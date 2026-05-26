import express from "express";
import { query, validationResult } from "express-validator";
import { authenticateToken } from "../middleware/auth.js";
import { getClimateAlerts } from "../services/climateService.js";

const router = express.Router();

router.get(
	"/alerts",
	authenticateToken,
	[
		query("location").optional().isString().trim().isLength({ min: 2, max: 120 }),
		query("latitude").optional().isFloat({ min: -90, max: 90 }),
		query("longitude").optional().isFloat({ min: -180, max: 180 }),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const hasLocation = typeof req.query.location === "string" && req.query.location.trim().length >= 2;
			const hasCoordinates = req.query.latitude !== undefined && req.query.longitude !== undefined;
			if (!hasLocation && !hasCoordinates) {
				return res.status(400).json({ error: "Location or coordinates are required" });
			}

			const result = await getClimateAlerts({
				location: req.query.location,
				latitude: req.query.latitude,
				longitude: req.query.longitude,
			});
			if (!result.ok) {
				return res.status(result.error === "location_not_found" ? 404 : 500).json({ error: result.error });
			}
			return res.json({ alerts: result.alerts, cached: result.cached, coordinates: result.coordinates });
		} catch (error) {
			console.error("Climate alerts error:", error);
			res.status(500).json({ error: "Failed to fetch climate alerts" });
		}
	},
);

export default router;

