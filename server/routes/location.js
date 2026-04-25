import express from 'express';
import locationService from '../services/locationService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Detect location of searching user (buyer)
router.get('/detect', authenticateToken, async (req, res) => {
	try {
		// Use request IP (standard express property, though may need adjustment if behind proxy)
		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
		const location = await locationService.detectLocation(ip);
		res.json(location);
	} catch (error) {
		res.status(500).json({ error: "Failed to detect location" });
	}
});

// Get map URL for a specific location string
router.get('/map-url', authenticateToken, (req, res) => {
	const { location, latitude, longitude } = req.query;
	if (!location && (!latitude || !longitude)) {
		return res.status(400).json({ error: "Location string or coordinates are required" });
	}
	const url = locationService.getMapUrl(location, { latitude, longitude });
	res.json({ url });
});

export default router;
