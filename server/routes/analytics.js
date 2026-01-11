import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// Admin dashboard analytics
router.get(
	"/dashboard",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const [
				totalUsers,
				unverifiedUsers,
				totalProducts,
				totalOrders,
				totalTransactions,
				failedTransactions,
				pendingOrders,
				eventsLast24h,
				revenueData,
				userGrowth,
				productCategories,
				orderStats,
				topFarmers,
				recentActivity,
				recentTransactions,
			] = await Promise.all([
				// Total counts
				prisma.user.count(),
				prisma.user.count({ where: { verified: false } }),
				prisma.product.count(),
				prisma.order.count(),
				prisma.transaction.count({ where: { status: "COMPLETED" } }),
				prisma.transaction.count({ where: { status: "FAILED" } }),
				prisma.order.count({ where: { status: "PENDING" } }),
				prisma.userAnalytics.count({
					where: {
						timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
					},
				}),

				// Revenue data (last 30 days)
				prisma.transaction.aggregate({
					where: {
						status: "COMPLETED",
						timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
					},
					_sum: { amount: true },
				}),

				// User growth (last 7 days)
				prisma.user.groupBy({
					by: ["createdAt"],
					where: {
						createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
					},
					_count: true,
				}),

				// Product categories distribution
				prisma.product.groupBy({
					by: ["category"],
					_count: { category: true },
					orderBy: { _count: { category: "desc" } },
				}),

				// Order status distribution
				prisma.order.groupBy({
					by: ["status"],
					_count: { status: true },
				}),

				// Top farmers by sales
				prisma.user.findMany({
					where: { role: "FARMER" },
					include: {
						sales: {
							where: { status: "DELIVERED" },
							select: { totalPrice: true },
						},
					},
					take: 5,
				}),

				// Recent activity
				prisma.userAnalytics.findMany({
					take: 10,
					orderBy: { timestamp: "desc" },
					include: {
						user: {
							select: { name: true, role: true },
						},
					},
				}),

				// Recent blockchain transactions
				prisma.transaction.findMany({
					where: { status: "COMPLETED" },
					select: {
						id: true,
						orderId: true,
						amount: true,
						blockHash: true,
						blockNumber: true,
						timestamp: true,
						order: {
							select: {
								status: true,
								product: { select: { name: true, category: true } },
							},
						},
					},
					orderBy: { timestamp: "desc" },
					take: 5,
				}),
			]);

			// Process top farmers data
			const topFarmersWithRevenue = topFarmers
				.map((farmer) => {
					const totalRevenue = farmer.sales.reduce(
						(sum, sale) => sum + sale.totalPrice,
						0,
					);
					return {
						id: farmer.id,
						name: farmer.name,
						location: farmer.location,
						totalRevenue,
						totalSales: farmer.sales.length,
					};
				})
				.sort((a, b) => b.totalRevenue - a.totalRevenue);

			res.json({
				overview: {
					totalUsers,
					unverifiedUsers,
					totalProducts,
					totalOrders,
					totalTransactions,
					failedTransactions,
					pendingOrders,
					totalRevenue: revenueData._sum.amount || 0,
				},
				systemHealth: {
					eventsLast24h,
				},
				userGrowth,
				productCategories,
				orderStats,
				topFarmers: topFarmersWithRevenue,
				recentActivity,
				recentTransactions,
			});
		} catch (error) {
			console.error("Dashboard analytics error:", error);
			res.status(500).json({ error: "Failed to fetch dashboard analytics" });
		}
	},
);

// Farmer analytics
router.get(
	"/farmer",
	authenticateToken,
	requireRole(["FARMER"]),
	async (req, res) => {
		try {
			const farmerId = req.user.id;

			const [
				totalProducts,
				totalSales,
				totalRevenue,
				averageRating,
				salesByMonth,
				topProducts,
				recentOrders,
			] = await Promise.all([
				prisma.product.count({ where: { farmerId } }),

				prisma.order.count({
					where: { farmerId, status: "DELIVERED" },
				}),

				prisma.order.aggregate({
					where: { farmerId, status: "DELIVERED" },
					_sum: { totalPrice: true },
				}),

				prisma.review.aggregate({
					where: {
						product: { farmerId },
					},
					_avg: { rating: true },
				}),

				prisma.order.groupBy({
					by: ["createdAt"],
					where: {
						farmerId,
						status: "DELIVERED",
						createdAt: {
							gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
						},
					},
					_sum: { totalPrice: true },
					_count: true,
				}),

				prisma.product.findMany({
					where: { farmerId },
					include: {
						_count: { select: { orders: true } },
						orders: {
							where: { status: "DELIVERED" },
							select: { totalPrice: true },
						},
					},
					orderBy: {
						orders: { _count: "desc" },
					},
					take: 5,
				}),

				prisma.order.findMany({
					where: { farmerId },
					include: {
						product: { select: { name: true } },
						buyer: { select: { name: true, location: true } },
					},
					orderBy: { createdAt: "desc" },
					take: 5,
				}),
			]);

			// Process top products
			const topProductsWithStats = topProducts.map((product) => ({
				id: product.id,
				name: product.name,
				category: product.category,
				totalOrders: product._count.orders,
				totalRevenue: product.orders.reduce(
					(sum, order) => sum + order.totalPrice,
					0,
				),
			}));

			res.json({
				overview: {
					totalProducts,
					totalSales,
					totalRevenue: totalRevenue._sum.totalPrice || 0,
					averageRating: averageRating._avg.rating || 0,
				},
				salesByMonth,
				topProducts: topProductsWithStats,
				recentOrders,
			});
		} catch (error) {
			console.error("Farmer analytics error:", error);
			res.status(500).json({ error: "Failed to fetch farmer analytics" });
		}
	},
);

// Buyer analytics
router.get(
	"/buyer",
	authenticateToken,
	requireRole(["BUYER"]),
	async (req, res) => {
		try {
			const buyerId = req.user.id;

			const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

			const [totalOrders, recentOrders, deliveredOrdersLastYear] =
				await Promise.all([
					prisma.order.count({ where: { buyerId } }),

					prisma.order.findMany({
						where: { buyerId },
						include: {
							product: { select: { name: true, category: true, images: true } },
							farmer: { select: { name: true, location: true } },
						},
						orderBy: { createdAt: "desc" },
						take: 5,
					}),

					prisma.order.findMany({
						where: {
							buyerId,
							status: "DELIVERED",
							createdAt: { gte: lastYear },
						},
						select: {
							totalPrice: true,
							createdAt: true,
							product: { select: { category: true } },
						},
					}),
				]);

			const totalSpent = deliveredOrdersLastYear.reduce(
				(sum, o) => sum + (o.totalPrice || 0),
				0,
			);
			const deliveredCount = deliveredOrdersLastYear.length;

			// Favorite categories (by delivered order count in last year)
			const categoryCounts = new Map();
			for (const o of deliveredOrdersLastYear) {
				const category = o.product.category;
				categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
			}
			const favoriteCategories = Array.from(categoryCounts.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([category, count]) => ({ category, count }));

			// Monthly spending (YYYY-MM) for last year
			const monthTotals = new Map();
			for (const o of deliveredOrdersLastYear) {
				const d = new Date(o.createdAt);
				const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				monthTotals.set(key, (monthTotals.get(key) || 0) + (o.totalPrice || 0));
			}
			const monthlySpending = Array.from(monthTotals.entries())
				.sort((a, b) => (a[0] > b[0] ? 1 : -1))
				.map(([month, totalSpent]) => ({ month, totalSpent }));

			res.json({
				overview: {
					totalOrders,
					totalSpent,
					averageOrderValue:
						deliveredCount > 0 ? totalSpent / deliveredCount : 0,
					deliveredOrders: deliveredCount,
				},
				favoriteCategories,
				recentOrders,
				monthlySpending,
			});
		} catch (error) {
			console.error("Buyer analytics error:", error);
			res.status(500).json({ error: "Failed to fetch buyer analytics" });
		}
	},
);

export default router;
