import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";

export async function getUserProfile(req, res) {
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

		if (!user) return res.status(404).json({ error: "User not found" });

		let farmerStats = {};
		if (user.role === "FARMER") {
			const [avgRating, totalSales, totalRevenue] = await Promise.all([
				prisma.review.aggregate({
					where: { product: { farmerId: id } },
					_avg: { rating: true },
				}),
				prisma.order.count({ where: { farmerId: id, status: "DELIVERED" } }),
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

		res.json({ user: { ...user, ...farmerStats } });
	} catch (error) {
		console.error("Get user profile error:", error);
		res.status(500).json({ error: "Failed to fetch user profile" });
	}
}

export async function updateUserProfile(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const updates = {};
		const allowedFields = [
			"name",
			"phone",
			"location",
			"address",
			"avatar",
			"walletAddress",
			"autoFulfillOnPayment",
			"notifySms",
			"notifyWhatsapp",
			"notifyChat",
			"notifyPayment",
			"notifyOrder",
		];

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
			data: { ...updates, updatedAt: new Date() },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				phone: true,
				location: true,
				address: true,
				walletAddress: true,
				avatar: true,
				verified: true,
				autoFulfillOnPayment: true,
				notifySms: true,
				notifyWhatsapp: true,
				notifyChat: true,
				notifyPayment: true,
				notifyOrder: true,
				updatedAt: true,
			},
		});

		res.json({ message: "Profile updated successfully", user });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "user_profile_update",
			targetType: "user",
			targetId: req.user.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { fields: Object.keys(updates) },
		});
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({ error: "Failed to update profile" });
	}
}

export async function changePassword(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { currentPassword, newPassword } = req.body;
		const user = await prisma.user.findUnique({ where: { id: req.user.id } });

		const isValidPassword = await bcrypt.compare(currentPassword, user.password);
		if (!isValidPassword) {
			return res.status(400).json({ error: "Current password is incorrect" });
		}

		const salt = await bcrypt.genSalt(12);
		const hashedPassword = await bcrypt.hash(newPassword, salt);

		await prisma.user.update({
			where: { id: req.user.id },
			data: { password: hashedPassword, passwordChangedAt: new Date() },
		});

		res.json({ message: "Password changed successfully" });

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "user_password_change",
			targetType: "user",
			targetId: req.user.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});
	} catch (error) {
		console.error("Change password error:", error);
		res.status(500).json({ error: "Failed to change password" });
	}
}

export async function listUsers(req, res) {
	try {
		const { role, verified, page = 1, limit = 20, search } = req.query;

		const where = {};
		if (role) where.role = String(role).toUpperCase();
		if (verified !== undefined) where.verified = String(verified) === "true";
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
					_count: { select: { products: true, orders: true, sales: true } },
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
}

export async function setUserVerified(req, res) {
	try {
		const { id } = req.params;
		const { verified } = req.body;

		const user = await prisma.user.update({
			where: { id },
			data: { verified: Boolean(verified) },
			select: { id: true, name: true, email: true, verified: true },
		});

		res.json({
			message: `User ${verified ? "verified" : "unverified"} successfully`,
			user,
		});
	} catch (error) {
		console.error("Toggle verification error:", error);
		res.status(500).json({ error: "Failed to update user verification" });
	}
}

