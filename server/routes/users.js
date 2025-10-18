import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const prisma = new PrismaClient();

const router = express.Router();

// Get user profile
router.get("/profile/:id", authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;

		const user = await prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				email: req.user.id === id || req.user.role === "ADMIN" ? true : false,
				role: true,
				location: true,
				phone: req.user.id === id || req.user.role === "ADMIN" ? true : false,
				address: req.user.id === id || req.user.role === "ADMIN" ? true : false,
				avatar: true,
				verified: true,
				createdAt: true,
				_count: {
					select: {
						products: true,
						orders: req.user.role === "BUYER",
						sales: req.user.role === "FARMER",
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Get additional stats for farmers
		let farmerStats = {};
		if (user.role === "FARMER") {
			const [avgRating, totalSales, totalRevenue] = await Promise.all([
				prisma.review.aggregate({
					where: { product: { farmerId: id } },
					_avg: { rating: true },
				}),
				prisma.order.count({
					where: { farmerId: id, status: "DELIVERED" },
				}),
				prisma.order.aggregate({
					where: { farmerId: id, status: "DELIVERED" },
					_sum: { totalPrice: true },
				}),
			]);

			farmerStats = {
				averageRating: avgRating._avg.rating || 0,
				totalSales,
				totalRevenue: totalRevenue._sum.totalPrice || 0,
			};
		}

		res.json({
			user: {
				...user,
				...farmerStats,
			},
		});
	} catch (error) {
		console.error("Get user profile error:", error);
		res.status(500).json({ error: "Failed to fetch user profile" });
	}
});

// Update user profile
router.put(
	"/profile",
	authenticateToken,
	[
		body("name").optional().trim().isLength({ min: 2, max: 50 }),
		body("phone").optional().isMobilePhone(),
		body("location").optional().trim().isLength({ min: 2, max: 100 }),
		body("address").optional().trim().isLength({ max: 200 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const updates = {};
			const allowedFields = ["name", "phone", "location", "address", "avatar"];

			Object.keys(req.body).forEach((key) => {
				if (allowedFields.includes(key) && req.body[key] !== undefined) {
					updates[key] = req.body[key];
				}
			});

			if (Object.keys(updates).length === 0) {
				return res.status(400).json({ error: "No valid fields to update" });
			}

			const user = await prisma.user.update({
				where: { id: req.user.id },
				data: {
					...updates,
					updatedAt: new Date(),
				},
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					phone: true,
					location: true,
					address: true,
					avatar: true,
					verified: true,
					updatedAt: true,
				},
			});

			res.json({
				message: "Profile updated successfully",
				user,
			});
		} catch (error) {
			console.error("Update profile error:", error);
			res.status(500).json({ error: "Failed to update profile" });
		}
	},
);

// Change password
router.put(
	"/change-password",
	authenticateToken,
	[
		body("currentPassword").exists({ checkFalsy: true }),
		body("newPassword")
			.isLength({ min: 6 })
			.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { currentPassword, newPassword } = req.body;

			// Get current user with password
			const user = await prisma.user.findUnique({
				where: { id: req.user.id },
			});

			// Verify current password
			const isValidPassword = await bcrypt.compare(
				currentPassword,
				user.password,
			);
			if (!isValidPassword) {
				return res.status(400).json({ error: "Current password is incorrect" });
			}

			// Hash new password
			const salt = await bcrypt.genSalt(12);
			const hashedPassword = await bcrypt.hash(newPassword, salt);

			// Update password
			await prisma.user.update({
				where: { id: req.user.id },
				data: { password: hashedPassword },
			});

			res.json({ message: "Password changed successfully" });
		} catch (error) {
			console.error("Change password error:", error);
			res.status(500).json({ error: "Failed to change password" });
		}
	},
);

// Get all users (admin only)
router.get("/", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
	try {
		const { role, page = 1, limit = 20, search } = req.query;

		const where = {};
		if (role) where.role = role.toUpperCase();
		if (search) {
			where.OR = [
				{ name: { contains: search } },
				{ email: { contains: search } },
				{ location: { contains: search } },
			];
		}

		const skip = (parseInt(page) - 1) * parseInt(limit);

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				where,
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					location: true,
					verified: true,
					createdAt: true,
					_count: {
						select: {
							products: true,
							orders: true,
							sales: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: parseInt(limit),
			}),
			prisma.user.count({ where }),
		]);

		res.json({
			users,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / parseInt(limit)),
			},
		});
	} catch (error) {
		console.error("Get users error:", error);
		res.status(500).json({ error: "Failed to fetch users" });
	}
});

// Toggle user verification (admin only)
router.patch(
	"/:id/verify",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const { id } = req.params;
			const { verified } = req.body;

			const user = await prisma.user.update({
				where: { id },
				data: { verified: Boolean(verified) },
				select: {
					id: true,
					name: true,
					email: true,
					verified: true,
				},
			});

			res.json({
				message: `User ${verified ? "verified" : "unverified"} successfully`,
				user,
			});
		} catch (error) {
			console.error("Toggle verification error:", error);
			res.status(500).json({ error: "Failed to update user verification" });
		}
	},
);

export default router;
