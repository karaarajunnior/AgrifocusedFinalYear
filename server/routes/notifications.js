import express from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

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

export default router;

