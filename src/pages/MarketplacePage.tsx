import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
	Sprout,
	Sun,
	ChevronDown,
	Globe2,
	Home
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import TrustBadge, { TrustScore } from "../components/TrustBadge";
import { t } from "../utils/translation";
import { useLanguage } from "../contexts/LanguageContext";
import LocationLink from "../components/LocationLink";
import { getPrimaryProductImage, getProductImages } from "../utils/productImages";

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
	origin?: "LOCAL" | "INTERNATIONAL";
	country?: string;
	organic: boolean;
	avgRating: number;
	totalReviews: number;
	farmer: {
		id: string;
		name: string;
		location: string;
		latitude?: number | null;
		longitude?: number | null;
		verified: boolean;
	};
	farmerTrust?: TrustScore;
	images?: string | string[] | null;
}

function MarketplacePage() {
	const { user } = useAuth();
	useLanguage(); // Triggers re-render on translation switch
	const [searchParams] = useSearchParams();
	const [imageFailures, setImageFailures] = useState<Record<string, boolean>>({});
	const [products, setProducts] = useState<Product[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("");
	const [priceRange, setPriceRange] = useState({ min: "", max: "" });
	const [organicOnly, setOrganicOnly] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState("newest");
	const [originFilter, setOriginFilter] = useState<"" | "LOCAL" | "INTERNATIONAL">("");
	const [locationTerm, setLocationTerm] = useState("");

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
		const urlSearch = searchParams.get("search") || "";
		setSearchTerm(urlSearch);
	}, [searchParams]);

	const categoryLabels: Record<string, string> = {
		VEGETABLES: "Vegetables",
		FRUITS: "Fruits",
		GRAINS: "Grains",
		PULSES: "Beans & peas",
		SPICES: "Spices",
		DAIRY: "Milk & dairy",
		ORGANIC: "Organic",
	};

	useEffect(() => {
		fetchProducts();
	}, [searchTerm, selectedCategory, priceRange, organicOnly, sortBy, originFilter, locationTerm]);

	const fetchProducts = async () => {
		try {
			const params = new URLSearchParams();
			if (searchTerm) params.append("search", searchTerm);
			if (selectedCategory) params.append("category", selectedCategory);
			if (priceRange.min) params.append("minPrice", priceRange.min);
			if (priceRange.max) params.append("maxPrice", priceRange.max);
			if (organicOnly) params.append("organic", "true");
			if (originFilter) params.append("origin", originFilter);
			if (locationTerm) params.append("location", locationTerm);

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
		setOriginFilter("");
		setLocationTerm("");
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-slate-50 flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-white pb-16">
			{/* Dynamic Hero Section */}
			<div className="relative bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 overflow-hidden text-white pt-10 pb-24 md:pt-20 md:pb-32">
				<div className="absolute inset-0 z-0 opacity-30 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-300 via-transparent to-transparent"></div>
				<div className="absolute inset-0 z-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PZyBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIGQ9Ik0wIDIwaDIwdjIwaC0yMHonLz48L3N2Zz4=')]"></div>

				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-left md:text-center">
					<div className="inline-flex items-center justify-center space-x-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-5 border border-white/15">
						<Sprout className="w-5 h-5 text-emerald-400" />
						<span className="text-sm font-semibold tracking-wide uppercase text-emerald-100">
							{t('marketplace_title')}
						</span>
					</div>
					<h1 className="text-3xl sm:text-5xl lg:text-6xl font-black mb-5 tracking-tight drop-shadow-md leading-tight">
						{t('marketplace_title')}
					</h1>
					<p className="text-emerald-50/90 max-w-2xl md:mx-auto text-base md:text-xl font-medium leading-relaxed drop-shadow-sm">
						{t('marketplace_subtitle')}
					</p>
					<div className="mt-7 grid grid-cols-3 gap-2 md:gap-3 max-w-3xl md:mx-auto text-left">
						{[
							{ icon: Search, text: "1. Search crop name" },
							{ icon: MapPin, text: "2. Choose nearby or outside Uganda" },
							{ icon: ShoppingCart, text: "3. Tap Order or View" },
						].map(({ icon: Icon, text }) => (
							<div key={text} className="flex flex-col md:flex-row md:items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-3">
								<Icon className="h-5 w-5 text-emerald-200 shrink-0" />
								<span className="font-bold text-[11px] md:text-sm leading-tight">{text}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
				{/* Search and Filters - Glassmorphism floating bar */}
				<div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-emerald-900/10 border border-white/70 mb-8 overflow-hidden transform transition-all">
					<div className="p-4 md:p-6">
						<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3 lg:gap-4">
							{/* Search */}
							<div className="flex-1">
								<div className="relative group">
									<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-6 w-6 group-hover:text-emerald-500 transition-colors" />
									<input
										type="text"
										placeholder={t('search_placeholder')}
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full pl-13 pr-4 py-4 bg-slate-50 border-transparent hover:border-emerald-200 border-2 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-slate-800 text-base"
									/>
								</div>
							</div>

							<div className="lg:w-72">
								<div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-1 border-2 border-transparent">
									{[
										{ value: "", label: "All", icon: Globe2 },
										{ value: "LOCAL", label: "Near", icon: Home },
										{ value: "INTERNATIONAL", label: "World", icon: Globe2 },
									].map(({ value, label, icon: Icon }) => (
										<button
											key={value || "all"}
											type="button"
											onClick={() => setOriginFilter(value as "" | "LOCAL" | "INTERNATIONAL")}
											className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-black transition-all ${originFilter === value
												? "bg-emerald-600 text-white shadow"
												: "text-slate-600 hover:bg-white"
											}`}
											aria-pressed={originFilter === value}>
											<Icon className="h-4 w-4" />
											{label}
										</button>
									))}
								</div>
							</div>

							{/* Sort dropdown */}
							<div className="lg:w-56 relative">
								<select
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value)}
									className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border-transparent border-2 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700 appearance-none cursor-pointer">
									<option value="newest">{t('newest_first')}</option>
									<option value="price-low">{t('price_low_high')}</option>
									<option value="price-high">{t('price_high_low')}</option>
									<option value="rating">{t('highest_rated')}</option>
								</select>
								<ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
							</div>

							{/* Filter Toggle */}
							<button
								onClick={() => setShowFilters(!showFilters)}
								className={`inline-flex items-center justify-center px-6 py-3.5 border-2 rounded-xl transition-all font-bold ${showFilters 
									? 'bg-emerald-100 border-emerald-200 text-emerald-800' 
									: 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
								<Filter className={`h-5 w-5 mr-2 ${showFilters ? 'text-emerald-600' : 'text-slate-400'}`} />
								{t('filters')}
							</button>
						</div>

						{/* Expanded Filters Panel */}
						{showFilters && (
							<div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
								<div className="grid grid-cols-1 md:grid-cols-5 gap-6">
									<div>
										<label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
											{t('category')}
										</label>
										<div className="relative">
											<select
												value={selectedCategory}
												onChange={(e) => setSelectedCategory(e.target.value)}
												className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 appearance-none font-medium cursor-pointer">
												<option value="">{t('all_categories')}</option>
												{categories.map((category) => (
													<option key={category} value={category}>
														{categoryLabels[category] || category}
													</option>
												))}
											</select>
											<ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
										</div>
									</div>

									<div>
										<label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
											Market place
										</label>
										<input
											type="text"
											value={locationTerm}
											onChange={(e) => setLocationTerm(e.target.value)}
											className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 font-medium"
											placeholder="District, city, country"
										/>
									</div>

									<div>
										<label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
											{t('min_price')}
										</label>
										<input
											type="number"
											value={priceRange.min}
											onChange={(e) =>
												setPriceRange({ ...priceRange, min: e.target.value })
											}
											className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 font-medium"
											placeholder="0"
										/>
									</div>

									<div>
										<label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">
											{t('max_price')}
										</label>
										<input
											type="number"
											value={priceRange.max}
											onChange={(e) =>
												setPriceRange({ ...priceRange, max: e.target.value })
											}
											className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 font-medium"
											placeholder="100000"
										/>
									</div>

									<div className="flex flex-col justify-end gap-3 h-full pb-1">
										<label className="relative flex items-center p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
											<input
												type="checkbox"
												checked={organicOnly}
												onChange={(e) => setOrganicOnly(e.target.checked)}
												className="w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500/50"
											/>
											<span className="ml-3 text-sm font-bold text-slate-700 uppercase tracking-wide">
												{t('organic_only')}
											</span>
										</label>

										<button
											onClick={clearFilters}
											className="text-sm text-rose-500 hover:text-rose-700 font-bold w-full text-right transition-colors uppercase tracking-widest pt-2">
											{t('clear_filters')}
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Results Summary */}
				<div className="mb-6 flex items-center justify-between">
					<p className="text-slate-500 font-medium tracking-wide">
						{t('found_products')} <span className="font-bold text-slate-800">{products.length}</span> {t('products')}
						{selectedCategory && ` in ${selectedCategory.toLowerCase()}`}
						{originFilter === "LOCAL" && " nearby"}
						{originFilter === "INTERNATIONAL" && " worldwide"}
					</p>
				</div>

				{/* Products Grid */}
				{products.length === 0 ? (
					<div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-16 text-center shadow-emerald-900/5">
						<div className="max-w-md mx-auto">
							<div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
								<Leaf className="h-10 w-10 text-emerald-500 opacity-60" />
							</div>
							<h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
								{t('no_products_found')}
							</h3>
							<p className="text-slate-500 mb-8 font-medium">
								{t('no_products_desc')}
							</p>
							<button
								onClick={clearFilters}
								className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all hover:scale-105 shadow-lg shadow-emerald-600/30">
								{t('clear_filters')}
							</button>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-7">
						{products.map((product) => {
							const primaryImage = imageFailures[product.id]
								? undefined
								: getPrimaryProductImage(product.images);
							const imageCount = getProductImages(product.images).length;

							return (
								<div
									key={product.id}
									className="group bg-white rounded-[2rem] shadow-sm border border-emerald-100/70 overflow-hidden hover:shadow-2xl hover:shadow-emerald-900/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative">
									<div className="relative h-56 bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-200 flex items-center justify-center overflow-hidden">
										{primaryImage ? (
											<img
												src={primaryImage}
												alt={product.name}
												className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
												onError={() =>
													setImageFailures((prev) => ({
														...prev,
														[product.id]: true,
													}))
												}
											/>
										) : (
											<>
												<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.35),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.35),_transparent_32%)] self-stretch z-0"></div>
												<div className="absolute inset-0 bg-white/20 backdrop-blur-sm self-stretch z-0"></div>
												<Sun className="absolute -top-10 -right-10 w-32 h-32 text-emerald-300/40 rotate-45 group-hover:rotate-90 transition-transform duration-700 ease-in-out" />
												<Leaf className="h-20 w-20 text-emerald-600/70 z-10 group-hover:scale-110 transition-transform duration-500 delay-100 drop-shadow-md" />
											</>
										)}

										{imageCount > 1 && (
											<div className="absolute bottom-4 left-4 z-20 rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
												{imageCount} photos
											</div>
										)}

										{product.organic && (
											<div className="absolute top-4 right-4 z-20">
												<span className="bg-white/90 backdrop-blur-md text-emerald-800 text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
													{t("organic_badge")}
												</span>
											</div>
										)}

										<div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between rounded-2xl bg-white/90 px-4 py-3 shadow-lg backdrop-blur-md">
											<div>
												<p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
													Fresh stock
												</p>
												<p className="text-sm font-black text-slate-900">
													{product.quantity} {product.unit}
												</p>
											</div>
											<div className="rounded-xl bg-emerald-600 px-3 py-2 text-right text-xs font-black text-white">
												UGX {product.price.toLocaleString()}
												<span className="block text-[9px] font-bold opacity-80">
													/{product.unit}
												</span>
											</div>
							const primaryImage = imageFailures[product.id] ? undefined : getPrimaryProductImage(product.images);
							return (
							<div
								key={product.id}
								className="group bg-white rounded-[2rem] shadow-sm border border-emerald-100/70 overflow-hidden hover:shadow-2xl hover:shadow-emerald-900/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative">
								
								{/* Image / Header Gradient */}
								<div className="relative h-56 bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-200 flex items-center justify-center overflow-hidden">
								<div className="relative h-48 sm:h-56 bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 flex items-center justify-center overflow-hidden">
									{primaryImage ? (
										<img
											src={primaryImage}
											alt={product.name}
											className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
											onError={() => setImageFailures((prev) => ({ ...prev, [product.id]: true }))}
										/>
									) : (
										<>
											<div className="absolute inset-0 bg-white/20 backdrop-blur-sm self-stretch z-0"></div>
											<Sun className="absolute -top-10 -right-10 w-32 h-32 text-emerald-300/40 rotate-45 group-hover:rotate-90 transition-transform duration-700 ease-in-out" />
											<Leaf className="h-20 w-20 text-emerald-600/70 z-10 group-hover:scale-110 transition-transform duration-500 delay-100 drop-shadow-md" />
										</>
									)}
									{getProductImages(product.images).length > 1 && (
										<div className="absolute bottom-4 left-4 z-20 rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
											{getProductImages(product.images).length} photos
										</div>
									</div>

									<div className="p-5 flex flex-col flex-grow">
										<div className="mb-3">
											<span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
												{categoryLabels[product.category] || product.category}
											</span>
											<span
												className={`ml-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
													product.origin === "INTERNATIONAL"
														? "text-indigo-700 bg-indigo-50"
														: "text-slate-600 bg-slate-100"
												}`}>
												{product.origin === "INTERNATIONAL"
													? "World market"
													: "Local"}
											</span>
										</div>

										<h3 className="font-bold text-slate-800 text-xl leading-tight mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
											{product.name}
										</h3>

										<div className="space-y-3 text-sm text-slate-600 mb-6 font-medium bg-slate-50 p-4 rounded-2xl flex-grow">
											<LocationLink
												location={product.location}
												latitude={product.latitude ?? product.farmer?.latitude}
												longitude={product.longitude ?? product.farmer?.longitude}
												className="flex items-start text-slate-600 hover:text-emerald-700"
											/>

											<div className="flex items-center justify-between">
												<div className="flex items-center">
													<User className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
													<span className="truncate pr-2">{product.farmer.name}</span>
													{product.farmer.verified && (
														<span
															className="text-emerald-500 bg-emerald-50 rounded-full p-0.5 flex shrink-0"
															title="Verified Farmer">
															<svg
																className="w-3 h-3"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor">
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={3}
																	d="M5 13l4 4L19 7"
																/>
															</svg>
														</span>
													)}
													{product.farmerTrust && (
														<span className="ml-2 shrink-0">
															<TrustBadge trust={product.farmerTrust} compact />
														</span>
													)}
												</div>
											</div>

											{product.totalReviews > 0 && (
												<div className="flex items-center bg-yellow-50/50 w-max px-2 py-1 rounded-md border border-yellow-100">
													<Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
													<span className="ml-1.5 font-bold text-yellow-700 text-xs">
														{product.avgRating.toFixed(1)}
													</span>
													<span className="text-yellow-600/50 text-[10px] uppercase font-bold ml-1">
														({product.totalReviews})
													</span>
												</div>
											)}

											<div className="pt-2 border-t border-slate-200 mt-2 flex justify-between items-center">
												<span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
													{t("available")}
												</span>
												<span className="text-sm font-black text-slate-700">
													{product.quantity} {product.unit}
												</span>
											</div>
										</div>

										<div className="flex gap-3 mt-auto pt-2">
											<Link
												to={`/product/${product.id}`}
												className="flex-1 text-center px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all">
												{t("view_details")}
											</Link>

											{user && user.role === "BUYER" && (
												<button
													onClick={() => handleQuickOrder(product.id)}
													className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-600/30 flex items-center justify-center group/btn">
													<ShoppingCart className="h-4 w-4 mr-2 group-hover/btn:-translate-y-0.5 transition-transform" />
													{t("order")}
												</button>
											)}
										</div>
									</div>
								</div>
							</div>
							);
						})}
					</div>
				)}

				{/* Call to Action for Non-Users */}
				{!user && (
					<div className="mt-16 relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl shadow-emerald-900/20 border border-emerald-500/30">
						<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PZyBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiIGQ9Ik0wIDEwaDEwdjEwaC0xMHonLz48L3N2Zz4=')] opacity-50"></div>
						
						<div className="relative z-10 max-w-3xl mx-auto">
							<div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
								<TrendingUp className="h-10 w-10 text-white" />
							</div>
							<h3 className="text-2xl md:text-3xl font-black text-white mb-4 tracking-tight drop-shadow-md">
								{t('ready_to_buy')}
							</h3>
							<p className="text-emerald-50/90 text-lg mb-10 max-w-xl mx-auto font-medium">
								Join AgriConnect to place orders, connect securely with verified farmers, and secure the best deals on fresh produce.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<Link
									to="/register"
									className="inline-flex items-center justify-center px-8 py-4 bg-white text-emerald-700 font-black rounded-2xl hover:bg-emerald-50 transition-all shadow-xl hover:shadow-white/20 hover:-translate-y-1">
									{t('signup_buyer')}
								</Link>
								<Link
									to="/login"
									className="inline-flex items-center justify-center px-8 py-4 bg-emerald-800/50 backdrop-blur-md border-2 border-emerald-400/50 text-white font-bold rounded-2xl hover:bg-emerald-800 transition-all">
									{t('have_account')}
								</Link>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default MarketplacePage;
