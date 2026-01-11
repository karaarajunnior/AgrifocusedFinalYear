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
			await prisma.transaction.updateMany({
				where: { provider: "airtel_ug", providerReference: String(providerReference) },
				data: {
					status: mapped,
					providerRaw: JSON.stringify(req.body),
				},
			});
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

