import prisma from "../db/prisma.js";

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function score01(n) {
	return clamp(n, 0, 1);
}

// Simple market segmentation rules (configurable later)
function matchMarket({ market, userCountry, productCountry }) {
	if (!market) return true;
	const m = String(market).toLowerCase();
	if (m === "local") {
		// same country or unknown
		if (!userCountry || !productCountry) return true;
		return userCountry.toLowerCase() === productCountry.toLowerCase();
	}
	if (m === "international") {
		if (!userCountry || !productCountry) return false;
		return userCountry.toLowerCase() !== productCountry.toLowerCase();
	}
	if (m === "urban") {
		// Heuristic: location contains common city markers
		return true;
	}
	return true;
}

export async function getTopBuyers({ market = "local", country = "Uganda", limit = 10 }) {
	const buyers = await prisma.user.findMany({
		where: { role: "BUYER", verified: true },
		select: {
			id: true,
			name: true,
			location: true,
			country: true,
			orders: {
				where: { status: "DELIVERED" },
				select: { totalPrice: true, createdAt: true, product: { select: { country: true } } },
			},
		},
	});

	const scored = buyers
		.map((b) => {
			const delivered = b.orders.filter((o) =>
				matchMarket({ market, userCountry: b.country || country, productCountry: o.product.country || country }),
			);
			const count = delivered.length;
			const spend = delivered.reduce((s, o) => s + (o.totalPrice || 0), 0);

			// Score components (0..1)
			const activity = score01(count / 20);
			const volume = score01(spend / 5_000_000); // UGX scale placeholder
			const recency =
				count === 0
					? 0
					: score01(
							1 -
								(Math.min(
									90,
									(Date.now() - new Date(delivered[0].createdAt).getTime()) /
										(24 * 60 * 60 * 1000),
								) /
									90),
						);

			const score = activity * 0.45 + volume * 0.45 + recency * 0.1;

			return {
				id: b.id,
				name: b.name,
				location: b.location,
				country: b.country,
				metrics: { deliveredOrders: count, deliveredSpend: spend },
				score: Math.round(score * 1000) / 1000,
			};
		})
		.sort((a, c) => c.score - a.score)
		.slice(0, limit);

	return scored;
}

export async function getTopFarmers({ market = "local", country = "Uganda", limit = 10 }) {
	const farmers = await prisma.user.findMany({
		where: { role: "FARMER", verified: true },
		select: {
			id: true,
			name: true,
			location: true,
			country: true,
			products: { select: { id: true, country: true } },
			sales: {
				where: { status: "DELIVERED" },
				select: { totalPrice: true, createdAt: true, product: { select: { country: true } } },
			},
		},
	});

	const scored = farmers
		.map((f) => {
			const delivered = f.sales.filter((o) =>
				matchMarket({ market, userCountry: f.country || country, productCountry: o.product.country || country }),
			);
			const count = delivered.length;
			const revenue = delivered.reduce((s, o) => s + (o.totalPrice || 0), 0);

			const listings = f.products.filter((p) =>
				matchMarket({ market, userCountry: f.country || country, productCountry: p.country || country }),
			).length;

			const reliability = score01(1); // placeholder until cancellation/late metrics exist
			const volume = score01(revenue / 10_000_000);
			const activity = score01(count / 20);
			const supply = score01(listings / 20);

			const score = reliability * 0.3 + volume * 0.35 + activity * 0.2 + supply * 0.15;

			return {
				id: f.id,
				name: f.name,
				location: f.location,
				country: f.country,
				metrics: { deliveredSales: count, deliveredRevenue: revenue, activeListings: listings },
				score: Math.round(score * 1000) / 1000,
			};
		})
		.sort((a, c) => c.score - a.score)
		.slice(0, limit);

	return scored;
}

