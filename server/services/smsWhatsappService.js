import twilio from "twilio";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isConfigured() {
	return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function client() {
	return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function toE164Ug(phone) {
	let msisdn = String(phone || "").trim();
	msisdn = msisdn.replace(/\s+/g, "");
	if (msisdn.startsWith("+")) return msisdn;
	if (msisdn.startsWith("0")) return `+256${msisdn.slice(1)}`;
	if (msisdn.startsWith("256")) return `+${msisdn}`;
	throw new Error("Phone must be a Uganda number (e.g. 07..., 2567..., +2567...)");
}

function getAllowedChannels() {
	// NOTIFY_CHANNELS=sms,whatsapp
	const raw = (process.env.NOTIFY_CHANNELS || "sms,whatsapp")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return raw;
}

function getFallbackOrder() {
	// NOTIFY_FALLBACK_ORDER=whatsapp_then_sms | sms_then_whatsapp
	const v = (process.env.NOTIFY_FALLBACK_ORDER || "whatsapp_then_sms").toLowerCase();
	return v === "sms_then_whatsapp" ? ["sms", "whatsapp"] : ["whatsapp", "sms"];
}

function getStatusCallbackUrl() {
	// Prefer explicit URL; else derive from PUBLIC_BASE_URL
	if (process.env.TWILIO_STATUS_CALLBACK_URL) return process.env.TWILIO_STATUS_CALLBACK_URL;
	if (!process.env.PUBLIC_BASE_URL) return null;
	return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/notifications/twilio/status`;
}

function isTypeEnabled(user, type) {
	if (type === "chat") return Boolean(user.notifyChat);
	if (type === "payment") return Boolean(user.notifyPayment);
	if (type === "order") return Boolean(user.notifyOrder);
	return true;
}

async function sendOne({ channel, toE164, body, userId, type }) {
	if (!body) return { ok: false, skipped: true };

	const to =
		channel === "whatsapp" ? `whatsapp:${toE164}` : toE164;

	const from =
		channel === "whatsapp"
			? process.env.TWILIO_WHATSAPP_FROM
				? `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`
				: null
			: process.env.TWILIO_SMS_FROM || null;

	if (!from) return { ok: false, error: `missing_from_for_${channel}` };

	const log = await prisma.notificationLog.create({
		data: {
			userId,
			type,
			channel,
			to: toE164,
			body,
			provider: "twilio",
			status: "queued",
		},
	});

	try {
		const statusCallback = getStatusCallbackUrl();
		const msg = await client().messages.create({
			from,
			to,
			body,
			statusCallback: statusCallback || undefined,
		});

		await prisma.notificationLog.update({
			where: { id: log.id },
			data: {
				providerSid: msg.sid,
				status: msg.status || "sent",
			},
		});

		return { ok: true, sid: msg.sid, channel };
	} catch (e) {
		const err = e?.message || String(e);
		await prisma.notificationLog.update({
			where: { id: log.id },
			data: { status: "failed", error: err },
		});
		return { ok: false, error: err, channel };
	}
}

export async function notifyUser({ userId, type, smsBody, whatsappBody }) {
	if (!isConfigured()) return { ok: false, reason: "twilio_not_configured" };

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			phone: true,
			notifySms: true,
			notifyWhatsapp: true,
			notifyChat: true,
			notifyPayment: true,
			notifyOrder: true,
		},
	});
	if (!user?.phone) return { ok: false, reason: "no_phone" };
	if (!isTypeEnabled(user, type)) return { ok: false, reason: "type_disabled" };

	const to = toE164Ug(user.phone);
	const allowed = new Set(getAllowedChannels());
	const order = getFallbackOrder();

	const bodies = {
		sms: smsBody,
		whatsapp: whatsappBody,
	};

	// Apply user channel preferences
	const channelEnabled = {
		sms: Boolean(user.notifySms),
		whatsapp: Boolean(user.notifyWhatsapp),
	};

	let lastError = null;
	for (const channel of order) {
		if (!allowed.has(channel)) continue;
		if (!channelEnabled[channel]) continue;
		const resp = await sendOne({
			channel,
			toE164: to,
			body: bodies[channel],
			userId,
			type,
		});
		if (resp.ok) return { ok: true, channel };
		if (!resp.skipped) lastError = resp.error;
	}

	return { ok: false, reason: "all_channels_failed", error: lastError };
}

export async function updateNotificationStatus({ providerSid, status, raw }) {
	if (!providerSid) return;
	await prisma.notificationLog.updateMany({
		where: { provider: "twilio", providerSid },
		data: {
			status: status || "unknown",
			error: raw ? JSON.stringify(raw).slice(0, 2000) : undefined,
		},
	});
}

