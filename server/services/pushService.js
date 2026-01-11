import admin from "firebase-admin";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let initialized = false;

function initFirebase() {
	if (initialized) return;
	const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
	if (!json) return;

	try {
		const serviceAccount = JSON.parse(json);
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});
		initialized = true;
	} catch (e) {
		console.error("Failed to init Firebase Admin:", e?.message || e);
	}
}

export async function sendPushToUser(userId, payload) {
	initFirebase();
	if (!initialized) return { ok: false, reason: "firebase_not_configured" };

	const tokens = await prisma.deviceToken.findMany({
		where: { userId },
		select: { token: true },
	});
	if (!tokens.length) return { ok: false, reason: "no_tokens" };

	// FCM supports both notification + data. Keep data for automation.
	const message = {
		notification: payload.notification,
		data: payload.data,
		tokens: tokens.map((t) => t.token),
	};

	const res = await admin.messaging().sendEachForMulticast(message);

	// Cleanup invalid tokens
	const toDelete = [];
	res.responses.forEach((r, idx) => {
		if (!r.success) {
			const code = r.error?.code || "";
			if (
				code.includes("registration-token-not-registered") ||
				code.includes("invalid-argument")
			) {
				toDelete.push(tokens[idx].token);
			}
		}
	});
	if (toDelete.length) {
		await prisma.deviceToken.deleteMany({ where: { token: { in: toDelete } } });
	}

	return { ok: true, successCount: res.successCount, failureCount: res.failureCount };
}

