import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { synthesizeToFile } from "./services/ttsService.js";
import { setRealtimeIo } from "./realtime.js";
import { sendPushToUser } from "./services/pushService.js";
import { notifyUser } from "./services/smsWhatsappService.js";
import prisma from "./db/prisma.js";

function userRoom(userId) {
	return `user:${userId}`;
}

export function initSocket(httpServer) {
	const io = new SocketIOServer(httpServer, {
		cors: {
			origin: true,
			credentials: true,
		},
	});

	setRealtimeIo(io);

	io.use(async (socket, next) => {
		try {
			const token =
				socket.handshake.auth?.token ||
				socket.handshake.headers?.authorization?.split(" ")?.[1];

			if (!token) return next(new Error("Authentication required"));
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const user = await prisma.user.findUnique({
				where: { id: decoded.userId },
				select: {
					id: true,
					name: true,
					role: true,
					verified: true,
					passwordChangedAt: true,
				},
			});
			if (!user) return next(new Error("Invalid token"));

			if (decoded?.iat && user.passwordChangedAt) {
				const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
				if (changedAtSec > decoded.iat) {
					return next(new Error("Token revoked"));
				}
			}

			socket.data.user = user;
			return next();
		} catch (e) {
			return next(new Error("Invalid or expired token"));
		}
	});

	io.on("connection", (socket) => {
		const user = socket.data.user;
		socket.join(userRoom(user.id));

		socket.on("chat:send", async (payload, ack) => {
			try {
				if (!user.verified && user.role !== "ADMIN") {
					return ack?.({ ok: false, error: "Account not verified" });
				}
				const receiverId = String(payload?.receiverId || "");
				const content = String(payload?.content || "").trim();
				if (!receiverId || content.length < 1 || content.length > 2000) {
					return ack?.({ ok: false, error: "Invalid message" });
				}

				const msg = await prisma.message.create({
					data: {
						senderId: user.id,
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
					// Non-fatal: deliver text even if TTS fails
					console.error("TTS failed:", e?.message || e);
				}

				const full = {
					id: msg.id,
					content,
					audioUrl,
					senderId: user.id,
					receiverId,
					read: false,
					createdAt: msg.createdAt,
				};

				io.to(userRoom(receiverId)).emit("chat:message", full);
				io.to(userRoom(user.id)).emit("chat:message:sent", full);

				// notification event (push-ready)
				io.to(userRoom(receiverId)).emit("notify", {
					type: "message",
					fromUserId: user.id,
					messageId: msg.id,
					createdAt: msg.createdAt,
				});

				await sendPushToUser(receiverId, {
					notification: {
						title: "New message",
						body: content.length > 120 ? `${content.slice(0, 117)}...` : content,
					},
					data: {
						type: "message",
						fromUserId: user.id,
						messageId: msg.id,
					},
				});

				// SMS/WhatsApp: keep it short (avoid leaking full chat content)
				await notifyUser({
					userId: receiverId,
					type: "chat",
					smsBody: `AgriConnect: New message from ${user.name}. Open the app to reply.`,
					whatsappBody: `AgriConnect: New message from *${user.name}*. Open the app to reply.`,
				});

				return ack?.({ ok: true, message: full });
			} catch (e) {
				console.error("chat:send error:", e);
				return ack?.({ ok: false, error: "Failed to send message" });
			}
		});
	});

	return io;
}

