import express from "express";
import { body, param, query, validationResult } from "express-validator";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import { synthesizeToFile } from "../services/ttsService.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "../services/pushService.js";
import { notifyUser } from "../services/smsWhatsappService.js";
import { translateLocal } from "../services/translationService.js";
import prisma from "../db/prisma.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const voiceUploadsDir = path.join(__dirname, "..", "uploads", "chat-voice");

const voiceStorage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(voiceUploadsDir, { recursive: true });
			cb(null, voiceUploadsDir);
		} catch (error) {
			cb(error);
		}
	},
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname || "") || ".webm";
		cb(null, `${req.user.id}_${Date.now()}${ext}`);
	},
});

const uploadVoice = multer({
	storage: voiceStorage,
	limits: { fileSize: 8 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype?.startsWith("audio/")) return cb(null, true);
		cb(new Error("Only audio files are allowed"));
	},
});

// List potential new contacts (based on orders/interactions)
router.get(
	"/potential-contacts",
	authenticateToken,
	async (req, res) => {
		try {
			let userIds = [];
			if (req.user.role === "BUYER") {
				// Buyers can see farmers they ordered from
				const orders = await prisma.order.findMany({
					where: { buyerId: req.user.id },
					select: { farmerId: true },
					distinct: ["farmerId"],
				});
				userIds = orders.map(o => o.farmerId);
			} else if (req.user.role === "FARMER" || req.user.role === "SUPERMARKET") {
				// Farmers can see buyers who ordered from them
				const orders = await prisma.order.findMany({
					where: { farmerId: req.user.id },
					select: { buyerId: true },
					distinct: ["buyerId"],
				});
				userIds = orders.map(o => o.buyerId);
			}

			const users = await prisma.user.findMany({
				where: { id: { in: userIds } },
				select: { id: true, name: true, role: true, location: true, verified: true },
			});

			res.json({ users });
		} catch (error) {
			console.error("Potential contacts error:", error);
			res.status(500).json({ error: "Failed to fetch potential contacts" });
		}
	}
);

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
		body("audioUrl").optional().isString().trim().isLength({ max: 1000 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const { receiverId, content, audioUrl: clientAudioUrl } = req.body;

			const msg = await prisma.message.create({
				data: {
					senderId: req.user.id,
					receiverId,
					content,
					audioUrl: clientAudioUrl || null,
				},
			});

			let audioUrl = clientAudioUrl || null;
			if (!audioUrl) {
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
			}

			const fullMsg = { ...msg, audioUrl };

			// Broadcast in real-time if receiver is connected
			emitToUser(receiverId, "chat:message", fullMsg);
			emitToUser(receiverId, "notify", {
				type: "message",
				fromUserId: req.user.id,
				messageId: msg.id,
				createdAt: msg.createdAt,
			});

			// Optional: Push Notification
			await sendPushToUser(receiverId, {
				notification: {
					title: "New message",
					body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
				},
				data: { type: "message", fromUserId: req.user.id, messageId: msg.id },
			});

			// SMS Notification
			await notifyUser({
				userId: receiverId,
				type: "chat",
				smsBody: `AgriConnect: New message received. Open the app to reply.`,
				whatsappBody: `AgriConnect: New message received. Open the app to reply.`,
			});

			res.status(201).json({
				message: "Message sent",
				chat: fullMsg,
			});
		} catch (error) {
			console.error("Send message error:", error);
			res.status(500).json({ error: "Failed to send message" });
		}
	},
);

router.post(
	"/voice",
	authenticateToken,
	requireVerified,
	uploadVoice.single("file"),
	async (req, res) => {
		try {
			if (!req.file) return res.status(400).json({ error: "Audio file required" });
			res.status(201).json({
				audioUrl: `/uploads/chat-voice/${path.basename(req.file.path)}`,
			});
		} catch (error) {
			console.error("Voice upload error:", error);
			res.status(500).json({ error: "Failed to upload voice message" });
		}
	},
);

router.post(
	"/translate",
	authenticateToken,
	[
		body("text").isString().notEmpty(),
		body("targetLang").isString().isIn(["luganda", "runyankore", "acholi"]),
	],
	async (req, res) => {
		try {
			const { text, targetLang } = req.body;
			const translated = translateLocal(text, targetLang);
			res.json({ translated });
		} catch (error) {
			console.error("Translation error:", error);
			res.status(500).json({ error: "Translation failed" });
		}
	}
);

export default router;

