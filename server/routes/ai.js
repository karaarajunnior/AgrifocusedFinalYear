import express from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import aiService from "../services/aiService.js";
import { requireVerified } from "../middleware/verified.js";

const prisma = new PrismaClient();
const router = express.Router();

// Advanced price prediction using AI
router.post(
	"/predict-price",
	authenticateToken,
	requireVerified,
	[
		body("category").isString().trim().isLength({ min: 2, max: 30 }),
		body("quantity").isInt({ min: 1 }),
		body("location").isString().trim().isLength({ min: 2, max: 100 }),
		body("organic").optional().isBoolean(),
	],
	async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

		const productData = req.body;
		const prediction = await aiService.predictPrice(productData);

		res.json({
			success: true,
			prediction,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Price prediction error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to predict price",
			message: error.message,
		});
	}
	},
);

// Advanced demand forecasting
router.post(
	"/forecast-demand",
	authenticateToken,
	requireVerified,
	[
		body("productData").isObject(),
		body("productData.category").optional().isString().trim().isLength({ min: 2, max: 30 }),
		body("productData.location").optional().isString().trim().isLength({ min: 2, max: 100 }),
		body("timeframe").optional().isInt({ min: 1, max: 365 }),
	],
	async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

		const { productData, timeframe } = req.body;
		const forecast = await aiService.forecastDemand(productData, timeframe);

		res.json({
			success: true,
			forecast,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Demand forecasting error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to forecast demand",
			message: error.message,
		});
	}
	},
);

// Crop recommendations for farmers
router.post(
	"/recommend-crops",
	authenticateToken,
	requireVerified,
	[
		body("location").isString().trim().isLength({ min: 2, max: 100 }),
		body("soilType").optional().isString().trim().isLength({ min: 2, max: 40 }),
		body("climate").optional().isString().trim().isLength({ min: 2, max: 40 }),
		body("farmSize").optional().isFloat({ min: 0.1, max: 100000 }),
	],
	async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

		const farmerData = req.body;
		const recommendations = await aiService.recommendCrops(farmerData);

		res.json({
			success: true,
			recommendations,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Crop recommendation error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to generate crop recommendations",
			message: error.message,
		});
	}
	},
);

// Market analysis
router.post(
	"/analyze-market",
	authenticateToken,
	requireVerified,
	[
		body("category").optional().isString().trim().isLength({ min: 2, max: 30 }),
		body("location").optional().isString().trim().isLength({ min: 2, max: 100 }),
	],
	async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

		const { category, location } = req.body;
		const analysis = await aiService.analyzeMarket(category, location);

		res.json({
			success: true,
			analysis,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Market analysis error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to analyze market",
			message: error.message,
		});
	}
	},
);

// Get AI model performance metrics
router.get("/model-performance", authenticateToken, requireVerified, async (req, res) => {
	try {
		const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const [pricePoints, orders, views] = await Promise.all([
			prisma.priceHistory.count({ where: { date: { gte: since30d } } }),
			prisma.userAnalytics.count({ where: { event: "order_placed", timestamp: { gte: since30d } } }),
			prisma.userAnalytics.count({ where: { event: "product_view", timestamp: { gte: since30d } } }),
		]);

		const performance = {
			dataSignals: {
				priceHistoryPoints30d: pricePoints,
				ordersPlaced30d: orders,
				productViews30d: views,
				conversionApprox: views > 0 ? Math.round((orders / views) * 1000) / 10 : 0,
			},
			systemHealth: {
				status: "healthy",
				uptimeSec: process.uptime(),
				lastUpdate: new Date(),
			},
		};

		res.json({
			success: true,
			performance,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Performance metrics error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch performance metrics",
		});
	}
});

export default router;
