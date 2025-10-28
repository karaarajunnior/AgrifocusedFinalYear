/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
	Plus,
	Package,
	TrendingUp,
	DollarSign,
	Users,
	BarChart as BarChart3,
	Eye,
	CreditCard as Edit,
	Trash2,
	Star,
	Brain,
	Zap,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import AIInsights from "../components/AIInsights";
import api from "../services/api";
import { toast } from "react-hot-toast";

interface Product {
	id: string;
	name: string;
	category: string;
	price: number;
	quantity: number;
	unit: string;
	available: boolean;
	avgRating: number;
	totalOrders: number;
	totalReviews: number;
	createdAt: string;
}

interface Analytics {
	overview: {
		totalProducts: number;
		totalSales: number;
		totalRevenue: number;
		averageRating: number;
	};
	topProducts: Array<{
		id: string;
		name: string;
		category: string;
		totalOrders: number;
		totalRevenue: number;
	}>;
	recentOrders: Array<{
		id: string;
		quantity: number;
		totalPrice: number;
		status: string;
		createdAt: string;
		product: { name: string };
		buyer: { name: string; location: string };
	}>;
}

function FarmerDashboard() {
	const { user } = useAuth();
	const [products, setProducts] = useState<Product[]>([]);
	const [analytics, setAnalytics] = useState<Analytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [showAddProduct, setShowAddProduct] = useState(false);
	const [showAIInsights, setShowAIInsights] = useState(false);
	const [selectedProductForAI, setSelectedProductForAI] =
		useState<Product | null>(null);
	const [newProduct, setNewProduct] = useState({
		name: "",
		description: "",
		category: "VEGETABLES",
		price: "",
		quantity: "",
		unit: "kg",
		location: "",
		organic: false,
	});

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		try {
			const [productsRes, analyticsRes] = await Promise.all([
				api.get("/products/farmer/my-products"),
				api.get("/analytics/farmer"),
			]);

			setProducts(productsRes.data.products);
			setAnalytics(analyticsRes.data);
		} catch (error) {
			console.error("Failed to fetch data:", error);
			toast.error("Failed to load dashboard data");
		} finally {
			setLoading(false);
		}
	};

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			await api.post("/products", {
				...newProduct,
				price: parseFloat(newProduct.price),
				quantity: parseInt(newProduct.quantity),
			});

			toast.success("Product added successfully!");
			setShowAddProduct(false);
			setNewProduct({
				name: "",
				description: "",
				category: "VEGETABLES",
				price: "",
				quantity: "",
				unit: "kg",
				location: "",
				organic: false,
			});
			fetchData();
		} catch (error: any) {
			toast.error(error.response?.data?.error || "Failed to add product");
		}
	};

	const handleDeleteProduct = async (productId: string) => {
		if (!confirm("Are you sure you want to delete this product?")) return;

		try {
			await api.delete(`/products/${productId}`);
			toast.success("Product deleted successfully!");
			fetchData();
		} catch (error: any) {
			toast.error(error.response?.data?.error || "Failed to delete product");
		}
	};

	const handleAIAnalysis = (product: Product) => {
		setSelectedProductForAI(product);
		setShowAIInsights(true);
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
						Welcome back, {user?.name}! 🌾
					</h1>
					<p className="text-gray-600 mt-2">
						Manage your products and track your farming business
					</p>
				</div>

				{/* Analytics Cards */}
				{analytics && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-blue-100 rounded-lg">
									<Package className="h-6 w-6 text-blue-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Total Products
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{analytics.overview.totalProducts}
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-green-100 rounded-lg">
									<TrendingUp className="h-6 w-6 text-green-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Total Sales
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{analytics.overview.totalSales}
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-yellow-100 rounded-lg">
									<DollarSign className="h-6 w-6 text-yellow-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Total Revenue
									</p>
									<p className="text-2xl font-bold text-gray-900">
										₹{analytics.overview.totalRevenue.toLocaleString()}
									</p>
								</div>
							</div>
						</div>

						<div className="bg-white rounded-lg shadow p-6">
							<div className="flex items-center">
								<div className="p-2 bg-purple-100 rounded-lg">
									<Star className="h-6 w-6 text-purple-600" />
								</div>
								<div className="ml-4">
									<p className="text-sm font-medium text-gray-600">
										Avg Rating
									</p>
									<p className="text-2xl font-bold text-gray-900">
										{analytics.overview.averageRating.toFixed(1)}
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Products Section */}
				<div className="bg-white rounded-lg shadow mb-8">
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-xl font-semibold text-gray-900">My Products</h2>
						<button
							onClick={() => setShowAddProduct(true)}
							className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
							<Plus className="h-4 w-4 mr-2" />
							Add Product
						</button>
					</div>

					<div className="p-6">
						{products.length === 0 ? (
							<div className="text-center py-12">
								<Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
								<h3 className="text-lg font-medium text-gray-900 mb-2">
									No products yet
								</h3>
								<p className="text-gray-600 mb-4">
									Start by adding your first product to the marketplace
								</p>
								<button
									onClick={() => setShowAddProduct(true)}
									className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
									<Plus className="h-4 w-4 mr-2" />
									Add Your First Product
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{products.map((product) => (
									<div
										key={product.id}
										className="border border-gray-200 rounded-lg p-4">
										<div className="flex justify-between items-start mb-3">
											<h3 className="font-semibold text-gray-900">
												{product.name}
											</h3>
											<div className="flex space-x-2">
												<button className="text-gray-400 hover:text-blue-600">
													<Eye className="h-4 w-4" />
												</button>
												<button
													onClick={() => handleAIAnalysis(product)}
													className="text-gray-400 hover:text-purple-600"
													title="AI Analysis">
													<Brain className="h-4 w-4" />
												</button>
												<button className="text-gray-400 hover:text-green-600">
													<Edit className="h-4 w-4" />
												</button>
												<button
													onClick={() => handleDeleteProduct(product.id)}
													className="text-gray-400 hover:text-red-600">
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</div>

										<div className="space-y-2 text-sm text-gray-600">
											<p>
												<span className="font-medium">Category:</span>{" "}
												{product.category}
											</p>
											<p>
												<span className="font-medium">Price:</span> ₹
												{product.price}/{product.unit}
											</p>
											<p>
												<span className="font-medium">Quantity:</span>{" "}
												{product.quantity} {product.unit}
											</p>
											<p>
												<span className="font-medium">Orders:</span>{" "}
												{product.totalOrders}
											</p>
											<div className="flex items-center">
												<span className="font-medium">Rating:</span>
												<div className="flex items-center ml-2">
													<Star className="h-4 w-4 text-yellow-400 fill-current" />
													<span className="ml-1">
														{product.avgRating.toFixed(1)} (
														{product.totalReviews})
													</span>
												</div>
											</div>
										</div>

										<div className="mt-3 pt-3 border-t border-gray-200">
											<span
												className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
													product.available
														? "bg-green-100 text-green-800"
														: "bg-red-100 text-red-800"
												}`}>
												{product.available ? "Available" : "Out of Stock"}
											</span>
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
												{order.buyer.name}
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

				{/* AI Insights Section */}
				<div className="bg-white rounded-lg shadow">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold text-gray-900 flex items-center">
							<Zap className="h-5 w-5 mr-2 text-yellow-500" />
							AI-Powered Market Intelligence
						</h2>
					</div>
					<div className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
								<div className="flex items-center mb-2">
									<Brain className="h-6 w-6 text-blue-600 mr-2" />
									<h3 className="font-semibold text-blue-900">
										Price Prediction
									</h3>
								</div>
								<p className="text-sm text-blue-800 mb-3">
									Get AI-powered price forecasts for your products based on
									market trends.
								</p>
								<button
									onClick={() => (window.location.href = "/ai-models")}
									className="text-blue-600 hover:text-blue-700 font-medium text-sm">
									Try Price Prediction →
								</button>
							</div>

							<div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
								<div className="flex items-center mb-2">
									<TrendingUp className="h-6 w-6 text-green-600 mr-2" />
									<h3 className="font-semibold text-green-900">
										Demand Forecast
									</h3>
								</div>
								<p className="text-sm text-green-800 mb-3">
									Predict market demand to optimize your production planning.
								</p>
								<button
									onClick={() => (window.location.href = "/ai-models")}
									className="text-green-600 hover:text-green-700 font-medium text-sm">
									Forecast Demand →
								</button>
							</div>

							<div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
								<div className="flex items-center mb-2">
									<Package className="h-6 w-6 text-purple-600 mr-2" />
									<h3 className="font-semibold text-purple-900">
										Crop Recommendations
									</h3>
								</div>
								<p className="text-sm text-purple-800 mb-3">
									Get personalized crop suggestions based on your location and
									soil.
								</p>
								<button
									onClick={() => (window.location.href = "/ai-models")}
									className="text-purple-600 hover:text-purple-700 font-medium text-sm">
									Get Recommendations →
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Add Product Modal */}
			{showAddProduct && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<h2 className="text-xl font-semibold text-gray-900 mb-4">
								Add New Product
							</h2>

							<form onSubmit={handleAddProduct} className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Product Name *
									</label>
									<input
										type="text"
										required
										value={newProduct.name}
										onChange={(e) =>
											setNewProduct({ ...newProduct, name: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
										placeholder="e.g., Fresh Tomatoes"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Category *
									</label>
									<select
										value={newProduct.category}
										onChange={(e) =>
											setNewProduct({ ...newProduct, category: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
										<option value="VEGETABLES">Vegetables</option>
										<option value="FRUITS">Fruits</option>
										<option value="GRAINS">Grains</option>
										<option value="PULSES">Pulses</option>
										<option value="SPICES">Spices</option>
										<option value="DAIRY">Dairy</option>
										<option value="ORGANIC">Organic</option>
									</select>
								</div>

								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Price (₹) *
										</label>
										<input
											type="number"
											step="0.01"
											required
											value={newProduct.price}
											onChange={(e) =>
												setNewProduct({ ...newProduct, price: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											placeholder="0.00"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Unit
										</label>
										<select
											value={newProduct.unit}
											onChange={(e) =>
												setNewProduct({ ...newProduct, unit: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
											<option value="kg">kg</option>
											<option value="gram">gram</option>
											<option value="liter">liter</option>
											<option value="piece">piece</option>
											<option value="dozen">dozen</option>
										</select>
									</div>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Quantity *
									</label>
									<input
										type="number"
										required
										value={newProduct.quantity}
										onChange={(e) =>
											setNewProduct({ ...newProduct, quantity: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
										placeholder="Available quantity"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Location *
									</label>
									<input
										type="text"
										required
										value={newProduct.location}
										onChange={(e) =>
											setNewProduct({ ...newProduct, location: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
										placeholder="City, State"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Description
									</label>
									<textarea
										rows={3}
										value={newProduct.description}
										onChange={(e) =>
											setNewProduct({
												...newProduct,
												description: e.target.value,
											})
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
										placeholder="Describe your product..."
									/>
								</div>

								<div className="flex items-center">
									<input
										type="checkbox"
										id="organic"
										checked={newProduct.organic}
										onChange={(e) =>
											setNewProduct({
												...newProduct,
												organic: e.target.checked,
											})
										}
										className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
									/>
									<label
										htmlFor="organic"
										className="ml-2 block text-sm text-gray-900">
										Organic Product
									</label>
								</div>

								<div className="flex justify-end space-x-3 pt-4">
									<button
										type="button"
										onClick={() => setShowAddProduct(false)}
										className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
										Cancel
									</button>
									<button
										type="submit"
										className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
										Add Product
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}

			{/* AI Insights Modal */}
			{showAIInsights && selectedProductForAI && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
					<div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl font-semibold text-gray-900 flex items-center">
									<Brain className="h-6 w-6 mr-2 text-purple-600" />
									AI Analysis: {selectedProductForAI.name}
								</h2>
								<button
									onClick={() => {
										setShowAIInsights(false);
										setSelectedProductForAI(null);
									}}
									className="text-gray-400 hover:text-gray-600">
									✕
								</button>
							</div>

							<AIInsights
								productData={{
									name: selectedProductForAI.name,
									category: selectedProductForAI.category,
									price: selectedProductForAI.price,
									quantity: selectedProductForAI.quantity,
									unit: selectedProductForAI.unit,
									organic: false,
									location: user?.location || "India",
								}}
								userRole="FARMER"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default FarmerDashboard;
