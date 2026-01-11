import prisma from "../db/prisma.js";
import { verifyDeliveryProof } from "./deliveryProofService.js";

function normalizeE164(phone) {
	return String(phone || "").trim();
}

function textResponse(message) {
	return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
		message,
	)}</Message></Response>`;
}

function escapeXml(s) {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function help() {
	return [
		"AgriConnect commands:",
		"HELP",
		"STATUS <order_last8>",
		"DELIVER <order_last8> <code>",
	].join("\n");
}

async function findOrderByLast8ForUser({ last8, userId }) {
	if (!last8 || last8.length < 4) return null;
	const orders = await prisma.order.findMany({
		where: {
			OR: [{ buyerId: userId }, { farmerId: userId }],
		},
		select: { id: true, buyerId: true, farmerId: true, status: true },
		orderBy: { createdAt: "desc" },
		take: 200,
	});
	return orders.find((o) => o.id.endsWith(last8)) || null;
}

export async function handleInboundSms({ from, body }) {
	const fromE164 = normalizeE164(from);
	const msg = String(body || "").trim();
	if (!msg) return { twiml: textResponse(help()) };

	const user = await prisma.user.findFirst({
		where: { phone: fromE164 },
		select: { id: true, role: true, verified: true, name: true },
	});

	if (!user) {
		return { twiml: textResponse("Your phone is not registered. Please login to the app and set your phone number.") };
	}

	const parts = msg.split(/\s+/);
	const cmd = (parts[0] || "").toUpperCase();

	if (cmd === "HELP") return { twiml: textResponse(help()) };

	if (cmd === "STATUS") {
		const last8 = parts[1] || "";
		const order = await findOrderByLast8ForUser({ last8, userId: user.id });
		if (!order) return { twiml: textResponse("Order not found. Use STATUS <order_last8>.") };
		return { twiml: textResponse(`Order ${order.id.slice(-8)} status: ${order.status}`) };
	}

	if (cmd === "DELIVER") {
		const last8 = parts[1] || "";
		const code = parts[2] || "";
		const order = await findOrderByLast8ForUser({ last8, userId: user.id });
		if (!order) return { twiml: textResponse("Order not found.") };

		// Buyer confirms delivery via SMS (simple rural fallback)
		if (order.buyerId !== user.id) {
			return { twiml: textResponse("Only the buyer can confirm delivery via SMS.") };
		}

		const result = await verifyDeliveryProof({
			orderId: order.id,
			codeOrToken: code,
			confirmedByUserId: user.id,
		});
		if (!result.ok) return { twiml: textResponse(`Delivery failed: ${result.error}`) };
		return { twiml: textResponse(`Delivery confirmed for order ${order.id.slice(-8)}. Thank you.`) };
	}

	return { twiml: textResponse(help()) };
}

