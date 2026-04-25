import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import ai from "../services/aiService.js";
import prisma from "../db/prisma.js";

const router = express.Router();

/**
 * GET /api/intelligence/trends
 * Fetches real-time market trends and prices for a specific category
 */
router.get("/trends", authenticateToken, async (req, res) => {
	try {
		const { category, location } = req.query;
		const trends = await ai.getMarketIntelligence(category || "Coffee", location || "Uganda");
		res.json({ success: true, trends });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/intelligence/leads
 * Proactively find matching buyers for a farmer or products for a buyer
 */
router.get("/leads", authenticateToken, async (req, res) => {
	try {
		const matches = await ai.getProactiveMatches(req.user.id);
		res.json({ success: true, matches });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * GET /api/intelligence/advisor
 * Returns personalized "Next Steps" for the user dashboard
 */
router.get("/advisor", authenticateToken, async (req, res) => {
	try {
		const guidance = await ai.getAIGuidance(req.user.id);
		res.json({ success: true, guidance });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * POST /api/intelligence/market-post
 * Generates marketing content for a listing
 */
router.post("/marketing-content", authenticateToken, async (req, res) => {
	try {
		const { productId } = req.body;
		const product = await prisma.product.findUnique({
			where: { id: productId }
		});
		if (!product) return res.status(404).json({ error: "Product not found" });

		const content = await ai.generateMarketingContent(product);
		res.json({ success: true, content });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

export default router;
