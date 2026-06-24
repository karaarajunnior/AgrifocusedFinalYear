// import prisma from "../db/prisma.js";
// import nodemailer from "nodemailer";
// import { emitToUser } from "../realtime.js";
// import twilio from "twilio";

// /**
//  * DAFIS Notification Service
//  *
//  * Replaces Twilio SMS/WhatsApp with:
//  *   1. In-app notifications (stored in DB, pushed via Socket.IO)
//  *   2. Email fallback via Nodemailer (free with any SMTP or localhost)
//  *
//  * The exported functions keep the same signatures so all callers
//  * (payments, orders, etc.) work without changes.
//  */

// function getTransporter() {
// 	const sendgridKey = process.env.SENDGRID_API_KEY;
// 	if (sendgridKey) {
// 		return nodemailer.createTransport({
// 			host: "smtp.sendgrid.net",
// 			port: 587,
// 			secure: false, // 587 uses STARTTLS
// 			auth: {
// 				user: "apikey",
// 				pass: sendgridKey,
// 			},
// 		});
// 	}

// 	const host = process.env.SMTP_HOST;
// 	if (!host) return null;
// 	return nodemailer.createTransport({
// 		host,
// 		port: Number(process.env.SMTP_PORT || 587),
// 		secure: process.env.SMTP_SECURE === "true",
// 		auth: {
// 			user: process.env.SMTP_USER || "",
// 			pass: process.env.SMTP_PASS || "",
// 		},
// 	});
// }

// function isTypeEnabled(user, type) {
// 	if (type === "chat") return Boolean(user.notifyChat);
// 	if (type === "payment") return Boolean(user.notifyPayment);
// 	if (type === "order") return Boolean(user.notifyOrder);
// 	return true;
// }

// /**
//  * Send an in-app notification — stored in NotificationLog and emitted via Socket.IO.
//  */
// async function sendInApp({ userId, type, body }) {
// 	if (!body) return { ok: false, skipped: true };

// 	const log = await prisma.notificationLog.create({
// 		data: {
// 			userId,
// 			type,
// 			channel: "in_app",
// 			to: "in_app",
// 			body,
// 			provider: "internal",
// 			status: "delivered",
// 		},
// 	});

// 	// Push via Socket.IO in realtime
// 	emitToUser(userId, "notify", {
// 		type: "notification",
// 		notificationId: log.id,
// 		category: type,
// 		body,
// 		timestamp: new Date().toISOString(),
// 	});

// 	return { ok: true, channel: "in_app", id: log.id };
// }

// /**
//  * Send an email notification via Nodemailer (free fallback).
//  */
// async function sendEmail({ userId, email, type, body }) {
// 	if (!body || !email) return { ok: false, skipped: true };

// 	const transporter = getTransporter();
// 	if (!transporter) return { ok: false, error: "email_not_configured" };

// 	const isSendgrid = Boolean(process.env.SENDGRID_API_KEY);
// 	const log = await prisma.notificationLog.create({
// 		data: {
// 			userId,
// 			type,
// 			channel: "email",
// 			to: email,
// 			body,
// 			provider: isSendgrid ? "sendgrid" : "nodemailer",
// 			status: "queued",
// 		},
// 	});

// 	try {
// 		const fromAddr = process.env.SENDGRID_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@dafis.ug";
// 		await transporter.sendMail({
// 			from: `DAFIS <${fromAddr}>`,
// 			to: email,
// 			subject: `DAFIS ${type} notification`,
// 			text: body,
// 		});

// 		await prisma.notificationLog.update({
// 			where: { id: log.id },
// 			data: { status: "sent" },
// 		});

// 		return { ok: true, channel: "email" };
// 	} catch (e) {
// 		const err = e?.message || String(e);
// 		await prisma.notificationLog.update({
// 			where: { id: log.id },
// 			data: { status: "failed", error: err },
// 		});
// 		return { ok: false, error: err, channel: "email" };
// 	}
// }

// /**
//  * Main notification function — same signature as the old Twilio-based notifyUser.
//  * Sends in-app first (always), then tries email as fallback.
//  *
//  * smsBody and whatsappBody params are accepted for backwards compatibility
//  * but both map to in-app and email channels.
//  */
// export async function notifyUser({ userId, type, smsBody, whatsappBody }) {
// 	const user = await prisma.user.findUnique({
// 		where: { id: userId },
// 		select: {
// 			phone: true,
// 			email: true,
// 			notifySms: true,
// 			notifyWhatsapp: true,
// 			notifyChat: true,
// 			notifyPayment: true,
// 			notifyOrder: true,
// 		},
// 	});
// 	if (!user) return { ok: false, reason: "user_not_found" };
// 	if (!isTypeEnabled(user, type)) return { ok: false, reason: "type_disabled" };

// 	// Use whatsappBody (richer formatting) if available, fallback to smsBody
// 	const messageBody = whatsappBody || smsBody;

// 	// 1. Always send in-app notification
// 	const inAppResult = await sendInApp({ userId, type, body: messageBody });

// 	// 2. Strictly send via email (using Nodemailer + SendGrid)
// 	if (user.email) {
// 		await sendEmail({ userId, email: user.email, type, body: messageBody });
// 	}

// 	return inAppResult;
// }

// /**
//  * Update notification status (kept for compatibility with existing callers).
//  */
// export async function updateNotificationStatus({ providerSid, status, raw }) {
// 	if (!providerSid) return;
// 	await prisma.notificationLog.updateMany({
// 		where: { provider: "internal", providerSid },
// 		data: {
// 			status: status || "unknown",
// 			error: raw ? JSON.stringify(raw).slice(0, 2000) : undefined,
// 		},
// 	});
// }

import prisma from "../db/prisma.js";
import nodemailer from "nodemailer";
import { emitToUser } from "../realtime.js";

/**
 * DAFIS Notification Service
 *
 * Channels:
 *   1. In-app notifications (stored in DB, pushed via Socket.IO)
 *   2. Email via Nodemailer + SendGrid SMTP
 */

function getTransporter() {
	const sendgridKey = process.env.SENDGRID_API_KEY;
	if (sendgridKey) {
		return nodemailer.createTransport({
			host: "smtp.sendgrid.net",
			port: 587,
			secure: false,
			auth: {
				user: "apikey",
				pass: sendgridKey,
			},
		});
	}

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

function getEmailSubject(type, emailSubject) {
	if (emailSubject) return emailSubject;
	const subjects = {
		auth: "Your AgriConnect Verification Code",
		payment: "AgriConnect Payment Notification",
		order: "AgriConnect Order Update",
		chat: "AgriConnect Message",
	};
	return subjects[type] || "AgriConnect Notification";
}

function buildEmailHtml(body, emailBody) {
	const content = emailBody || body;
	return `
	<!DOCTYPE html>
	<html>
	<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 30px;">
		<div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
			<h2 style="color: #2d7a3a; margin-top: 0;">AgriConnect</h2>
			<div style="font-size: 15px; color: #333; line-height: 1.6;">
				${content}
			</div>
			<hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
			<p style="font-size: 12px; color: #999; margin: 0;">
				This is an automated message from AgriConnect (DAFIS). Do not reply to this email.
			</p>
		</div>
	</body>
	</html>`;
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
 * Send an email notification via Nodemailer + SendGrid.
 */
async function sendEmail({ userId, email, type, body, emailBody, emailSubject }) {
	if (!email) return { ok: false, skipped: true, reason: "no_email" };

	const transporter = getTransporter();
	if (!transporter) return { ok: false, error: "email_not_configured" };

	// ✅ FIXED: Always use the verified SendGrid sender
	const fromAddr = process.env.SENDGRID_FROM || "karaarajunior1@gmail.com";
	const subject = getEmailSubject(type, emailSubject);
	const html = buildEmailHtml(body, emailBody);
	const text = emailBody || body;

	const isSendgrid = Boolean(process.env.SENDGRID_API_KEY);
	const log = await prisma.notificationLog.create({
		data: {
			userId,
			type,
			channel: "email",
			to: email,
			body: text,
			provider: isSendgrid ? "sendgrid" : "nodemailer",
			status: "queued",
		},
	});

	try {
		await transporter.sendMail({
			from: `AgriConnect <${fromAddr}>`,
			to: email,
			subject,
			text,
			html,
		});

		await prisma.notificationLog.update({
			where: { id: log.id },
			data: { status: "sent" },
		});

		console.log(`[Email] Sent to ${email} | type: ${type}`);
		return { ok: true, channel: "email" };
	} catch (e) {
		const err = e?.message || String(e);
		console.error(`[Email] Failed to send to ${email}:`, err);
		await prisma.notificationLog.update({
			where: { id: log.id },
			data: { status: "failed", error: err },
		});
		return { ok: false, error: err, channel: "email" };
	}
}

/**
 * Main notification function.
 *
 * Supports optional emailBody and emailSubject for richer email content.
 * smsBody and whatsappBody are kept for backwards compatibility.
 */
export async function notifyUser({ userId, type, smsBody, whatsappBody, emailBody, emailSubject }) {
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

	const messageBody = whatsappBody || smsBody;

	// 1. Always send in-app
	const inAppResult = await sendInApp({ userId, type, body: messageBody });

	// 2. Send email
	if (user.email) {
		await sendEmail({
			userId,
			email: user.email,
			type,
			body: messageBody,
			emailBody,
			emailSubject,
		});
	}

	return inAppResult;
}

/**
 * Update notification status (kept for compatibility).
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