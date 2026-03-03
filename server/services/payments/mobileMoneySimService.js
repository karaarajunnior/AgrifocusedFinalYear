import crypto from "crypto";

/**
 * Simulated Mobile Money Service for DAFIS
 *
 * Replaces the Airtel Money API with an in-process simulation.
 * Generates the same data structures (reference IDs, statuses)
 * so the rest of the system (blockchain, ledger, notifications)
 * works without changes.
 *
 * Payments auto-complete after a configurable delay to mimic
 * phone-side approval during presentations.
 */

// In-memory store of pending payments (cleared on restart — fine for presentation)
const pendingPayments = new Map();

export function normalizeUgMsisdn(input) {
	let msisdn = String(input || "").trim();
	msisdn = msisdn.replace(/\s+/g, "");
	msisdn = msisdn.replace(/^\+/, "");
	if (msisdn.startsWith("0")) msisdn = "256" + msisdn.slice(1);
	if (!msisdn.startsWith("256")) throw new Error("Phone must be a Uganda number");
	if (!/^\d{12}$/.test(msisdn)) throw new Error("Invalid phone format");
	return msisdn;
}

function makeReference(prefix = "DAFIS") {
	const rand = crypto.randomBytes(8).toString("hex");
	return `${prefix}-${Date.now()}-${rand}`.slice(0, 64);
}

/**
 * Simulate initiating a mobile money collection.
 * Returns a reference immediately. The payment auto-completes
 * after PAYMENT_AUTO_COMPLETE_MS (default 3000ms).
 */
export async function initiateCollection({
	amountUgx,
	msisdn,
	orderId,
}) {
	const reference = makeReference("DAFIS-ORDER");
	const providerReference = makeReference("MOMO-REF");

	const payment = {
		reference,
		providerReference,
		orderId,
		amountUgx,
		msisdn,
		status: "PENDING",
		createdAt: new Date().toISOString(),
	};

	pendingPayments.set(reference, payment);

	// Auto-complete after configurable delay (simulates phone-side approval)
	const delayMs = Number(process.env.PAYMENT_AUTO_COMPLETE_MS || 3000);
	setTimeout(() => {
		const p = pendingPayments.get(reference);
		if (p && p.status === "PENDING") {
			p.status = "COMPLETED";
			// Trigger the internal webhook callback if a handler is registered
			if (_webhookHandler) {
				_webhookHandler({
					transaction: {
						id: providerReference,
						status: "SUCCESS",
					},
					reference,
				});
			}
		}
	}, delayMs);

	return {
		reference,
		providerReference,
		raw: {
			status: { code: "200", message: "Payment initiated successfully" },
			data: {
				transaction: { id: providerReference, status: "PENDING" },
			},
		},
	};
}

/**
 * Manually complete a pending payment (e.g. from admin panel).
 */
export function manualComplete(reference) {
	const p = pendingPayments.get(reference);
	if (!p) return { ok: false, error: "Payment not found" };
	p.status = "COMPLETED";
	if (_webhookHandler) {
		_webhookHandler({
			transaction: { id: p.providerReference, status: "SUCCESS" },
			reference,
		});
	}
	return { ok: true };
}

/**
 * Get all pending payments (for admin visibility).
 */
export function getPendingPayments() {
	return [...pendingPayments.values()].filter((p) => p.status === "PENDING");
}

/**
 * Webhook verification — always returns true for simulation.
 */
export function verifyWebhook(req) {
	return true;
}

// Internal webhook handler registration
let _webhookHandler = null;

export function registerWebhookHandler(handler) {
	_webhookHandler = handler;
}
