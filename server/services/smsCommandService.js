import prisma from "../db/prisma.js";
import { verifyDeliveryProof } from "./deliveryProofService.js";

/**
 * In-app text command handler for DAFIS.
 * Simulates USSD/SMS commands within the app.
 * Returns plain-text responses (no TwiML).
 */

function help() {
	return [
		"DAFIS commands:",
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
	const fromId = String(from || "").trim();
	const msg = String(body || "").trim();
	if (!msg) return { response: help() };

	const user = await prisma.user.findFirst({
		where: {
			OR: [
				{ phone: fromId },
				{ id: fromId },
			],
		},
		select: { id: true, role: true, verified: true, name: true },
	});

	if (!user) {
		return { response: "Your phone is not registered. Please login to the app and set your phone number." };
	}

	const parts = msg.split(/\s+/);
	const cmd = (parts[0] || "").toUpperCase();

	if (cmd === "HELP") return { response: help() };

	if (cmd === "STATUS") {
		const last8 = parts[1] || "";
		const order = await findOrderByLast8ForUser({ last8, userId: user.id });
		if (!order) return { response: "Order not found. Use STATUS <order_last8>." };
		return { response: `Order ${order.id.slice(-8)} status: ${order.status}` };
	}

	if (cmd === "DELIVER") {
		const last8 = parts[1] || "";
		const code = parts[2] || "";
		const order = await findOrderByLast8ForUser({ last8, userId: user.id });
		if (!order) return { response: "Order not found." };

		// Buyer confirms delivery
		if (order.buyerId !== user.id) {
			return { response: "Only the buyer can confirm delivery." };
		}

		const result = await verifyDeliveryProof({
			orderId: order.id,
			codeOrToken: code,
			confirmedByUserId: user.id,
		});
		if (!result.ok) return { response: `Delivery failed: ${result.error}` };
		return { response: `Delivery confirmed for order ${order.id.slice(-8)}. Thank you.` };
	}

	return { response: help() };
}
