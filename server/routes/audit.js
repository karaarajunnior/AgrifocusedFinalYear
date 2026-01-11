import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = express.Router();

// Admin: view audit logs (append-only operational security trail)
router.get("/", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
	try {
		const { page = 1, limit = 50, action, actorUserId } = req.query;
		const take = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
		const skip = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * take;

		const where = {};
		if (action) where.action = String(action);
		if (actorUserId) where.actorUserId = String(actorUserId);

		const [items, total] = await Promise.all([
			prisma.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			prisma.auditLog.count({ where }),
		]);

		res.json({
			auditLogs: items,
			pagination: {
				page: Math.max(1, parseInt(String(page), 10) || 1),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		console.error("Audit logs error:", error);
		res.status(500).json({ error: "Failed to fetch audit logs" });
	}
});

export default router;

