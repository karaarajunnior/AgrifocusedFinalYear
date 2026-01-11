import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_ACCOUNTS = {
	AIRTEL_CASH: { code: "1000", name: "Airtel Money Clearing (UGX)", type: "ASSET" },
	FARMER_PAYABLES: { code: "2000", name: "Payables to Farmers (UGX)", type: "LIABILITY" },
	PLATFORM_FEES: { code: "4000", name: "Platform Fees Revenue (UGX)", type: "REVENUE" },
};

async function upsertAccount({ code, name, type, parentId = null, userId = null }) {
	return prisma.ledgerAccount.upsert({
		where: { code },
		update: { name, type, parentId, userId },
		create: { code, name, type, parentId, userId },
	});
}

async function ensureBaseAccounts() {
	const cash = await upsertAccount(BASE_ACCOUNTS.AIRTEL_CASH);
	const payables = await upsertAccount(BASE_ACCOUNTS.FARMER_PAYABLES);
	const fees = await upsertAccount(BASE_ACCOUNTS.PLATFORM_FEES);
	return { cash, payables, fees };
}

async function ensureFarmerPayableSubledger({ farmerId, farmerName, parent }) {
	const code = `2000-${farmerId.slice(-8)}`;
	const name = `Farmer Payable - ${farmerName || farmerId}`;
	return upsertAccount({
		code,
		name,
		type: "LIABILITY",
		parentId: parent.id,
		userId: farmerId,
	});
}

function feeRate() {
	const r = Number(process.env.PLATFORM_FEE_RATE || 0.02);
	if (Number.isNaN(r) || r < 0 || r > 0.2) return 0.02;
	return r;
}

function round2(n) {
	return Math.round(n * 100) / 100;
}

export async function postAirtelPaymentCompleted({ transactionId }) {
	// Idempotent by (referenceType, referenceId)
	const existing = await prisma.journalEntry.findUnique({
		where: {
			referenceType_referenceId: { referenceType: "airtel_payment", referenceId: transactionId },
		},
	});
	if (existing) return { ok: true, entryId: existing.id, idempotent: true };

	const tx = await prisma.transaction.findUnique({
		where: { id: transactionId },
		include: { order: { include: { farmer: true, buyer: true } } },
	});
	if (!tx) throw new Error("Transaction not found");

	if (tx.status !== "COMPLETED") {
		return { ok: false, reason: "transaction_not_completed" };
	}

	const { cash, payables, fees } = await ensureBaseAccounts();
	const farmerSub = await ensureFarmerPayableSubledger({
		farmerId: tx.order.farmerId,
		farmerName: tx.order.farmer?.name,
		parent: payables,
	});

	const gross = Number(tx.amount || 0);
	const fee = round2(gross * feeRate());
	const farmerNet = round2(gross - fee);

	if (gross <= 0) return { ok: false, reason: "invalid_amount" };
	if (farmerNet < 0) return { ok: false, reason: "invalid_net_amount" };

	const entry = await prisma.journalEntry.create({
		data: {
			referenceType: "airtel_payment",
			referenceId: tx.id,
			orderId: tx.orderId,
			currency: tx.currency || "UGX",
			memo: `Airtel Money payment completed for order ${tx.orderId}`,
			lines: {
				create: [
					{
						accountId: cash.id,
						debit: gross,
						credit: 0,
						memo: "Cash received (Airtel clearing)",
					},
					{
						accountId: farmerSub.id,
						debit: 0,
						credit: farmerNet,
						memo: "Payable to farmer",
					},
					{
						accountId: fees.id,
						debit: 0,
						credit: fee,
						memo: "Platform fee revenue",
					},
				],
			},
		},
	});

	// Link for convenience
	await prisma.transaction.update({
		where: { id: tx.id },
		data: { ledgerEntryId: entry.id },
	});

	return { ok: true, entryId: entry.id, idempotent: false };
}

