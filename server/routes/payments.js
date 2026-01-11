import express from "express";
import { body, param, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import {
	initiateAirtelUgCollection,
	normalizeUgMsisdn,
	verifyAirtelWebhook,
} from "../services/payments/airtelUgService.js";
import blockchainService from "../services/blockchainService.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "../services/pushService.js";
import { notifyUser } from "../services/smsWhatsappService.js";

const prisma = new PrismaClient();
const router = express.Router();

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
					provider: "airtel_ug",
					currency: "UGX",
					payerMsisdn,
				},
				create: {
					orderId,
					productId: order.productId,
					amount: amountUgx,
					status: "PENDING",
					provider: "airtel_ug",
					currency: "UGX",
					payerMsisdn,
				},
			});

			const airtel = await initiateAirtelUgCollection({
				amountUgx,
				msisdn: payerMsisdn,
				orderId,
			});

			const updated = await prisma.transaction.update({
				where: { id: tx.id },
				data: {
					providerReference: airtel.providerReference,
					providerRaw: JSON.stringify(airtel.raw),
				},
			});

			await prisma.userAnalytics.create({
				data: {
					userId: req.user.id,
					event: "payment_initiated",
					metadata: JSON.stringify({
						orderId,
						provider: "airtel_ug",
						providerReference: airtel.providerReference,
						amountUgx,
					}),
				},
			});

			res.json({
				message:
					"Airtel Money payment initiated. Customer should approve on phone/USSD.",
				transaction: updated,
				provider: {
					name: "airtel_ug",
					reference: airtel.providerReference,
				},
			});
		} catch (error) {
			console.error("Initialize payment error:", error);
			res.status(500).json({ error: "Failed to initialize payment" });
		}
	},
);

// Airtel callback/webhook (provider will call this). Keep public.
router.post("/airtel/webhook", async (req, res) => {
	try {
		if (!verifyAirtelWebhook(req)) {
			return res.status(401).json({ error: "Invalid signature" });
		}

		// Best-effort extraction: providers vary in payload shape.
		const providerReference =
			req.body?.transaction?.id ||
			req.body?.data?.transaction?.id ||
			req.body?.reference ||
			req.body?.transactionId ||
			null;

		const status =
			(req.body?.transaction?.status ||
				req.body?.data?.transaction?.status ||
				req.body?.status ||
				"") + "";

		const normalizedStatus = status.toUpperCase();
		const mapped =
			normalizedStatus.includes("SUCCESS") || normalizedStatus === "COMPLETED"
				? "COMPLETED"
				: normalizedStatus.includes("FAIL") || normalizedStatus.includes("REJECT")
					? "FAILED"
					: "PENDING";

		if (providerReference) {
			const tx = await prisma.transaction.findFirst({
				where: {
					provider: "airtel_ug",
					providerReference: String(providerReference),
				},
				include: { order: true },
			});

			if (tx) {
				const updated = await prisma.transaction.update({
					where: { id: tx.id },
					data: {
						status: mapped,
						providerRaw: JSON.stringify(req.body),
					},
				});

				// Automation: emit realtime notification to both parties
				const paymentNotify = {
					type: "payment",
					orderId: tx.orderId,
					status: mapped,
					provider: "airtel_ug",
					timestamp: new Date().toISOString(),
				};
				emitToUser(tx.order.buyerId, "notify", paymentNotify);
				emitToUser(tx.order.farmerId, "notify", paymentNotify);

				// Push notifications (mobile)
				await sendPushToUser(tx.order.buyerId, {
					notification: {
						title: "Payment update",
						body: `Your Airtel Money payment is ${mapped}`,
					},
					data: {
						type: "payment",
						orderId: tx.orderId,
						status: mapped,
						provider: "airtel_ug",
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
						provider: "airtel_ug",
					},
				});

				// SMS + WhatsApp fallback/primary
				await notifyUser({
					userId: tx.order.buyerId,
					smsBody: `AgriConnect: Payment ${mapped} for order ${tx.orderId.slice(-8)} (Airtel Money).`,
					whatsappBody: `AgriConnect: Payment *${mapped}* for order *${tx.orderId.slice(-8)}* (Airtel Money).`,
				});
				await notifyUser({
					userId: tx.order.farmerId,
					smsBody: `AgriConnect: Buyer payment ${mapped} for order ${tx.orderId.slice(-8)}.`,
					whatsappBody: `AgriConnect: Buyer payment *${mapped}* for order *${tx.orderId.slice(-8)}*.`,
				});

				// Log analytics (buyer + farmer)
				await prisma.userAnalytics.createMany({
					data: [
						{
							userId: tx.order.buyerId,
							event:
								mapped === "COMPLETED"
									? "payment_completed"
									: mapped === "FAILED"
										? "payment_failed"
										: "payment_pending",
							metadata: JSON.stringify({
								orderId: tx.orderId,
								provider: "airtel_ug",
								providerReference,
								status: mapped,
							}),
						},
						{
							userId: tx.order.farmerId,
							event:
								mapped === "COMPLETED"
									? "payment_completed"
									: mapped === "FAILED"
										? "payment_failed"
										: "payment_pending",
							metadata: JSON.stringify({
								orderId: tx.orderId,
								provider: "airtel_ug",
								providerReference,
								status: mapped,
							}),
						},
					],
				});

				// Automation: if payment completed, ensure blockchain tx exists (if not already recorded)
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

							// Automation: optionally progress order to IN_TRANSIT after successful payment
							const autoGlobal =
								String(process.env.AUTO_FULFILL_ON_PAYMENT || "false").toLowerCase() ===
								"true";
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
									notification: {
										title: "Order update",
										body: "Your order is now IN TRANSIT",
									},
									data: {
										type: "order",
										orderId: order.id,
										status: updatedOrder.status,
										reason: "auto_fulfill_on_payment",
									},
								});
								await sendPushToUser(order.farmerId, {
									notification: {
										title: "Order update",
										body: "Auto-fulfillment marked the order IN TRANSIT",
									},
									data: {
										type: "order",
										orderId: order.id,
										status: updatedOrder.status,
										reason: "auto_fulfill_on_payment",
									},
								});

								await notifyUser({
									userId: order.buyerId,
									smsBody: `AgriConnect: Your order ${order.id.slice(-8)} is now IN TRANSIT.`,
									whatsappBody: `AgriConnect: Your order *${order.id.slice(-8)}* is now *IN TRANSIT*.`,
								});
								await notifyUser({
									userId: order.farmerId,
									smsBody: `AgriConnect: Order ${order.id.slice(-8)} set to IN TRANSIT (auto).`,
									whatsappBody: `AgriConnect: Order *${order.id.slice(-8)}* set to *IN TRANSIT* (auto).`,
								});

								await prisma.userAnalytics.createMany({
									data: [
										{
											userId: order.buyerId,
											event: "order_auto_in_transit",
											metadata: JSON.stringify({
												orderId: order.id,
												status: updatedOrder.status,
												provider: "airtel_ug",
											}),
										},
										{
											userId: order.farmerId,
											event: "order_auto_in_transit",
											metadata: JSON.stringify({
												orderId: order.id,
												status: updatedOrder.status,
												provider: "airtel_ug",
											}),
										},
									],
								});
							}
						}
					} catch (e) {
						console.error("Webhook blockchain finalize failed:", e);
					}
				}
			}
		}

		res.json({ ok: true });
	} catch (error) {
		console.error("Airtel webhook error:", error);
		res.status(500).json({ error: "Webhook processing failed" });
	}
});

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

