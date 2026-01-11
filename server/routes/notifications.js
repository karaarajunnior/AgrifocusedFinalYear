import express from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import twilio from "twilio";
import { updateNotificationStatus } from "../services/smsWhatsappService.js";

const prisma = new PrismaClient();
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

// Twilio delivery receipts (status callback). Public endpoint.
router.post("/twilio/status", async (req, res) => {
	try {
		// Optional signature verification (recommended in production)
		const verify = String(process.env.TWILIO_VALIDATE_WEBHOOK || "false").toLowerCase() === "true";
		if (verify) {
			const signature = req.get("x-twilio-signature");
			const url =
				process.env.TWILIO_STATUS_CALLBACK_URL ||
				(process.env.PUBLIC_BASE_URL
					? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/notifications/twilio/status`
					: null);
			if (!signature || !url) {
				return res.status(401).json({ error: "Signature verification failed" });
			}
			const ok = twilio.validateRequest(
				process.env.TWILIO_AUTH_TOKEN,
				signature,
				url,
				req.body || {},
			);
			if (!ok) return res.status(401).json({ error: "Invalid signature" });
		}

		const sid = req.body?.MessageSid || req.body?.SmsSid;
		const status = req.body?.MessageStatus || req.body?.SmsStatus;
		await updateNotificationStatus({ providerSid: sid, status, raw: req.body });
		res.json({ ok: true });
	} catch (error) {
		console.error("Twilio status webhook error:", error);
		res.status(500).json({ error: "Failed to process status" });
	}
});

export default router;

