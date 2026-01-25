import axios from "axios";
import crypto from "crypto";
import { getRedis } from "../../redis.js";

function getBaseUrl() {
	// Airtel Africa Open API endpoints differ by env; keep configurable
	if (process.env.AIRTEL_BASE_URL) return process.env.AIRTEL_BASE_URL;
	const env = (process.env.AIRTEL_ENV || "sandbox").toLowerCase();
	return env === "production"
		? "https://openapi.airtel.africa"
		: "https://openapiuat.airtel.africa";
}

function requiredEnv(name) {
	const v = process.env[name];
	if (!v) throw new Error(`Missing ${name}`);
	return v;
}

async function getAccessToken() {
	const redis = getRedis();
	const cacheKey = "airtel:oauth:token";
	if (redis) {
		const cached = await redis.get(cacheKey);
		if (cached) return cached;
	}

	const clientId = requiredEnv("AIRTEL_CLIENT_ID");
	const clientSecret = requiredEnv("AIRTEL_CLIENT_SECRET");

	const url = `${getBaseUrl()}/auth/oauth2/token`;
	const authMode = (process.env.AIRTEL_AUTH_MODE || "basic").toLowerCase();

	const data = new URLSearchParams();
	data.set("grant_type", "client_credentials");

	const headers = {
		"Content-Type": "application/x-www-form-urlencoded",
	};

	if (authMode === "basic") {
		headers.Authorization =
			"Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
	} else {
		data.set("client_id", clientId);
		data.set("client_secret", clientSecret);
	}

	const res = await axios.post(url, data.toString(), { headers });
	const token = res.data?.access_token;
	const expiresIn = Number(res.data?.expires_in || 0);
	if (!token) throw new Error("Airtel auth failed: missing access_token");

	// Cache slightly under expiry
	if (redis && expiresIn > 10) {
		await redis.set(cacheKey, token, "EX", Math.max(1, expiresIn - 10));
	}

	return token;
}

export function normalizeUgMsisdn(input) {
	let msisdn = String(input || "").trim();
	msisdn = msisdn.replace(/\s+/g, "");
	msisdn = msisdn.replace(/^\+/, "");
	if (msisdn.startsWith("0")) msisdn = "256" + msisdn.slice(1);
	if (!msisdn.startsWith("256")) throw new Error("Phone must be a Uganda number");
	if (!/^\d{12}$/.test(msisdn)) throw new Error("Invalid phone format");
	return msisdn;
}

function makeReference(prefix = "AGRI") {
	const rand = crypto.randomBytes(8).toString("hex");
	return `${prefix}-${Date.now()}-${rand}`.slice(0, 64);
}

export async function initiateAirtelUgCollection({
	amountUgx,
	msisdn,
	orderId,
}) {
	const token = await getAccessToken();
	const reference = makeReference("AGRI-ORDER");

	// These headers are per Airtel Open API patterns
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: "application/json",
		"Content-Type": "application/json",
		"X-Country": "UG",
		"X-Currency": "UGX",
	};

	// Body structure can vary by Airtel deployment; keep it flexible and log raw responses.
	const payload = {
		reference,
		subscriber: {
			country: "UG",
			currency: "UGX",
			msisdn,
		},
		transaction: {
			amount: String(Math.round(amountUgx)),
			country: "UG",
			currency: "UGX",
			id: reference,
		},
		meta: {
			orderId,
		},
	};

	const url = `${getBaseUrl()}/merchant/v1/payments/`;
	const res = await axios.post(url, payload, { headers });

	// Provider reference could be returned as transaction.id/reference depending on API version
	const providerReference =
		res.data?.transaction?.id ||
		res.data?.data?.transaction?.id ||
		res.data?.reference ||
		reference;

	return {
		reference,
		providerReference: String(providerReference),
		raw: res.data,
	};
}

export function verifyAirtelWebhook(req) {
	// Optional: verify if you configure a secret
	const secret = process.env.AIRTEL_WEBHOOK_SECRET;
	if (!secret) return true;

	const signature = req.get("x-airtel-signature") || req.get("X-Airtel-Signature");
	if (!signature) return false;

	const body = JSON.stringify(req.body || {});
	const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
	return crypto.timingSafeEqual(
		Buffer.from(signature, "utf8"),
		Buffer.from(expected, "utf8"),
	);
}

