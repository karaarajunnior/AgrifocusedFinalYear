/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from "react";
import {
	TrendingUp,
	Brain,
	BarChart as BarChart3,
	AlertCircle as AlertCircle,
	CheckCircle as CheckCircle,
	Lightbulb,
} from "lucide-react";
import api from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import {} from "lucide-react";

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
	trends: any;
	seasonality: any;
	recommendations: string[];
}

interface AIInsightsProps {
	productData?: any;
	userRole: string;
}

function AIInsights({ productData, userRole }: AIInsightsProps) {
	const [pricePrediction, setPricePrediction] =
		useState<PricePrediction | null>(null);
	const [demandForecast, setDemandForecast] = useState<DemandForecast | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState("price");

	useEffect(() => {
		if (productData) {
			fetchAIInsights();
		}
	}, [productData]);

	const fetchAIInsights = async () => {
		if (!productData) return;

		setLoading(true);
		try {
			const [priceRes, demandRes] = await Promise.all([
				api.post("/ai/predict-price", productData),
				api.post("/ai/forecast-demand", { productData, timeframe: 30 }),
			]);

			if (priceRes.data.success) {
				setPricePrediction(priceRes.data.prediction);
			}

			if (demandRes.data.success) {
				setDemandForecast(demandRes.data.forecast);
			}
		} catch (error) {
			console.error("Failed to fetch AI insights:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="bg-white rounded-lg shadow p-6">
				<div className="flex items-center justify-center h-32">
					<LoadingSpinner size="lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white rounded-lg shadow">
			<div className="border-b border-gray-200">
				<nav className="flex space-x-8 px-6">
					<button
						onClick={() => setActiveTab("price")}
						className={`py-4 px-1 border-b-2 font-medium text-sm ${
							activeTab === "price"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}>
						<TrendingUp className="h-4 w-4 inline mr-2" />
						Price Prediction
					</button>
					<button
						onClick={() => setActiveTab("demand")}
						className={`py-4 px-1 border-b-2 font-medium text-sm ${
							activeTab === "demand"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}>
						<BarChart3 className="h-4 w-4 inline mr-2" />
						Demand Forecast
					</button>
					<button
						onClick={() => setActiveTab("insights")}
						className={`py-4 px-1 border-b-2 font-medium text-sm ${
							activeTab === "insights"
								? "border-blue-500 text-blue-600"
								: "border-transparent text-gray-500 hover:text-gray-700"
						}`}>
						<Brain className="h-4 w-4 inline mr-2" />
						AI Insights
					</button>
				</nav>
			</div>

			<div className="p-6">
				{activeTab === "price" && pricePrediction && (
					<div className="space-y-6">
						<div className="text-center">
							<h3 className="text-lg font-semibold text-gray-900 mb-2">
								Predicted Price
							</h3>
							<div className="text-3xl font-bold text-green-600">
								₹{pricePrediction.predictedPrice.toFixed(2)}
							</div>
							<div className="flex items-center justify-center mt-2">
								<div
									className={`flex items-center px-3 py-1 rounded-full text-sm ${
										pricePrediction.confidence > 0.8
											? "bg-green-100 text-green-800"
											: pricePrediction.confidence > 0.6
											? "bg-yellow-100 text-yellow-800"
											: "bg-red-100 text-red-800"
									}`}>
									{pricePrediction.confidence > 0.8 ? (
										<CheckCircle className="h-4 w-4 mr-1" />
									) : (
										<AlertCircle className="h-4 w-4 mr-1" />
									)}
									{Math.round(pricePrediction.confidence * 100)}% Confidence
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
							<div className="text-center">
								<div className="text-sm text-gray-600">Seasonal</div>
								<div className="text-lg font-semibold">
									{(pricePrediction.factors.seasonal * 100).toFixed(0)}%
								</div>
							</div>
							<div className="text-center">
								<div className="text-sm text-gray-600">Supply</div>
								<div className="text-lg font-semibold">
									{(pricePrediction.factors.supply * 100).toFixed(0)}%
								</div>
							</div>
							<div className="text-center">
								<div className="text-sm text-gray-600">Demand</div>
								<div className="text-lg font-semibold">
									{(pricePrediction.factors.demand * 100).toFixed(0)}%
								</div>
							</div>
							<div className="text-center">
								<div className="text-sm text-gray-600">Quality</div>
								<div className="text-lg font-semibold">
									{(pricePrediction.factors.quality * 100).toFixed(0)}%
								</div>
							</div>
							<div className="text-center">
								<div className="text-sm text-gray-600">Location</div>
								<div className="text-lg font-semibold">
									{(pricePrediction.factors.location * 100).toFixed(0)}%
								</div>
							</div>
						</div>

						<div className="bg-blue-50 rounded-lg p-4">
							<h4 className="font-medium text-blue-900 mb-2">
								Market Analysis
							</h4>
							<p className="text-blue-800">{pricePrediction.marketAnalysis}</p>
						</div>

						<div>
							<h4 className="font-medium text-gray-900 mb-3">
								Recommendations
							</h4>
							<ul className="space-y-2">
								{pricePrediction.recommendations.map((rec, index) => (
									<li key={index} className="flex items-start">
										<Lightbulb className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
										<span className="text-gray-700">{rec}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}

				{activeTab === "demand" && demandForecast && (
					<div className="space-y-6">
						<div className="text-center">
							<h3 className="text-lg font-semibold text-gray-900 mb-2">
								Demand Forecast
							</h3>
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
								Score: {(demandForecast.demandScore * 100).toFixed(1)}%
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="bg-gray-50 rounded-lg p-4">
								<h4 className="font-medium text-gray-900 mb-2">
									Forecasted Quantity
								</h4>
								<div className="text-2xl font-bold text-blue-600">
									{demandForecast.forecastedQuantity} units
								</div>
								<div className="text-sm text-gray-600">
									Next {demandForecast.timeframe} days
								</div>
							</div>

							<div className="bg-gray-50 rounded-lg p-4">
								<h4 className="font-medium text-gray-900 mb-2">Demand Trend</h4>
								<div className="flex items-center">
									<TrendingUp className="h-5 w-5 text-green-500 mr-2" />
									<span className="text-green-600 font-medium">Increasing</span>
								</div>
							</div>
						</div>

						<div>
							<h4 className="font-medium text-gray-900 mb-3">
								Demand Recommendations
							</h4>
							<ul className="space-y-2">
								{demandForecast.recommendations.map((rec, index) => (
									<li key={index} className="flex items-start">
										<Lightbulb className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
										<span className="text-gray-700">{rec}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}

				{activeTab === "insights" && (
					<div className="space-y-6">
						<div className="text-center">
							<Brain className="h-12 w-12 text-purple-600 mx-auto mb-4" />
							<h3 className="text-lg font-semibold text-gray-900 mb-2">
								AI-Powered Insights
							</h3>
							<p className="text-gray-600">
								Advanced analytics powered by machine learning algorithms
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
								<h4 className="font-medium text-blue-900 mb-2">
									Market Intelligence
								</h4>
								<ul className="text-sm text-blue-800 space-y-1">
									<li>• Real-time price tracking across 500+ markets</li>
									<li>• Weather impact analysis on crop yields</li>
									<li>• Supply chain disruption predictions</li>
									<li>• Consumer behavior pattern analysis</li>
								</ul>
							</div>

							<div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
								<h4 className="font-medium text-green-900 mb-2">
									Optimization Suggestions
								</h4>
								<ul className="text-sm text-green-800 space-y-1">
									<li>• Optimal harvest timing recommendations</li>
									<li>• Dynamic pricing strategies</li>
									<li>• Inventory management insights</li>
									<li>• Quality improvement suggestions</li>
								</ul>
							</div>
						</div>

						<div className="bg-purple-50 rounded-lg p-4">
							<h4 className="font-medium text-purple-900 mb-2">
								Blockchain Integration
							</h4>
							<p className="text-purple-800 text-sm">
								All AI predictions and recommendations are recorded on the
								blockchain for transparency and auditability. This ensures that
								farmers and buyers can trust the AI-generated insights and track
								their accuracy over time.
							</p>
						</div>
					</div>
				)}

				{!pricePrediction && !demandForecast && !loading && (
					<div className="text-center py-8">
						<Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
						<h3 className="text-lg font-medium text-gray-900 mb-2">
							No Data Available
						</h3>
						<p className="text-gray-600">
							Provide product information to get AI-powered insights
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

export default AIInsights;
