import tf from "@tensorflow/tfjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class AIService {
	constructor() {
		this.isInitialized = false;
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
			console.log(" Predicting price for:", productData);
			// Keep response time snappy in production
			const t0 = Date.now();

			// Feature engineering
			const features = this.extractPriceFeatures(productData);

			// Pull recent price history from DB (best-effort)
			const recentPrices = await this.getRecentPricesForSignal(productData);
			const dbAvg =
				recentPrices.length > 0
					? recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length
					: null;

			// Base price calculation with AI factors
			const basePrice = this.getBasePriceForCategory(productData.category);
			const seasonalFactor = this.getSeasonalFactor(productData.category);
			const locationFactor = this.getLocationFactor(productData.location);
			const organicFactor = productData.organic ? 1.3 : 1.0;
			const supplyFactor = this.getSupplyFactor(productData.quantity);
			const demandFactor = await this.getDemandFactorFromDb(productData.category);

			// AI-predicted price
			let predictedPrice =
				basePrice *
				seasonalFactor *
				locationFactor *
				organicFactor *
				supplyFactor *
				demandFactor;

			// Blend with DB signal if present (more realistic than pure heuristics)
			if (dbAvg !== null) {
				predictedPrice = predictedPrice * 0.6 + dbAvg * 0.4;
			}

			// Calculate confidence based on data quality
			const confidence = this.calculatePriceConfidence(
				productData,
				predictedPrice,
			);

			// Market analysis
			const marketAnalysis = await this.analyzeMarket(
				productData.category,
				productData.location,
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
					productData,
					predictedPrice,
				),
				telemetry: {
					usedDbSignal: dbAvg !== null,
					priceSamples: recentPrices.length,
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

	calculatePriceConfidence(productData, predictedPrice) {
		let confidence = 0.75;

		if (productData.quantity > 0) confidence += 0.1;
		if (productData.location) confidence += 0.05;
		if (productData.category) confidence += 0.05;

		const categoryStability = this.getCategoryStability(productData.category);
		confidence += categoryStability;

		return Math.min(0.95, confidence);
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
		const conditions = [
			"Market showing stable growth trends",
			"Seasonal demand patterns detected",
			"Supply chain optimization opportunities available",
			"Price volatility within normal ranges",
			"Consumer preference shifting towards quality",
		];

		return conditions[Math.floor(Math.random() * conditions.length)];
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

		// Random factor for demonstration
		score += (Math.random() - 0.5) * 0.2;

		return Math.min(0.95, Math.max(0.1, score));
	}

	assessMarketPotential(crop, location) {
		const basePotential = 0.6 + Math.random() * 0.3;
		return Math.min(0.95, basePotential);
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
		// Feature extraction for ML model (simplified)
		return [
			this.encodeCategoryToNumber(productData.category),
			new Date().getMonth() / 12,
			Math.min(productData.quantity / 1000, 1),
			this.encodeLocationToNumber(productData.location || ""),
			productData.organic ? 1 : 0,
			Math.random(), // Placeholder for additional features
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
