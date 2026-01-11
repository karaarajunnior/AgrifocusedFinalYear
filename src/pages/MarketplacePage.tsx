import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
	Search,
	Filter,
	MapPin,
	Star,
	User,
	ShoppingCart,
	Leaf,
	TrendingUp,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

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
	farmer: {
		id: string;
		name: string;
		location: string;
		verified: boolean;
	};
}

function MarketplacePage() {
	const { user } = useAuth();
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [priceRange, setPriceRange] = useState({ min: "", max: "" });
	const [organicOnly, setOrganicOnly] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState("newest");

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
		fetchProducts();
	}, [searchTerm, selectedCategory, priceRange, organicOnly, sortBy]);

	const fetchProducts = async () => {
		try {
			const params = new URLSearchParams();
			if (searchTerm) params.append("search", searchTerm);
			if (selectedCategory) params.append("category", selectedCategory);
			if (priceRange.min) params.append("minPrice", priceRange.min);
			if (priceRange.max) params.append("maxPrice", priceRange.max);
			if (organicOnly) params.append("organic", "true");

			const response = await api.get(`/products?${params.toString()}`);
			const sortedProducts: Product[] = [...response.data.products];

			// Sort products
			switch (sortBy) {
				case "price-low":
					sortedProducts.sort((a: Product, b: Product) => a.price - b.price);
					break;
				case "price-high":
					sortedProducts.sort((a: Product, b: Product) => b.price - a.price);
					break;
				case "rating":
					sortedProducts.sort(
						(a: Product, b: Product) => b.avgRating - a.avgRating,
					);
					break;
				case "newest":
				default:
					// Already sorted by newest from API
					break;
			}

			setProducts(sortedProducts);
		} catch (error) {
			console.error("Failed to fetch products:", error);
			toast.error("Failed to load products");
		} finally {
			setLoading(false);
		}
	};

	const handleQuickOrder = async (productId: string) => {
		if (!user) {
			toast.error("Please login to place an order");
			return;
		}

		if (user.role !== "BUYER") {
			toast.error("Only buyers can place orders");
			return;
		}

		try {
			await api.post("/orders", {
				productId,
				quantity: 1,
				notes: "Quick order from marketplace",
			});

			toast.success("Order placed successfully!");
		} catch (error: unknown) {
			let message = "Failed to place order";
			if (axios.isAxiosError(error)) {
				const data = error.response?.data;
				if (data && typeof data === "object") {
					const maybe = data as Record<string, unknown>;
					if (typeof maybe.error === "string") message = maybe.error;
				}
			}
			toast.error(message);
		}
	};

	const clearFilters = () => {
		setSearchTerm("");
		setSelectedCategory("");
		setPriceRange({ min: "", max: "" });
		setOrganicOnly(false);
		setSortBy("newest");
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
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						Fresh Produce Marketplace 🌾
					</h1>
					<p className="text-gray-600">
						Discover fresh, quality produce directly from verified farmers
					</p>
				</div>

				{/* Search and Filters */}
				<div className="bg-white rounded-lg shadow mb-8">
					<div className="p-6">
						<div className="flex flex-col lg:flex-row gap-4">
							{/* Search */}
							<div className="flex-1">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
									<input
										type="text"
										placeholder="Search for products, farmers, or locations..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
									/>
								</div>
							</div>

							{/* Sort */}
							<div className="lg:w-48">
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value)}
									className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
									<option value="newest">Newest First</option>
									<option value="price-low">Price: Low to High</option>
									<option value="price-high">Price: High to Low</option>
									<option value="rating">Highest Rated</option>
								</select>
							</div>

							{/* Filter Toggle */}
							<button
								onClick={() => setShowFilters(!showFilters)}
								className="inline-flex items-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
								<Filter className="h-4 w-4 mr-2" />
								Filters
							</button>
						</div>

						{/* Filters Panel */}
						{showFilters && (
							<div className="mt-6 pt-6 border-t border-gray-200">
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

									<div className="flex flex-col justify-end">
										<div className="flex items-center mb-2">
											<input
												type="checkbox"
												id="organic"
												checked={organicOnly}
												onChange={(e) => setOrganicOnly(e.target.checked)}
												className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
											/>
											<label
												htmlFor="organic"
												className="ml-2 block text-sm text-gray-900">
												Organic Only
											</label>
										</div>

										<button
											onClick={clearFilters}
											className="text-sm text-green-600 hover:text-green-700 font-medium">
											Clear All Filters
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Results Summary */}
				<div className="mb-6">
					<p className="text-gray-600">
						Found {products.length} products
						{selectedCategory && ` in ${selectedCategory.toLowerCase()}`}
						{searchTerm && ` matching "${searchTerm}"`}
					</p>
				</div>

				{/* Products Grid */}
				{products.length === 0 ? (
					<div className="bg-white rounded-lg shadow p-12 text-center">
						<div className="max-w-md mx-auto">
							<Leaf className="h-16 w-16 text-gray-400 mx-auto mb-4" />
							<h3 className="text-xl font-medium text-gray-900 mb-2">
								No products found
							</h3>
							<p className="text-gray-600 mb-6">
								Try adjusting your search terms or filters to find what you're
								looking for.
							</p>
							<button
								onClick={clearFilters}
								className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
								Clear Filters
							</button>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{products.map((product) => (
							<div
								key={product.id}
								className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
								{/* Product Image Placeholder */}
								<div className="h-48 bg-gradient-to-br from-green-100 to-green-200 rounded-t-lg flex items-center justify-center">
									<Leaf className="h-16 w-16 text-green-600" />
								</div>

								<div className="p-4">
									{/* Product Header */}
									<div className="flex justify-between items-start mb-2">
										<div>
											<h3 className="font-semibold text-gray-900 text-lg">
												{product.name}
											</h3>
											<p className="text-sm text-gray-600">
												{product.category}
											</p>
										</div>
										{product.organic && (
											<span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
												🌱 Organic
											</span>
										)}
									</div>

									{/* Price */}
									<div className="mb-3">
										<span className="text-2xl font-bold text-green-600">
											₹{product.price}
										</span>
										<span className="text-gray-600">/{product.unit}</span>
									</div>

									{/* Product Details */}
									<div className="space-y-2 text-sm text-gray-600 mb-4">
										<div className="flex items-center">
											<MapPin className="h-4 w-4 mr-1" />
											<span>{product.location}</span>
										</div>

										<div className="flex items-center justify-between">
											<div className="flex items-center">
												<User className="h-4 w-4 mr-1" />
												<span>{product.farmer.name}</span>
												{product.farmer.verified && (
													<span
														className="ml-1 text-blue-500"
														title="Verified Farmer">
														✓
													</span>
												)}
											</div>

											{product.totalReviews > 0 && (
												<div className="flex items-center">
													<Star className="h-4 w-4 text-yellow-400 fill-current" />
													<span className="ml-1">
														{product.avgRating.toFixed(1)}
													</span>
													<span className="text-gray-500">
														({product.totalReviews})
													</span>
												</div>
											)}
										</div>

										<div>
											<span className="font-medium">Available:</span>{" "}
											{product.quantity} {product.unit}
										</div>
									</div>

									{/* Actions */}
									<div className="flex space-x-2">
										<Link
											to={`/product/${product.id}`}
											className="flex-1 text-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
											View Details
										</Link>

										{user && user.role === "BUYER" && (
											<button
												onClick={() => handleQuickOrder(product.id)}
												className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center">
												<ShoppingCart className="h-4 w-4 mr-1" />
												Order
											</button>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Call to Action for Non-Users */}
				{!user && (
					<div className="mt-12 bg-green-50 rounded-lg p-8 text-center">
						<TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
						<h3 className="text-xl font-semibold text-gray-900 mb-2">
							Ready to start buying fresh produce?
						</h3>
						<p className="text-gray-600 mb-6">
							Join AgriConnect to place orders, connect with farmers, and get
							the best deals on fresh produce.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Link
								to="/register"
								className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors">
								Sign Up as Buyer
							</Link>
							<Link
								to="/login"
								className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
								Already have an account?
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default MarketplacePage;
