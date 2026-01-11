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

function channels() {
	// NOTIFY_CHANNELS=sms,whatsapp
	const raw = (process.env.NOTIFY_CHANNELS || "sms,whatsapp")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return new Set(raw);
}

export async function notifyUser({ userId, smsBody, whatsappBody }) {
	if (!isConfigured()) return { ok: false, reason: "twilio_not_configured" };

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { phone: true },
	});
	if (!user?.phone) return { ok: false, reason: "no_phone" };

	const to = toE164Ug(user.phone);
	const ch = channels();
	const results = [];

	if (ch.has("sms") && process.env.TWILIO_SMS_FROM && smsBody) {
		results.push(
			client().messages.create({
				from: process.env.TWILIO_SMS_FROM,
				to,
				body: smsBody,
			}),
		);
	}

	if (ch.has("whatsapp") && process.env.TWILIO_WHATSAPP_FROM && whatsappBody) {
		results.push(
			client().messages.create({
				from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
				to: `whatsapp:${to}`,
				body: whatsappBody,
			}),
		);
	}

	await Promise.allSettled(results);
	return { ok: true };
}

