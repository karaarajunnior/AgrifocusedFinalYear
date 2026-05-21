import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
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
	RefreshCw,
	UserPlus,
	ShieldCheck
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import axios from "axios";
import ClimateAlertsCard from "../components/ClimateAlertsCard";
import TrustBadge, { TrustScore } from "../components/TrustBadge";
import { saveToCache, getFromCache } from "../utils/offlineCache";
import { useOfflineSync } from "../hooks/useOfflineSync";
import OfflineBadge from "../components/OfflineBadge";
import { enqueueOfflineOrderDraft, getOfflineOrderCount } from "../utils/offlineOrderQueue";
import { t } from "../utils/translation";
import LocationLink from "../components/LocationLink";

interface Product {
	id: string;
	name: string;
	category: string;
	price: number;
	quantity: number;
	unit: string;
	location: string;
	latitude?: number | null;
	longitude?: number | null;
	organic: boolean;
	avgRating: number;
	origin: "LOCAL" | "INTERNATIONAL";
	totalReviews: number;
	distance?: number;
	distanceText?: string;
	farmer: {
		id: string;
		name: string;
		location: string;
		latitude: number | null;
		longitude: number | null;
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
	const [currency, setCurrency] = useState<'UGX' | 'USD'>('UGX');
	const EXCHANGE_RATE = 3800;

	const convertPrice = (price: number) => {
		if (currency === 'USD') return (price / EXCHANGE_RATE).toFixed(2);
		return price.toLocaleString();
	};
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [selectedOrigin, setSelectedOrigin] = useState<"LOCAL" | "INTERNATIONAL" | "">("");
	const [priceRange, setPriceRange] = useState({ min: "", max: "" });
	const [showFilters, setShowFilters] = useState(false);
	const [userLocation, setUserLocation] = useState("");
	const [searchRadius, setSearchRadius] = useState(25);
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
	}, [searchTerm, selectedCategory, selectedOrigin, priceRange, userLocation, searchRadius]);

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

	const detectUserLocation = async () => {
		setLocationLoading(true);
		try {
			const res = await api.get("/location/detect");
			if (res.data && res.data.city) {
				const locString = `${res.data.city}, ${res.data.country}`;
				setUserLocation(locString);
				toast.success(`Detected location: ${locString}`);
			} else {
				setUserLocation(user?.location || "Kampala, Uganda");
			}
		} catch (error) {
			console.error("Location detection failed:", error);
			setUserLocation(user?.location || "Kampala, Uganda");
		} finally {
			setLocationLoading(false);
		}
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
			setNearbyProducts([]);
			toast.error("Could not load nearby products. Check your connection and try again.");
		}
	};
	const fetchProducts = async () => {
		try {
			const params = new URLSearchParams();
			if (searchTerm) params.append("search", searchTerm);
			if (selectedCategory) params.append("category", selectedCategory);
			if (selectedOrigin) params.append("origin", selectedOrigin);
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
						Discover fresh produce directly from farmers and supermarkets
					</p>
				</div>

				{/* Origin Tabs */}
				<div className="flex gap-3 mb-8">
					<button
						onClick={() => setSelectedOrigin("")}
						className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${!selectedOrigin ? "bg-slate-800 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
					>
						All Assets
					</button>
					<button
						onClick={() => setSelectedOrigin("LOCAL")}
						className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${selectedOrigin === "LOCAL" ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
					>
						Local Markets
					</button>
					<button
						onClick={() => setSelectedOrigin("INTERNATIONAL")}
						className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${selectedOrigin === "INTERNATIONAL" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
					>
						International
					</button>
				</div>

				{/* Pending Sync Alert */}
				{getOfflineOrderCount() > 0 && (
					<div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<RefreshCw className="h-5 w-5 text-blue-600 animate-spin-slow" />
							<div>
								<p className="text-sm font-semibold text-blue-900">
									{getOfflineOrderCount()} Pending Order(s)
								</p>
								<p className="text-xs text-blue-700">
									These orders will be placed automatically when your connection returns.
								</p>
							</div>
						</div>
						{!isOnline && (
							<span className="text-xs font-bold bg-blue-200 text-blue-800 px-2.5 py-1 rounded-md uppercase">Waiting for Network</span>
						)}
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
					<div className="lg:col-span-1 space-y-6">
						{/* Currency Toggle */}
						<div className="bg-white border border-slate-200 p-4 rounded-2xl flex gap-4 items-center shadow-sm">
							<DollarSign className="h-5 w-5 text-slate-400" />
							<p className="text-sm font-semibold text-slate-600">Currency:</p>
							<div className="flex gap-2">
								<button 
									onClick={() => setCurrency('UGX')}
									className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${currency === 'UGX' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
								>
									UGX
								</button>
								<button 
									onClick={() => setCurrency('USD')}
									className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${currency === 'USD' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
								>
									USD
								</button>
							</div>
						</div>

						{/* Origin Highlights */}
						<div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl shadow-sm">
							<div className="flex justify-between items-start mb-4">
								<TrendingUp className="h-6 w-6 text-emerald-600" />
								<span className="text-[10px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-full uppercase">Top Category</span>
							</div>
							<h4 className="font-bold text-slate-900 mb-1">Local Commodities</h4>
							<p className="text-xs text-slate-500 font-medium">95% Trade Efficiency</p>
						</div>
						{/* Invite an Importer Widget */}
						<div className="rounded-2xl p-6 bg-blue-900 text-white overflow-hidden relative mt-6 shadow-sm">
							<div className="absolute top-0 right-0 p-6 opacity-10">
								<UserPlus className="h-20 w-20" />
							</div>
							<h3 className="text-lg font-bold mb-4">Trade Network</h3>
							<p className="text-sm text-blue-100 mb-6 leading-relaxed">
								Invite an international roaster or bulk buyer to earn <span className="text-amber-400 font-semibold">Trade Pioneer</span> status and exclusive logistics discounts.
							</p>
							<button 
								onClick={() => toast.success("Buyer referral link copied!")}
								className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
							>
								Invite an Importer
							</button>
						</div>
					</div>

					<div className="lg:col-span-2">
						{/* Location-Based Shopping Section */}
				<div className="bg-white border border-slate-200 rounded-2xl mb-12 overflow-hidden shadow-sm">
					<div className="p-6 md:p-8">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
							<div className="flex items-center">
								<div className="p-3 bg-blue-50 rounded-xl text-blue-600 mr-4 border border-blue-100">
									<Navigation className="h-5 w-5" />
								</div>
								<div>
									<h2 className="text-xl font-bold text-slate-800">
										Regional Inventory
									</h2>
									<p className="text-sm text-slate-500 mt-1">
										{locationLoading
											? "Syncing geospatial data..."
											: `Verified assets within ${searchRadius}km of ${userLocation}`}
									</p>
								</div>
							</div>
							<div className="flex items-center space-x-3">
								<select
									value={searchRadius}
									onChange={(e) => setSearchRadius(parseInt(e.target.value))}
									className="px-4 py-2 border border-slate-200 bg-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium text-slate-700">
									<option value={10}>Within 10km</option>
									<option value={25}>Within 25km</option>
									<option value={50}>Within 50km</option>
									<option value={100}>Within 100km</option>
								</select>
								<button
									onClick={detectUserLocation}
									className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
									<Target className="h-4 w-4 mr-2" />
									Update
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
												{product.distanceText || (product.distance ? `${product.distance}km away` : "Location available")}
											</span>
										</div>

										<div className="space-y-1 text-sm text-gray-600 mb-3">
											<p className="text-lg font-bold text-green-600">
												{currency === 'USD' ? '$' : 'UGX'} {convertPrice(product.price)}/{product.unit}
											</p>
											<div className="flex items-center">
												<User className="h-4 w-4 mr-1" />
												<span>{product.farmer.name}</span>
												{product.farmer.verified && (
													<span className="ml-1 text-blue-500">✓</span>
												)}
											</div>
											<LocationLink
												location={product.location}
												latitude={product.latitude ?? product.farmer.latitude}
												longitude={product.longitude ?? product.farmer.longitude}
												className="flex items-center text-gray-600 hover:text-blue-700"
												textClassName="truncate max-w-[120px]"
											/>
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
			</div>
		</div>

				{/* Climate alerts */}
				<div className="mb-8">
					<ClimateAlertsCard location={userLocation || user?.location || "kampala"} />
				</div>
				{/* Analytics Cards */}
				{analytics && (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
						<div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
							<div className="flex justify-between items-center mb-4">
								<p className="text-sm font-semibold text-slate-500">Total Procurement</p>
								<Package className="h-5 w-5 text-blue-500" />
							</div>
							<p className="text-3xl font-bold text-slate-900">{analytics.overview.totalOrders}</p>
						</div>

						<div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
							<div className="flex justify-between items-center mb-4">
								<p className="text-sm font-semibold text-slate-500">Capital Expenditure</p>
								<DollarSign className="h-5 w-5 text-emerald-500" />
							</div>
							<p className="text-3xl font-bold text-slate-900">
								<span className="text-base text-slate-400 mr-1">UGX</span>
								{analytics.overview.totalSpent.toLocaleString()}
							</p>
						</div>

						<div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
							<div className="flex justify-between items-center mb-4">
								<p className="text-sm font-semibold text-slate-500">Average Order Value</p>
								<TrendingUp className="h-5 w-5 text-purple-500" />
							</div>
							<p className="text-3xl font-bold text-slate-900">
								<span className="text-base text-slate-400 mr-1">UGX</span>
								{analytics.overview.averageOrderValue.toLocaleString()}
							</p>
						</div>
					</div>
				)}

				{/* Search and Filters */}
				<div className="bg-white border border-slate-100 rounded-2xl mb-12 shadow-sm">
					<div className="p-6 md:p-8">
						<div className="flex flex-col md:flex-row gap-4">
							<div className="flex-1">
								<div className="relative group">
									<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-emerald-500 transition-colors" />
									<input
										type="text"
										placeholder="Search products..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-medium text-slate-900"
									/>
								</div>
							</div>

							<button
								onClick={() => setShowFilters(!showFilters)}
								className="inline-flex items-center justify-center px-6 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-semibold text-sm text-slate-700">
								<Filter className="h-4 w-4 mr-2" />
								Filters
							</button>
						</div>

						{showFilters && (
							<div className="mt-6 pt-6 border-t border-slate-100">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
									<div>
										<label className="block text-sm font-semibold text-slate-700 mb-2">
											Category
										</label>
										<select
											value={selectedCategory}
											onChange={(e) => setSelectedCategory(e.target.value)}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-700">
											<option value="">All Categories</option>
											{categories.map((category) => (
												<option key={category} value={category}>
													{category.charAt(0) + category.slice(1).toLowerCase()}
												</option>
											))}
										</select>
									</div>

									<div>
										<label className="block text-sm font-semibold text-slate-700 mb-2">
											Min Price (UGX)
										</label>
										<input
											type="number"
											value={priceRange.min}
											onChange={(e) =>
												setPriceRange({ ...priceRange, min: e.target.value })
											}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-700"
											placeholder="0"
										/>
									</div>

									<div>
										<label className="block text-sm font-semibold text-slate-700 mb-2">
											Max Price (UGX)
										</label>
										<input
											type="number"
											value={priceRange.max}
											onChange={(e) =>
												setPriceRange({ ...priceRange, max: e.target.value })
											}
											className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-700"
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
					<div className="flex items-center justify-between mb-6">
						<h2 className="text-xl font-bold text-slate-800">
							Market Inventory
						</h2>
						<div className="text-sm font-semibold text-slate-500">
							{products.length} Items Listed
						</div>
					</div>

					{products.length === 0 ? (
						<div className="bg-white border border-slate-100 rounded-2xl p-16 text-center">
							<Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
							<h3 className="text-lg font-semibold text-slate-800 mb-2">
								No Products Found
							</h3>
							<p className="text-slate-500">
								Try adjusting your search or filters to see more results.
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{products.map((product) => (
								<div
									key={product.id}
									className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-emerald-300 transition-all shadow-sm group">
									<div className="flex justify-between items-start mb-4">
										<div>
											<h3 className="font-bold text-slate-800 text-lg group-hover:text-emerald-700 transition-colors">
												{product.name}
											</h3>
											<p className="text-xs font-semibold text-emerald-600 mt-1 uppercase">
												{product.category}
											</p>
										</div>
										<div className="flex flex-col gap-2 items-end">
											{product.organic && (
												<span className="bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-md">
													Organic
												</span>
											)}
											<span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${product.origin === 'INTERNATIONAL' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
												{product.origin}
											</span>
										</div>
									</div>

									<div className="space-y-4 mb-6">
										<div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
											<p className="text-2xl font-bold text-slate-900">
												<span className="text-sm text-slate-400 mr-1">UGX</span>
												{product.price.toLocaleString()}
												<span className="text-sm text-slate-400 ml-1">/{product.unit}</span>
											</p>
											<div className="flex flex-col items-end">
												<span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1">Direct Trade</span>
												<span className="text-[10px] font-semibold text-slate-500">~UGX {(product.price * 0.43).toLocaleString()} saved</span>
											</div>
										</div>
										
										<div className="flex flex-col gap-2 text-sm text-slate-600">
											<LocationLink
												location={product.location}
												latitude={product.latitude ?? product.farmer.latitude}
												longitude={product.longitude ?? product.farmer.longitude}
												className="flex items-center text-slate-600 hover:text-emerald-700"
											/>

											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<User className="h-4 w-4 text-slate-400" />
													<span className="font-medium text-slate-800">{product.farmer.name}</span>
													{product.farmer.verified && (
														<span className="text-blue-500 text-sm">✓</span>
													)}
													{product.farmerTrust && (
														<TrustBadge trust={product.farmerTrust} compact />
													)}
												</div>

												{product.totalReviews > 0 && (
													<div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100">
														<Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
														<span className="text-xs font-bold text-yellow-700">
															{product.avgRating.toFixed(1)}
														</span>
													</div>
												)}
											</div>
										</div>
									</div>

									<div className="flex gap-3">
										<Link
											to={`/product/${product.id}`}
											className="flex-1 text-center py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm">
											View Details
										</Link>
										<button
											onClick={() => handleOrder(product.id)}
											className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm">
											Order Now
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Recent Orders */}
				{analytics && analytics.recentOrders.length > 0 && (
					<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-12 shadow-sm">
						<div className="px-8 py-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
							<h2 className="text-xl font-bold text-slate-800">
								Recent Orders
							</h2>
							<div className="text-sm font-semibold text-slate-500">
								Latest Transactions
							</div>
						</div>
						<div className="divide-y divide-slate-100">
							{analytics.recentOrders.map((order) => (
								<div
									key={order.id}
									className="flex items-center justify-between p-8 hover:bg-slate-50 transition-colors">
									<div className="flex items-center gap-6">
										<div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center font-bold text-sm text-slate-500">
											{order.product.category.slice(0, 3).toUpperCase()}
										</div>
										<div>
											<h3 className="font-semibold text-slate-800 text-base">
												{order.product.name}
											</h3>
											<p className="text-sm text-slate-500 mt-1">
												{order.quantity} units · UGX {order.totalPrice.toLocaleString()} · {order.farmer.name}
											</p>
											<p className="text-xs text-slate-400 mt-1">
												{new Date(order.createdAt).toLocaleDateString()}
											</p>
										</div>
									</div>
									<span
										className={`px-3 py-1 text-xs font-bold rounded-md uppercase border ${order.status === "DELIVERED"
											? "bg-green-50 text-green-700 border-green-100"
											: order.status === "PENDING"
												? "bg-yellow-50 text-yellow-700 border-yellow-100"
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
