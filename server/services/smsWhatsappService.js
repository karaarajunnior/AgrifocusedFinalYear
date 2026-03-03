import prisma from "../db/prisma.js";
import nodemailer from "nodemailer";
import { emitToUser } from "../realtime.js";

/**
 * DAFIS Notification Service
 *
 * Replaces Twilio SMS/WhatsApp with:
 *   1. In-app notifications (stored in DB, pushed via Socket.IO)
 *   2. Email fallback via Nodemailer (free with any SMTP or localhost)
 *
 * The exported functions keep the same signatures so all callers
 * (payments, orders, etc.) work without changes.
 */

function getTransporter() {
	const host = process.env.SMTP_HOST;
	if (!host) return null;
	return nodemailer.createTransport({
		host,
		port: Number(process.env.SMTP_PORT || 587),
		secure: process.env.SMTP_SECURE === "true",
		auth: {
			user: process.env.SMTP_USER || "",
			pass: process.env.SMTP_PASS || "",
		},
	});
}

function isTypeEnabled(user, type) {
	if (type === "chat") return Boolean(user.notifyChat);
	if (type === "payment") return Boolean(user.notifyPayment);
	if (type === "order") return Boolean(user.notifyOrder);
	return true;
}

/**
 * Send an in-app notification — stored in NotificationLog and emitted via Socket.IO.
 */
async function sendInApp({ userId, type, body }) {
	if (!body) return { ok: false, skipped: true };

	const log = await prisma.notificationLog.create({
		data: {
			userId,
			type,
			channel: "in_app",
			to: "in_app",
			body,
			provider: "internal",
			status: "delivered",
		},
	});

	// Push via Socket.IO in realtime
	emitToUser(userId, "notify", {
		type: "notification",
		notificationId: log.id,
		category: type,
		body,
		timestamp: new Date().toISOString(),
	});

	return { ok: true, channel: "in_app", id: log.id };
}

/**
 * Send an email notification via Nodemailer (free fallback).
 */
async function sendEmail({ userId, email, type, body }) {
	if (!body || !email) return { ok: false, skipped: true };

	const transporter = getTransporter();
	if (!transporter) return { ok: false, error: "smtp_not_configured" };

	const log = await prisma.notificationLog.create({
		data: {
			userId,
			type,
			channel: "email",
			to: email,
			body,
			provider: "nodemailer",
			status: "queued",
		},
	});

	try {
		const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@dafis.ug";
		await transporter.sendMail({
			from: `DAFIS <${fromAddr}>`,
			to: email,
			subject: `DAFIS ${type} notification`,
			text: body,
		});

		await prisma.notificationLog.update({
			where: { id: log.id },
			data: { status: "sent" },
		});

		return { ok: true, channel: "email" };
	} catch (e) {
		const err = e?.message || String(e);
		await prisma.notificationLog.update({
			where: { id: log.id },
			data: { status: "failed", error: err },
		});
		return { ok: false, error: err, channel: "email" };
	}
}

/**
 * Main notification function — same signature as the old Twilio-based notifyUser.
 * Sends in-app first (always), then tries email as fallback.
 *
 * smsBody and whatsappBody params are accepted for backwards compatibility
 * but both map to in-app and email channels.
 */
export async function notifyUser({ userId, type, smsBody, whatsappBody }) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			phone: true,
			email: true,
			notifySms: true,
			notifyWhatsapp: true,
			notifyChat: true,
			notifyPayment: true,
			notifyOrder: true,
		},
	});
	if (!user) return { ok: false, reason: "user_not_found" };
	if (!isTypeEnabled(user, type)) return { ok: false, reason: "type_disabled" };

	// Use whatsappBody (richer formatting) if available, fallback to smsBody
	const messageBody = whatsappBody || smsBody;

	// 1. Always send in-app notification
	const inAppResult = await sendInApp({ userId, type, body: messageBody });

	// 2. Try email as fallback (if user has email and SMTP is configured)
	if (user.email) {
		await sendEmail({ userId, email: user.email, type, body: smsBody || whatsappBody });
	}

	return inAppResult;
}

/**
 * Update notification status (kept for compatibility with existing callers).
 */
export async function updateNotificationStatus({ providerSid, status, raw }) {
	if (!providerSid) return;
	await prisma.notificationLog.updateMany({
		where: { provider: "internal", providerSid },
		data: {
			status: status || "unknown",
			error: raw ? JSON.stringify(raw).slice(0, 2000) : undefined,
		},
	});
}
