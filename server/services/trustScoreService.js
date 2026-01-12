import prisma from "../db/prisma.js";

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

export async function computeTrustScore({ userId }) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			role: true,
			verified: true,
			createdAt: true,
		},
	});
	if (!user) return null;

	const now = Date.now();
	const ageDays = Math.max(0, Math.floor((now - new Date(user.createdAt).getTime()) / (24 * 60 * 60 * 1000)));

	// Activity signals
	const [deliveredAsBuyer, cancelledAsBuyer, deliveredAsFarmer, cancelledAsFarmer, avgRatingAgg] =
		await Promise.all([
			prisma.order.count({ where: { buyerId: userId, status: "DELIVERED" } }),
			prisma.order.count({ where: { buyerId: userId, status: "CANCELLED" } }),
			prisma.order.count({ where: { farmerId: userId, status: "DELIVERED" } }),
			prisma.order.count({ where: { farmerId: userId, status: "CANCELLED" } }),
			prisma.review.aggregate({
				where: { product: { farmerId: userId } },
				_avg: { rating: true },
			}),
		]);

	const avgRating = Number(avgRatingAgg?._avg?.rating || 0);

	let score = 40;
	const reasons = [];

	if (user.verified) {
		score += 20;
		reasons.push("Verified account");
	} else {
		reasons.push("Not yet verified");
	}

	// Account age: up to +10
	const ageBonus = clamp(Math.floor(ageDays / 30), 0, 10);
	if (ageBonus > 0) reasons.push(`Account age +${ageBonus}`);
	score += ageBonus;

	// Buyer reliability: deliveries vs cancellations
	if (user.role === "BUYER") {
		const good = Math.min(20, deliveredAsBuyer * 2);
		const bad = Math.min(25, cancelledAsBuyer * 5);
		score += good;
		score -= bad;
		reasons.push(`Delivered orders: ${deliveredAsBuyer}`);
		if (cancelledAsBuyer > 0) reasons.push(`Cancellations: ${cancelledAsBuyer}`);
	}

	// Farmer reliability: deliveries + ratings, penalize cancellations
	if (user.role === "FARMER") {
		const good = Math.min(20, deliveredAsFarmer * 2);
		const bad = Math.min(25, cancelledAsFarmer * 5);
		score += good;
		score -= bad;
		if (avgRating > 0) {
			const rBonus = clamp(Math.round(avgRating * 4), 0, 20); // 5★ -> 20
			score += rBonus;
			reasons.push(`Avg rating: ${avgRating.toFixed(1)}★`);
		}
		reasons.push(`Delivered sales: ${deliveredAsFarmer}`);
		if (cancelledAsFarmer > 0) reasons.push(`Cancelled sales: ${cancelledAsFarmer}`);
	}

	score = clamp(Math.round(score), 0, 100);

	let band = "low";
	if (score >= 75) band = "high";
	else if (score >= 50) band = "medium";

	return {
		userId: user.id,
		role: user.role,
		score,
		band,
		reasons: reasons.slice(0, 6),
	};
}

