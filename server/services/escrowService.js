import prisma from "../db/prisma.js";
import blockchainService from "./blockchainService.js";
import { postPaymentCompleted } from "./ledgerService.js";
import { emitToUser } from "../realtime.js";
import { sendPushToUser } from "./pushService.js";
import { notifyUser } from "./smsWhatsappService.js";

export async function releaseEscrowForOrder(orderId) {
	try {
		const tx = await prisma.transaction.findFirst({
			where: { orderId, status: "ESCROW_LOCKED" },
			include: { order: true }
		});
		if (!tx) {
			console.log(`[ESCROW] No locked escrow transaction found for order ${orderId}`);
			return { success: false, reason: "No locked escrow transaction found" };
		}

		console.log(`[ESCROW] Releasing locked escrow funds for order ${orderId}, amount: UGX ${tx.amount}`);

		// Update transaction status to COMPLETED
		const updatedTx = await prisma.transaction.update({
			where: { id: tx.id },
			data: { status: "COMPLETED" },
		});

		// Release escrow on blockchain (simulated or real)
		try {
			const chain = await blockchainService.completeTransaction(orderId);
			if (chain && chain.transactionHash) {
				await prisma.transaction.update({
					where: { id: tx.id },
					data: {
						blockHash: chain.transactionHash,
						blockNumber: chain.blockNumber,
						gasUsed: chain.gasUsed,
					}
				});
			}
		} catch (chainErr) {
			console.error("[ESCROW] Blockchain completeTransaction failed:", chainErr);
		}

		// Perform automated input-debt settlement for the farmer
		try {
			const activeCredits = await prisma.inputCredit.findMany({
				where: {
					farmerId: tx.order.farmerId,
					status: { in: ['APPROVED', 'ACTIVE'] }
				},
				orderBy: { createdAt: 'asc' }
			});

			let totalDeducted = 0;
			for (const credit of activeCredits) {
				const maxDeduction = tx.amount * 0.5; // Max 50% deduction
				if (totalDeducted + credit.totalAmount <= maxDeduction) {
					await prisma.inputCredit.update({
						where: { id: credit.id },
						data: { status: 'SETTLED' }
					});
					totalDeducted += credit.totalAmount;
				}
			}

			if (totalDeducted > 0) {
				console.log(`[ESCROW] Automatically settled UGX ${totalDeducted} input debt for farmer ${tx.order.farmerId} upon escrow release.`);
			}
		} catch (creditErr) {
			console.error("[ESCROW] Debt settlement failed during escrow release:", creditErr);
		}

		// Post payment completion to ledger
		try {
			await postPaymentCompleted({ transactionId: tx.id });
		} catch (ledgerErr) {
			console.error("[ESCROW] Ledger posting failed during escrow release:", ledgerErr);
		}

		// Notifications (Realtime, Push, SMS/WhatsApp)
		try {
			const escrowNotify = {
				type: "escrow_release",
				orderId,
				status: "RELEASED",
				timestamp: new Date().toISOString()
			};
			emitToUser(tx.order.buyerId, "notify", escrowNotify);
			emitToUser(tx.order.farmerId, "notify", escrowNotify);

			await sendPushToUser(tx.order.buyerId, {
				notification: {
					title: "Escrow funds released",
					body: `Your payment of UGX ${tx.amount.toLocaleString()} has been released to the farmer.`,
				},
				data: { type: "escrow_release", orderId, status: "RELEASED" }
			});

			await sendPushToUser(tx.order.farmerId, {
				notification: {
					title: "Escrow funds released",
					body: `Escrow payment of UGX ${tx.amount.toLocaleString()} has been released to your account.`,
				},
				data: { type: "escrow_release", orderId, status: "RELEASED" }
			});

			await notifyUser({
				userId: tx.order.buyerId,
				type: "payment",
				smsBody: `DAFIS: Escrow funds of UGX ${tx.amount.toLocaleString()} released for order ${orderId.slice(-8)}.`,
				whatsappBody: `DAFIS: Escrow funds of *UGX ${tx.amount.toLocaleString()}* released for order *${orderId.slice(-8)}*.`,
			});

			await notifyUser({
				userId: tx.order.farmerId,
				type: "payment",
				smsBody: `DAFIS: Escrow payment of UGX ${tx.amount.toLocaleString()} has been released to your account.`,
				whatsappBody: `DAFIS: Escrow payment of *UGX ${tx.amount.toLocaleString()}* has been released to your account.`,
			});
		} catch (notifyErr) {
			console.error("[ESCROW] Notifications failed during escrow release:", notifyErr);
		}

		return { success: true };
	} catch (err) {
		console.error("[ESCROW] releaseEscrowForOrder error:", err);
		return { success: false, error: err.message };
	}
}
