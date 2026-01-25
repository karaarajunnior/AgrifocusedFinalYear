import crypto from "crypto";
import prisma from "../db/prisma.js";
import blockchainService from "./blockchainService.js";

function sha256Hex(s) {
	return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function generateShortCode() {
	// 6 digits, easy for offline/SMS
	return String(Math.floor(100000 + Math.random() * 900000));
}

function generateQrToken() {
	return crypto.randomBytes(24).toString("hex");
}

export async function createDeliveryProof({ orderId, generatedByUserId, gpsLocation = null }) {
	const order = await prisma.order.findUnique({
		where: { id: orderId },
		select: { id: true, buyerId: true, farmerId: true, status: true },
	});
	if (!order) return { ok: false, error: "Order not found" };
	if (order.status !== "IN_TRANSIT" && order.status !== "DELIVERED") {
		return { ok: false, error: "Order must be IN_TRANSIT (or DELIVERED) for delivery proof" };
	}

	const code = generateShortCode();
	const qrToken = generateQrToken();

	const upserted = await prisma.deliveryProof.upsert({
		where: { orderId },
		update: {
			codeHash: sha256Hex(code),
			qrTokenHash: sha256Hex(qrToken),
			generatedByUserId,
			generatedAt: new Date(),
			gpsLocation: gpsLocation ? String(gpsLocation) : null,
			confirmedAt: null,
			confirmedByUserId: null,
		},
		create: {
			orderId,
			codeHash: sha256Hex(code),
			qrTokenHash: sha256Hex(qrToken),
			generatedByUserId,
			gpsLocation: gpsLocation ? String(gpsLocation) : null,
		},
	});

	// Panel/demo: return the code and token for QR generation (never store plain)
	return {
		ok: true,
		proof: {
			id: upserted.id,
			orderId,
			code,
			qrToken,
			generatedAt: upserted.generatedAt,
		},
	};
}

export async function verifyDeliveryProof({ orderId, codeOrToken, confirmedByUserId, gpsLocation = null }) {
	const proof = await prisma.deliveryProof.findUnique({ where: { orderId } });
	if (!proof) return { ok: false, error: "No delivery proof found for this order" };
	if (proof.confirmedAt) return { ok: true, alreadyConfirmed: true };

	const hashed = sha256Hex(codeOrToken);
	const matches =
		hashed === proof.codeHash || (proof.qrTokenHash && hashed === proof.qrTokenHash);
	if (!matches) return { ok: false, error: "Invalid delivery code" };

	const updated = await prisma.deliveryProof.update({
		where: { id: proof.id },
		data: {
			confirmedAt: new Date(),
			confirmedByUserId,
			gpsLocation: gpsLocation ? String(gpsLocation) : proof.gpsLocation,
		},
	});

	// Automation: mark order delivered when buyer confirms delivery
	const order = await prisma.order.update({
		where: { id: orderId },
		data: { status: "DELIVERED" },
	});

	// Optional: record a hash on the chain (simulation-safe)
	try {
		await blockchainService.init?.();
		const orderHash = blockchainService.computePaymentProofOrderHash?.(orderId);
		const detailsHash = blockchainService.web3?.utils?.soliditySha3?.(
			{ t: "string", v: "delivery_proof" },
			{ t: "string", v: updated.id },
			{ t: "string", v: updated.confirmedAt?.toISOString?.() || "" },
		);
		// In simulation mode, just record as a blockchain transaction; in real mode, this is a placeholder.
		if (orderHash && detailsHash && blockchainService.recordPaymentProofOnChain) {
			const chain = await blockchainService.recordPaymentProofOnChain({
				orderHash,
				detailsHash,
				buyerWallet: order.buyerId,
				farmerWallet: order.farmerId,
				buyerSignature: "0x",
				farmerSignature: "0x",
			});
			if (chain?.transactionHash) {
				await prisma.deliveryProof.update({
					where: { id: updated.id },
					data: {
						chainTxHash: chain.transactionHash,
						chainBlockNumber: chain.blockNumber || null,
					},
				});
			}
		}
	} catch {
		// Non-fatal
	}

	return { ok: true, delivered: true, order };
}

