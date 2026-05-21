import tf from "@tensorflow/tfjs";
import prisma from "../db/prisma.js";
import OpenAI from "openai";

// Lightweight in-memory TTL cache so the AI service can stay responsive 24/7
// even when the DB is slow or external providers (OpenAI / web sources) fail.
class TTLCache {
	constructor(defaultTtlMs = 5 * 60 * 1000) {
		this.defaultTtlMs = defaultTtlMs;
		this.store = new Map();
	}
	get(key) {
		const hit = this.store.get(key);
		if (!hit) return undefined;
		if (hit.expires < Date.now()) {
			this.store.delete(key);
			return undefined;
		}
		return hit.value;
	}
	set(key, value, ttlMs = this.defaultTtlMs) {
		this.store.set(key, { value, expires: Date.now() + ttlMs });
		return value;
	}
	getStale(key) {
		// Return value even if it has expired (graceful fallback for 24/7 uptime)
		const hit = this.store.get(key);
		return hit ? hit.value : undefined;
	}
}

class AIService {
	constructor() {
		this.isInitialized = false;
		this.cache = new TTLCache();
		// Trained linear regression weights for price prediction (per category)
		this.priceModels = new Map();
		this.priceModelTrainedAt = 0;
		if (process.env.OPENAI_API_KEY) {
			this.openai = new OpenAI({
				apiKey: process.env.OPENAI_API_KEY,
			});
		} else {
			console.warn("OPENAI_API_KEY not found. AI features will fall back to data-driven heuristics.");
			this.openai = null;
		}
		this.initializeModels();
	}

	async initializeModels() {
		try {
			console.log("Initializing AI models...");
			// Best-effort training pass; non-blocking if DB has no data yet.
			await this.trainPriceModels().catch((e) =>
				console.warn("Price model warm-up skipped:", e?.message || e),
			);
			this.isInitialized = true;
			console.log("AI models initialized successfully");
		} catch (error) {
			console.error("AI model initialization error:", error);
			this.isInitialized = false;
		}
	}

	// Advanced price prediction blending a small ML model + DB signals + heuristics
	async predictPrice(productData) {
		try {
			const t0 = Date.now();

			// Cached identical prediction within last 5 min (snappy UX, less DB load)
			const cacheKey = this.priceCacheKey(productData);
			const cached = this.cache.get(`predict:${cacheKey}`);
			if (cached) {
				return { ...cached, fromCache: true };
			}

			// Pull recent price history from DB (best-effort)
			const [recentPrices, recentListings, webPrice] = await Promise.all([
				this.getRecentPricesForSignal(productData),
				this.getRecentListingPrices(productData),
				this.getLatestWebPrice(productData.category, productData.location),
			]);

			const histAvg =
				recentPrices.length > 0
					? recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length
					: null;
			const listingAvg =
				recentListings.length > 0
					? recentListings.reduce((s, p) => s + p, 0) / recentListings.length
					: null;
			const webPriceVal = webPrice?.price ?? null;

			// Base price calculation with AI factors
			const basePrice = this.getBasePriceForCategory(productData.category);
			const seasonalFactor = this.getSeasonalFactor(productData.category);
			const locationFactor = this.getLocationFactor(productData.location);
			const organicFactor = productData.organic ? 1.3 : 1.0;
			const supplyFactor = this.getSupplyFactor(productData.quantity);
			const demandFactor = await this.getDemandFactorFromDb(productData.category);

			// Heuristic prediction (always available)
			const heuristicPrice =
				basePrice *
				seasonalFactor *
				locationFactor *
				organicFactor *
				supplyFactor *
				demandFactor;

			// ML prediction from trained linear regression on PriceHistory (per category).
			// Falls back to null if no model is trained for this category yet.
			const mlPrice = await this.mlPredict(productData);

			// Build a weighted blend. Weights only kick in when signals are present.
			const components = [];
			if (mlPrice !== null) components.push({ value: mlPrice, weight: 0.35 });
			if (histAvg !== null) components.push({ value: histAvg, weight: 0.25 });
			if (listingAvg !== null)
				components.push({ value: listingAvg, weight: 0.2 });
			if (webPriceVal !== null)
				components.push({ value: webPriceVal, weight: 0.15 });
			components.push({ value: heuristicPrice, weight: 0.25 });

			const totalWeight = components.reduce((s, c) => s + c.weight, 0) || 1;
			const predictedPrice =
				components.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight;

			// Confidence reflects both data coverage and signal agreement.
			const confidence = this.calculatePriceConfidence(productData, {
				heuristicPrice,
				mlPrice,
				histAvg,
				listingAvg,
				webPriceVal,
			});

			// Market analysis (uses DB signals)
			const marketAnalysis = await this.analyzeMarket(
				productData.category,
				productData.location,
			);

			const result = {
				predictedPrice: Math.max(5, Math.round(predictedPrice * 100) / 100),
				confidence,
				marketAnalysis: marketAnalysis.summary,
				factors: {
					seasonal: seasonalFactor,
					supply: supplyFactor,
					demand: demandFactor,
					quality: organicFactor,
					location: locationFactor,
				},
				signals: {
					heuristicPrice: Math.round(heuristicPrice * 100) / 100,
					mlPrice: mlPrice !== null ? Math.round(mlPrice * 100) / 100 : null,
					historyAvg30d: histAvg !== null ? Math.round(histAvg * 100) / 100 : null,
					listingAvg: listingAvg !== null ? Math.round(listingAvg * 100) / 100 : null,
					webPrice: webPrice
						? {
								value: webPrice.price,
								currency: webPrice.currency,
								source: webPrice.source,
								collectedAt: webPrice.collectedAt,
						  }
						: null,
				},
				recommendations: this.generatePriceRecommendations(
					productData,
					predictedPrice,
				),
				telemetry: {
					modelTrainedAt: this.priceModelTrainedAt
						? new Date(this.priceModelTrainedAt).toISOString()
						: null,
					priceSamples: recentPrices.length,
					listingSamples: recentListings.length,
					processingMs: Date.now() - t0,
				},
				timestamp: new Date().toISOString(),
			};

			// Cache for 5 minutes to keep responses snappy
			this.cache.set(`predict:${cacheKey}`, result);
			return result;
		} catch (error) {
			console.error("Price prediction error:", error);
			// Try to serve stale cache before pure fallback
			const stale = this.cache.getStale(`predict:${this.priceCacheKey(productData)}`);
			if (stale) return { ...stale, stale: true };
			return this.getFallbackPricePrediction(productData);
		}
	}

	priceCacheKey(productData) {
		return [
			String(productData.category || "").toUpperCase(),
			String(productData.location || "").toLowerCase().trim(),
			productData.organic ? "org" : "std",
			Math.round((Number(productData.quantity) || 0) / 50) * 50,
		].join("|");
	}

	async getRecentListingPrices(productData) {
		try {
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const rows = await prisma.product.findMany({
				where: {
					category: productData.category || undefined,
					location: productData.location
						? { contains: productData.location }
						: undefined,
					createdAt: { gte: since30d },
				},
				orderBy: { createdAt: "desc" },
				take: 50,
				select: { price: true },
			});
			return rows.map((r) => r.price).filter((p) => typeof p === "number" && p > 0);
		} catch {
			return [];
		}
	}

	async getLatestWebPrice(category, location) {
		try {
			return await prisma.marketWebPrice.findFirst({
				where: {
					category: category || undefined,
					location: location ? { contains: location } : undefined,
				},
				orderBy: { collectedAt: "desc" },
				select: {
					price: true,
					currency: true,
					source: true,
					collectedAt: true,
				},
			});
		} catch {
			return null;
		}
	}

	// Train one tiny linear-regression model per category from PriceHistory.
	// Inputs: [monthOfYear/12, organic(0/1), quantityScaled, locationHash]
	// Output: price (UGX/kg)
	async trainPriceModels() {
		try {
			const since180d = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
			const rows = await prisma.priceHistory.findMany({
				where: { date: { gte: since180d } },
				orderBy: { date: "desc" },
				take: 5000,
				select: {
					price: true,
					date: true,
					product: {
						select: {
							category: true,
							organic: true,
							quantity: true,
							location: true,
						},
					},
				},
			});

			if (!rows || rows.length < 12) {
				// Not enough data – ML will sit out and heuristics + DB averages take over.
				return;
			}

			// Group by category
			const byCat = new Map();
			for (const r of rows) {
				const cat = r.product?.category;
				if (!cat || typeof r.price !== "number") continue;
				const arr = byCat.get(cat) || [];
				arr.push({
					y: r.price,
					x: [
						(r.date.getMonth() + 1) / 12,
						r.product.organic ? 1 : 0,
						Math.min((r.product.quantity || 100) / 1000, 1),
						this.encodeLocationToNumber(r.product.location || ""),
					],
				});
				byCat.set(cat, arr);
			}

			for (const [cat, samples] of byCat.entries()) {
				if (samples.length < 8) continue;
				const xs = tf.tensor2d(samples.map((s) => s.x));
				const ys = tf.tensor2d(samples.map((s) => [s.y]));

				const model = tf.sequential();
				model.add(
					tf.layers.dense({ inputShape: [4], units: 8, activation: "relu" }),
				);
				model.add(tf.layers.dense({ units: 1 }));
				model.compile({ optimizer: tf.train.adam(0.05), loss: "meanSquaredError" });
				await model.fit(xs, ys, {
					epochs: 60,
					batchSize: Math.min(32, samples.length),
					shuffle: true,
					verbose: 0,
				});
				this.priceModels.set(cat, model);
				xs.dispose();
				ys.dispose();
			}
			this.priceModelTrainedAt = Date.now();
			console.log(
				`AI price model trained for ${this.priceModels.size} categories`,
			);
		} catch (e) {
			console.warn("trainPriceModels failed:", e?.message || e);
		}
	}

	async mlPredict(productData) {
		try {
			const cat = productData.category;
			if (!cat) return null;

			// Lazy retraining every 6h to keep model fresh.
			const SIX_HOURS = 6 * 60 * 60 * 1000;
			if (
				!this.priceModelTrainedAt ||
				Date.now() - this.priceModelTrainedAt > SIX_HOURS
			) {
				await this.trainPriceModels().catch(() => {});
			}

			const model = this.priceModels.get(cat);
			if (!model) return null;

			const x = tf.tensor2d([
				[
					(new Date().getMonth() + 1) / 12,
					productData.organic ? 1 : 0,
					Math.min((Number(productData.quantity) || 100) / 1000, 1),
					this.encodeLocationToNumber(productData.location || ""),
				],
			]);
			const out = model.predict(x);
			const value = (await out.data())[0];
			x.dispose();
			out.dispose?.();
			if (!Number.isFinite(value) || value <= 0) return null;
			return value;
		} catch (e) {
			console.warn("mlPredict failed:", e?.message || e);
			return null;
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
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

			const [deliveredOrders, recentProducts, avgPriceHistory, webPrice] = await Promise.all([
				prisma.order.count({
					where: {
						status: "DELIVERED",
						createdAt: { gte: since30d },
						product: category ? { category } : undefined,
					},
				}),
				prisma.product.count({
					where: {
						available: true,
						quantity: { gt: 0 },
						category: category || undefined,
						location: location ? { contains: location } : undefined,
					},
				}),
				prisma.priceHistory.aggregate({
					where: {
						date: { gte: since30d },
						product: category ? { category } : undefined,
					},
					_avg: { price: true },
				}),
				prisma.marketWebPrice.findFirst({
					where: {
						category: category || undefined,
						location: location ? { contains: location } : undefined,
					},
					orderBy: { collectedAt: "desc" },
				}),
			]);

			const avgPrice = avgPriceHistory._avg.price || 0;
			const webPriceSignal = webPrice
				? {
						source: webPrice.source,
						price: webPrice.price,
						currency: webPrice.currency,
						unit: webPrice.unit,
						collectedAt: webPrice.collectedAt,
				  }
				: null;

			return {
				summary: `Last 30 days: ${deliveredOrders} delivered orders. ${recentProducts} active listings. Avg internal price signal: ${avgPrice.toFixed(
					2,
				)}. ${
					webPriceSignal
						? `Web price signal: ${webPriceSignal.price} ${webPriceSignal.currency}${webPriceSignal.unit ? `/${webPriceSignal.unit}` : ""} (source: ${webPriceSignal.source}).`
						: "Web price signal: none."
				}`,
				signals: {
					deliveredOrders30d: deliveredOrders,
					activeListings: recentProducts,
					avgPrice30d: avgPrice,
					webPriceSignal,
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
			const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const count = await prisma.order.count({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since30d },
					product: category ? { category } : undefined,
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
			const since = new Date(Date.now() - Math.max(7, timeframe) * 24 * 60 * 60 * 1000);
			const delivered = await prisma.order.count({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since },
					product: productData.category ? { category: productData.category } : undefined,
				},
			});
			// Normalize into 0.1..0.95
			const base = Math.min(0.95, Math.max(0.1, delivered / 100));
			const seasonalFactor = this.getSeasonalFactor(productData.category);
			return Math.min(0.95, Math.max(0.1, base * seasonalFactor));
		} catch {
			return this.calculateDemandScore(productData, timeframe);
		}
	}

	async analyzeDemandTrendsFromDb(productData) {
		try {
			const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
			const rows = await prisma.order.findMany({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since14d },
					product: productData.category ? { category: productData.category } : undefined,
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
		const basePrices = {
			VEGETABLES: 25,
			FRUITS: 35,
			GRAINS: 20,
			PULSES: 45,
			SPICES: 150,
			DAIRY: 40,
			POULTRY: 120,
			ORGANIC: 60,
			PROCESSED: 80,
		};
		return basePrices[category] || 30;
	}

	getSeasonalFactor(category) {
		const month = new Date().getMonth() + 1;
		const seasonalFactors = {
			VEGETABLES: [1.2, 1.1, 0.9, 0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 0.9, 1.0, 1.1],
			FRUITS: [0.8, 0.9, 1.2, 1.3, 1.1, 1.0, 0.9, 0.8, 1.0, 1.1, 1.0, 0.9],
			GRAINS: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
		};
		const factors = seasonalFactors[category] || seasonalFactors["VEGETABLES"];
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

		const city = location.toLowerCase();
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
		const demandFactors = {
			VEGETABLES: 1.1,
			FRUITS: 1.15,
			ORGANIC: 1.3,
			GRAINS: 1.0,
			PULSES: 1.05,
			SPICES: 1.2,
			DAIRY: 1.1,
			POULTRY: 1.25,
		};
		return demandFactors[category] || 1.0;
	}

	calculatePriceConfidence(productData, signals = {}) {
		// Base from input completeness
		let confidence = 0.55;
		if (productData.quantity > 0) confidence += 0.05;
		if (productData.location) confidence += 0.05;
		if (productData.category) confidence += 0.05;
		confidence += this.getCategoryStability(productData.category);

		// Each independent live signal adds confidence
		const live = [
			signals.mlPrice,
			signals.histAvg,
			signals.listingAvg,
			signals.webPriceVal,
		].filter((v) => v !== null && v !== undefined && Number.isFinite(v));
		confidence += Math.min(0.2, live.length * 0.05);

		// Reward signal agreement (low spread => high confidence)
		if (live.length >= 2) {
			const mean = live.reduce((a, b) => a + b, 0) / live.length;
			const spread =
				live.reduce((a, b) => a + Math.abs(b - mean), 0) / live.length;
			const relative = mean > 0 ? spread / mean : 1;
			if (relative < 0.1) confidence += 0.1;
			else if (relative < 0.2) confidence += 0.05;
		}

		return Math.min(0.95, Math.max(0.4, confidence));
	}

	getCategoryStability(category) {
		const stability = {
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
		return stability[category] || 0.05;
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

		const categoryDemand = {
			VEGETABLES: 0.7,
			FRUITS: 0.75,
			ORGANIC: 0.85,
			GRAINS: 0.6,
			PULSES: 0.65,
			SPICES: 0.7,
			DAIRY: 0.8,
			POULTRY: 0.75,
		};

		score = categoryDemand[productData.category] || 0.6;

		const seasonalFactor = this.getSeasonalFactor(productData.category);
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
		const patterns = {
			VEGETABLES: "Peak demand in winter months",
			FRUITS: "High demand in summer season",
			GRAINS: "Steady demand throughout year",
			ORGANIC: "Growing demand across all seasons",
		};
		return patterns[category] || "Seasonal variations apply";
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
		const peakSeasons = {
			VEGETABLES: "Winter",
			FRUITS: "Summer",
			GRAINS: "Post-harvest (Oct-Dec)",
			ORGANIC: "Year-round",
		};
		return peakSeasons[category] || "Seasonal";
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

	// AI guidance: combines DB facts with optional LLM enrichment.
	// Always returns concrete, data-driven steps even without OpenAI.
	async getAIGuidance(userId) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
				include: {
					products: { select: { id: true, available: true, quantity: true, price: true, category: true } },
				},
			});
			if (!user) {
				return [
					{
						title: "Sign in",
						description: "Log in to get personalized next steps.",
						priority: "MEDIUM",
					},
				];
			}

			const dataSteps = await this.computeRuleBasedGuidance(user);

			if (!this.openai) {
				return dataSteps;
			}

			try {
				const factSheet = {
					role: user.role,
					verified: user.verified,
					isExportVerified: user.isExportVerified,
					location: user.location,
					productsTotal: user.products?.length || 0,
					availableProducts: user.products?.filter((p) => p.available).length || 0,
					categories: [...new Set(user.products?.map((p) => p.category) || [])],
				};
				const prompt = `Act as a senior agri business advisor for a Ugandan smallholder marketplace.
User facts: ${JSON.stringify(factSheet)}.
Existing draft steps: ${JSON.stringify(dataSteps)}.
Refine/replace with exactly 3 proactive next steps tailored to the user's state.
Each step must be specific, concrete, and tied to the facts. Keep titles under 8 words and descriptions under 25 words.
Output as JSON: { "steps": [{ "title": "string", "description": "string", "priority": "HIGH|MEDIUM" }] }`;

				const response = await this.openai.chat.completions.create({
					model: "gpt-4o-mini",
					messages: [{ role: "user", content: prompt }],
					response_format: { type: "json_object" },
				});
				const parsed = JSON.parse(response.choices[0].message.content);
				if (Array.isArray(parsed?.steps) && parsed.steps.length > 0) {
					return parsed.steps.slice(0, 3);
				}
			} catch (e) {
				// Silent: keep rule-based steps
			}
			return dataSteps;
		} catch (error) {
			return [
				{
					title: "Update Profile",
					description: "Keep your farm details updated for better matches.",
					priority: "MEDIUM",
				},
			];
		}
	}

	async computeRuleBasedGuidance(user) {
		const steps = [];
		const products = user.products || [];
		const availableProducts = products.filter((p) => p.available && p.quantity > 0);

		if (!user.verified) {
			steps.push({
				title: "Complete verification",
				description:
					"Verified farmers earn buyer trust and unlock direct sales. Submit your ID and farm proof.",
				priority: "HIGH",
			});
		}

		if (user.role === "FARMER") {
			if (products.length === 0) {
				steps.push({
					title: "List your first harvest",
					description:
						"Add at least one product so buyers in your district can find and contact you.",
					priority: "HIGH",
				});
			} else if (availableProducts.length === 0) {
				steps.push({
					title: "Reactivate listings",
					description:
						"All your listings are out of stock or hidden. Refresh them to keep buyers engaged.",
					priority: "HIGH",
				});
			}

			if (!user.isExportVerified && availableProducts.length >= 2) {
				steps.push({
					title: "Apply for export verification",
					description:
						"Verified exporters earn up to 2x more per kg on international contracts.",
					priority: "MEDIUM",
				});
			}

			// Pricing nudge based on category averages
			try {
				const cats = [...new Set(products.map((p) => p.category))];
				for (const cat of cats) {
					const avg = await this.getCategoryAvgPrice(cat);
					const mine = products
						.filter((p) => p.category === cat)
						.reduce((s, p) => s + p.price, 0) / Math.max(1, products.filter((p) => p.category === cat).length);
					if (avg && mine && mine < avg * 0.85) {
						steps.push({
							title: `Re-price your ${cat.toLowerCase()}`,
							description: `Your average ${cat.toLowerCase()} price is below the market by ${Math.round(
								(1 - mine / avg) * 100,
							)}%. Consider raising it.`,
							priority: "MEDIUM",
						});
						break;
					}
				}
			} catch {}
		} else if (user.role === "BUYER") {
			steps.push({
				title: "Set your sourcing region",
				description:
					"Tell us your district to surface verified farmers within 50km of you.",
				priority: user.location ? "MEDIUM" : "HIGH",
			});
			steps.push({
				title: "Save a recurring order",
				description:
					"Lock in better prices by committing to weekly volumes from a trusted farmer.",
				priority: "MEDIUM",
			});
		} else {
			steps.push({
				title: "Update profile",
				description: "Keep your details current to unlock the right tools for your role.",
				priority: "MEDIUM",
			});
		}

		// Always recommend something useful
		if (steps.length < 3) {
			steps.push({
				title: "Check today's market signal",
				description: "See live prices and demand before you list, sell, or buy.",
				priority: "MEDIUM",
			});
		}

		return steps.slice(0, 3);
	}

	async getCategoryAvgPrice(category) {
		try {
			const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			const agg = await prisma.product.aggregate({
				where: { category, available: true, createdAt: { gte: since60d } },
				_avg: { price: true },
			});
			return agg._avg.price || 0;
		} catch {
			return 0;
		}
	}

	// 24/7 market intelligence: always returns a live price range derived from DB
	// signals (active listings, price history, web feeds, market_prices). Falls
	// back to category baselines if the DB has no signal yet so the UI never
	// shows "Unavailable" or "no price available".
	async getMarketIntelligence(commodity, location) {
		const cacheKey = `mi:${String(commodity || "").toLowerCase()}|${String(
			location || "",
		).toLowerCase()}`;
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		try {
			const liveTrends = await this.computeLiveMarketTrends(commodity, location);

			// Optionally enrich the qualitative outlook with OpenAI but never
			// block on it. We always return numeric prices from the DB / baseline.
			let outlook = liveTrends.outlook;
			if (this.openai) {
				try {
					const prompt = `You are a Ugandan agri analyst. Given these signals for ${commodity} near ${location}:
- price range: ${liveTrends.priceRange}
- recent listings: ${liveTrends.signals.listings}
- delivered orders (30d): ${liveTrends.signals.deliveredOrders30d}
- trend: ${liveTrends.signals.trend}
Provide a short 1-week outlook (max 12 words, plain English). JSON: { "outlook": "..." }`;
					const response = await this.openai.chat.completions.create({
						model: "gpt-4o-mini",
						messages: [{ role: "user", content: prompt }],
						response_format: { type: "json_object" },
					});
					const parsed = JSON.parse(response.choices[0].message.content);
					if (parsed?.outlook && typeof parsed.outlook === "string") {
						outlook = parsed.outlook;
					}
				} catch (e) {
					// Silent: keep DB-derived outlook
				}
			}

			const result = {
				priceRange: liveTrends.priceRange,
				demand: liveTrends.demand,
				outlook,
				currency: liveTrends.currency,
				unit: liveTrends.unit,
				updatedAt: new Date().toISOString(),
				source: liveTrends.source,
			};
			// Cache for 5 min so we don't hammer the DB on every dashboard load
			this.cache.set(cacheKey, result, 5 * 60 * 1000);
			return result;
		} catch (error) {
			console.warn("getMarketIntelligence failed:", error?.message || error);
			// Serve stale cache if any
			const stale = this.cache.getStale(cacheKey);
			if (stale) return { ...stale, stale: true };
			// Final fallback: still produce a price range so the UI never says "no price"
			const baseline = await this.baselinePriceRange(commodity);
			return {
				priceRange: baseline.priceRange,
				demand: "Stable",
				outlook: "Steady – using baseline reference price",
				currency: "UGX",
				unit: "kg",
				updatedAt: new Date().toISOString(),
				source: "baseline",
			};
		}
	}

	// Produce a numeric price range using whatever DB signals are available
	async computeLiveMarketTrends(commodity, location) {
		const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
		const commodityStr = String(commodity || "").trim();
		const locationStr = String(location || "").trim();

		// Resolve commodity to a Category enum if possible (case-insensitive match)
		const category = this.resolveCategoryFromCommodity(commodityStr);

		const productWhere = {
			available: true,
			quantity: { gt: 0 },
			...(category ? { category } : {}),
			...(locationStr ? { location: { contains: locationStr } } : {}),
		};

		const [listings, history, web, marketPrices, deliveredOrders] = await Promise.all([
			prisma.product.findMany({
				where: productWhere,
				select: { price: true, name: true },
				orderBy: { createdAt: "desc" },
				take: 100,
			}),
			prisma.priceHistory.findMany({
				where: {
					date: { gte: since60d },
					product: {
						...(category ? { category } : {}),
						...(locationStr ? { location: { contains: locationStr } } : {}),
					},
				},
				orderBy: { date: "desc" },
				take: 200,
				select: { price: true, date: true },
			}),
			prisma.marketWebPrice.findMany({
				where: {
					...(category ? { category } : {}),
					...(commodityStr
						? { commodity: { contains: commodityStr } }
						: {}),
					...(locationStr ? { location: { contains: locationStr } } : {}),
					collectedAt: { gte: since60d },
				},
				orderBy: { collectedAt: "desc" },
				take: 50,
				select: { price: true, currency: true, unit: true, collectedAt: true },
			}),
			// Generic MarketPrice store keyed by commodity (string)
			commodityStr
				? prisma.marketPrice.findMany({
						where: { commodity: { contains: commodityStr } },
						orderBy: { timestamp: "desc" },
						take: 30,
						select: { pricePerKg: true, timestamp: true },
				  })
				: Promise.resolve([]),
			prisma.order.count({
				where: {
					status: "DELIVERED",
					createdAt: { gte: since30d },
					...(category ? { product: { category } } : {}),
				},
			}),
		]);

		// Combine numerical signals
		const numericValues = [
			...listings.map((l) => l.price),
			...history.map((h) => h.price),
			...web.map((w) => w.price),
			...marketPrices.map((m) => m.pricePerKg),
		].filter((v) => typeof v === "number" && v > 0);

		let currency = "UGX";
		let unit = "kg";
		if (web[0]?.currency) currency = web[0].currency;
		if (web[0]?.unit) unit = web[0].unit;

		let priceRange;
		let source;
		if (numericValues.length >= 3) {
			numericValues.sort((a, b) => a - b);
			const lo = numericValues[Math.floor(numericValues.length * 0.1)];
			const hi = numericValues[Math.floor(numericValues.length * 0.9)];
			priceRange = `${currency} ${this.formatMoney(lo)} – ${this.formatMoney(
				hi,
			)} / ${unit}`;
			source =
				listings.length > 0
					? "live-listings"
					: history.length > 0
					? "price-history"
					: web.length > 0
					? "web-feed"
					: "market-prices";
		} else if (numericValues.length > 0) {
			const v = numericValues[0];
			priceRange = `${currency} ${this.formatMoney(
				v * 0.9,
			)} – ${this.formatMoney(v * 1.1)} / ${unit}`;
			source = "single-signal";
		} else {
			const baseline = await this.baselinePriceRange(commodityStr || category);
			priceRange = baseline.priceRange;
			source = "baseline";
		}

		// Demand level from delivered orders
		let demand = "Stable";
		if (deliveredOrders >= 50) demand = "High";
		else if (deliveredOrders >= 10) demand = "Medium";
		else if (deliveredOrders > 0) demand = "Low";

		// Trend from history split (last 14d vs prior 14d)
		const now = Date.now();
		const last14 = history.filter(
			(h) => h.date.getTime() >= now - 14 * 24 * 60 * 60 * 1000,
		);
		const prev14 = history.filter(
			(h) =>
				h.date.getTime() < now - 14 * 24 * 60 * 60 * 1000 &&
				h.date.getTime() >= now - 28 * 24 * 60 * 60 * 1000,
		);
		const lastAvg =
			last14.length > 0
				? last14.reduce((s, x) => s + x.price, 0) / last14.length
				: null;
		const prevAvg =
			prev14.length > 0
				? prev14.reduce((s, x) => s + x.price, 0) / prev14.length
				: null;
		let trend = "stable";
		if (lastAvg !== null && prevAvg !== null) {
			const delta = (lastAvg - prevAvg) / prevAvg;
			if (delta > 0.05) trend = "rising";
			else if (delta < -0.05) trend = "falling";
		}

		const outlook =
			trend === "rising"
				? "Prices ticking up — list now to capture the gain"
				: trend === "falling"
				? "Prices softening — hold or bundle for better margins"
				: "Stable week — focus on volume and quality";

		return {
			priceRange,
			demand,
			outlook,
			currency,
			unit,
			source,
			signals: {
				listings: listings.length,
				historyPoints: history.length,
				webPoints: web.length,
				marketPricePoints: marketPrices.length,
				deliveredOrders30d: deliveredOrders,
				trend,
			},
		};
	}

	resolveCategoryFromCommodity(commodity) {
		if (!commodity) return null;
		const c = String(commodity).toLowerCase();
		const mapping = {
			coffee: "GRAINS",
			tea: "GRAINS",
			maize: "GRAINS",
			rice: "GRAINS",
			wheat: "GRAINS",
			beans: "PULSES",
			peas: "PULSES",
			tomato: "VEGETABLES",
			onion: "VEGETABLES",
			potato: "VEGETABLES",
			cabbage: "VEGETABLES",
			carrot: "VEGETABLES",
			banana: "FRUITS",
			mango: "FRUITS",
			pineapple: "FRUITS",
			milk: "DAIRY",
			cheese: "DAIRY",
			chicken: "POULTRY",
			egg: "POULTRY",
		};
		for (const [key, cat] of Object.entries(mapping)) {
			if (c.includes(key)) return cat;
		}
		// Treat the input as a possible enum value already
		const upper = commodity.toUpperCase();
		const enums = [
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
		return enums.includes(upper) ? upper : null;
	}

	formatMoney(value) {
		const num = Math.round(Number(value) || 0);
		return num.toLocaleString();
	}

	async baselinePriceRange(commodityOrCategory) {
		const cat =
			this.resolveCategoryFromCommodity(commodityOrCategory) ||
			(typeof commodityOrCategory === "string"
				? commodityOrCategory.toUpperCase()
				: null);
		const base = this.getBasePriceForCategory(cat || "VEGETABLES");
		// Convert tiny base (UGX/kg-ish heuristic) to a useful display range
		const lo = Math.round(base * 80);
		const hi = Math.round(base * 140);
		return {
			priceRange: `UGX ${this.formatMoney(lo)} – ${this.formatMoney(hi)} / kg`,
		};
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
			if (!user) return [];

			let matches = [];

			if (user.role === "FARMER") {
				// Find buyers who recently bought similar categories
				const farmerProducts = await prisma.product.findMany({
					where: { farmerId: userId },
					select: { category: true },
				});
				const categories = [...new Set(farmerProducts.map((p) => p.category))];
				if (categories.length === 0) return [];

				const buyers = await prisma.user.findMany({
					where: {
						role: "BUYER",
						orders: {
							some: { product: { category: { in: categories } } },
						},
					},
					select: { id: true, name: true, location: true },
					take: 5,
				});
				matches = buyers.map((b) => ({
					id: b.id,
					name: b.name,
					location: b.location || "Region not set",
					reason: "Recently bought similar produce",
				}));
			} else {
				// Buyer: surface farmers nearby with available stock
				const products = await prisma.product.findMany({
					where: {
						available: true,
						quantity: { gt: 0 },
						...(user.location
							? { location: { contains: user.location.split(",")[0] } }
							: {}),
					},
					orderBy: { createdAt: "desc" },
					take: 5,
					include: {
						farmer: { select: { id: true, name: true, location: true } },
					},
				});
				matches = products.map((p) => ({
					id: p.farmer.id,
					name: p.farmer.name,
					location: p.farmer.location || p.location || "Nearby",
					productName: p.name,
					reason: "Fresh harvest available now",
				}));
			}
			return matches;
		} catch (error) {
			console.warn("getProactiveMatches failed:", error?.message || error);
			return [];
		}
	}

	// Fallback methods

	getFallbackPricePrediction(productData) {
		const basePrice = this.getBasePriceForCategory(productData.category);
		const organicMultiplier = productData.organic ? 1.3 : 1.0;

		return {
			predictedPrice: basePrice * organicMultiplier,
			confidence: 0.65,
			marketAnalysis: "Limited data available - using baseline prediction",
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
