import express from "express";
import { query, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { getTopBuyers, getTopFarmers } from "../services/marketCapabilityService.js";

const router = express.Router();

// Admin-only, because it ranks users (sensitive)
router.get(
	"/capability",
	authenticateToken,
	requireRole(["ADMIN"]),
	[
		query("market").optional().isIn(["local", "urban", "international"]),
		query("country").optional().isString().trim().isLength({ min: 2, max: 64 }),
		query("limit").optional().isInt({ min: 1, max: 50 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const market = req.query.market || "local";
			const country = req.query.country || "Uganda";
			const limit = req.query.limit ? parseInt(req.query.limit) : 10;

			const [buyers, farmers] = await Promise.all([
				getTopBuyers({ market, country, limit }),
				getTopFarmers({ market, country, limit }),
			]);

			res.json({ market, country, buyers, farmers });
		} catch (error) {
			console.error("Market capability error:", error);
			res.status(500).json({ error: "Failed to compute market capability" });
		}
	},
);

export default router;

