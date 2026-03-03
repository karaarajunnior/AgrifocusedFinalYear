import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../db/prisma.js";

const router = express.Router();

// GET /analytics/market-intelligence - Suggest best markets and list trends
router.get("/market-intelligence", authenticateToken, async (req, res) => {
	try {
		const { region, commodity } = req.query;

		const where = {};
		if (region) where.region = region;
		if (commodity) where.commodity = commodity;

		const prices = await prisma.marketPrice.findMany({
			where,
			orderBy: { timestamp: "desc" },
			take: 50
		});

		// Grouping logic to suggest "Best"
		// In a real app, this would use a more complex algorithm
		const grouped = prices.reduce((acc, curr) => {
			const key = `${curr.commodity}-${curr.region}`;
			if (!acc[key]) acc[key] = { commodity: curr.commodity, region: curr.region, types: {} };
			acc[key].types[curr.marketType] = curr.pricePerKg;
			return acc;
		}, {});

		const summaries = Object.values(grouped).map(item => {
			const exportPrice = item.types["EXPORT"] || 0;
			const regionalPrice = item.types["REGIONAL"] || 0;
			const localPrice = item.types["LOCAL"] || 0;

			let suggestion = "Local Market";
			let bestPrice = localPrice;

			if (exportPrice > regionalPrice && exportPrice > localPrice) {
				suggestion = "International Export";
				bestPrice = exportPrice;
			} else if (regionalPrice > localPrice) {
				suggestion = "DAFIS Marketplace";
				bestPrice = regionalPrice;
			}

			return {
				...item,
				bestMarket: suggestion,
				bestPrice,
				potentialGain: bestPrice - localPrice
			};
		});

		res.json({ summaries, raw: prices });
	} catch (error) {
		console.error("Market intelligence error:", error);
		res.status(500).json({ error: "Failed to fetch market intelligence" });
	}
});

// GET /analytics/profit-proof - Mathematical comparison logic
router.get("/profit-proof", authenticateToken, async (req, res) => {
	try {
		const { quantityKg = 100, commodity = 'Robusta Coffee', region = 'Central' } = req.query;
		const qty = parseFloat(quantityKg);

		const prices = await prisma.marketPrice.findMany({
			where: { commodity, region },
			orderBy: { timestamp: "desc" },
			take: 3 // Latest LOCAL, REGIONAL, EXPORT
		});

		const local = prices.find(p => p.marketType === 'LOCAL')?.pricePerKg || 3500;
		const direct = prices.find(p => p.marketType === 'REGIONAL')?.pricePerKg || 5000;
		const exportPrice = prices.find(p => p.marketType === 'EXPORT')?.pricePerKg || 7500;

		const results = {
			commodity,
			region,
			quantity: qty,
			scenarios: [
				{
					name: "Traditional Middleman",
					pricePerKg: local,
					totalRevenue: local * qty,
					lossComparedToDirect: (direct - local) * qty,
					lossPercentage: ((direct - local) / local) * 100
				},
				{
					name: "DAFIS Marketplace",
					pricePerKg: direct,
					totalRevenue: direct * qty,
					gainOverMiddleman: (direct - local) * qty
				},
				{
					name: "Direct Export",
					pricePerKg: exportPrice,
					totalRevenue: exportPrice * qty,
					gainOverMiddleman: (exportPrice - local) * qty
				}
			],
			mathProof: `Selling ${qty}kg directly on DAFIS earns you UGX ${(direct - local) * qty} more than a middleman. Exporting earns you UGX ${(exportPrice - local) * qty} more.`
		};

		res.json(results);
	} catch (error) {
		console.error("Profit proof error:", error);
		res.status(500).json({ error: "Failed to calculate profit proof" });
	}
});

export default router;
