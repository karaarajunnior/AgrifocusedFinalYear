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
			const liveSignal = await this.getLiveMarketPriceSignal({
				category: productData.category,
				location: productData.location,
				commodity: productData.category,
			});

			// Base price calculation with AI factors
			const basePrice = this.getBasePriceForCategory(normalizedProductData.category);
			const seasonalFactor = this.getSeasonalFactor(normalizedProductData.category);
			const locationFactor = this.getLocationFactor(normalizedProductData.location);
			const organicFactor = normalizedProductData.organic ? 1.3 : 1.0;
			const supplyFactor = this.getSupplyFactor(normalizedProductData.quantity);
			const demandFactor = await this.getDemandFactorFromDb(normalizedProductData.category);

			// Heuristic prediction (always available)
			const heuristicPrice =
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
			// Blend heuristic estimate with internal and live market signals.
			const weightedSignals = [{ value: predictedPrice, weight: 0.5 }];
			if (dbAvg !== null) weightedSignals.push({ value: dbAvg, weight: 0.3 });
			if (liveSignal.median !== null) {
				weightedSignals.push({ value: liveSignal.median, weight: 0.2 });
			}
			const totalWeight = weightedSignals.reduce((sum, s) => sum + s.weight, 0);
			predictedPrice =
				weightedSignals.reduce((sum, s) => sum + s.value * s.weight, 0) /
				(totalWeight || 1);

			// Calculate confidence based on data quality
			const confidence = this.calculatePriceConfidence(
				normalizedProductData,
				predictedPrice,
				{
					priceSamples: recentPrices.length,
					marketSamples: currentMarketPrice?.samples || 0,
					usedBaseline: currentMarketPrice?.fallback || false,
					liveSamples: liveSignal.sampleCount,
					freshnessHours: liveSignal.freshnessHours,
				},
			);

			// Market analysis (uses DB signals)
			const marketAnalysis = await this.analyzeMarket(
				normalizedProductData.category,
				normalizedProductData.location,
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
					normalizedProductData,
					predictedPrice,
				),
				currentMarketPrice,
				telemetry: {
					modelTrainedAt: this.priceModelTrainedAt
						? new Date(this.priceModelTrainedAt).toISOString()
						: null,
					priceSamples: recentPrices.length,
					marketSamples: currentMarketPrice?.samples || 0,
					marketSignalSource: currentMarketPrice?.source,
					listingSamples: recentListings.length,
					liveMarketSamples: liveSignal.sampleCount,
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
	resolveCategory(value) {
		if (!value) return null;
		const normalized = String(value).trim().toUpperCase();
		const aliases = {
			COFFEE: "COFFEE",
			MAIZE: "GRAINS",
			CORN: "GRAINS",
			BEANS: "PULSES",
			VEGETABLE: "VEGETABLES",
			VEGETABLES: "VEGETABLES",
			FRUIT: "FRUITS",
			FRUITS: "FRUITS",
			GRAIN: "GRAINS",
			GRAINS: "GRAINS",
			PULSE: "PULSES",
			PULSES: "PULSES",
			SPICE: "SPICES",
			SPICES: "SPICES",
			DAIRY: "DAIRY",
			POULTRY: "POULTRY",
			ORGANIC: "ORGANIC",
			PROCESSED: "PROCESSED",
		};
		return aliases[normalized] || null;
	}

	buildProductFilters({ category, commodity, location }) {
		const filters = {};
		const normalizedLocation = String(location || "").trim();
		if (normalizedLocation) {
			filters.location = { contains: normalizedLocation };
		}

		const normalizedCommodity = String(commodity || "").trim();
		const orFilters = [];
		if (category) orFilters.push({ category });
		if (normalizedCommodity) {
			orFilters.push({ name: { contains: normalizedCommodity } });
		}

		if (orFilters.length === 1) Object.assign(filters, orFilters[0]);
		if (orFilters.length > 1) filters.OR = orFilters;

		return filters;
	}

	formatPriceRange({ min, max, currency }) {
		if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
		const roundedMin = Math.round(min);
		const roundedMax = Math.round(max);
		if (roundedMin === roundedMax) {
			return `${currency || "UGX"} ${roundedMin.toLocaleString()}/kg`;
		}
		return `${currency || "UGX"} ${roundedMin.toLocaleString()} - ${roundedMax.toLocaleString()}/kg`;
	}

	async getLiveMarketPriceSignal({ category, location, commodity }) {
		try {
			const resolvedCategory = this.resolveCategory(category || commodity);
			const normalizedCommodity = String(commodity || "").trim();
			const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

			const webPriceWhere = {
				collectedAt: { gte: since48h },
			};
			if (location) webPriceWhere.location = { contains: String(location) };
			const webOr = [];
			if (resolvedCategory) webOr.push({ category: resolvedCategory });
			if (normalizedCommodity) {
				webOr.push({ commodity: { contains: normalizedCommodity } });
			}
			if (webOr.length === 1) Object.assign(webPriceWhere, webOr[0]);
			if (webOr.length > 1) webPriceWhere.OR = webOr;

			const productWhere = {
				available: true,
				quantity: { gt: 0 },
				...this.buildProductFilters({
					category: resolvedCategory,
					commodity: normalizedCommodity,
					location,
				}),
			};

			const [webRows, listingRows] = await Promise.all([
				prisma.marketWebPrice.findMany({
					where: webPriceWhere,
					orderBy: { collectedAt: "desc" },
					take: 80,
					select: {
						price: true,
						currency: true,
						collectedAt: true,
						source: true,
					},
				}),
				prisma.product.findMany({
					where: productWhere,
					orderBy: { updatedAt: "desc" },
					take: 80,
					select: {
						price: true,
						unit: true,
						updatedAt: true,
					},
				}),
			]);

			const prices = [];
			let latestTimestamp = null;

			for (const row of webRows) {
				if (Number.isFinite(row.price)) prices.push(Number(row.price));
				if (!latestTimestamp || row.collectedAt > latestTimestamp) {
					latestTimestamp = row.collectedAt;
				}
			}

			for (const row of listingRows) {
				if (!Number.isFinite(row.price) || row.price <= 0) continue;
				prices.push(Number(row.price));
				if (!latestTimestamp || row.updatedAt > latestTimestamp) {
					latestTimestamp = row.updatedAt;
				}
			}

			if (prices.length === 0) {
				const lastKnownWeb = await prisma.marketWebPrice.findFirst({
					where: webOr.length
						? {
								...(location ? { location: { contains: String(location) } } : {}),
								...(webOr.length === 1 ? webOr[0] : { OR: webOr }),
						  }
						: undefined,
					orderBy: { collectedAt: "desc" },
					select: { price: true, currency: true, collectedAt: true },
				});

				if (lastKnownWeb?.price && Number.isFinite(lastKnownWeb.price)) {
					const now = Date.now();
					const updatedAt = lastKnownWeb.collectedAt;
					return {
						median: Number(lastKnownWeb.price),
						min: Number(lastKnownWeb.price),
						max: Number(lastKnownWeb.price),
						sampleCount: 1,
						currency: lastKnownWeb.currency || "UGX",
						freshnessHours: Math.max(
							0,
							(now - new Date(updatedAt).getTime()) / (1000 * 60 * 60),
						),
						lastUpdatedAt: updatedAt,
						sources: { web: 1, listings: 0 },
					};
				}

				return {
					median: null,
					min: null,
					max: null,
					sampleCount: 0,
					currency: "UGX",
					freshnessHours: null,
					lastUpdatedAt: null,
					sources: { web: 0, listings: 0 },
				};
			}

			const sorted = [...prices].sort((a, b) => a - b);
			const middle = Math.floor(sorted.length / 2);
			const median =
				sorted.length % 2 === 0
					? (sorted[middle - 1] + sorted[middle]) / 2
					: sorted[middle];
			const min = sorted[0];
			const max = sorted[sorted.length - 1];
			const freshnessHours = latestTimestamp
				? Math.max(
						0,
						(Date.now() - new Date(latestTimestamp).getTime()) / (1000 * 60 * 60),
				  )
				: null;

			return {
				median,
				min,
				max,
				sampleCount: sorted.length,
				currency: webRows[0]?.currency || "UGX",
				freshnessHours,
				lastUpdatedAt: latestTimestamp,
				sources: { web: webRows.length, listings: listingRows.length },
			};
		} catch {
			return {
				median: null,
				min: null,
				max: null,
				sampleCount: 0,
				currency: "UGX",
				freshnessHours: null,
				lastUpdatedAt: null,
				sources: { web: 0, listings: 0 },
			};
		}
	}

	async getRecentPricesForSignal(productData) {
		try {
			const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			const productFilter = {};
			if (productData.category) productFilter.category = productData.category;
			if (productData.location) productFilter.location = { contains: productData.location };

			const rows = await prisma.priceHistory.findMany({
				where: {
					date: { gte: since90d },
					...(Object.keys(productFilter).length ? { product: productFilter } : {}),
				},
				orderBy: { date: "desc" },
				take: 30,
				select: { price: true },
			});
			const supplementalSignals = await this.getSupplementalPriceSignals(
				productData.category,
				productData.location,
			);
			return [
				...rows.map((r) => r.price),
				...supplementalSignals,
			].filter((p) => typeof p === "number" && Number.isFinite(p));
		} catch {
			return [];
		}
	}

	async getSupplementalPriceSignals(category, location) {
		try {
			const canonicalCategory = this.getCanonicalCategory(category);
			const terms = this.getCommoditySearchTerms(category, canonicalCategory);
			const marketPriceWhere = terms.length
				? { OR: terms.map((term) => ({ commodity: { contains: term } })) }
				: {};
			const webPriceOr = [];
			if (canonicalCategory) webPriceOr.push({ category: canonicalCategory });
			for (const term of terms) {
				webPriceOr.push({ commodity: { contains: term } });
			}
			const webPriceWhere = webPriceOr.length ? { OR: webPriceOr } : {};

			const [marketRows, webRows] = await Promise.all([
				prisma.marketPrice.findMany({
					where: marketPriceWhere,
					orderBy: { timestamp: "desc" },
					take: 12,
					select: { pricePerKg: true, region: true },
				}),
				prisma.marketWebPrice.findMany({
					where: webPriceWhere,
					orderBy: { collectedAt: "desc" },
					take: 6,
					select: { price: true, location: true },
				}),
			]);

			const marketSignals = this.preferLocationRows(marketRows, location, "region")
				.map((row) => row.pricePerKg);
			const webSignals = this.preferLocationRows(webRows, location, "location")
				.map((row) => row.price);
			return [...marketSignals, ...webSignals];
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
		const basePrices = {
			COFFEE: 6500,
			VEGETABLES: 1600,
			FRUITS: 2200,
			GRAINS: 1400,
			PULSES: 4200,
			SPICES: 9000,
			DAIRY: 2500,
			POULTRY: 12000,
			ORGANIC: 4200,
			PROCESSED: 6500,
		};
		return basePrices[category] || 3000;
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
	calculatePriceConfidence(productData, predictedPrice, signalMetadata = {}) {
		let confidence = 0.58;

		if (productData.quantity > 0) confidence += 0.08;
		if (productData.location) confidence += 0.05;
		if (productData.category) confidence += 0.06;
		if (predictedPrice > 0) confidence += 0.02;

		const categoryStability = this.getCategoryStability(productData.category);
		confidence += categoryStability;

		const priceSamples = Number(signalMetadata.priceSamples || 0);
		const liveSamples = Number(signalMetadata.liveSamples || 0);
		const freshnessHours = Number(signalMetadata.freshnessHours);

		confidence += Math.min(0.1, priceSamples / 120);
		confidence += Math.min(0.08, liveSamples / 60);

		if (Number.isFinite(freshnessHours)) {
			if (freshnessHours <= 6) confidence += 0.05;
			else if (freshnessHours <= 24) confidence += 0.03;
			else if (freshnessHours > 72) confidence -= 0.04;
		}

		return Math.min(0.95, Math.max(0.35, confidence));
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
			const category = this.getCanonicalCategory(commodity);
			const [priceSignal, marketAnalysis] = await Promise.all([
				this.getBestMarketPriceSignal(commodity, location, category),
				this.analyzeMarket(category, location),
			]);
			const priceRange = this.formatMarketPriceRange(priceSignal);
			const baseTrends = {
				priceRange,
				demand: this.deriveDemandLabel(marketAnalysis.signals),
				outlook: this.deriveOutlookLabel(marketAnalysis.signals, priceSignal),
				source: priceSignal.source,
				sourceType: priceSignal.sourceType,
				lastUpdated: priceSignal.lastUpdated,
				confidence: priceSignal.confidence,
			};

			if (!this.openai) {
				return baseTrends;
			}

			const prompt = `Act as an agricultural market analyst for Uganda.
Use this verified price signal without changing the price:
- Commodity: ${commodity}
- Location: ${location || "Uganda"}
- Price range: ${priceRange}
- Source: ${priceSignal.source}
- Last updated: ${priceSignal.lastUpdated}
- 30-day platform signals: ${JSON.stringify(marketAnalysis.signals)}

Return JSON only: { "demand": "High|Medium|Low|Stable", "outlook": "short 1-week outlook" }`;

			const response = await this.openai.chat.completions.create({
				model: "gpt-4o",
				messages: [{ role: "user", content: prompt }],
				response_format: { type: "json_object" }
			});
			const narrative = JSON.parse(response.choices[0]?.message?.content || "{}");

			return {
				...baseTrends,
				demand: typeof narrative.demand === "string" ? narrative.demand : baseTrends.demand,
				outlook: typeof narrative.outlook === "string" ? narrative.outlook : baseTrends.outlook,
			};
		} catch (error) {
			const fallback = this.getBaselineMarketPriceSignal(commodity);
			return {
				priceRange: this.formatMarketPriceRange(fallback),
				demand: "Stable",
				outlook: "Using benchmark price while live feeds refresh",
				source: fallback.source,
				sourceType: fallback.sourceType,
				lastUpdated: fallback.lastUpdated,
				confidence: fallback.confidence,
			};
		}
	}

	async getBestMarketPriceSignal(commodity, location, category = this.getCanonicalCategory(commodity)) {
		const [webSignal, persistedSignal, platformSignal] = await Promise.all([
			this.getLatestWebMarketPriceSignal(commodity, location, category),
			this.getPersistedMarketPriceSignal(commodity, location, category),
			this.getPlatformPriceHistorySignal(category, location),
		]);

		return (
			webSignal ||
			persistedSignal ||
			platformSignal ||
			this.getBaselineMarketPriceSignal(commodity, category)
		);
	}

	async getLatestWebMarketPriceSignal(commodity, location, category) {
		try {
			const terms = this.getCommoditySearchTerms(commodity, category);
			const or = [];
			if (category) or.push({ category });
			for (const term of terms) {
				or.push({ commodity: { contains: term } });
			}

			const rows = await prisma.marketWebPrice.findMany({
				where: or.length ? { OR: or } : {},
				orderBy: { collectedAt: "desc" },
				take: 12,
			});
			if (!rows.length) return null;

			const preferredRows = this.preferLocationRows(rows, location, "location");
			const freshest = preferredRows[0];
			const comparableRows = preferredRows.filter((row) =>
				row.currency === freshest.currency &&
				(row.unit || "kg") === (freshest.unit || "kg"),
			);
			const prices = comparableRows.map((row) => row.price).filter((price) => Number.isFinite(price));
			if (!prices.length) return null;

			return {
				minPrice: Math.min(...prices),
				maxPrice: Math.max(...prices),
				currency: freshest.currency || "UGX",
				unit: freshest.unit || "kg",
				source: freshest.source || "Web market feed",
				sourceType: "web_market",
				lastUpdated: freshest.collectedAt?.toISOString?.() || new Date().toISOString(),
				confidence: 0.9,
			};
		} catch {
			return null;
		}
	}

	async getPersistedMarketPriceSignal(commodity, location, category) {
		try {
			const terms = this.getCommoditySearchTerms(commodity, category);
			if (!terms.length) return null;

			const rows = await prisma.marketPrice.findMany({
				where: { OR: terms.map((term) => ({ commodity: { contains: term } })) },
				orderBy: { timestamp: "desc" },
				take: 30,
			});
			if (!rows.length) return null;

			const preferredRows = this.preferLocationRows(rows, location, "region");
			const farmgateRows = preferredRows.filter((row) => row.marketType !== "EXPORT");
			const comparableRows = farmgateRows.length ? farmgateRows : preferredRows;
			const prices = comparableRows
				.map((row) => row.pricePerKg)
				.filter((price) => Number.isFinite(price));
			if (!prices.length) return null;

			const freshest = comparableRows[0];
			return {
				minPrice: Math.min(...prices),
				maxPrice: Math.max(...prices),
				currency: freshest.currency || "UGX",
				unit: "kg",
				source: "Regional market prices",
				sourceType: "market_prices",
				lastUpdated: freshest.timestamp?.toISOString?.() || new Date().toISOString(),
				confidence: 0.82,
			};
		} catch {
			return null;
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
	async getMarketIntelligence(commodity, location) {
		try {
			const resolvedCategory = this.resolveCategory(commodity);
			const productFilters = this.buildProductFilters({
				category: resolvedCategory,
				commodity,
				location,
			});
			const liveSignal = await this.getLiveMarketPriceSignal({
				category: resolvedCategory,
				location,
				commodity,
			});
			const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
			const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			const between14And7d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

			const [deliveredOrders, activeListings, recentPriceRows, previousPriceRows] =
				await Promise.all([
					prisma.order.count({
						where: {
							status: "DELIVERED",
							createdAt: { gte: since14d },
							product: productFilters,
						},
					}),
					prisma.product.count({
						where: {
							available: true,
							quantity: { gt: 0 },
							...productFilters,
						},
					}),
					prisma.priceHistory.findMany({
						where: {
							date: { gte: since7d },
							product: productFilters,
						},
						select: { price: true },
						take: 200,
					}),
					prisma.priceHistory.findMany({
						where: {
							date: { gte: between14And7d, lt: since7d },
							product: productFilters,
						},
						select: { price: true },
						take: 200,
					}),
				]);

			const recentAvg =
				recentPriceRows.length > 0
					? recentPriceRows.reduce((sum, row) => sum + row.price, 0) /
					  recentPriceRows.length
					: null;
			const previousAvg =
				previousPriceRows.length > 0
					? previousPriceRows.reduce((sum, row) => sum + row.price, 0) /
					  previousPriceRows.length
					: null;
			const changeRatio =
				Number.isFinite(recentAvg) && Number.isFinite(previousAvg) && previousAvg > 0
					? (recentAvg - previousAvg) / previousAvg
					: 0;

			const demandScore = deliveredOrders * 2 + activeListings;
			let demand = "Low";
			if (demandScore >= 25) demand = "High";
			else if (demandScore >= 10) demand = "Medium";

			let outlook = "Stable this week.";
			if (changeRatio > 0.08) outlook = "Slight upward pressure this week.";
			else if (changeRatio < -0.08) outlook = "Softening prices this week.";
			if (demand === "High" && changeRatio >= 0) {
				outlook = "Strong demand; prices likely to remain firm this week.";
			}

			const fallbackBasePrice = this.getBasePriceForCategory(
				resolvedCategory || "VEGETABLES",
			);
			const fallbackRange = this.formatPriceRange({
				min: fallbackBasePrice * 0.95,
				max: fallbackBasePrice * 1.1,
				currency: "UGX",
			});
			const priceRange =
				this.formatPriceRange({
					min:
						liveSignal.min ??
						(Number.isFinite(recentAvg) ? recentAvg * 0.95 : fallbackBasePrice),
					max:
						liveSignal.max ??
						(Number.isFinite(recentAvg) ? recentAvg * 1.05 : fallbackBasePrice * 1.1),
					currency: liveSignal.currency || "UGX",
				}) || fallbackRange;

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
			return {
				priceRange,
				demand,
				outlook,
				updatedAt: liveSignal.lastUpdatedAt || new Date().toISOString(),
				source:
					liveSignal.sampleCount > 0
						? "live-market-signals"
						: "internal-baseline-signal",
			};
		} catch (error) {
			const fallbackCategory = this.resolveCategory(commodity) || "VEGETABLES";
			const fallbackBasePrice = this.getBasePriceForCategory(fallbackCategory);
			return {
				priceRange: this.formatPriceRange({
					min: fallbackBasePrice * 0.95,
					max: fallbackBasePrice * 1.1,
					currency: "UGX",
				}),
				demand: "Medium",
				outlook: "Collecting live signals. Check again shortly.",
				updatedAt: new Date().toISOString(),
				source: "fallback-baseline",
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

	hasUsablePriceRange(priceRange) {
		const value = String(priceRange || "").trim().toLowerCase();
		return Boolean(value) && !["unavailable", "n/a", "none", "no price available"].includes(value);
	}

	async getPlatformPriceHistorySignal(category, location) {
		try {
			const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			const productFilter = {};
			if (category) productFilter.category = category;
			if (location) productFilter.location = { contains: location };

			const rows = await prisma.priceHistory.findMany({
				where: {
					date: { gte: since90d },
					...(Object.keys(productFilter).length ? { product: productFilter } : {}),
				},
				orderBy: { date: "desc" },
				take: 25,
				select: { price: true, date: true },
			});
			const prices = rows.map((row) => row.price).filter((price) => Number.isFinite(price));
			if (!prices.length) return null;

			const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
			return {
				minPrice: avg * 0.9,
				maxPrice: avg * 1.1,
				currency: "UGX",
				unit: "kg",
				source: "Platform listing history",
				sourceType: "price_history",
				lastUpdated: rows[0].date?.toISOString?.() || new Date().toISOString(),
				confidence: 0.72,
			};
		} catch {
			return null;
		}
	}

	getBaselineMarketPriceSignal(commodity, category = this.getCanonicalCategory(commodity)) {
		const text = String(commodity || "").toLowerCase();
		const baselines = {
			COFFEE: [4500, 7500],
			VEGETABLES: [800, 2500],
			FRUITS: [1200, 3500],
			GRAINS: text.includes("maize") ? [900, 1800] : [1500, 3200],
			PULSES: [2800, 5200],
			SPICES: [6000, 14000],
			DAIRY: [1800, 3200],
			POULTRY: [9000, 16000],
			ORGANIC: [2500, 6500],
			PROCESSED: [3500, 9000],
		};
		const [minPrice, maxPrice] = baselines[category] || [1500, 4500];
		return {
			minPrice,
			maxPrice,
			currency: "UGX",
			unit: "kg",
			source: "Uganda benchmark price",
			sourceType: "benchmark",
			lastUpdated: new Date().toISOString(),
			confidence: 0.55,
		};
	}

	getCanonicalCategory(input) {
		const raw = String(input || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
		const categoryValues = new Set([
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
		]);
		if (categoryValues.has(raw)) return raw;
		if (raw.includes("COFFEE") || raw.includes("ARABICA") || raw.includes("ROBUSTA")) return "COFFEE";
		if (raw.includes("MAIZE") || raw.includes("CORN") || raw.includes("RICE") || raw.includes("GRAIN")) return "GRAINS";
		if (raw.includes("BEAN") || raw.includes("PULSE")) return "PULSES";
		if (raw.includes("TOMATO") || raw.includes("ONION") || raw.includes("VEGETABLE")) return "VEGETABLES";
		if (raw.includes("FRUIT") || raw.includes("BANANA") || raw.includes("MANGO")) return "FRUITS";
		if (raw.includes("SPICE") || raw.includes("GINGER")) return "SPICES";
		return null;
	}

	getCommoditySearchTerms(commodity, category) {
		const display = this.toDisplayCommodity(commodity);
		const terms = [display];
		const categoryTerms = {
			COFFEE: ["Coffee", "Arabica", "Robusta"],
			GRAINS: ["Maize", "Grain", "Rice"],
			PULSES: ["Beans", "Pulse"],
			VEGETABLES: ["Vegetable", "Tomato", "Onion"],
			FRUITS: ["Fruit", "Banana", "Mango"],
			SPICES: ["Spice", "Ginger"],
			DAIRY: ["Dairy", "Milk"],
			POULTRY: ["Poultry", "Chicken"],
			ORGANIC: ["Organic"],
			PROCESSED: ["Processed"],
		};
		if (categoryTerms[category]) terms.push(...categoryTerms[category]);
		return [...new Set(terms.filter((term) => term && term.length >= 3))];
	}

	toDisplayCommodity(commodity) {
		return String(commodity || "")
			.replace(/_/g, " ")
			.toLowerCase()
			.replace(/\b\w/g, (char) => char.toUpperCase())
			.trim();
	}

	preferLocationRows(rows, location, field) {
		if (!location) return rows;
		const needle = String(location).toLowerCase();
		const localRows = rows.filter((row) =>
			String(row[field] || "").toLowerCase().includes(needle),
		);
		return localRows.length ? localRows : rows;
	}

	formatMarketPriceRange(signal) {
		const min = Math.round(signal.minPrice);
		const max = Math.round(signal.maxPrice);
		const unit = signal.unit || "kg";
		const currency = signal.currency || "UGX";
		if (min === max) return `${currency} ${min.toLocaleString("en-UG")}/${unit}`;
		return `${currency} ${min.toLocaleString("en-UG")} - ${max.toLocaleString("en-UG")}/${unit}`;
	}

	deriveDemandLabel(signals = {}) {
		const deliveredOrders = Number(signals.deliveredOrders30d || 0);
		const activeListings = Number(signals.activeListings || 0);
		if (deliveredOrders >= 20 || (deliveredOrders >= 8 && activeListings <= 10)) return "High";
		if (deliveredOrders >= 5 || activeListings >= 5) return "Medium";
		return "Stable";
	}

	deriveOutlookLabel(signals = {}, priceSignal) {
		if (priceSignal.sourceType === "benchmark") return "Benchmark shown while live feed refreshes";
		const deliveredOrders = Number(signals.deliveredOrders30d || 0);
		const activeListings = Number(signals.activeListings || 0);
		if (deliveredOrders > activeListings) return "Demand may lift prices this week";
		if (activeListings > deliveredOrders * 3 && activeListings > 10) return "Supply is strong; compare buyers before selling";
		return "Stable with normal weekly movement";
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
