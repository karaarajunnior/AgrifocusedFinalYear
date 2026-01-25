/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
	Brain,
	TrendingUp,
	BarChart3,
	Lightbulb,
	Target,
	Leaf,
	DollarSign,
	Calendar,
	AlertCircle,
	CheckCircle,
	Activity,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";

interface PricePrediction {
	predictedPrice: number;
	confidence: number;
	marketAnalysis: string;
	factors: {
		seasonal: number;
		supply: number;
		demand: number;
		quality: number;
		location: number;
	};
	recommendations: string[];
}

interface DemandForecast {
	demandLevel: string;
	demandScore: number;
	forecastedQuantity: number;
	timeframe: number;
	recommendations: string[];
}

interface CropRecommendation {
	crop: string;
	category: string;
	suitabilityScore: number;
	marketPotential: number;
	profitability: number;
	plantingTime: string;
	harvestTime: string;
	expectedYield: number;
	marketPrice: number;
	reasons: string[];
}

function AIModelPage() {
	const [activeTab, setActiveTab] = useState("price-prediction");
	const [loading, setLoading] = useState(false);

	// Price Prediction State
	const [priceData, setPriceData] = useState({
		category: "VEGETABLES",
		quantity: 100,
		location: "Mumbai, Maharashtra",
		organic: false,
	});
	const [pricePrediction, setPricePrediction] =
		useState<PricePrediction | null>(null);

	// Demand Forecast State
	const [demandData, setDemandData] = useState({
		category: "VEGETABLES",
		location: "Delhi, India",
		timeframe: 30,
	});
	const [demandForecast, setDemandForecast] = useState<DemandForecast | null>(
		null,
	);

	// Crop Recommendation State
	const [farmerData, setFarmerData] = useState({
		location: "Punjab, India",
		soilType: "Loamy",
		climate: "Subtropical",
		farmSize: 5,
		previousCrops: ["Rice", "Wheat"],
	});
	const [cropRecommendations, setCropRecommendations] = useState<
		CropRecommendation[]
	>([]);

	const categories = [
		"VEGETABLES",
		"FRUITS",
		"GRAINS",
		"PULSES",
		"SPICES",
		"DAIRY",
		"ORGANIC",
	];
	const soilTypes = ["Clay", "Sandy", "Loamy", "Clay-loam", "Sandy-loam"];
	const climateTypes = [
		"Tropical",
		"Subtropical",
		"Temperate",
		"Arid",
		"Semi-arid",
	];

	const handlePricePrediction = async () => {
		setLoading(true);
		try {
			const response = await api.post("/ai/predict-price", priceData);
			if (response.data.success) {
				setPricePrediction(response.data.prediction);
				toast.success("Price prediction generated successfully!");
			}
		} catch (error: any) {
			toast.error(
				error.response?.data?.error || "Failed to generate price prediction",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleDemandForecast = async () => {
		setLoading(true);
		try {
			const response = await api.post("/ai/forecast-demand", {
				productData: demandData,
				timeframe: demandData.timeframe,
			});
			if (response.data.success) {
				setDemandForecast(response.data.forecast);
				toast.success("Demand forecast generated successfully!");
			}
		} catch (error: any) {
			toast.error(
				error.response?.data?.error || "Failed to generate demand forecast",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleCropRecommendations = async () => {
		setLoading(true);
		try {
			const response = await api.post("/ai/recommend-crops", farmerData);
			if (response.data.success) {
				setCropRecommendations(
					response.data.recommendations.recommendations || [],
				);
				toast.success("Crop recommendations generated successfully!");
			}
		} catch (error: any) {
			toast.error(
				error.response?.data?.error ||
					"Failed to generate crop recommendations",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 flex items-center">
						<Brain className="h-8 w-8 mr-3 text-purple-600" />
						AI Models & Predictions
					</h1>
					<p className="text-gray-600 mt-2">
						Use advanced AI models for price prediction, demand forecasting, and
						crop recommendations
					</p>
				</div>

				{/* AI Model Performance Stats */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div className="bg-white rounded-lg shadow p-6">
						<div className="flex items-center">
							<div className="p-2 bg-blue-100 rounded-lg">
								<TrendingUp className="h-6 w-6 text-blue-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">
									Price Model Accuracy
								</p>
								<p className="text-2xl font-bold text-gray-900">87%</p>
								<p className="text-xs text-gray-500">MAE: 2.34</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow p-6">
						<div className="flex items-center">
							<div className="p-2 bg-green-100 rounded-lg">
								<BarChart3 className="h-6 w-6 text-green-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">
									Demand Model Accuracy
								</p>
								<p className="text-2xl font-bold text-gray-900">82%</p>
								<p className="text-xs text-gray-500">Precision: 79%</p>
							</div>
						</div>
					</div>

					<div className="bg-white rounded-lg shadow p-6">
						<div className="flex items-center">
							<div className="p-2 bg-purple-100 rounded-lg">
								<Activity className="h-6 w-6 text-purple-600" />
							</div>
							<div className="ml-4">
								<p className="text-sm font-medium text-gray-600">
									System Health
								</p>
								<p className="text-2xl font-bold text-gray-900">99.7%</p>
								<p className="text-xs text-gray-500">Uptime</p>
							</div>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="bg-white rounded-lg shadow mb-8">
					<div className="border-b border-gray-200">
						<nav className="flex space-x-8 px-6">
							{[
								{
									id: "price-prediction",
									name: "Price Prediction",
									icon: TrendingUp,
								},
								{
									id: "demand-forecast",
									name: "Demand Forecast",
									icon: BarChart3,
								},
								{
									id: "crop-recommendations",
									name: "Crop Recommendations",
									icon: Leaf,
								},
							].map((tab) => (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
										activeTab === tab.id
											? "border-purple-500 text-purple-600"
											: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
									}`}>
									<tab.icon className="h-4 w-4 mr-2" />
									{tab.name}
								</button>
							))}
						</nav>
					</div>

					<div className="p-6">
						{/* Price Prediction Tab */}
						{activeTab === "price-prediction" && (
							<div className="space-y-6">
								<div>
									<h3 className="text-lg font-semibold text-gray-900 mb-4">
										AI Price Prediction Model
									</h3>
									<p className="text-gray-600 mb-6">
										Get accurate price predictions based on market conditions,
										seasonality, supply-demand dynamics, and location factors.
									</p>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									{/* Input Form */}
									<div className="space-y-4">
										<h4 className="font-medium text-gray-900">
											Input Parameters
										</h4>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Product Category
											</label>
											<select
												value={priceData.category}
												onChange={(e) =>
													setPriceData({
														...priceData,
														category: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
												{categories.map((category) => (
													<option key={category} value={category}>
														{category.charAt(0) +
															category.slice(1).toLowerCase()}
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Quantity (kg)
											</label>
											<input
												type="number"
												value={priceData.quantity}
												onChange={(e) =>
													setPriceData({
														...priceData,
														quantity: parseInt(e.target.value) || 0,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
												placeholder="Enter quantity"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Location
											</label>
											<input
												type="text"
												value={priceData.location}
												onChange={(e) =>
													setPriceData({
														...priceData,
														location: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
												placeholder="City, State"
											/>
										</div>

										<div className="flex items-center">
											<input
												type="checkbox"
												id="organic"
												checked={priceData.organic}
												onChange={(e) =>
													setPriceData({
														...priceData,
														organic: e.target.checked,
													})
												}
												className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
											/>
											<label
												htmlFor="organic"
												className="ml-2 block text-sm text-gray-900">
												Organic Product
											</label>
										</div>

										<button
											onClick={handlePricePrediction}
											disabled={loading}
											className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center">
											{loading ? (
												<LoadingSpinner size="sm" />
											) : (
												<>
													<TrendingUp className="h-4 w-4 mr-2" />
													Generate Price Prediction
												</>
											)}
										</button>
									</div>

									{/* Results */}
									<div>
										{pricePrediction ? (
											<div className="space-y-4">
												<h4 className="font-medium text-gray-900">
													Prediction Results
												</h4>

												<div className="bg-purple-50 rounded-lg p-4">
													<div className="text-center">
														<div className="text-3xl font-bold text-purple-600">
															₹{pricePrediction.predictedPrice.toFixed(2)}
														</div>
														<div className="text-sm text-gray-600">per kg</div>
														<div
															className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${
																pricePrediction.confidence > 0.8
																	? "bg-green-100 text-green-800"
																	: "bg-yellow-100 text-yellow-800"
															}`}>
															{pricePrediction.confidence > 0.8 ? (
																<CheckCircle className="h-4 w-4 mr-1" />
															) : (
																<AlertCircle className="h-4 w-4 mr-1" />
															)}
															{Math.round(pricePrediction.confidence * 100)}%
															Confidence
														</div>
													</div>
												</div>

												<div className="space-y-3">
													<h5 className="font-medium text-gray-900">
														Influencing Factors
													</h5>
													{Object.entries(pricePrediction.factors).map(
														([factor, value]) => (
															<div
																key={factor}
																className="flex items-center justify-between">
																<span className="text-sm text-gray-600 capitalize">
																	{factor}
																</span>
																<div className="flex items-center">
																	<div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
																		<div
																			className="bg-purple-600 h-2 rounded-full"
																			style={{
																				width: `${value * 100}%`,
																			}}></div>
																	</div>
																	<span className="text-sm font-medium">
																		{(value * 100).toFixed(0)}%
																	</span>
																</div>
															</div>
														),
													)}
												</div>

												<div className="bg-blue-50 rounded-lg p-4">
													<h5 className="font-medium text-blue-900 mb-2">
														Market Analysis
													</h5>
													<p className="text-blue-800 text-sm">
														{pricePrediction.marketAnalysis}
													</p>
												</div>

												<div>
													<h5 className="font-medium text-gray-900 mb-2">
														Recommendations
													</h5>
													<ul className="space-y-1">
														{pricePrediction.recommendations.map(
															(rec, index) => (
																<li
																	key={index}
																	className="flex items-start text-sm">
																	<Lightbulb className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
																	<span className="text-gray-700">{rec}</span>
																</li>
															),
														)}
													</ul>
												</div>
											</div>
										) : (
											<div className="text-center py-8">
												<TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
												<h4 className="text-lg font-medium text-gray-900 mb-2">
													No Prediction Yet
												</h4>
												<p className="text-gray-600">
													Fill in the parameters and click "Generate Price
													Prediction" to see AI results
												</p>
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Demand Forecast Tab */}
						{activeTab === "demand-forecast" && (
							<div className="space-y-6">
								<div>
									<h3 className="text-lg font-semibold text-gray-900 mb-4">
										AI Demand Forecasting Model
									</h3>
									<p className="text-gray-600 mb-6">
										Predict market demand for agricultural products using
										advanced machine learning algorithms.
									</p>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									{/* Input Form */}
									<div className="space-y-4">
										<h4 className="font-medium text-gray-900">
											Input Parameters
										</h4>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Product Category
											</label>
											<select
												value={demandData.category}
												onChange={(e) =>
													setDemandData({
														...demandData,
														category: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
												{categories.map((category) => (
													<option key={category} value={category}>
														{category.charAt(0) +
															category.slice(1).toLowerCase()}
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Location
											</label>
											<input
												type="text"
												value={demandData.location}
												onChange={(e) =>
													setDemandData({
														...demandData,
														location: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
												placeholder="City, State"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Forecast Timeframe (days)
											</label>
											<select
												value={demandData.timeframe}
												onChange={(e) =>
													setDemandData({
														...demandData,
														timeframe: parseInt(e.target.value),
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
												<option value={7}>7 days</option>
												<option value={15}>15 days</option>
												<option value={30}>30 days</option>
												<option value={60}>60 days</option>
												<option value={90}>90 days</option>
											</select>
										</div>

										<button
											onClick={handleDemandForecast}
											disabled={loading}
											className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center">
											{loading ? (
												<LoadingSpinner size="sm" />
											) : (
												<>
													<BarChart3 className="h-4 w-4 mr-2" />
													Generate Demand Forecast
												</>
											)}
										</button>
									</div>

									{/* Results */}
									<div>
										{demandForecast ? (
											<div className="space-y-4">
												<h4 className="font-medium text-gray-900">
													Forecast Results
												</h4>

												<div className="bg-purple-50 rounded-lg p-4">
													<div className="text-center">
														<div
															className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold ${
																demandForecast.demandLevel === "high"
																	? "bg-red-100 text-red-800"
																	: demandForecast.demandLevel === "medium"
																	? "bg-yellow-100 text-yellow-800"
																	: "bg-green-100 text-green-800"
															}`}>
															{demandForecast.demandLevel.toUpperCase()} DEMAND
														</div>
														<div className="mt-2 text-gray-600">
															Score:{" "}
															{(demandForecast.demandScore * 100).toFixed(1)}%
														</div>
													</div>
												</div>

												<div className="grid grid-cols-1 gap-4">
													<div className="bg-gray-50 rounded-lg p-4">
														<h5 className="font-medium text-gray-900 mb-2">
															Forecasted Quantity
														</h5>
														<div className="text-2xl font-bold text-blue-600">
															{demandForecast.forecastedQuantity} units
														</div>
														<div className="text-sm text-gray-600">
															Next {demandForecast.timeframe} days
														</div>
													</div>
												</div>

												<div>
													<h5 className="font-medium text-gray-900 mb-2">
														Recommendations
													</h5>
													<ul className="space-y-1">
														{demandForecast.recommendations.map(
															(rec, index) => (
																<li
																	key={index}
																	className="flex items-start text-sm">
																	<Lightbulb className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
																	<span className="text-gray-700">{rec}</span>
																</li>
															),
														)}
													</ul>
												</div>
											</div>
										) : (
											<div className="text-center py-8">
												<BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
												<h4 className="text-lg font-medium text-gray-900 mb-2">
													No Forecast Yet
												</h4>
												<p className="text-gray-600">
													Fill in the parameters and click "Generate Demand
													Forecast" to see AI results
												</p>
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Crop Recommendations Tab */}
						{activeTab === "crop-recommendations" && (
							<div className="space-y-6">
								<div>
									<h3 className="text-lg font-semibold text-gray-900 mb-4">
										AI Crop Recommendation System
									</h3>
									<p className="text-gray-600 mb-6">
										Get personalized crop recommendations based on your
										location, soil type, climate, and market conditions.
									</p>
								</div>

								<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
									{/* Input Form */}
									<div className="space-y-4">
										<h4 className="font-medium text-gray-900">
											Farm Information
										</h4>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Location
											</label>
											<input
												type="text"
												value={farmerData.location}
												onChange={(e) =>
													setFarmerData({
														...farmerData,
														location: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
												placeholder="State, Country"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Soil Type
											</label>
											<select
												value={farmerData.soilType}
												onChange={(e) =>
													setFarmerData({
														...farmerData,
														soilType: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
												{soilTypes.map((soil) => (
													<option key={soil} value={soil}>
														{soil}
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Climate
											</label>
											<select
												value={farmerData.climate}
												onChange={(e) =>
													setFarmerData({
														...farmerData,
														climate: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
												{climateTypes.map((climate) => (
													<option key={climate} value={climate}>
														{climate}
													</option>
												))}
											</select>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-2">
												Farm Size (hectares)
											</label>
											<input
												type="number"
												value={farmerData.farmSize}
												onChange={(e) =>
													setFarmerData({
														...farmerData,
														farmSize: parseInt(e.target.value) || 0,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
												placeholder="Enter farm size"
											/>
										</div>

										<button
											onClick={handleCropRecommendations}
											disabled={loading}
											className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center">
											{loading ? (
												<LoadingSpinner size="sm" />
											) : (
												<>
													<Leaf className="h-4 w-4 mr-2" />
													Get Crop Recommendations
												</>
											)}
										</button>
									</div>

									{/* Results */}
									<div className="lg:col-span-2">
										{cropRecommendations.length > 0 ? (
											<div className="space-y-4">
												<h4 className="font-medium text-gray-900">
													Recommended Crops
												</h4>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
													{cropRecommendations
														.slice(0, 6)
														.map((crop, index) => (
															<div
																key={index}
																className="border border-gray-200 rounded-lg p-4">
																<div className="flex justify-between items-start mb-3">
																	<h5 className="font-semibold text-gray-900">
																		{crop.crop}
																	</h5>
																	<span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
																		{crop.category}
																	</span>
																</div>

																<div className="space-y-2 text-sm text-gray-600 mb-4">
																	<div className="flex items-center">
																		<Target className="h-4 w-4 mr-2" />
																		<span>
																			Suitability:{" "}
																			{(crop.suitabilityScore * 100).toFixed(0)}
																			%
																		</span>
																	</div>
																	<div className="flex items-center">
																		<DollarSign className="h-4 w-4 mr-2" />
																		<span>
																			Market Price: ₹{crop.marketPrice}/kg
																		</span>
																	</div>
																	<div className="flex items-center">
																		<Calendar className="h-4 w-4 mr-2" />
																		<span>Planting: {crop.plantingTime}</span>
																	</div>
																</div>

																<div className="text-xs text-gray-500">
																	Expected Yield: {crop.expectedYield}{" "}
																	tons/hectare
																</div>
															</div>
														))}
												</div>
											</div>
										) : (
											<div className="text-center py-8">
												<Leaf className="h-12 w-12 text-gray-400 mx-auto mb-4" />
												<h4 className="text-lg font-medium text-gray-900 mb-2">
													No Recommendations Yet
												</h4>
												<p className="text-gray-600">
													Fill in your farm information and click "Get Crop
													Recommendations" to see AI suggestions
												</p>
											</div>
										)}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* How AI Models Work */}
				<div className="bg-white rounded-lg shadow">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold text-gray-900">
							How Our AI Models Work
						</h2>
					</div>
					<div className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="text-center">
								<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<TrendingUp className="h-8 w-8 text-blue-600" />
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">
									Price Prediction
								</h3>
								<p className="text-sm text-gray-600">
									Neural network trained on 15,420+ data points analyzing
									seasonal patterns, supply-demand dynamics, and market
									conditions.
								</p>
							</div>

							<div className="text-center">
								<div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<BarChart3 className="h-8 w-8 text-green-600" />
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">
									Demand Forecasting
								</h3>
								<p className="text-sm text-gray-600">
									Advanced ML algorithms processing 8,930+ market transactions
									to predict future demand patterns and trends.
								</p>
							</div>

							<div className="text-center">
								<div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<Leaf className="h-8 w-8 text-purple-600" />
								</div>
								<h3 className="font-semibold text-gray-900 mb-2">
									Crop Recommendations
								</h3>
								<p className="text-sm text-gray-600">
									Expert system combining climate data, soil analysis, and
									market intelligence to suggest optimal crops for your farm.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default AIModelPage;
