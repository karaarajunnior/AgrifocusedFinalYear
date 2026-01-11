import express from "express";
import { body, query, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { refreshMarketWebPrices } from "../services/webMarketDataService.js";

const prisma = new PrismaClient();
const router = express.Router();

// Admin/manual ingestion (best for n8n workflows)
router.post(
	"/ingest",
	authenticateToken,
	requireRole(["ADMIN"]),
	[
		body("items").isArray({ min: 1, max: 500 }),
		body("source").optional().isString().trim().isLength({ min: 2, max: 64 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const source = String(req.body.source || "manual");
			let inserted = 0;

			for (const row of req.body.items) {
				const price = Number(row.price);
				if (!Number.isFinite(price)) continue;

				await prisma.marketWebPrice.create({
					data: {
						category: row.category || null,
						commodity: row.commodity ? String(row.commodity) : null,
						market: row.market ? String(row.market) : "local",
						country: row.country ? String(row.country) : null,
						location: row.location ? String(row.location) : null,
						price,
						currency: row.currency ? String(row.currency) : "UGX",
						unit: row.unit ? String(row.unit) : null,
						source,
						sourceUrl: row.sourceUrl ? String(row.sourceUrl) : null,
						collectedAt: row.collectedAt ? new Date(row.collectedAt) : new Date(),
						raw: JSON.stringify(row),
					},
				});
				inserted++;
			}

			res.json({ message: "Ingested", inserted });
		} catch (error) {
			console.error("Market data ingest error:", error);
			res.status(500).json({ error: "Failed to ingest market data" });
		}
	},
);

// Admin: refresh from configured sources (MARKET_DATA_SOURCES_JSON)
router.post(
	"/refresh",
	authenticateToken,
	requireRole(["ADMIN"]),
	async (req, res) => {
		try {
			const results = await refreshMarketWebPrices();
			res.json({ results });
		} catch (error) {
			console.error("Market data refresh error:", error);
			res.status(500).json({ error: "Failed to refresh market data" });
		}
	},
);

// Query latest web price signals (admin-only)
router.get(
	"/latest",
	authenticateToken,
	requireRole(["ADMIN"]),
	[
		query("category").optional().isString(),
		query("country").optional().isString(),
		query("market").optional().isString(),
		query("limit").optional().isInt({ min: 1, max: 100 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const limit = req.query.limit ? parseInt(req.query.limit) : 20;
			const where = {};
			if (req.query.category) where.category = req.query.category;
			if (req.query.country) where.country = req.query.country;
			if (req.query.market) where.market = req.query.market;

			const items = await prisma.marketWebPrice.findMany({
				where,
				orderBy: { collectedAt: "desc" },
				take: limit,
			});

			res.json({ items });
		} catch (error) {
			console.error("Market data query error:", error);
			res.status(500).json({ error: "Failed to query market data" });
		}
	},
);

export default router;

