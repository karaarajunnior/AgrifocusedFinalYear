import { validationResult } from "express-validator";
import { createDeliveryProof, verifyDeliveryProof } from "../services/deliveryProofService.js";
import prisma from "../db/prisma.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "../services/pushService.js";
import { notifyUser } from "../services/smsWhatsappService.js";
import { writeAuditLog } from "../services/auditLogService.js";

export async function generateProof(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { orderId, gpsLocation } = req.body;

		const order = await prisma.order.findUnique({
			where: { id: orderId },
			select: { id: true, buyerId: true, farmerId: true },
		});
		if (!order) return res.status(404).json({ error: "Order not found" });

		const hasAccess =
			order.buyerId === req.user.id || order.farmerId === req.user.id || req.user.role === "ADMIN";
		if (!hasAccess) return res.status(403).json({ error: "Access denied" });

		const created = await createDeliveryProof({
			orderId,
			generatedByUserId: req.user.id,
			gpsLocation,
		});
		if (!created.ok) return res.status(400).json({ error: created.error });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "delivery_proof_generate",
			targetType: "order",
			targetId: orderId,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});

		// Notify both parties (do not leak code via SMS; only say "open app")
		const notify = { type: "delivery_proof", orderId, status: "generated" };
		emitToUser(order.buyerId, "notify", notify);
		emitToUser(order.farmerId, "notify", notify);
		await sendPushToUser(order.buyerId, {
			notification: { title: "Delivery confirmation", body: "A delivery code is ready. Open the app to confirm." },
			data: { type: "delivery_proof", orderId },
		});
		await sendPushToUser(order.farmerId, {
			notification: { title: "Delivery code generated", body: "Open the app to view the delivery code/QR." },
			data: { type: "delivery_proof", orderId },
		});
		await notifyUser({
			userId: order.buyerId,
			type: "order",
			smsBody: `AgriConnect: Delivery confirmation ready for order ${orderId.slice(-8)}. Open the app to confirm.`,
			whatsappBody: `AgriConnect: Delivery confirmation ready for order *${orderId.slice(-8)}*. Open the app to confirm.`,
		});

		res.json({ proof: created.proof });
	} catch (error) {
		console.error("Generate delivery proof error:", error);
		res.status(500).json({ error: "Failed to generate delivery proof" });
	}
}

export async function confirmProof(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { orderId, code, gpsLocation } = req.body;

		const order = await prisma.order.findUnique({
			where: { id: orderId },
			select: { id: true, buyerId: true, farmerId: true },
		});
		if (!order) return res.status(404).json({ error: "Order not found" });

		// Buyer confirms delivery (admin allowed for demos/support)
		const allowed = order.buyerId === req.user.id || req.user.role === "ADMIN";
		if (!allowed) return res.status(403).json({ error: "Only buyer can confirm delivery" });

		const verified = await verifyDeliveryProof({
			orderId,
			codeOrToken: code,
			confirmedByUserId: req.user.id,
			gpsLocation,
		});
		if (!verified.ok) return res.status(400).json({ error: verified.error });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "delivery_proof_confirm",
			targetType: "order",
			targetId: orderId,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});

		const notify = { type: "delivery_proof", orderId, status: "confirmed" };
		emitToUser(order.buyerId, "notify", notify);
		emitToUser(order.farmerId, "notify", notify);

		await notifyUser({
			userId: order.farmerId,
			type: "order",
			smsBody: `AgriConnect: Delivery confirmed for order ${orderId.slice(-8)}.`,
			whatsappBody: `AgriConnect: Delivery confirmed for order *${orderId.slice(-8)}*.`,
		});

		res.json({ ok: true, order: verified.order });
	} catch (error) {
		console.error("Confirm delivery proof error:", error);
		res.status(500).json({ error: "Failed to confirm delivery" });
	}
}

export async function getProof(req, res) {
	try {
		const orderId = String(req.params.orderId || "");
		if (!orderId) return res.status(400).json({ error: "orderId required" });

		const order = await prisma.order.findUnique({
			where: { id: orderId },
			select: { id: true, buyerId: true, farmerId: true },
		});
		if (!order) return res.status(404).json({ error: "Order not found" });

		const hasAccess =
			order.buyerId === req.user.id || order.farmerId === req.user.id || req.user.role === "ADMIN";
		if (!hasAccess) return res.status(403).json({ error: "Access denied" });

		const proof = await prisma.deliveryProof.findUnique({
			where: { orderId },
		});

		res.json({ proof: proof || null });
	} catch (error) {
		console.error("Get delivery proof error:", error);
		res.status(500).json({ error: "Failed to fetch delivery proof" });
	}
}

