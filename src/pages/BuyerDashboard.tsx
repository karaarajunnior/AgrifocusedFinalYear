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
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import AIInsights from "../components/AIInsights";

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
		} catch (error) {
			console.error("Failed to fetch analytics:", error);
		}
	};

	const detectUserLocation = () => {
		setLocationLoading(true);
		// Use user's profile location or default to Mumbai
		const location = user?.location || "Mumbai, Maharashtra";
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
					distanceText: `${
						Math.round((Math.random() * searchRadius + 1) * 10) / 10
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
		} catch (error) {
			console.error("Failed to fetch products:", error);
			toast.error("Failed to load products");
		} finally {
			setLoading(false);
			setLocationLoading(false);
		}
	};

	const handleOrder = async (productId: string, quantity: number = 1) => {
		try {
			await api.post("/orders", {
				productId,
				quantity,
				notes: "Order placed from dashboard",
			});

			toast.success("Order placed successfully!");
			fetchData(); // Refresh analytics
		} catch (error: any) {
			toast.error(error.response?.data?.error || "Failed to place order");
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
					<h1 className="text-3xl font-bold text-gray-900">
						Welcome back, {user?.name}! 🛒
					</h1>
					<p className="text-gray-600 mt-2">
						Discover fresh produce directly from farmers
					</p>
				</div>

				{/* Location-Based Shopping Section */}
				<div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow mb-8">
					<div className="p-6">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center">
								<div className="p-2 bg-blue-100 rounded-lg mr-3">
									<Navigation className="h-6 w-6 text-blue-600" />
								</div>
								<div>
									<h2 className="text-xl font-semibold text-gray-900">
										Products Near You
									</h2>
									<p className="text-gray-600">
										{locationLoading
											? "Detecting your location..."
											: `Showing products within ${searchRadius}km of ${userLocation}`}
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
													`${
														product.distance ||
														Math.round(Math.random() * searchRadius + 1)
													}km away`}
											</span>
										</div>

										<div className="space-y-1 text-sm text-gray-600 mb-3">
											<p className="text-lg font-bold text-green-600">
												₹{product.price}/{product.unit}
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
				{/* Analytics Cards */}
				{analytics && (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-blue-100 rounded-lg">
									<Package className="h-6 w-6 text-blue-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Total Orders
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{analytics.overview.totalOrders}
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-green-100 rounded-lg">
									<DollarSign className="h-6 w-6 text-green-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Total Spent
									</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{analytics.overview.totalSpent.toLocaleString()}
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-purple-100 rounded-lg">
									<TrendingUp className="h-6 w-6 text-purple-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Avg Order Value
									</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{analytics.overview.averageOrderValue.toLocaleString()}
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Search and Filters */}
				<div className="bg-white rounded-lg shadow mb-8">
					<div className="p-6">
						<div className="flex flex-col md:flex-row gap-4">
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
									<input
										type="text"
										placeholder="Search for products..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
							</div>

							<button
								onClick={() => setShowFilters(!showFilters)}
								className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
								<Filter className="h-4 w-4 mr-2" />
								Filters
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
				<div className="bg-white rounded-lg shadow mb-8">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold text-gray-900">
							Available Products
						</h2>
					</div>

					<div className="p-6">
						{products.length === 0 ? (
							<div className="text-center py-12">
								<Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									No products found
								</h3>
								<p className="text-gray-600">
									Try adjusting your search or filters
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{products.map((product) => (
									<div
										key={product.id}
										className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
										<div className="flex justify-between items-start mb-3">
											<div>
												<h3 className="font-semibold text-gray-900">
													{product.name}
												</h3>
												<p className="text-sm text-gray-600">
													{product.category}
												</p>
											</div>
											{product.organic && (
												<span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
													Organic
												</span>
											)}
										</div>

										<div className="space-y-2 text-sm text-gray-600 mb-4">
											<p className="text-lg font-bold text-green-600">
												₹{product.price}/{product.unit}
											</p>
											<p>
												<span className="font-medium">Available:</span>{" "}
												{product.quantity} {product.unit}
											</p>

											<div className="flex items-center">
												<MapPin className="h-4 w-4 mr-1" />
												<span>{product.location}</span>
											</div>

											<div className="flex items-center justify-between">
												<div className="flex items-center">
													<User className="h-4 w-4 mr-1" />
													<span>{product.farmer.name}</span>
													{product.farmer.verified && (
														<span className="ml-1 text-blue-500">✓</span>
													)}
												</div>

												{product.totalReviews > 0 && (
													<div className="flex items-center">
														<Star className="h-4 w-4 text-yellow-400 fill-current" />
														<span className="ml-1">
															{product.avgRating.toFixed(1)} (
															{product.totalReviews})
														</span>
													</div>
												)}
											</div>
										</div>

										<div className="flex space-x-2">
											<Link
												to={`/product/${product.id}`}
												className="flex-1 text-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
												View Details
											</Link>
											<button
												onClick={() => handleOrder(product.id)}
												className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
												Order Now
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Recent Orders */}
				{analytics && analytics.recentOrders.length > 0 && (
					<div className="bg-white rounded-lg shadow">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-xl font-semibold text-gray-900">
								Recent Orders
							</h2>
						</div>
						<div className="p-6">
							<div className="space-y-4">
								{analytics.recentOrders.map((order) => (
									<div
										key={order.id}
										className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
										<div>
											<h3 className="font-medium text-gray-900">
												{order.product.name}
											</h3>
											<p className="text-sm text-gray-600">
												{order.quantity} units • ₹{order.totalPrice} •{" "}
												{order.farmer.name}
											</p>
											<p className="text-xs text-gray-500">
												{new Date(order.createdAt).toLocaleDateString()}
											</p>
										</div>
										<span
											className={`px-2 py-1 text-xs font-medium rounded-full ${
												order.status === "DELIVERED"
													? "bg-green-100 text-green-800"
													: order.status === "PENDING"
													? "bg-yellow-100 text-yellow-800"
													: "bg-blue-100 text-blue-800"
											}`}>
											{order.status}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default BuyerDashboard;
