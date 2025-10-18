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
				totalProducts,
				totalOrders,
				totalTransactions,
				revenueData,
				userGrowth,
				productCategories,
				orderStats,
				topFarmers,
				recentActivity,
			] = await Promise.all([
				// Total counts
				prisma.user.count(),
				prisma.product.count(),
				prisma.order.count(),
				prisma.transaction.count({ where: { status: "COMPLETED" } }),

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
					totalProducts,
					totalOrders,
					totalTransactions,
					totalRevenue: revenueData._sum.amount || 0,
				},
				userGrowth,
				productCategories,
				orderStats,
				topFarmers: topFarmersWithRevenue,
				recentActivity,
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

			const [
				totalOrders,
				totalSpent,
				favoriteCategories,
				recentOrders,
				monthlySpending,
			] = await Promise.all([
				prisma.order.count({ where: { buyerId } }),

				prisma.order.aggregate({
					where: { buyerId, status: "DELIVERED" },
					_sum: { totalPrice: true },
				}),

				await prisma.order.groupBy({
					by: ["productId"],
					where: { buyerId, status: "DELIVERED" },
					select: {
						//  _count: { _all: true },
						productId: true,
					},
					orderBy: { _count: { productId: "desc" } },
					take: 5,
				}),

				prisma.order.findMany({
					where: { buyerId },
					include: {
						product: { select: { name: true, category: true, images: true } },
						farmer: { select: { name: true, location: true } },
					},
					orderBy: { createdAt: "desc" },
					take: 5,
				}),

				prisma.order.groupBy({
					by: ["createdAt"],
					where: {
						buyerId,
						status: "DELIVERED",
						createdAt: {
							gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
						},
					},
					_sum: { totalPrice: true },
				}),
			]);

			res.json({
				overview: {
					totalOrders,
					totalSpent: totalSpent._sum.totalPrice || 0,
					averageOrderValue:
						totalOrders > 0
							? (totalSpent._sum.totalPrice || 0) / totalOrders
							: 0,
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
