/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
	ShoppingCart,
	TrendingUp,
	DollarSign,
	Package,
	Search,
	Filter,
	Star,
	MapPin,
	User,
	Navigation,
	Target,
	Clock,
	RefreshCw,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import axios from "axios";
import AIInsights from "../components/AIInsights";
import ClimateAlertsCard from "../components/ClimateAlertsCard";
import TrustBadge, { TrustScore } from "../components/TrustBadge";
import { saveToCache, getFromCache, isOffline } from "../utils/offlineCache";
import { useOfflineSync } from "../hooks/useOfflineSync";
import OfflineBadge from "../components/OfflineBadge";
import { enqueueOfflineOrderDraft, getOfflineOrderCount } from "../utils/offlineOrderQueue";

interface Product {
	id: string;
	name: string;
	category: string;
	price: number;
	quantity: number;
	unit: string;
	location: string;
	organic: boolean;
	avgRating: number;
	totalReviews: number;
	distance?: number;
	distanceText?: string;
	farmer: {
		id: string;
		name: string;
		location: string;
		verified: boolean;
	};
	farmerTrust?: TrustScore;
}

interface Analytics {
	overview: {
		totalOrders: number;
		totalSpent: number;
		averageOrderValue: number;
	};
	recentOrders: Array<{
		id: string;
		quantity: number;
		totalPrice: number;
		status: string;
		createdAt: string;
		product: {
			name: string;
			category: string;
			images: string;
		};
		farmer: {
			name: string;
			location: string;
		};
	}>;
}

function BuyerDashboard() {
	const { user } = useAuth();
	const [products, setProducts] = useState<Product[]>([]);
	const [nearbyProducts, setNearbyProducts] = useState<Product[]>([]);
	const [analytics, setAnalytics] = useState<Analytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [locationLoading, setLocationLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [priceRange, setPriceRange] = useState({ min: "", max: "" });
	const [showFilters, setShowFilters] = useState(false);
	const [userLocation, setUserLocation] = useState("");
	const [searchRadius, setSearchRadius] = useState(25);
	const [showAIModal, setShowAIModal] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
	const [cacheTime, setCacheTime] = useState<string | undefined>();

	const { isOnline } = useOfflineSync(() => {
		fetchData();
		fetchProducts();
	});

	const categories = [
		"VEGETABLES",
		"FRUITS",
		"GRAINS",
		"PULSES",
		"SPICES",
		"DAIRY",
		"ORGANIC",
	];

	useEffect(() => {
		fetchData();
		detectUserLocation();
	}, []);

	useEffect(() => {
		if (userLocation) {
			fetchProducts();
			fetchNearbyProducts();
		}
	}, [searchTerm, selectedCategory, priceRange, userLocation, searchRadius]);

	const fetchData = async () => {
		try {
			const analyticsRes = await api.get("/analytics/buyer");
			setAnalytics(analyticsRes.data);
			saveToCache('buyer.analytics', analyticsRes.data);
			setCacheTime(undefined);
		} catch (error) {
			console.error("Failed to fetch analytics:", error);
			if (axios.isAxiosError(error) && !error.response) {
				const cached = getFromCache<Analytics>('buyer.analytics');
				if (cached) {
					setAnalytics(cached.data);
					setCacheTime(cached.timestamp);
				}
			}
		}
	};

	const detectUserLocation = () => {
		setLocationLoading(true);
		// Use user's profile location or default to Mumbai
		const location = user?.location || "default, home";
		setUserLocation(location);
		setLocationLoading(false);
	};

	const fetchNearbyProducts = async () => {
		try {
			const params = new URLSearchParams();
			params.append("location", userLocation);
			params.append("radius", searchRadius.toString());

			const response = await api.get(`/products/nearby?${params.toString()}`);
			setNearbyProducts(response.data.products || []);
		} catch (error) {
			console.error("Failed to fetch nearby products:", error);
			// Fallback to regular products with simulated distances
			const productsWithDistance = products
				.slice(0, 6)
				.map((product, index) => ({
					...product,
					distance: Math.round((Math.random() * searchRadius + 1) * 10) / 10,
					distanceText: `${Math.round((Math.random() * searchRadius + 1) * 10) / 10
						} km away`,
				}));
			setNearbyProducts(productsWithDistance);
		}
	};
	const fetchProducts = async () => {
		try {
			const params = new URLSearchParams();
			if (searchTerm) params.append("search", searchTerm);
			if (selectedCategory) params.append("category", selectedCategory);
			if (priceRange.min) params.append("minPrice", priceRange.min);
			if (priceRange.max) params.append("maxPrice", priceRange.max);

			const response = await api.get(`/products?${params.toString()}`);
			setProducts(response.data.products);

			if (!searchTerm && !selectedCategory) {
				saveToCache('buyer.products', response.data.products);
			}
		} catch (error) {
			console.error("Failed to fetch products:", error);
			if (axios.isAxiosError(error) && !error.response) {
				const cached = getFromCache<Product[]>('buyer.products');
				if (cached) setProducts(cached.data);
			} else {
				toast.error("Failed to load products");
			}
		} finally {
			setLoading(false);
			setLocationLoading(false);
		}
	};

	const handleOrder = async (productId: string, quantity: number = 1) => {
		const product = products.find(p => p.id === productId) || nearbyProducts.find(p => p.id === productId);

		try {
			await api.post("/orders", {
				productId,
				quantity,
				notes: "Order placed from dashboard",
			});

			toast.success("Order placed successfully!");
			fetchData(); // Refresh analytics
		} catch (error: any) {
			if (axios.isAxiosError(error) && !error.response) {
				enqueueOfflineOrderDraft({
					productId,
					quantity,
					notes: "Order placed from dashboard (Offline)"
				}, product?.name || "Product");
				toast.success("Order saved offline. Will sync when online.");
			} else {
				toast.error(error.response?.data?.error || "Failed to place order");
			}
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-8">
					<OfflineBadge isOffline={!isOnline} timestamp={cacheTime} />
					<h1 className="text-3xl font-bold text-gray-900">
						Welcome back, {user?.name}! 🛒
					</h1>
					<p className="text-gray-600 mt-2">
						Discover fresh produce directly from farmers
					</p>
				</div>

				{/* Pending Sync Alert */}
				{getOfflineOrderCount() > 0 && (
					<div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<RefreshCw className="h-5 w-5 text-blue-600 animate-spin-slow" />
							<div>
								<p className="text-sm font-bold text-blue-900">
									{getOfflineOrderCount()} Pending Order(s)
								</p>
								<p className="text-xs text-blue-700">
									These orders will be placed automatically when your connection returns.
								</p>
							</div>
						</div>
						{!isOnline && (
							<span className="text-[10px] font-black bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full uppercase">Waiting for Network</span>
						)}
					</div>
				)}

				{/* Location-Based Shopping Section */}
				<div className="glass-card mb-12 overflow-hidden border-blue-100/30">
					<div className="p-10">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
							<div className="flex items-center">
								<div className="p-4 bg-blue-50 rounded-2xl text-blue-600 mr-6 shadow-sm">
									<Navigation className="h-6 w-6" />
								</div>
								<div>
									<h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
										Regional Inventory
									</h2>
									<p className="text-slate-500 font-medium mt-1">
										{locationLoading
											? "Syncing geospatial data..."
											: `Verified assets within ${searchRadius}km of ${userLocation}`}
									</p>
								</div>
							</div>
							<div className="flex items-center space-x-4">
								<select
									value={searchRadius}
									onChange={(e) => setSearchRadius(parseInt(e.target.value))}
									className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value={10}>Within 10km</option>
									<option value={25}>Within 25km</option>
									<option value={50}>Within 50km</option>
									<option value={100}>Within 100km</option>
								</select>
								<button
									onClick={detectUserLocation}
									className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
									<Target className="h-4 w-4 mr-2" />
									Update Location
								</button>
							</div>
						</div>

						{/* Nearby Products Grid */}
						{locationLoading ? (
							<div className="flex items-center justify-center py-8">
								<LoadingSpinner size="lg" />
							</div>
						) : nearbyProducts.length > 0 ? (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{nearbyProducts.map((product) => (
									<div
										key={product.id}
										className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
										<div className="flex justify-between items-start mb-2">
											<h3 className="font-semibold text-gray-900">
												{product.name}
											</h3>
											<span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
												📍{" "}
												{product.distanceText ||
													`${product.distance ||
													Math.round(Math.random() * searchRadius + 1)
													}km away`}
											</span>
										</div>

										<div className="space-y-1 text-sm text-gray-600 mb-3">
											<p className="text-lg font-bold text-green-600">
												UGX {product.price}/{product.unit}
											</p>
											<div className="flex items-center">
												<User className="h-4 w-4 mr-1" />
												<span>{product.farmer.name}</span>
												{product.farmer.verified && (
													<span className="ml-1 text-blue-500">✓</span>
												)}
											</div>
											<div className="flex items-center">
												<MapPin className="h-4 w-4 mr-1" />
												<span>{product.location}</span>
											</div>
										</div>

										<div className="flex space-x-2">
											<Link
												to={`/product/${product.id}`}
												className="flex-1 text-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
												View Details
											</Link>
											<button
												onClick={() => handleOrder(product.id)}
												className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
												Order Now
											</button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8">
								<MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									No nearby products found
								</h3>
								<p className="text-gray-600 mb-4">
									Try increasing your search radius or check back later for new
									products in your area.
								</p>
								<button
									onClick={() => setSearchRadius(searchRadius + 25)}
									className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
									Expand Search to {searchRadius + 25}km
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Climate alerts */}
				<div className="mb-8">
					<ClimateAlertsCard location={userLocation || user?.location || "kampala"} />
				</div>
				{/* Analytics Cards */}
				{analytics && (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
						<div className="glass-card p-10 group hover:translate-y-[-4px] transition-all">
							<div className="flex items-center">
								<div className="p-4 bg-blue-50 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-sm">
									<Package className="h-7 w-7" />
								</div>
								<div className="ml-8">
									<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Procurement</p>
									<p className="text-4xl font-black text-slate-900 tracking-tight">{analytics.overview.totalOrders}</p>
								</div>
							</div>
						</div>

						<div className="glass-card p-10 group hover:translate-y-[-4px] transition-all">
							<div className="flex items-center">
								<div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform shadow-sm">
									<DollarSign className="h-7 w-7" />
								</div>
								<div className="ml-8">
									<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Capital Expenditure</p>
									<p className="text-3xl font-black text-slate-900 tracking-tight">
										<span className="text-xs font-bold mr-1 opacity-30 tracking-normal">UGX</span>
										{analytics.overview.totalSpent.toLocaleString()}
									</p>
								</div>
							</div>
						</div>

						<div className="glass-card p-10 group hover:translate-y-[-4px] transition-all">
							<div className="flex items-center">
								<div className="p-4 bg-purple-50 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform shadow-sm">
									<TrendingUp className="h-7 w-7" />
								</div>
								<div className="ml-8">
									<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efficiency Index</p>
									<p className="text-3xl font-black text-slate-900 tracking-tight">
										<span className="text-xs font-bold mr-1 opacity-30 tracking-normal">UGX</span>
										{analytics.overview.averageOrderValue.toLocaleString()}
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Search and Filters */}
				<div className="glass-card mb-12">
					<div className="p-10">
						<div className="flex flex-col md:flex-row gap-6">
							<div className="flex-1">
								<div className="relative group">
									<Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-emerald-500 transition-colors" />
									<input
										type="text"
										placeholder="Query market inventory..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full pl-14 pr-6 py-5 bg-slate-50 border-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 font-medium text-slate-900"
									/>
								</div>
							</div>

							<button
								onClick={() => setShowFilters(!showFilters)}
								className="inline-flex items-center px-8 py-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all font-black text-[10px] uppercase tracking-[0.2em] text-slate-600">
								<Filter className="h-4 w-4 mr-3" />
								Engine Parameters
							</button>
						</div>

						{showFilters && (
							<div className="mt-4 pt-4 border-t border-gray-200">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Category
										</label>
										<select
											value={selectedCategory}
											onChange={(e) => setSelectedCategory(e.target.value)}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
											<option value="">All Categories</option>
											{categories.map((category) => (
												<option key={category} value={category}>
													{category.charAt(0) + category.slice(1).toLowerCase()}
												</option>
											))}
										</select>
									</div>

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Min Price (₹)
										</label>
										<input
											type="number"
											value={priceRange.min}
											onChange={(e) =>
												setPriceRange({ ...priceRange, min: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											placeholder="0"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Max Price (₹)
										</label>
										<input
											type="number"
											value={priceRange.max}
											onChange={(e) =>
												setPriceRange({ ...priceRange, max: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											placeholder="1000"
										/>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Products Grid */}
				<div className="mb-12">
					<div className="flex items-center justify-between mb-8">
						<h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
							Market Inventory
						</h2>
						<div className="text-xs font-black text-slate-400 uppercase tracking-widest">
							{products.length} assets listed
						</div>
					</div>

					{products.length === 0 ? (
						<div className="glass-card p-20 text-center">
							<Package className="h-12 w-12 text-slate-200 mx-auto mb-6" />
							<h3 className="text-lg font-bold text-slate-900 mb-2">
								Empty Ledger
							</h3>
							<p className="text-slate-500 font-medium">
								No products match your current parameters.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
							{products.map((product) => (
								<div
									key={product.id}
									className="glass-card p-8 group hover:translate-y-[-4px] transition-all border-slate-100/50">
									<div className="flex justify-between items-start mb-6">
										<div>
											<h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-emerald-600 transition-colors">
												{product.name}
											</h3>
											<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
												{product.category}
											</p>
										</div>
										{product.organic && (
											<span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100/50">
												Organic
											</span>
										)}
									</div>

									<div className="space-y-4 mb-8">
										<div className="p-4 bg-slate-50 rounded-2xl">
											<p className="text-2xl font-black text-slate-900">
												<span className="text-xs font-bold mr-1 opacity-30">UGX</span>
												{product.price.toLocaleString()}
												<span className="text-xs font-bold opacity-30 ml-1">/{product.unit}</span>
											</p>
										</div>
										
										<div className="flex flex-col gap-3 text-sm font-medium text-slate-600">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
													<MapPin className="h-4 w-4" />
												</div>
												<span>{product.location}</span>
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
														<User className="h-4 w-4" />
													</div>
													<div className="flex items-center gap-2">
														<span className="font-bold text-slate-900">{product.farmer.name}</span>
														{product.farmer.verified && (
															<div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
																<span className="text-[10px] text-white font-bold">✓</span>
															</div>
														)}
														{product.farmerTrust && (
															<TrustBadge trust={product.farmerTrust} compact />
														)}
													</div>
												</div>

												{product.totalReviews > 0 && (
													<div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
														<Star className="h-3.5 w-3.5 text-amber-500 fill-current" />
														<span className="text-xs font-black text-amber-700">
															{product.avgRating.toFixed(1)}
														</span>
													</div>
												)}
											</div>
										</div>
									</div>

									<div className="flex gap-4">
										<Link
											to={`/product/${product.id}`}
											className="flex-1 text-center py-4 border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest">
											Specs
										</Link>
										<button
											onClick={() => handleOrder(product.id)}
											className="flex-1 py-4 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:shadow-emerald-500/20">
											Procure
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Recent Orders */}
				{analytics && analytics.recentOrders.length > 0 && (
					<div className="glass-card overflow-hidden mb-12">
						<div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
							<h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
								Procurement History
							</h2>
							<div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
								Verified Ledger
							</div>
						</div>
						<div className="divide-y divide-slate-50">
							{analytics.recentOrders.map((order) => (
								<div
									key={order.id}
									className="flex items-center justify-between p-10 hover:bg-slate-50/50 transition-colors group">
									<div className="flex items-center gap-8">
										<div className="w-16 h-16 bg-white border border-slate-100 rounded-2xl flex items-center justify-center font-black text-xs text-slate-400 group-hover:scale-110 transition-transform shadow-sm">
											{order.product.category.slice(0, 3).toUpperCase()}
										</div>
										<div>
											<h3 className="font-bold text-slate-900 text-lg">
												{order.product.name}
											</h3>
											<p className="text-sm text-slate-500 font-medium mt-1">
												{order.quantity} units · UGX {order.totalPrice.toLocaleString()} · {order.farmer.name}
											</p>
											<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
												{new Date(order.createdAt).toLocaleDateString()}
											</p>
										</div>
									</div>
									<span
										className={`px-4 py-2 text-[10px] font-black rounded-full uppercase tracking-widest border ${order.status === "DELIVERED"
											? "bg-emerald-50 text-emerald-700 border-emerald-100"
											: order.status === "PENDING"
												? "bg-amber-50 text-amber-700 border-amber-100"
												: "bg-blue-50 text-blue-700 border-blue-100"
											}`}>
										{order.status}
									</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default BuyerDashboard;
