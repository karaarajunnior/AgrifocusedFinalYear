import express from "express";
import { query, validationResult } from "express-validator";
import { authenticateToken } from "../middleware/auth.js";
import { getClimateAlerts } from "../services/climateService.js";

const router = express.Router();

router.get(
	"/alerts",
	authenticateToken,
	[query("location").isString().trim().isLength({ min: 2, max: 120 })],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const result = await getClimateAlerts({ location: req.query.location });
			if (!result.ok) return res.status(500).json({ error: result.error });
			return res.json({ alerts: result.alerts, cached: result.cached });
		} catch (error) {
			console.error("Climate alerts error:", error);
			res.status(500).json({ error: "Failed to fetch climate alerts" });
		}
	},
);

export default router;

