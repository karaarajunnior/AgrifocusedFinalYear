import express from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import {
	initiateCollection,
	normalizeUgMsisdn,
	verifyWebhook,
	manualComplete,
	registerWebhookHandler,
} from "../services/payments/mobileMoneySimService.js";
import blockchainService from "../services/blockchainService.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "../services/pushService.js";
import { notifyUser } from "../services/smsWhatsappService.js";
import { postPaymentCompleted } from "../services/ledgerService.js";
import { writeAuditLog } from "../services/auditLogService.js";
import prisma from "../db/prisma.js";

const router = express.Router();

// Wire the simulator's auto-complete callback to the same logic as the webhook
registerWebhookHandler(async (payload) => {
	try {
		const providerReference =
			payload?.transaction?.id || payload?.reference || null;
		const status = (payload?.transaction?.status || "").toUpperCase();
		const mapped = status.includes("SUCCESS") || status === "COMPLETED"
			? "COMPLETED"
			: status.includes("FAIL") || status.includes("REJECT")
				? "FAILED"
				: "PENDING";

		if (!providerReference) return;

		const tx = await prisma.transaction.findFirst({
			where: {
				provider: "mobile_money",
				providerReference: String(providerReference),
			},
			include: { order: true },
		});

		if (!tx) return;
		if (tx.status === mapped) return;

		const updated = await prisma.transaction.update({
			where: { id: tx.id },
			data: {
				status: mapped,
				providerRaw: JSON.stringify(payload),
			},
		});

		// Emit realtime notification to both parties
		const paymentNotify = {
			type: "payment",
			orderId: tx.orderId,
			status: mapped,
			provider: "mobile_money",
			timestamp: new Date().toISOString(),
		};
		emitToUser(tx.order.buyerId, "notify", paymentNotify);
		emitToUser(tx.order.farmerId, "notify", paymentNotify);

		// Push notifications
		await sendPushToUser(tx.order.buyerId, {
			notification: {
				title: "Payment update",
				body: `Your Mobile Money payment is ${mapped}`,
			},
			data: {
				type: "payment",
				orderId: tx.orderId,
				status: mapped,
				provider: "mobile_money",
			},
		});
		await sendPushToUser(tx.order.farmerId, {
			notification: {
				title: "Payment update",
				body: `Order payment is ${mapped}`,
			},
			data: {
				type: "payment",
				orderId: tx.orderId,
				status: mapped,
				provider: "mobile_money",
			},
		});

		// In-app + email notification
		await notifyUser({
			userId: tx.order.buyerId,
			type: "payment",
			smsBody: `DAFIS: Payment ${mapped} for order ${tx.orderId.slice(-8)} (Mobile Money).`,
			whatsappBody: `DAFIS: Payment *${mapped}* for order *${tx.orderId.slice(-8)}* (Mobile Money).`,
		});
		await notifyUser({
			userId: tx.order.farmerId,
			type: "payment",
			smsBody: `DAFIS: Buyer payment ${mapped} for order ${tx.orderId.slice(-8)}.`,
			whatsappBody: `DAFIS: Buyer payment *${mapped}* for order *${tx.orderId.slice(-8)}*.`,
		});

		// Analytics
		await prisma.userAnalytics.createMany({
			data: [
				{
					userId: tx.order.buyerId,
					event: mapped === "COMPLETED" ? "payment_completed" : mapped === "FAILED" ? "payment_failed" : "payment_pending",
					metadata: JSON.stringify({
						orderId: tx.orderId,
						provider: "mobile_money",
						providerReference,
						status: mapped,
					}),
				},
				{
					userId: tx.order.farmerId,
					event: mapped === "COMPLETED" ? "payment_completed" : mapped === "FAILED" ? "payment_failed" : "payment_pending",
					metadata: JSON.stringify({
						orderId: tx.orderId,
						provider: "mobile_money",
						providerReference,
						status: mapped,
					}),
				},
			],
		});

		// Ledger posting for completed payment
		if (mapped === "COMPLETED") {
			try {
				// PHASE 3: Automated Input-Debt Settlement
				// Find any active input credits for this farmer
				const activeCredits = await prisma.inputCredit.findMany({
					where: {
						farmerId: tx.order.farmerId,
						status: { in: ['APPROVED', 'ACTIVE'] }
					},
					orderBy: { createdAt: 'asc' }
				});

				let totalDeducted = 0;
				for (const credit of activeCredits) {
					// Maximum 50% deduction to ensure farmer receives some cash
					const maxDeduction = tx.amount * 0.5;
					if (totalDeducted + credit.totalAmount <= maxDeduction) {
						await prisma.inputCredit.update({
							where: { id: credit.id },
							data: { status: 'SETTLED' }
						});
						totalDeducted += credit.totalAmount;
					}
				}

				if (totalDeducted > 0) {
					console.log(`[DAFIS ECOSYSTEM] Automatically settled UGX ${totalDeducted} input debt for farmer ${tx.order.farmerId}`);
					// In a real system, we'd adjust the ledger entry to split the payment
				}

				await postPaymentCompleted({ transactionId: tx.id });
			} catch (e) {
				console.error("Ledger posting or debt settlement failed:", e);
			}
		}

		// Blockchain finalization
		if (mapped === "COMPLETED" && !updated.blockHash) {
			try {
				const order = await prisma.order.findUnique({
					where: { id: tx.orderId },
					include: { buyer: true, farmer: true },
				});
				if (order) {
					const chain = await blockchainService.recordTransaction({
						orderId: order.id,
						productId: order.productId,
						buyerAddress: order.buyerId,
						farmerAddress: order.farmerId,
						quantity: order.quantity,
						totalPrice: order.totalPrice,
					});

					await prisma.transaction.update({
						where: { id: updated.id },
						data: {
							blockHash: chain.transactionHash,
							blockNumber: chain.blockNumber,
							gasUsed: chain.gasUsed,
						},
					});

					// Auto-fulfill if configured
					const autoGlobal = String(process.env.AUTO_FULFILL_ON_PAYMENT || "false").toLowerCase() === "true";
					const autoFarmer = Boolean(order.farmer?.autoFulfillOnPayment);

					if (order.status === "CONFIRMED" && (autoGlobal || autoFarmer)) {
						const updatedOrder = await prisma.order.update({
							where: { id: order.id },
							data: { status: "IN_TRANSIT" },
						});

						const orderNotify = {
							type: "order",
							orderId: order.id,
							status: "IN_TRANSIT",
							reason: "auto_fulfill_on_payment",
							timestamp: new Date().toISOString(),
						};
						emitToUser(order.buyerId, "notify", orderNotify);
						emitToUser(order.farmerId, "notify", orderNotify);

						await sendPushToUser(order.buyerId, {
							notification: { title: "Order update", body: "Your order is now IN TRANSIT" },
							data: { type: "order", orderId: order.id, status: updatedOrder.status, reason: "auto_fulfill_on_payment" },
						});
						await sendPushToUser(order.farmerId, {
							notification: { title: "Order update", body: "Order marked IN TRANSIT after payment" },
							data: { type: "order", orderId: order.id, status: updatedOrder.status, reason: "auto_fulfill_on_payment" },
						});

						await notifyUser({
							userId: order.buyerId,
							type: "order",
							smsBody: `DAFIS: Your order ${order.id.slice(-8)} is now IN TRANSIT.`,
							whatsappBody: `DAFIS: Your order *${order.id.slice(-8)}* is now *IN TRANSIT*.`,
						});
						await notifyUser({
							userId: order.farmerId,
							type: "order",
							smsBody: `DAFIS: Order ${order.id.slice(-8)} set to IN TRANSIT.`,
							whatsappBody: `DAFIS: Order *${order.id.slice(-8)}* set to *IN TRANSIT*.`,
						});

						await prisma.userAnalytics.createMany({
							data: [
								{
									userId: order.buyerId,
									event: "order_auto_in_transit",
									metadata: JSON.stringify({ orderId: order.id, status: updatedOrder.status, provider: "mobile_money" }),
								},
								{
									userId: order.farmerId,
									event: "order_auto_in_transit",
									metadata: JSON.stringify({ orderId: order.id, status: updatedOrder.status, provider: "mobile_money" }),
								},
							],
						});
					}
				}
			} catch (e) {
				console.error("Webhook blockchain finalize failed:", e);
			}
		}
	} catch (error) {
		console.error("Simulated webhook handler error:", error);
	}
});

// Initialize payment for an order (BUYER)
router.post(
	"/initialize",
	authenticateToken,
	requireRole(["BUYER"]),
	requireVerified,
	[
		body("orderId").isString(),
		body("msisdn").optional().isString(),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { orderId, msisdn } = req.body;
			const order = await prisma.order.findUnique({
				where: { id: orderId },
				include: { buyer: true, product: true },
			});

			if (!order) return res.status(404).json({ error: "Order not found" });
			if (order.buyerId !== req.user.id) {
				return res.status(403).json({ error: "Not authorized" });
			}
			if (order.status !== "CONFIRMED") {
				return res.status(400).json({ error: "Order must be CONFIRMED to pay" });
			}

			const phone = msisdn || order.buyer.phone;
			if (!phone) {
				return res.status(400).json({ error: "Buyer phone number required" });
			}

			const payerMsisdn = normalizeUgMsisdn(phone);
			const amountUgx = order.totalPrice;

			const tx = await prisma.transaction.upsert({
				where: { orderId },
				update: {
					amount: amountUgx,
					status: "PENDING",
					provider: "mobile_money",
					currency: "UGX",
					payerMsisdn,
				},
				create: {
					orderId,
					productId: order.productId,
					amount: amountUgx,
					status: "PENDING",
					provider: "mobile_money",
					currency: "UGX",
					payerMsisdn,
				},
			});

			const result = await initiateCollection({
				amountUgx,
				msisdn: payerMsisdn,
				orderId,
			});

			const updated = await prisma.transaction.update({
				where: { id: tx.id },
				data: {
					providerReference: result.providerReference,
					providerRaw: JSON.stringify(result.raw),
				},
			});

			await prisma.userAnalytics.create({
				data: {
					userId: req.user.id,
					event: "payment_initiated",
					metadata: JSON.stringify({
						orderId,
						provider: "mobile_money",
						providerReference: result.providerReference,
						amountUgx,
					}),
				},
			});

			res.json({
				message:
					"Mobile Money payment initiated. Payment will be processed shortly.",
				transaction: updated,
				provider: {
					name: "mobile_money",
					reference: result.providerReference,
				},
			});
		} catch (error) {
			console.error("Initialize payment error:", error);
			res.status(500).json({ error: "Failed to initialize payment" });
		}
	},
);

// Webhook endpoint (kept for compatibility; simulation calls handler internally)
router.post("/webhook", async (req, res) => {
	try {
		if (!verifyWebhook(req)) {
			return res.status(401).json({ error: "Invalid signature" });
		}
		res.json({ ok: true });
	} catch (error) {
		console.error("Webhook error:", error);
		res.status(500).json({ error: "Webhook processing failed" });
	}
});

// Admin: manually complete a pending payment for presentation
router.post(
	"/simulate-complete/:orderId",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const tx = await prisma.transaction.findFirst({
				where: { orderId: req.params.orderId, status: "PENDING" },
			});
			if (!tx) return res.status(404).json({ error: "No pending payment found for this order" });

			// Update status directly
			await prisma.transaction.update({
				where: { id: tx.id },
				data: { status: "COMPLETED" },
			});

			// Trigger ledger + blockchain via the registered handler
			if (tx.providerReference) {
				manualComplete(tx.providerReference);
			}

			res.json({ ok: true, message: "Payment marked as completed" });
		} catch (error) {
			console.error("Simulate complete error:", error);
			res.status(500).json({ error: "Failed to simulate payment completion" });
		}
	},
);

// Get payment status by order
router.get(
	"/status/:orderId",
	authenticateToken,
	[param("orderId").isString()],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const order = await prisma.order.findUnique({
				where: { id: req.params.orderId },
				include: { transaction: true },
			});
			if (!order) return res.status(404).json({ error: "Order not found" });

			const hasAccess =
				order.buyerId === req.user.id ||
				order.farmerId === req.user.id ||
				req.user.role === "ADMIN";
			if (!hasAccess) return res.status(403).json({ error: "Access denied" });

			res.json({ transaction: order.transaction || null });
		} catch (error) {
			console.error("Payment status error:", error);
			res.status(500).json({ error: "Failed to fetch status" });
		}
	},
);

export default router;
