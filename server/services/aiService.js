import tf from "@tensorflow/tfjs";
import prisma from "../db/prisma.js";
import OpenAI from "openai";

const CATEGORY_ALIASES = {
	BEANS: "PULSES",
	PEAS: "PULSES",
	MAIZE: "GRAINS",
	CORN: "GRAINS",
	RICE: "GRAINS",
	TOMATO: "VEGETABLES",
	TOMATOES: "VEGETABLES",
	ONION: "VEGETABLES",
	ONIONS: "VEGETABLES",
	POTATO: "VEGETABLES",
	POTATOES: "VEGETABLES",
	BANANA: "FRUITS",
	BANANAS: "FRUITS",
	MATOKE: "FRUITS",
	MILK: "DAIRY",
	CHICKEN: "POULTRY",
	COFFEE: "COFFEE",
	ROBUSTA_COFFEE: "COFFEE",
	ARABICA_COFFEE: "COFFEE",
};

const MARKET_PRICE_BASELINES = {
	COFFEE: { low: 5500, high: 8500 },
	VEGETABLES: { low: 1200, high: 4500 },
	FRUITS: { low: 1500, high: 5000 },
	GRAINS: { low: 1800, high: 3600 },
	PULSES: { low: 3000, high: 6500 },
	SPICES: { low: 6000, high: 16000 },
	DAIRY: { low: 1800, high: 3200 },
	POULTRY: { low: 9000, high: 15000 },
	ORGANIC: { low: 2500, high: 6500 },
	PROCESSED: { low: 4000, high: 9000 },
};

class AIService {
	constructor() {
		this.isInitialized = false;
		if (process.env.OPENAI_API_KEY) {
			this.openai = new OpenAI({
				apiKey: process.env.OPENAI_API_KEY
			});
		} else {
			console.warn("OPENAI_API_KEY not found. AI features will be disabled.");
			this.openai = null;
		}
		this.initializeModels();
	}

	async initializeModels() {
		try {
			console.log(" Initializing AI models...");
			this.isInitialized = true;
			console.log("AI models initialized successfully");
		} catch (error) {
			console.error("AI model initialization error:", error);
			this.isInitialized = false;
		}
	}

	// Advanced price prediction with multiple factors
	async predictPrice(productData) {
		try {
			const normalizedProductData = this.normalizeProductInput(productData);
			console.log(" Predicting price for:", normalizedProductData);
			// Keep response time snappy in production
			const t0 = Date.now();

			// Pull recent internal and market price signals (best-effort)
			const [recentPrices, currentMarketPrice] = await Promise.all([
				this.getRecentPricesForSignal(normalizedProductData),
				this.getCurrentPriceSignal(normalizedProductData),
			]);
			const dbAvg =
				recentPrices.length > 0
					? recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length
					: null;

			// Base price calculation with AI factors
			const basePrice = this.getBasePriceForCategory(normalizedProductData.category);
			const seasonalFactor = this.getSeasonalFactor(normalizedProductData.category);
			const locationFactor = this.getLocationFactor(normalizedProductData.location);
			const organicFactor = normalizedProductData.organic ? 1.3 : 1.0;
			const supplyFactor = this.getSupplyFactor(normalizedProductData.quantity);
			const demandFactor = await this.getDemandFactorFromDb(normalizedProductData.category);

			// AI-predicted price
			let predictedPrice =
				basePrice *
				seasonalFactor *
				locationFactor *
				organicFactor *
				supplyFactor *
				demandFactor;

			const signals = [];
			if (dbAvg !== null) signals.push({ price: dbAvg, weight: 0.3 });
			if (currentMarketPrice) {
				signals.push({
					price: currentMarketPrice.midpoint,
					weight: currentMarketPrice.fallback ? 0.25 : 0.45,
				});
			}

			// Blend heuristics with observed/internal prices. A baseline signal is always available,
			// so the user receives a useful 24/7 estimate even before fresh web data is ingested.
			if (signals.length > 0) {
				const totalWeight = Math.min(
					0.75,
					signals.reduce((sum, signal) => sum + signal.weight, 0),
				);
				const weightedSignal =
					signals.reduce((sum, signal) => sum + signal.price * signal.weight, 0) /
					signals.reduce((sum, signal) => sum + signal.weight, 0);
				predictedPrice = predictedPrice * (1 - totalWeight) + weightedSignal * totalWeight;
			}

			// Calculate confidence based on data quality
			const confidence = this.calculatePriceConfidence(
				normalizedProductData,
				predictedPrice,
				{
					priceSamples: recentPrices.length,
					marketSamples: currentMarketPrice?.samples || 0,
					usedBaseline: currentMarketPrice?.fallback || false,
				},
			);

			// Market analysis
			const marketAnalysis = await this.analyzeMarket(
				normalizedProductData.category,
				normalizedProductData.location,
			);

			return {
				predictedPrice: Math.max(5, Math.round(predictedPrice * 100) / 100),
				confidence: confidence,
				marketAnalysis: marketAnalysis.summary,
				factors: {
					seasonal: seasonalFactor,
					supply: supplyFactor,
					demand: demandFactor,
					quality: organicFactor,
					location: locationFactor,
				},
				recommendations: this.generatePriceRecommendations(
					normalizedProductData,
					predictedPrice,
				),
				currentMarketPrice,
				telemetry: {
					usedDbSignal: dbAvg !== null,
					priceSamples: recentPrices.length,
					marketSamples: currentMarketPrice?.samples || 0,
					marketSignalSource: currentMarketPrice?.source,
					processingMs: Date.now() - t0,
				},
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Price prediction error:", error);
			return this.getFallbackPricePrediction(productData);
		}
	}

	// Advanced demand forecasting
	async forecastDemand(productData, timeframe = 30) {
		try {
			console.log("Forecasting demand for:", productData);
			const t0 = Date.now();

			const demandScore = await this.calculateDemandScoreFromDb(
				productData,
				timeframe,
			);
			const demandLevel = this.scoreToDemandLevel(demandScore);
			const forecastedQuantity = this.calculateForecastedQuantity(
				productData,
				demandScore,
				timeframe,
			);

			return {
				demandLevel: demandLevel,
				demandScore: demandScore,
				forecastedQuantity: forecastedQuantity,
				timeframe: timeframe,
				trends: await this.analyzeDemandTrendsFromDb(productData),
				seasonality: this.getSeasonalDemandPattern(productData.category),
				recommendations: this.generateDemandRecommendations(
					productData,
					demandLevel,
				),
				telemetry: {
					processingMs: Date.now() - t0,
				},
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Demand forecasting error:", error);
			return this.getFallbackDemandForecast(productData);
		}
	}

	// Crop recommendation system
	async recommendCrops(farmerData) {
		try {
			console.log(" Generating crop recommendations for:", farmerData);
			const t0 = Date.now();

			const cropDatabase = this.getCropDatabase();
			const recommendations = [];

			for (const crop of cropDatabase) {
				const suitabilityScore = this.calculateCropSuitability(
					crop,
					farmerData,
				);
				const marketPotential = this.assessMarketPotential(
					crop,
					farmerData.location,
				);
				const profitability = this.calculateProfitability(
					crop,
					farmerData.farmSize || 1,
				);

				if (suitabilityScore > 0.5) {
					recommendations.push({
						crop: crop.name,
						category: crop.category,
						suitabilityScore: Math.round(suitabilityScore * 100),
						marketPotential: Math.round(marketPotential * 100),
						profitability: Math.round(profitability * 100),
						plantingTime: crop.plantingTime,
						harvestTime: crop.harvestTime,
						expectedYield: Math.round(
							crop.expectedYield * (farmerData.farmSize || 1),
						),
						waterRequirement: crop.waterRequirement,
						marketPrice: crop.averagePrice,
						reasons: this.generateRecommendationReasons(
							crop,
							farmerData,
							suitabilityScore,
						),
					});
				}
			}

			// Sort by overall score
			recommendations.sort((a, b) => {
				const scoreA =
					(a.suitabilityScore + a.marketPotential + a.profitability) / 3;
				const scoreB =
					(b.suitabilityScore + b.marketPotential + b.profitability) / 3;
				return scoreB - scoreA;
			});

			return {
				recommendations: recommendations.slice(0, 6),
				season: this.getCurrentSeason(),
				weatherForecast: this.getWeatherInsights(farmerData.location),
				marketTrends: await this.getMarketTrendsFromDb(),
				tips: this.getFarmingTips(farmerData),
				telemetry: { processingMs: Date.now() - t0 },
				timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("Crop recommendation error:", error);
			return this.getFallbackCropRecommendations();
		}
	}

	// Market analysis (DB-driven)
	async analyzeMarket(category, location) {
		try {
			const normalizedCategory = this.normalizeCategory(category);
			const normalizedLocation = this.normalizeLocation(location);
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

			const [deliveredOrders, recentProducts, avgPriceHistory, currentPrice] = await Promise.all([
				prisma.order.count({
					where: {
						status: "DELIVERED",
						createdAt: { gte: since30d },
						product: normalizedCategory ? { category: normalizedCategory } : undefined,
					},
				}),
				prisma.product.count({
					where: {
						available: true,
						quantity: { gt: 0 },
						category: normalizedCategory || undefined,
						location: normalizedLocation ? { contains: normalizedLocation } : undefined,
					},
				}),
				prisma.priceHistory.aggregate({
					where: {
						date: { gte: since30d },
						product: normalizedCategory ? { category: normalizedCategory } : undefined,
					},
					_avg: { price: true },
				}),
				this.getCurrentPriceSignal({ category: normalizedCategory, location: normalizedLocation }),
			]);

			const avgPrice = avgPriceHistory._avg.price || 0;

			return {
				summary: `Last 30 days: ${deliveredOrders} delivered orders. ${recentProducts} active listings. Avg internal price signal: ${avgPrice.toFixed(
					2,
				)}. Current market price: ${currentPrice.priceRange} (${currentPrice.source}).`,
				signals: {
					deliveredOrders30d: deliveredOrders,
					activeListings: recentProducts,
					avgPrice30d: avgPrice,
					currentPrice,
				},
				timestamp: new Date().toISOString(),
			};
		} catch (e) {
			return {
				summary: "Market analysis unavailable (insufficient data).",
				signals: {},
				timestamp: new Date().toISOString(),
			};
		}
	}

	normalizeProductInput(productData = {}) {
		return {
			...productData,
			category: this.normalizeCategory(productData.category || productData.commodity || productData.name),
			quantity: Number.isFinite(Number(productData.quantity))
				? Math.max(1, Number(productData.quantity))
				: 100,
			location: this.normalizeLocation(productData.location) || "Uganda",
			organic: Boolean(productData.organic),
		};
	}

	normalizeCategory(category) {
		const value = String(category || "")
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "");
		return CATEGORY_ALIASES[value] || (MARKET_PRICE_BASELINES[value] ? value : "VEGETABLES");
	}

	normalizeLocation(location) {
		const value = String(location || "").trim();
		if (!value) return "";
		return value.split(",")[0].trim();
	}

	getBaselinePriceRange(category) {
		const normalizedCategory = this.normalizeCategory(category);
		return MARKET_PRICE_BASELINES[normalizedCategory] || MARKET_PRICE_BASELINES.VEGETABLES;
	}

	formatUgx(value) {
		return Math.round(value).toLocaleString("en-US");
	}

	formatPriceRange(low, high, currency = "UGX", unit = "kg") {
		return `${currency} ${this.formatUgx(low)} - ${this.formatUgx(high)}/${unit}`;
	}

	humanizeCategory(category) {
		return this.normalizeCategory(category)
			.toLowerCase()
			.split("_")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}

	async getCurrentPriceSignal(productData = {}) {
		const category = this.normalizeCategory(productData.category || productData.commodity);
		const location = this.normalizeLocation(productData.location);
		const baseline = this.getBaselinePriceRange(category);

		try {
			const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			const commodityLabel = this.humanizeCategory(category);
			const locationFilter = location ? { contains: location } : undefined;

			const [webPrices, marketPrices, productPrice, historyPrice] = await Promise.all([
				prisma.marketWebPrice.findMany({
					where: {
						category,
						location: locationFilter,
					},
					orderBy: { collectedAt: "desc" },
					take: 8,
					select: {
						price: true,
						currency: true,
						unit: true,
						source: true,
						collectedAt: true,
					},
				}),
				prisma.marketPrice.findMany({
					where: {
						commodity: { contains: commodityLabel },
						timestamp: { gte: since90d },
					},
					orderBy: { timestamp: "desc" },
					take: 8,
					select: {
						pricePerKg: true,
						currency: true,
						timestamp: true,
						marketType: true,
					},
				}),
				prisma.product.aggregate({
					where: {
						available: true,
						quantity: { gt: 0 },
						category,
						location: locationFilter,
					},
					_avg: { price: true },
					_count: { price: true },
				}),
				prisma.priceHistory.aggregate({
					where: {
						date: { gte: since90d },
						product: {
							category,
							location: locationFilter,
						},
					},
					_avg: { price: true },
					_count: { price: true },
				}),
			]);

			const signals = [];
			for (const row of webPrices) {
				if (Number.isFinite(row.price)) {
					signals.push({
						price: row.price,
						weight: 1.25,
						source: row.source || "web market",
						updatedAt: row.collectedAt,
					});
				}
			}
			for (const row of marketPrices) {
				if (Number.isFinite(row.pricePerKg)) {
					signals.push({
						price: row.pricePerKg,
						weight: row.marketType === "EXPORT" ? 0.8 : 1,
						source: "regional market",
						updatedAt: row.timestamp,
					});
				}
			}
			if (Number.isFinite(productPrice._avg.price)) {
				signals.push({
					price: productPrice._avg.price,
					weight: Math.min(1.4, 0.7 + productPrice._count.price * 0.05),
					source: "active listings",
					updatedAt: new Date(),
				});
			}
			if (Number.isFinite(historyPrice._avg.price)) {
				signals.push({
					price: historyPrice._avg.price,
					weight: Math.min(1.2, 0.6 + historyPrice._count.price * 0.04),
					source: "price history",
					updatedAt: new Date(),
				});
			}

			if (signals.length === 0) {
				return {
					category,
					priceRange: this.formatPriceRange(baseline.low, baseline.high),
					low: baseline.low,
					high: baseline.high,
					midpoint: (baseline.low + baseline.high) / 2,
					currency: "UGX",
					unit: "kg",
					source: "DAFIS baseline",
					samples: 0,
					confidence: 0.6,
					fallback: true,
					updatedAt: new Date().toISOString(),
				};
			}

			const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
			const midpoint =
				signals.reduce((sum, signal) => sum + signal.price * signal.weight, 0) /
				totalWeight;
			const low = Math.max(100, Math.round((midpoint * 0.9) / 50) * 50);
			const high = Math.max(low, Math.round((midpoint * 1.12) / 50) * 50);
			const latestUpdate = signals
				.map((signal) => new Date(signal.updatedAt).getTime())
				.filter(Number.isFinite)
				.sort((a, b) => b - a)[0];
			const source = [...new Set(signals.map((signal) => signal.source))].join(" + ");

			return {
				category,
				priceRange: this.formatPriceRange(low, high),
				low,
				high,
				midpoint,
				currency: "UGX",
				unit: "kg",
				source,
				samples: signals.length,
				confidence: Math.min(0.92, 0.64 + signals.length * 0.035),
				fallback: false,
				updatedAt: new Date(latestUpdate || Date.now()).toISOString(),
			};
		} catch (error) {
			console.error("Current price signal error:", error);
			return {
				category,
				priceRange: this.formatPriceRange(baseline.low, baseline.high),
				low: baseline.low,
				high: baseline.high,
				midpoint: (baseline.low + baseline.high) / 2,
				currency: "UGX",
				unit: "kg",
				source: "DAFIS baseline",
				samples: 0,
				confidence: 0.55,
				fallback: true,
				updatedAt: new Date().toISOString(),
			};
		}
	}

	async getRecentPricesForSignal(productData) {
		try {
			const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			const rows = await prisma.priceHistory.findMany({
				where: {
					date: { gte: since90d },
					product: {
						category: productData.category || undefined,
						location: productData.location
							? { contains: productData.location }
							: undefined,
					},
				},
				orderBy: { date: "desc" },
				take: 30,
				select: { price: true },
			});
			return rows.map((r) => r.price).filter((p) => typeof p === "number");
		} catch {
			return [];
		}
	}

	async getDemandFactorFromDb(category) {
		// Convert recent delivered order volume into a mild multiplier (0.9..1.3)
		try {
			const normalizedCategory = this.normalizeCategory(category);
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const count = await prisma.order.count({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since30d },
					product: normalizedCategory ? { category: normalizedCategory } : undefined,
				},
			});
			// basic scaling
			const factor = 0.9 + Math.min(0.4, count / 200);
			return Math.max(0.9, Math.min(1.3, factor));
		} catch {
			return this.getDemandFactor(category);
		}
	}

	async calculateDemandScoreFromDb(productData, timeframe) {
		try {
			const normalizedCategory = this.normalizeCategory(productData.category);
			const since = new Date(Date.now() - Math.max(7, timeframe) * 24 * 60 * 60 * 1000);
			const delivered = await prisma.order.count({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since },
					product: normalizedCategory ? { category: normalizedCategory } : undefined,
				},
			});
			// Normalize into 0.1..0.95
			const base = Math.min(0.95, Math.max(0.1, delivered / 100));
			const seasonalFactor = this.getSeasonalFactor(normalizedCategory);
			return Math.min(0.95, Math.max(0.1, base * seasonalFactor));
		} catch {
			return this.calculateDemandScore(productData, timeframe);
		}
	}

	async analyzeDemandTrendsFromDb(productData) {
		try {
			const normalizedCategory = this.normalizeCategory(productData.category);
			const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
			const rows = await prisma.order.findMany({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since14d },
					product: normalizedCategory ? { category: normalizedCategory } : undefined,
				},
				select: { createdAt: true },
			});
			const last7 = rows.filter((r) => r.createdAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
			const prev7 = rows.length - last7;
			const trend = last7 > prev7 ? "increasing" : last7 < prev7 ? "decreasing" : "stable";
			return { trend, last7, prev7 };
		} catch {
			return this.analyzeDemandTrends(productData);
		}
	}

	async getMarketTrendsFromDb() {
		try {
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const [orders, views] = await Promise.all([
				prisma.userAnalytics.count({
					where: { event: "order_placed", timestamp: { gte: since30d } },
				}),
				prisma.userAnalytics.count({
					where: { event: "product_view", timestamp: { gte: since30d } },
				}),
			]);
			return {
				orders30d: orders,
				views30d: views,
				conversionApprox: views > 0 ? Math.round((orders / views) * 1000) / 10 : 0,
			};
		} catch {
			return this.getMarketTrends();
		}
	}

	// Helper methods
	getBasePriceForCategory(category) {
		const range = this.getBaselinePriceRange(category);
		return (range.low + range.high) / 2;
	}

	getSeasonalFactor(category) {
		const normalizedCategory = this.normalizeCategory(category);
		const month = new Date().getMonth() + 1;
		const seasonalFactors = {
			COFFEE: [1.05, 1.0, 0.95, 0.95, 1.0, 1.08, 1.12, 1.08, 1.0, 0.98, 1.02, 1.08],
			VEGETABLES: [1.2, 1.1, 0.9, 0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 0.9, 1.0, 1.1],
			FRUITS: [0.8, 0.9, 1.2, 1.3, 1.1, 1.0, 0.9, 0.8, 1.0, 1.1, 1.0, 0.9],
			GRAINS: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
		};
		const factors = seasonalFactors[normalizedCategory] || seasonalFactors["VEGETABLES"];
		return factors[month - 1];
	}

	getLocationFactor(location) {
		// Simulate location-based pricing
		const locationFactors = {
			jinja: 1.3,
			mbiko: 1.25,
			mafubira: 1.2,
			bugiri: 1.15,
			iganga: 1.1,
			mayunge: 1.1,
			kamuli: 1.05,
		};

		const city = String(location || "").toLowerCase();
		for (const [key, factor] of Object.entries(locationFactors)) {
			if (city.includes(key)) {
				return factor;
			}
		}
		return 1.0; // Default factor for other locations
	}

	getSupplyFactor(quantity) {
		if (quantity > 1000) return 0.9;
		if (quantity > 500) return 0.95;
		if (quantity > 100) return 1.0;
		return 1.1;
	}

	getDemandFactor(category) {
		const normalizedCategory = this.normalizeCategory(category);
		const demandFactors = {
			COFFEE: 1.18,
			VEGETABLES: 1.1,
			FRUITS: 1.15,
			ORGANIC: 1.3,
			GRAINS: 1.0,
			PULSES: 1.05,
			SPICES: 1.2,
			DAIRY: 1.1,
			POULTRY: 1.25,
		};
		return demandFactors[normalizedCategory] || 1.0;
	}

	calculatePriceConfidence(productData, predictedPrice, signalStats = {}) {
		let confidence = 0.68;

		if (productData.quantity > 0) confidence += 0.1;
		if (productData.location) confidence += 0.05;
		if (productData.category) confidence += 0.05;
		if (signalStats.priceSamples > 0) confidence += Math.min(0.08, signalStats.priceSamples * 0.01);
		if (signalStats.marketSamples > 0) confidence += Math.min(0.1, signalStats.marketSamples * 0.015);
		if (signalStats.usedBaseline) confidence -= 0.05;

		const categoryStability = this.getCategoryStability(productData.category);
		confidence += categoryStability;

		return Math.min(0.95, confidence);
	}

	getCategoryStability(category) {
		const normalizedCategory = this.normalizeCategory(category);
		const stability = {
			COFFEE: 0.07,
			VEGETABLES: 0.05,
			FRUITS: 0.03,
			GRAINS: 0.08,
			PULSES: 0.06,
			SPICES: 0.04,
			DAIRY: 0.09,
			POULTRY: 0.05,
			ORGANIC: 0.03,
			PROCESSED: 0.1,
		};
		return stability[normalizedCategory] || 0.05;
	}

	analyzeMarketConditions(productData) {
		const category = String(productData.category || "").toUpperCase();
		if (productData.organic) return "Organic quality can support a price premium";
		if (["VEGETABLES", "FRUITS", "DAIRY"].includes(category)) {
			return "Fresh produce should move quickly to protect quality and price";
		}
		if (["GRAINS", "PULSES"].includes(category)) {
			return "Stored produce can be timed around buyer demand and transport availability";
		}
		return "Use recent orders and active listings to confirm the final asking price";
	}

	generatePriceRecommendations(productData, predictedPrice) {
		const recommendations = [];

		if (productData.organic) {
			recommendations.push(
				"Highlight organic certification to justify premium pricing",
			);
		}

		const currentPrice = this.getBasePriceForCategory(productData.category);
		if (predictedPrice > currentPrice * 1.1) {
			recommendations.push(
				"Market conditions favor higher pricing - consider premium positioning",
			);
		} else if (predictedPrice < currentPrice * 0.9) {
			recommendations.push(
				"Consider competitive pricing strategy to increase market share",
			);
		}

		recommendations.push("Monitor competitor pricing regularly");
		recommendations.push(
			"Consider seasonal adjustments based on supply patterns",
		);

		return recommendations;
	}

	calculateDemandScore(productData, timeframe) {
		let score = 0.5;
		const normalizedCategory = this.normalizeCategory(productData.category);

		const categoryDemand = {
			COFFEE: 0.78,
			VEGETABLES: 0.7,
			FRUITS: 0.75,
			ORGANIC: 0.85,
			GRAINS: 0.6,
			PULSES: 0.65,
			SPICES: 0.7,
			DAIRY: 0.8,
			POULTRY: 0.75,
		};

		score = categoryDemand[normalizedCategory] || 0.6;

		const seasonalFactor = this.getSeasonalFactor(normalizedCategory);
		score *= seasonalFactor;

		if (timeframe <= 7) score *= 1.1;
		if (timeframe >= 60) score *= 0.9;

		return Math.min(0.95, Math.max(0.1, score));
	}

	scoreToDemandLevel(score) {
		if (score >= 0.75) return "high";
		if (score >= 0.5) return "medium";
		return "low";
	}

	calculateForecastedQuantity(productData, demandScore, timeframe) {
		const baseQuantity = 100;
		const weeklyDemand = baseQuantity * demandScore;
		const totalWeeks = Math.ceil(timeframe / 7);
		return Math.round(weeklyDemand * totalWeeks);
	}

	analyzeDemandTrends(productData) {
		return {
			trend: "increasing",
			growth_rate: "12%",
			peak_season: this.getPeakSeason(productData.category),
		};
	}

	getSeasonalDemandPattern(category) {
		const normalizedCategory = this.normalizeCategory(category);
		const patterns = {
			COFFEE: "Strong export demand with harvest-season price movement",
			VEGETABLES: "Peak demand in winter months",
			FRUITS: "High demand in summer season",
			GRAINS: "Steady demand throughout year",
			ORGANIC: "Growing demand across all seasons",
		};
		return patterns[normalizedCategory] || "Seasonal variations apply";
	}

	generateDemandRecommendations(productData, demandLevel) {
		const recommendations = [];

		if (demandLevel === "high") {
			recommendations.push("Increase production capacity to meet high demand");
			recommendations.push("Consider premium pricing due to strong demand");
		} else if (demandLevel === "low") {
			recommendations.push("Focus on marketing and promotion to boost demand");
			recommendations.push("Consider competitive pricing strategy");
		}

		recommendations.push("Monitor market trends closely");
		recommendations.push("Build relationships with key buyers");

		return recommendations;
	}

	getCropDatabase() {
		return [
			{
				name: "Tomato",
				category: "VEGETABLES",
				plantingTime: "March-April, July-August",
				harvestTime: "90-120 days",
				expectedYield: 25,
				waterRequirement: "High",
				soilType: ["Loamy", "Sandy-loam"],
				climate: ["Tropical", "Subtropical"],
				averagePrice: 25,
				profitMargin: 0.6,
			},
			{
				name: "Rice",
				category: "GRAINS",
				plantingTime: "June-July",
				harvestTime: "120-150 days",
				expectedYield: 4,
				waterRequirement: "Very High",
				soilType: ["Clay", "Clay-loam"],
				climate: ["Tropical", "Subtropical"],
				averagePrice: 20,
				profitMargin: 0.4,
			},
			{
				name: "Wheat",
				category: "GRAINS",
				plantingTime: "November-December",
				harvestTime: "120-150 days",
				expectedYield: 3.5,
				waterRequirement: "Medium",
				soilType: ["Loamy", "Clay-loam"],
				climate: ["Temperate", "Subtropical"],
				averagePrice: 18,
				profitMargin: 0.35,
			},
			{
				name: "Potato",
				category: "VEGETABLES",
				plantingTime: "October-November",
				harvestTime: "90-120 days",
				expectedYield: 20,
				waterRequirement: "Medium",
				soilType: ["Sandy-loam", "Loamy"],
				climate: ["Temperate", "Subtropical"],
				averagePrice: 15,
				profitMargin: 0.5,
			},
			{
				name: "Onion",
				category: "VEGETABLES",
				plantingTime: "November-December",
				harvestTime: "120-150 days",
				expectedYield: 15,
				waterRequirement: "Medium",
				soilType: ["Loamy", "Sandy-loam"],
				climate: ["Tropical", "Subtropical"],
				averagePrice: 22,
				profitMargin: 0.55,
			},
			{
				name: "Sugarcane",
				category: "PROCESSED",
				plantingTime: "February-March",
				harvestTime: "12-18 months",
				expectedYield: 60,
				waterRequirement: "Very High",
				soilType: ["Clay-loam", "Loamy"],
				climate: ["Tropical", "Subtropical"],
				averagePrice: 3,
				profitMargin: 0.3,
			},
		];
	}

	calculateCropSuitability(crop, farmerData) {
		let score = 0.5;

		// Soil type compatibility
		if (crop.soilType.includes(farmerData.soilType)) {
			score += 0.2;
		}

		// Climate compatibility
		if (crop.climate.includes(farmerData.climate)) {
			score += 0.2;
		}

		if (farmerData.farmSize >= 2) score += 0.05;
		if (Array.isArray(farmerData.previousCrops) && farmerData.previousCrops.includes(crop.name)) {
			score += 0.05;
		}

		return Math.min(0.95, Math.max(0.1, score));
	}

	assessMarketPotential(crop, location) {
		const locationSignal = String(location || "").trim() ? 0.08 : 0;
		const basePotential = crop.category === "VEGETABLES" ? 0.72 : 0.64;
		return Math.min(0.95, basePotential + locationSignal + (crop.profitMargin || 0) * 0.2);
	}

	calculateProfitability(crop, farmSize) {
		const revenue = crop.expectedYield * crop.averagePrice * farmSize;
		const costs = revenue * (1 - crop.profitMargin);
		const profit = revenue - costs;
		const profitabilityScore = profit / (revenue || 1);
		return Math.min(0.95, Math.max(0.1, profitabilityScore));
	}

	generateRecommendationReasons(crop, farmerData, suitabilityScore) {
		const reasons = [];

		if (suitabilityScore > 0.8) {
			reasons.push("Excellent soil and climate match");
		} else if (suitabilityScore > 0.6) {
			reasons.push("Good growing conditions");
		}

		reasons.push(`High market demand for ${crop.name}`);
		reasons.push(`Suitable for ${farmerData.climate} climate`);

		return reasons;
	}

	getCurrentSeason() {
		const month = new Date().getMonth() + 1;
		if (month >= 3 && month <= 5) return "Spring";
		if (month >= 6 && month <= 8) return "Summer";
		if (month >= 9 && month <= 11) return "Autumn";
		return "Winter";
	}

	getPeakSeason(category) {
		const normalizedCategory = this.normalizeCategory(category);
		const peakSeasons = {
			COFFEE: "Harvest and export contracting windows",
			VEGETABLES: "Winter",
			FRUITS: "Summer",
			GRAINS: "Post-harvest (Oct-Dec)",
			ORGANIC: "Year-round",
		};
		return peakSeasons[normalizedCategory] || "Seasonal";
	}

	getWeatherInsights(location) {
		return {
			temperature: "25-30°C",
			rainfall: "Moderate",
			humidity: "60-70%",
			recommendation: "Favorable conditions for most crops",
		};
	}

	getMarketTrends() {
		return {
			organic_growth: "+15%",
			digital_adoption: "+25%",
			direct_sales: "+20%",
		};
	}

	getFarmingTips(farmerData) {
		return [
			"Use drip irrigation to conserve water",
			"Implement crop rotation for soil health",
			"Consider organic certification for premium pricing",
			"Monitor weather patterns for optimal planting",
		];
	}

	// OpenAI Intelligence Features
	async getAIGuidance(userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				include: { products: true, orders: true }
			});

			const prompt = `Act as a senior agricultural business advisor for the Agrifocused platform.
Analyze this user's state:
- Role: ${user.role}
- Products: ${user.products?.length || 0}
- Verified: ${user.verified}
- Location: ${user.location}

Provide exactly 3 proactive "Next Steps" to help them maximize profit or efficiency.
Output as JSON: { "steps": [{ "title": "string", "description": "string", "priority": "HIGH|MEDIUM" }] }`;

			if (!this.openai) {
				return [{ title: "Update Profile", description: "Keep your farm details updated for better matches.", priority: "MEDIUM" }];
			}

			const response = await this.openai.chat.completions.create({
				model: "gpt-4o",
				messages: [{ role: "user", content: prompt }],
				response_format: { type: "json_object" }
			});

			return JSON.parse(response.choices[0].message.content).steps;
		} catch (error) {
			return [{ title: "Update Profile", description: "Keep your farm details updated for better matches.", priority: "MEDIUM" }];
		}
	}

	async getMarketIntelligence(commodity, location) {
		try {
			const category = this.normalizeCategory(commodity);
			const marketSignal = await this.getCurrentPriceSignal({
				category,
				commodity,
				location,
			});
			const demandFactor = await this.getDemandFactorFromDb(category);
			const demand =
				demandFactor >= 1.15 ? "High" : demandFactor >= 1.0 ? "Medium" : "Low";
			const localTrend = {
				priceRange: marketSignal.priceRange,
				demand,
				outlook: marketSignal.fallback
					? "Baseline estimate available 24/7; refresh market data for sharper local pricing."
					: "Current app and market signals are active.",
				source: marketSignal.source,
				confidence: marketSignal.confidence,
				updatedAt: marketSignal.updatedAt,
				priceAvailable: true,
				category,
			};

			const prompt = `Provide the latest market trends and prices for ${this.humanizeCategory(category)} in ${location || "Uganda"}. 
Include:
- Current farmgate price range (UGX/kg)
- Market demand (High/Medium/Low)
- 1-week outlook.
Output as JSON: { "priceRange": "string", "demand": "string", "outlook": "string" }`;

			if (!this.openai) {
				return localTrend;
			}

			const response = await this.openai.chat.completions.create({
				model: "gpt-4o",
				messages: [{ role: "user", content: prompt }],
				response_format: { type: "json_object" }
			});

			const aiTrend = JSON.parse(response.choices[0].message.content);
			return {
				...localTrend,
				priceRange: this.hasUsablePriceRange(aiTrend.priceRange)
					? aiTrend.priceRange
					: localTrend.priceRange,
				demand: aiTrend.demand || localTrend.demand,
				outlook: aiTrend.outlook || localTrend.outlook,
			};
		} catch (error) {
			const category = this.normalizeCategory(commodity);
			const baseline = this.getBaselinePriceRange(category);
			return {
				priceRange: this.formatPriceRange(baseline.low, baseline.high),
				demand: "Medium",
				outlook: "Baseline estimate available 24/7; live market service is temporarily unavailable.",
				source: "DAFIS baseline",
				confidence: 0.55,
				updatedAt: new Date().toISOString(),
				priceAvailable: true,
				category,
			};
		}
	}

	hasUsablePriceRange(priceRange) {
		const value = String(priceRange || "").trim().toLowerCase();
		return Boolean(value) && !["unavailable", "n/a", "none", "no price available"].includes(value);
	}

	async generateMarketingContent(product) {
		try {
			const prompt = `Generate a compelling, professional social media marketing snippet for this product:
- Name: ${product.name}
- Origin: ${product.location}
- Quality: ${product.organic ? 'Organic' : 'Premium'}
The goal is to attract high-value international buyers and local importers.
Output as JSON: { "heading": "string", "body": "string", "hashtags": ["string"] }`;

			if (!this.openai) {
				return { heading: "Fresh Harvest", body: product.name, hashtags: ["#agri"] };
			}

			const response = await this.openai.chat.completions.create({
				model: "gpt-4o",
				messages: [{ role: "user", content: prompt }],
				response_format: { type: "json_object" }
			});

			return JSON.parse(response.choices[0].message.content);
		} catch (error) {
			return { heading: "Fresh Harvest", body: product.name, hashtags: ["#agri"] };
		}
	}

	async getProactiveMatches(userId) {
		try {
			const user = await prisma.user.findUnique({ where: { id: userId } });
			let matches = [];

			if (user.role === "FARMER") {
				// Find buyers interested in things this farmer sells
				const farmerProducts = await prisma.product.findMany({ where: { farmerId: userId } });
				const categories = [...new Set(farmerProducts.map(p => p.category))];
				
				const buyers = await prisma.user.findMany({
					where: { 
						role: "BUYER",
						orders: { some: { product: { category: { in: categories } } } }
					},
					take: 5
				});
				matches = buyers.map(b => ({ id: b.id, name: b.name, location: b.location, reason: "Recently bought similar quality" }));
			} else {
				// Find farmers with available stock matching buyer history
				const products = await prisma.product.findMany({ 
					where: { available: true, quantity: { gt: 0 } },
					take: 5,
					include: { user: true }
				});
				matches = products.map(p => ({ id: p.user.id, name: p.user.name, productName: p.name, reason: "Fresh harvest available now" }));
			}
			return matches;
		} catch (error) {
			return [];
		}
	}

	// Fallback methods

	getFallbackPricePrediction(productData) {
		const normalizedProductData = this.normalizeProductInput(productData);
		const basePrice = this.getBasePriceForCategory(normalizedProductData.category);
		const organicMultiplier = normalizedProductData.organic ? 1.3 : 1.0;
		const baseline = this.getBaselinePriceRange(normalizedProductData.category);

		return {
			predictedPrice: basePrice * organicMultiplier,
			confidence: 0.65,
			marketAnalysis: `Limited live data available - using 24/7 baseline ${this.formatPriceRange(
				baseline.low,
				baseline.high,
			)}`,
			factors: {
				seasonal: 1.0,
				supply: 1.0,
				demand: 1.0,
				quality: organicMultiplier,
				location: 1.0,
			},
			recommendations: [
				"Monitor market trends",
				"Consider organic certification",
			],
			currentMarketPrice: {
				category: normalizedProductData.category,
				priceRange: this.formatPriceRange(baseline.low, baseline.high),
				low: baseline.low,
				high: baseline.high,
				midpoint: (baseline.low + baseline.high) / 2,
				currency: "UGX",
				unit: "kg",
				source: "DAFIS baseline",
				samples: 0,
				confidence: 0.55,
				fallback: true,
				updatedAt: new Date().toISOString(),
			},
			timestamp: new Date().toISOString(),
		};
	}

	getFallbackDemandForecast(productData) {
		return {
			demandLevel: "medium",
			demandScore: 0.6,
			forecastedQuantity: 150,
			timeframe: 30,
			trends: { trend: "stable", growth_rate: "5%" },
			seasonality: "Seasonal variations apply",
			recommendations: ["Monitor market conditions", "Maintain steady supply"],
			timestamp: new Date().toISOString(),
		};
	}

	getFallbackCropRecommendations() {
		return {
			recommendations: [
				{
					crop: "Tomato",
					category: "VEGETABLES",
					suitabilityScore: 75,
					marketPotential: 80,
					profitability: 70,
					plantingTime: "March-April",
					harvestTime: "90-120 days",
					expectedYield: 25,
					waterRequirement: "High",
					marketPrice: 25,
					reasons: ["Good market demand", "Suitable climate"],
				},
			],
			season: this.getCurrentSeason(),
			weatherForecast: this.getWeatherInsights(""),
			marketTrends: this.getMarketTrends(),
			tips: this.getFarmingTips({}),
			timestamp: new Date().toISOString(),
		};
	}

	extractPriceFeatures(productData) {
		return [
			this.encodeCategoryToNumber(productData.category),
			new Date().getMonth() / 12,
			Math.min(productData.quantity / 1000, 1),
			this.encodeLocationToNumber(productData.location || ""),
			productData.organic ? 1 : 0,
			this.getCategoryStability(productData.category),
		];
	}

	encodeCategoryToNumber(category) {
		const categories = [
			"COFFEE",
			"VEGETABLES",
			"FRUITS",
			"GRAINS",
			"PULSES",
			"SPICES",
			"DAIRY",
			"POULTRY",
			"ORGANIC",
			"PROCESSED",
		];
		const index = categories.indexOf(category);
		return index >= 0 ? index / (categories.length - 1) : 0.5;
	}

	encodeLocationToNumber(location) {
		let hash = 0;
		for (let i = 0; i < location.length; i++) {
			hash = ((hash << 5) - hash + location.charCodeAt(i)) & 0xffffffff;
		}
		return Math.abs(hash) / 0xffffffff;
	}
}

export default new AIService();
