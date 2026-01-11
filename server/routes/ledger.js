import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../db/prisma.js";

const router = express.Router();

// Admin: list recent journal entries
router.get(
	"/entries",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const entries = await prisma.journalEntry.findMany({
				orderBy: { createdAt: "desc" },
				take: 50,
				include: {
					lines: {
						include: { account: true },
					},
				},
			});
			res.json({ entries });
		} catch (error) {
			console.error("Ledger entries error:", error);
			res.status(500).json({ error: "Failed to fetch ledger entries" });
		}
	},
);

// Admin: subledger for a farmer (payables account children)
router.get(
	"/subledger/farmer/:farmerId",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const { farmerId } = req.params;
			const account = await prisma.ledgerAccount.findFirst({
				where: { userId: farmerId, code: { startsWith: "2000-" } },
			});
			if (!account) return res.json({ account: null, lines: [] });

			const lines = await prisma.journalLine.findMany({
				where: { accountId: account.id },
				include: { entry: true },
				orderBy: { entry: { createdAt: "desc" } },
				take: 200,
			});

			const balance = lines.reduce((b, l) => b + (l.credit - l.debit), 0);

			res.json({ account, balance, lines });
		} catch (error) {
			console.error("Farmer subledger error:", error);
			res.status(500).json({ error: "Failed to fetch subledger" });
		}
	},
);

export default router;

