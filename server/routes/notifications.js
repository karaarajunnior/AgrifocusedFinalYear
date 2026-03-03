import express from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { updateNotificationStatus } from "../services/smsWhatsappService.js";
import prisma from "../db/prisma.js";
import { handleInboundSms } from "../services/smsCommandService.js";

const router = express.Router();

// Register a device token (mobile app calls this after login)
router.post(
	"/register-token",
	authenticateToken,
	[
		body("token").isString().trim().isLength({ min: 20, max: 255 }),
		body("platform").optional().isString().trim().isLength({ min: 2, max: 20 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const { token, platform } = req.body;

			const dt = await prisma.deviceToken.upsert({
				where: { token },
				update: { userId: req.user.id, platform, lastSeenAt: new Date() },
				create: { userId: req.user.id, token, platform },
			});

			res.json({ message: "Token registered", deviceToken: dt });
		} catch (error) {
			console.error("Register token error:", error);
			res.status(500).json({ error: "Failed to register token" });
		}
	},
);

router.post(
	"/unregister-token",
	authenticateToken,
	[body("token").isString().trim().isLength({ min: 20, max: 255 })],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			await prisma.deviceToken.deleteMany({
				where: { userId: req.user.id, token: req.body.token },
			});

			res.json({ message: "Token unregistered" });
		} catch (error) {
			console.error("Unregister token error:", error);
			res.status(500).json({ error: "Failed to unregister token" });
		}
	},
);

// Get notification preferences (current user)
router.get("/preferences", authenticateToken, async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: {
				notifySms: true,
				notifyWhatsapp: true,
				notifyChat: true,
				notifyPayment: true,
				notifyOrder: true,
			},
		});
		res.json({ preferences: user });
	} catch (error) {
		console.error("Get preferences error:", error);
		res.status(500).json({ error: "Failed to fetch preferences" });
	}
});

router.put(
	"/preferences",
	authenticateToken,
	[
		body("notifySms").optional().isBoolean(),
		body("notifyWhatsapp").optional().isBoolean(),
		body("notifyChat").optional().isBoolean(),
		body("notifyPayment").optional().isBoolean(),
		body("notifyOrder").optional().isBoolean(),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const allowed = [
				"notifySms",
				"notifyWhatsapp",
				"notifyChat",
				"notifyPayment",
				"notifyOrder",
			];
			const data = {};
			for (const k of allowed) {
				if (req.body[k] !== undefined) data[k] = Boolean(req.body[k]);
			}

			const user = await prisma.user.update({
				where: { id: req.user.id },
				data,
				select: {
					notifySms: true,
					notifyWhatsapp: true,
					notifyChat: true,
					notifyPayment: true,
					notifyOrder: true,
				},
			});
			res.json({ message: "Preferences updated", preferences: user });
		} catch (error) {
			console.error("Update preferences error:", error);
			res.status(500).json({ error: "Failed to update preferences" });
		}
	},
);

// Get in-app notifications for the current user
router.get("/my", authenticateToken, async (req, res) => {
	try {
		const limit = Math.min(Number(req.query.limit || 50), 100);
		const notifications = await prisma.notificationLog.findMany({
			where: { userId: req.user.id },
			orderBy: { createdAt: "desc" },
			take: limit,
			select: {
				id: true,
				type: true,
				channel: true,
				body: true,
				status: true,
				createdAt: true,
			},
		});
		res.json({ notifications });
	} catch (error) {
		console.error("Get notifications error:", error);
		res.status(500).json({ error: "Failed to fetch notifications" });
	}
});

// Mark a notification as read
router.patch(
	"/:id/read",
	authenticateToken,
	[param("id").isString()],
	async (req, res) => {
		try {
			const notification = await prisma.notificationLog.findFirst({
				where: { id: req.params.id, userId: req.user.id },
			});
			if (!notification) return res.status(404).json({ error: "Notification not found" });

			await prisma.notificationLog.update({
				where: { id: notification.id },
				data: { status: "read" },
			});

			res.json({ ok: true });
		} catch (error) {
			console.error("Mark read error:", error);
			res.status(500).json({ error: "Failed to mark notification as read" });
		}
	},
);

// In-app text command handler (simulates SMS/USSD commands in-app)
router.post(
	"/command",
	authenticateToken,
	[body("command").isString().trim().isLength({ min: 1, max: 200 })],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() });
			}

			const user = await prisma.user.findUnique({
				where: { id: req.user.id },
				select: { phone: true },
			});

			const { response } = await handleInboundSms({
				from: user?.phone || req.user.id,
				body: req.body.command,
			});

			res.json({ response });
		} catch (error) {
			console.error("Command handler error:", error);
			res.status(500).json({ error: "Failed to process command" });
		}
	},
);

// Admin: notifications delivery analytics
router.get(
	"/admin/stats",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

			const [last24hTotal, last24hFailed, byChannel, byType, recentFailures] =
				await Promise.all([
					prisma.notificationLog.count({
						where: { createdAt: { gte: since24h } },
					}),
					prisma.notificationLog.count({
						where: { createdAt: { gte: since24h }, status: "failed" },
					}),
					prisma.notificationLog.groupBy({
						by: ["channel", "status"],
						where: { createdAt: { gte: since7d } },
						_count: true,
					}),
					prisma.notificationLog.groupBy({
						by: ["type", "status"],
						where: { createdAt: { gte: since7d } },
						_count: true,
					}),
					prisma.notificationLog.findMany({
						where: { status: "failed" },
						select: {
							id: true,
							type: true,
							channel: true,
							to: true,
							status: true,
							error: true,
							providerSid: true,
							createdAt: true,
							user: { select: { id: true, name: true, role: true } },
						},
						orderBy: { createdAt: "desc" },
						take: 25,
					}),
				]);

			const last24hSuccess = Math.max(0, last24hTotal - last24hFailed);
			const last24hSuccessRate =
				last24hTotal > 0 ? last24hSuccess / last24hTotal : 0;

			res.json({
				overview: {
					last24hTotal,
					last24hFailed,
					last24hSuccess,
					last24hSuccessRate,
				},
				last7d: {
					byChannel,
					byType,
				},
				recentFailures: recentFailures.map((f) => ({
					...f,
					toMasked: f.to ? `${f.to.slice(0, 5)}***${f.to.slice(-3)}` : null,
				})),
			});
		} catch (error) {
			console.error("Admin notifications stats error:", error);
			res.status(500).json({ error: "Failed to fetch notifications stats" });
		}
	},
);

export default router;
