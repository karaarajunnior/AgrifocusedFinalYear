import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
	Zap,
	ShieldCheck,
	ArrowRight,
	Globe,
	RefreshCw,
	Plus,
	Package,
	DollarSign,
	TrendingUp,
	Star
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ProfitMaximizer from "../components/ProfitMaximizer";
import { Link } from "react-router-dom";
import api from "../services/api";
import { toast } from "react-hot-toast";
import axios from "axios";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import {
	enqueueOfflineProductDraft,
} from "../utils/offlineProductQueue";
import ClimateAlertsCard from "../components/ClimateAlertsCard";
import DynamicFieldsetForm from "../components/DynamicFieldsetForm";
import {
	PRODUCT_FORM_KEY,
	defaultProductFormDefinition,
	type FormDefinition,
} from "../utils/formDefinitions";
import { saveToCache, getFromCache, isOffline } from "../utils/offlineCache";
import { useOfflineSync } from "../hooks/useOfflineSync";
import OfflineBadge from "../components/OfflineBadge";
import { getOfflineProductQueue, getOfflineProductCount } from "../utils/offlineProductQueue";

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
	topProducts: any[];
	recentOrders: any[];
}

interface MarketPrice {
	item: string;
	price: number;
	trend: string;
}

function FarmerDashboard() {
	const { user } = useAuth();

	const [products, setProducts] = useState<Product[]>([]);
	const [analytics, setAnalytics] = useState<Analytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [cacheTime, setCacheTime] = useState<string | undefined>();
	const [showAddProduct, setShowAddProduct] = useState(false);
	const [showAllProducts, setShowAllProducts] = useState(false);
	const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);

	const { isOnline } = useOfflineSync(() => {
		fetchData();
	});

	const [simpleMode] = useLocalStorageState<boolean>(
		"agri.simpleMode.farmer",
		true,
	);

	const [addStep, setAddStep] = useState(0);
	const [submitting, setSubmitting] = useState(false);

	const [productFormDef, setProductFormDef] = useState<FormDefinition>(
		defaultProductFormDefinition(),
	);
	const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

	const [newProduct, setNewProduct] = useState({
		name: "",
		description: "",
		category: "VEGETABLES",
		price: "",
		quantity: "",
		unit: "kg",
		location: user?.location || "",
		organic: false,
	});

	useEffect(() => {
		fetchData();

		try {
			const raw = localStorage.getItem(PRODUCT_FORM_KEY);
			setProductFormDef(raw ? JSON.parse(raw) : defaultProductFormDefinition());
		} catch {
			setProductFormDef(defaultProductFormDefinition());
		}
	}, []);

	const fetchData = async () => {
		try {
			const [p, a, m] = await Promise.all([
				api.get("/products/farmer/my-products"),
				api.get("/analytics/farmer"),
				api.get("/analytics/market-prices"),
			]);
			setProducts(p.data.products);
			setAnalytics(a.data);
			setMarketPrices(m.data);

			// Save to cache
			saveToCache('farmer.products', p.data.products);
			saveToCache('farmer.analytics', a.data);
			saveToCache('farmer.marketPrices', m.data);
			setCacheTime(undefined);
		} catch (e) {
			if (axios.isAxiosError(e) && !e.response) {
				// We are likely offline, try to load from cache
				const cachedProducts = getFromCache<Product[]>('farmer.products');
				const cachedAnalytics = getFromCache<Analytics>('farmer.analytics');

				if (cachedProducts) setProducts(cachedProducts.data);
				if (cachedAnalytics) {
					setAnalytics(cachedAnalytics.data);
					setCacheTime(cachedAnalytics.timestamp);
				}
				const cachedMarket = getFromCache<MarketPrice[]>('farmer.marketPrices');
				if (cachedMarket) setMarketPrices(cachedMarket.data);

				toast.error("Offline: Showing cached data", { icon: "📡" });
			} else {
				toast.error("Failed to load dashboard data");
			}
		} finally {
			setLoading(false);
		}
	};

	const isLastStep = () => addStep >= (simpleMode ? 2 : 3);

	const submitProduct = async () => {
		const payload = {
			name: newProduct.name.trim(),
			description: simpleMode ? "" : newProduct.description,
			category: newProduct.category,
			price: Number(newProduct.price),
			quantity: Number(newProduct.quantity),
			unit: newProduct.unit,
			location: newProduct.location || user?.location || "",
			organic: simpleMode ? false : newProduct.organic,
			customFields,
		};

		setSubmitting(true);
		try {
			await api.post("/products", payload);
			toast.success("Product added");
			setShowAddProduct(false);
			setAddStep(0);
			setCustomFields({});
			await fetchData();
		} catch (err) {
			if (axios.isAxiosError(err) && !err.response) {
				enqueueOfflineProductDraft(payload);
				toast.success("Saved offline");
			} else {
				toast.error("Failed to add product");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handleAddProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isLastStep()) return setAddStep((s) => s + 1);
		await submitProduct();
	};

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50/50">
			<div className="max-w-7xl mx-auto px-4 py-10">
				{/* Welcome Header */}
				<div className="mb-6">
					<OfflineBadge isOffline={!isOnline} timestamp={cacheTime} />
				</div>

				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
					<div>
						<h1 className="text-3xl font-bold text-gray-900 tracking-tight">
							Hello, {user?.name.split(' ')[0]} 👋
						</h1>
						<p className="text-gray-500 mt-1">Manage your coffee farm and track market trends.</p>
					</div>
					<div className="flex gap-3">
						<button
							onClick={() => setShowAddProduct(true)}
							className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20 flex items-center gap-2"
						>
							<Plus className="h-5 w-5" />
							List Harvest
						</button>
						{!user?.isExportVerified && (
							<Link
								to="/export-verification"
								className="bg-white border-2 border-green-600 text-green-700 px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center gap-2"
							>
								<Globe className="h-5 w-5" />
								Apply to Export
							</Link>
						)}
					</div>
				</div>

				{/* Quick Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
					<div className="bg-white p-6 rounded-2xl border shadow-sm">
						<div className="p-3 bg-blue-50 w-fit rounded-xl mb-4 text-blue-600">
							<Package className="h-6 w-6" />
						</div>
						<p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Products</p>
						<h3 className="text-3xl font-black text-gray-900 mt-1">{analytics?.overview.totalProducts || 0}</h3>
					</div>
					<div className="bg-white p-6 rounded-2xl border shadow-sm">
						<div className="p-3 bg-green-50 w-fit rounded-xl mb-4 text-green-600">
							<DollarSign className="h-6 w-6" />
						</div>
						<p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Revenue</p>
						<h3 className="text-3xl font-black text-gray-900 mt-1">
							<span className="text-lg font-bold mr-1">UGX</span>
							{(analytics?.overview.totalRevenue || 0).toLocaleString()}
						</h3>
					</div>
					<div className="bg-white p-6 rounded-2xl border shadow-sm">
						<div className="p-3 bg-amber-50 w-fit rounded-xl mb-4 text-amber-600">
							<TrendingUp className="h-6 w-6" />
						</div>
						<p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Sales Made</p>
						<h3 className="text-3xl font-black text-gray-900 mt-1">{analytics?.overview.totalSales || 0}</h3>
					</div>
					<div className="bg-white p-6 rounded-2xl border shadow-sm">
						<div className="p-3 bg-purple-50 w-fit rounded-xl mb-4 text-purple-600">
							<Star className="h-6 w-6" />
						</div>
						<p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Avg Rating</p>
						<h3 className="text-3xl font-black text-gray-900 mt-1">{analytics?.overview.averageRating.toFixed(1) || '0.0'}</h3>
					</div>
				</div>

				{/* Pending Sync Alert */}
				{getOfflineProductCount() > 0 && (
					<div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<RefreshCw className="h-5 w-5 text-amber-600 animate-spin-slow" />
							<div>
								<p className="text-sm font-bold text-amber-900">
									{getOfflineProductCount()} Pending Sync Item(s)
								</p>
								<p className="text-xs text-amber-700">
									These products will be uploaded automatically when you are back online.
								</p>
							</div>
						</div>
						{!isOnline && (
							<span className="text-[10px] font-black bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full uppercase">Waiting for Network</span>
						)}
					</div>
				)}

				<div className="grid lg:grid-cols-3 gap-8 mb-10">
					{/* Left Column: Analytics & Proof */}
					<div className="lg:col-span-2 space-y-8">
						<ProfitMaximizer onSellDirect={() => setShowAddProduct(true)} />

						{/* My Listings */}
						<div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
							<div className="p-6 border-b flex justify-between items-center">
								<h3 className="text-xl font-bold text-gray-900">My Listings</h3>
								<button 
									onClick={() => setShowAllProducts(!showAllProducts)}
									className="text-sm font-bold text-green-600 hover:text-green-700 flex items-center gap-1"
								>
									{showAllProducts ? 'Show Less' : 'Manage All'} <ArrowRight className={`h-4 w-4 transition-transform ${showAllProducts ? 'rotate-90' : ''}`} />
								</button>
							</div>
							<div className="divide-y">
								{products.length > 0 ? (showAllProducts ? products : products.slice(0, 5)).map(product => (
									<div key={product.id} className="p-6 hover:bg-gray-50 transition flex items-center justify-between">
										<div className="flex items-center gap-4">
											<div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-xs">
												{product.category.slice(0, 3)}
											</div>
											<div>
												<h4 className="font-bold text-gray-900">{product.name}</h4>
												<p className="text-sm text-gray-500">{product.quantity}{product.unit} Available</p>
											</div>
										</div>
										<div className="text-right">
											<p className="font-bold text-gray-900">UGX {product.price.toLocaleString()}</p>
											<p className="text-xs text-gray-500 capitalize">{product.category}</p>
										</div>
									</div>
								)) : (
									<div className="p-10 text-center text-gray-500">
										No products listed yet. Start by listing your harvest.
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Right Column: Alerts & Verification */}
					<div className="space-y-8">
						{!user?.isExportVerified && (
							<div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 text-white shadow-xl shadow-green-600/30">
								<div className="flex items-center gap-3 mb-4">
									<div className="p-2 bg-white/20 rounded-lg">
										<ShieldCheck className="h-6 w-6" />
									</div>
									<h4 className="font-bold text-lg">Export Status: Not Verified</h4>
								</div>
								<p className="text-green-100 text-sm leading-relaxed mb-6">
									You are currently restricted to local sales. Verified exporters earn 2x more per kg on international contracts.
								</p>
								<Link
									to="/export-verification"
									className="block w-full text-center py-3 bg-white text-green-700 rounded-xl font-bold hover:bg-green-50 transition translate-y-0 active:translate-y-1"
								>
									Verify for Export
								</Link>
							</div>
						)}

						<ClimateAlertsCard location={user?.location || "Kampala"} />

						<div className="bg-white rounded-2xl shadow-sm border p-6">
							<h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
								<Zap className="h-4 w-4 text-amber-500" />
								Regional Price Index
							</h4>
							<div className="space-y-4">
								{marketPrices.length > 0 ? marketPrices.map((mp, i) => (
									<div key={i} className="flex justify-between items-center text-sm">
										<span className="text-gray-600 font-medium">{mp.item}</span>
										<span className="font-bold text-green-600">{mp.price.toLocaleString()}/kg</span>
									</div>
								)) : (
									<p className="text-xs text-gray-400 italic">No recent price data available.</p>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Add Product Modal */}
				{showAddProduct && (
					<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
						<div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
							<div className="p-8 border-b bg-gray-50/50">
								<div className="flex justify-between items-center">
									<div>
										<h2 className="text-2xl font-bold text-gray-900">List Your Harvest</h2>
										<p className="text-sm text-gray-500 mt-1">Step {addStep + 1} of {simpleMode ? 3 : 4}</p>
									</div>
									<button
										onClick={() => { setShowAddProduct(false); setAddStep(0); }}
										className="p-2 hover:bg-gray-200 rounded-full transition"
									>
										<Plus className="h-6 w-6 rotate-45 text-gray-400" />
									</button>
								</div>
							</div>

							<form onSubmit={handleAddProduct} className="p-8 space-y-6">
								{addStep === 0 && (
									<div className="space-y-4">
										<label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Product Name</label>
										<input
											autoFocus
											className="w-full border-2 border-gray-100 p-4 rounded-2xl text-lg font-medium focus:border-green-500 focus:bg-white transition-all outline-none bg-gray-50"
											placeholder="e.g. Arabica Dried Cherry"
											value={newProduct.name}
											onChange={(e) =>
												setNewProduct({ ...newProduct, name: e.target.value })
											}
										/>
										<div className="flex flex-wrap gap-2">
											{['Coffee', 'Vegetables', 'Fruits'].map(cat => (
												<button
													key={cat}
													type="button"
													onClick={() => setNewProduct({ ...newProduct, category: cat.toUpperCase() })}
													className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${newProduct.category === cat.toUpperCase() ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500'}`}
												>
													{cat}
												</button>
											))}
										</div>
									</div>
								)}

								{addStep === 1 && (
									<div className="space-y-4">
										<label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Price per KG (UGX)</label>
										<div className="relative">
											<input
												autoFocus
												type="number"
												className="w-full border-2 border-gray-100 p-4 rounded-2xl text-2xl font-black focus:border-green-500 focus:bg-white transition-all outline-none bg-gray-50"
												placeholder="0"
												value={newProduct.price}
												onChange={(e) =>
													setNewProduct({ ...newProduct, price: e.target.value })
												}
											/>
											<div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300">UGX</div>
										</div>
									</div>
								)}

								{addStep === 2 && (
									<div className="space-y-4">
										<label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Estimated Quantity</label>
										<div className="relative">
											<input
												autoFocus
												type="number"
												className="w-full border-2 border-gray-100 p-4 rounded-2xl text-2xl font-black focus:border-green-500 focus:bg-white transition-all outline-none bg-gray-50"
												placeholder="0"
												value={newProduct.quantity}
												onChange={(e) =>
													setNewProduct({
														...newProduct,
														quantity: e.target.value,
													})
												}
											/>
											<div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300">KG</div>
										</div>
									</div>
								)}

								{!simpleMode && addStep === 3 && (
									<div className="space-y-6">
										<div>
											<label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Description</label>
											<textarea
												className="w-full border-2 border-gray-100 p-4 rounded-2xl min-h-[120px] focus:border-green-500 focus:bg-white transition-all outline-none bg-gray-50"
												placeholder="Describe the quality, grade, or moisture level..."
												value={newProduct.description}
												onChange={(e) =>
													setNewProduct({
														...newProduct,
														description: e.target.value,
													})
												}
											/>
										</div>

										<DynamicFieldsetForm
											fieldSets={productFormDef.fieldSets}
											values={customFields}
											onChange={setCustomFields}
										/>
									</div>
								)}

								<div className="flex gap-4 pt-4">
									<button
										type="button"
										onClick={() => {
											if (addStep > 0) setAddStep(s => s - 1);
											else setShowAddProduct(false);
										}}
										className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition"
									>
										{addStep === 0 ? 'Cancel' : 'Back'}
									</button>
									<button
										type="submit"
										disabled={submitting}
										className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
									>
										{submitting ? <RefreshCw className="animate-spin h-5 w-5" /> : (isLastStep() ? "Finalize & List" : "Continue")}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default FarmerDashboard;
