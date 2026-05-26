import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { computeCreditScore } from "../services/creditScoreService.js";
import aiService from "../services/aiService.js";

const router = express.Router();

// GET /analytics/dashboard - Admin Dashboard Stats
router.get("/dashboard", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
	try {
		const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const [
			totalUsers,
			unverifiedUsers,
			totalProducts,
			totalOrders,
			totalTransactions,
			failedTransactions,
			pendingOrders,
			revenueData,
			eventsLast24h,
			productCategories,
			orderStats,
			topFarmers,
			recentActivity,
			recentTransactions
		] = await Promise.all([
			prisma.user.count(),
			prisma.user.count({ where: { verified: false } }),
			prisma.product.count(),
			prisma.order.count(),
			prisma.transaction.count(),
			prisma.transaction.count({ where: { status: "FAILED" } }),
			prisma.order.count({ where: { status: "PENDING" } }),
			prisma.transaction.aggregate({
				where: { status: "COMPLETED" },
				_sum: { amount: true }
			}),
			prisma.auditLog.count({ where: { createdAt: { gte: since24h } } }),
			prisma.product.groupBy({
				by: ['category'],
				_count: { category: true }
			}),
			prisma.order.groupBy({
				by: ['status'],
				_count: { status: true }
			}),
			prisma.user.findMany({
				where: { role: "FARMER" },
				select: {
					id: true,
					name: true,
					location: true,
					sales: {
						where: { status: "DELIVERED" },
						select: { totalPrice: true }
					}
				},
				take: 10
			}),
			prisma.auditLog.findMany({
				take: 10,
				orderBy: { createdAt: 'desc' },
				include: { actor: { select: { name: true, role: true } } }
			}),
			prisma.transaction.findMany({
				take: 10,
				orderBy: { timestamp: 'desc' },
				include: {
					order: {
						select: {
							status: true,
							product: { select: { name: true, category: true } }
						}
					}
				}
			})
		]);

		// Process top farmers to match frontend interface
		const processedTopFarmers = topFarmers.map(farmer => {
			const totalRevenue = farmer.sales.reduce((sum, s) => sum + s.totalPrice, 0);
			return {
				id: farmer.id,
				name: farmer.name,
				location: farmer.location || 'N/A',
				totalRevenue,
				totalSales: farmer.sales.length
			};
		}).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);

		// Process recent activity
		const processedActivity = recentActivity.map(a => ({
			id: a.id,
			event: a.action,
			timestamp: a.createdAt,
			user: {
				name: a.actor?.name || 'System',
				role: a.actor?.role || 'SYSTEM'
			}
		}));

		res.json({
			overview: {
				totalUsers,
				unverifiedUsers,
				totalProducts,
				totalOrders,
				totalTransactions,
				failedTransactions,
				pendingOrders,
				totalRevenue: revenueData._sum.amount || 0
			},
			systemHealth: {
				eventsLast24h
			},
			userGrowth: [], // Placeholder for growth chart
			productCategories,
			orderStats,
			topFarmers: processedTopFarmers,
			recentActivity: processedActivity,
			recentTransactions
		});
	} catch (error) {
		console.error("Dashboard error:", error);
		res.status(500).json({ error: "Failed to fetch dashboard data" });
	}
});

// GET /analytics/farmer - Farmer Dashboard Stats
router.get("/farmer", authenticateToken, requireRole(["FARMER"]), async (req, res) => {
	try {
		const farmerId = req.user.id;

		const [
			totalProducts,
			salesStats,
			revenueData,
			ratingData
		] = await Promise.all([
			prisma.product.count({ where: { farmerId } }),
			prisma.order.count({
				where: {
					farmerId,
					status: { not: "CANCELLED" }
				}
			}),
			prisma.order.aggregate({
				where: {
					farmerId,
					status: "DELIVERED"
				},
				_sum: { totalPrice: true }
			}),
			prisma.review.aggregate({
				where: {
					product: { farmerId }
				},
				_avg: { rating: true }
			})
		]);

		res.json({
			overview: {
				totalProducts,
				totalSales: salesStats,
				totalRevenue: revenueData._sum.totalPrice || 0,
				averageRating: ratingData._avg.rating || 0
			},
			topProducts: [],
			recentOrders: []
		});
	} catch (error) {
		console.error("Farmer analytics error:", error);
		res.status(500).json({ error: "Failed to fetch farmer analytics" });
	}
});

// GET /analytics/credit-score - Farmer Financial Identity
router.get("/credit-score", authenticateToken, requireRole(["FARMER"]), async (req, res) => {
	try {
		const scoreData = await computeCreditScore(req.user.id);
		res.json(scoreData);
	} catch (error) {
		console.error("Credit score error:", error);
		res.status(500).json({ error: "Failed to fetch credit score" });
	}
});

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

// GET /analytics/market-prices - Real Regional Price Stats
router.get("/market-prices", authenticateToken, async (req, res) => {
	try {
		// Get latest price for each unique commodity
		const latestPrices = await prisma.marketPrice.findMany({
			distinct: ['commodity'],
			orderBy: { timestamp: 'desc' },
			select: {
				commodity: true,
				region: true,
				marketType: true,
				pricePerKg: true,
				currency: true,
				timestamp: true
			},
			take: 10
		});

		if (latestPrices.length === 0) {
			return res.json([
				{ item: "Coffee", price: 6500, currency: "UGX", region: "Uganda", marketType: "REGIONAL", trend: "stable", source: "benchmark" },
				{ item: "Maize", price: 1400, currency: "UGX", region: "Uganda", marketType: "REGIONAL", trend: "stable", source: "benchmark" },
				{ item: "Beans", price: 4200, currency: "UGX", region: "Uganda", marketType: "REGIONAL", trend: "stable", source: "benchmark" },
			]);
			const categories = ["COFFEE", "VEGETABLES", "FRUITS", "GRAINS", "PULSES"];
			const fallbackPrices = await Promise.all(
				categories.map(async (category) => {
					const signal = await aiService.getCurrentPriceSignal({ category });
					return {
						item: aiService.humanizeCategory(category),
						price: Math.round(signal.midpoint),
						trend: signal.fallback ? "baseline" : "stable",
						priceRange: signal.priceRange,
						source: signal.source,
					};
				}),
			);
			return res.json(fallbackPrices);
		}

		// Map to a format suitable for the dashboard
		const formatted = latestPrices.map(p => ({
			item: p.commodity,
			price: p.pricePerKg,
			currency: p.currency,
			region: p.region,
			marketType: p.marketType,
			timestamp: p.timestamp,
			trend: 'stable',
			source: 'market_prices'
		}));

		res.json(formatted);
	} catch (error) {
		console.error("Market prices error:", error);
		res.status(500).json({ error: "Failed to fetch market prices" });
	}
});

export default router;
