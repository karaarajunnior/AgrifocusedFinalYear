import express from "express";
import { body, param, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import { synthesizeToFile } from "../services/ttsService.js";

const prisma = new PrismaClient();
const router = express.Router();

// List conversation counterparts (best-effort, based on recent messages)
router.get(
	"/conversations",
	authenticateToken,
	async (req, res) => {
		try {
			const messages = await prisma.message.findMany({
				where: {
					OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
				},
				orderBy: { createdAt: "desc" },
				take: 200,
			});

			const seen = new Set();
			const counterpartIds = [];
			for (const m of messages) {
				const other = m.senderId === req.user.id ? m.receiverId : m.senderId;
				if (!seen.has(other)) {
					seen.add(other);
					counterpartIds.push(other);
				}
			}

			const users = await prisma.user.findMany({
				where: { id: { in: counterpartIds } },
				select: { id: true, name: true, role: true, location: true, verified: true },
			});

			// preserve most-recent order
			const byId = new Map(users.map((u) => [u.id, u]));
			res.json({
				conversations: counterpartIds.map((id) => byId.get(id)).filter(Boolean),
			});
		} catch (error) {
			console.error("List conversations error:", error);
			res.status(500).json({ error: "Failed to fetch conversations" });
		}
	},
);

router.get(
	"/messages/:userId",
	authenticateToken,
	[param("userId").isString()],
	[query("limit").optional().isInt({ min: 1, max: 200 })],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const otherId = req.params.userId;
			const limit = req.query.limit ? parseInt(req.query.limit) : 50;

			const messages = await prisma.message.findMany({
				where: {
					OR: [
						{ senderId: req.user.id, receiverId: otherId },
						{ senderId: otherId, receiverId: req.user.id },
					],
				},
				orderBy: { createdAt: "asc" },
				take: limit,
			});

			// Mark incoming as read
			await prisma.message.updateMany({
				where: { senderId: otherId, receiverId: req.user.id, read: false },
				data: { read: true },
			});

			res.json({ messages });
		} catch (error) {
			console.error("Get messages error:", error);
			res.status(500).json({ error: "Failed to fetch messages" });
		}
	},
);

router.post(
	"/messages",
	authenticateToken,
	requireVerified,
	[
		body("receiverId").isString(),
		body("content").trim().isLength({ min: 1, max: 2000 }).escape(),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const { receiverId, content } = req.body;

			const msg = await prisma.message.create({
				data: {
					senderId: req.user.id,
					receiverId,
					content,
				},
			});

			let audioUrl = null;
			try {
				audioUrl = await synthesizeToFile({ messageId: msg.id, text: content });
				if (audioUrl) {
					await prisma.message.update({
						where: { id: msg.id },
						data: { audioUrl },
					});
				}
			} catch (e) {
				console.error("TTS failed:", e?.message || e);
			}

			res.status(201).json({
				message: "Message sent",
				chat: { ...msg, audioUrl },
			});
		} catch (error) {
			console.error("Send message error:", error);
			res.status(500).json({ error: "Failed to send message" });
		}
	},
);

export default router;

