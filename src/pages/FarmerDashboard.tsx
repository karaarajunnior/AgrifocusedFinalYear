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
	Star,
	FileText,
	CreditCard,
	Award,
	Smartphone,
	Check
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
import { saveToCache, getFromCache } from "../utils/offlineCache";
import { useOfflineSync } from "../hooks/useOfflineSync";
import OfflineBadge from "../components/OfflineBadge";
import { getOfflineProductCount } from "../utils/offlineProductQueue";

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

interface CreditRecord {
	score: number;
	rating: string;
	reasons: string[];
	totalIncome: number;
	repaidCount: number;
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
	const [credit, setCredit] = useState<CreditRecord | null>(null);
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

	const [showUSSD, setShowUSSD] = useState(false);
	const [ussdInput, setUssdInput] = useState("");
	const [ussdResponse, setUssdResponse] = useState("CON Welcome to DAFIS Mobile\n1. List Harvest\n2. Check Market Prices\n3. My Credit Score\n4. Help");
	const [ussdSessionId] = useState(`sess_${Math.random().toString(16).slice(2)}`);

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
			const [p, a, m, c] = await Promise.all([
				api.get("/products/farmer/my-products"),
				api.get("/analytics/farmer"),
				api.get("/analytics/market-prices"),
				api.get("/analytics/credit-score"),
			]);
			setProducts(p.data.products);
			setAnalytics(a.data);
			setMarketPrices(m.data);
			setCredit(c.data);

			// Save to cache
			saveToCache('farmer.products', p.data.products);
			saveToCache('farmer.analytics', a.data);
			saveToCache('farmer.marketPrices', m.data);
			saveToCache('farmer.credit', c.data);
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
				const cachedCredit = getFromCache<CreditRecord>('farmer.credit');
				if (cachedMarket) setMarketPrices(cachedMarket.data);
				if (cachedCredit) setCredit(cachedCredit.data);

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
				const message = err.response?.data?.error || "Failed to add product";
				toast.error(message);
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

	const submitUSSD = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		try {
			const res = await api.post("/ussd", {
				msisdn: user?.phone || "256700000000",
				text: ussdInput,
				sessionId: ussdSessionId
			});
			setUssdResponse(res.data);
			if (res.data.startsWith("END")) {
				// Success or Final screen
				setTimeout(() => {
					setUssdResponse("");
					setShowUSSD(false);
					fetchData();
				}, 3000);
			}
			setUssdInput("");
		} catch (err) {
			toast.error("USSD Gateway error");
		}
	};

	const handleDownloadReport = async () => {
		if (!credit || !user) return;
		
		const toastId = toast.loading("Generating Secure Financial Report...");
		
		try {
			// Generate CSV content
			const csvHeaders = ["DAFIS Verified Financial Identity Report", ""];
			const csvMeta = [
				["Generated On", new Date().toLocaleString()],
				["Farmer Name", user.name],
				["DAFIS ID", user.id],
				["Credit Score", credit.score],
				["Rating", credit.rating],
				["Total Verified Income", `UGX ${credit.totalIncome.toLocaleString()}`],
				["Credits Repaid", credit.repaidCount]
			];
			const csvFactors = [
				[""],
				["Verification Factors"],
				...credit.reasons.map(r => [r])
			];
			const csvFooter = [
				[""],
				["Disclaimer: This report is a verified record of DAFIS transactions and is intended for credit assessment by verified banking partners."]
			];

			const allLines = [csvHeaders, ...csvMeta, ...csvFactors, ...csvFooter];
			const csvContent = allLines.map(line => line.map(cell => `"${cell}"`).join(",")).join("\n");

			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.setAttribute("href", url);
			link.setAttribute("download", `DAFIS_Bank_Report_${user.name.split(' ').join('_')}.csv`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			toast.success("Report downloaded successfully", { id: toastId });
		} catch (err) {
			toast.error("Failed to generate report", { id: toastId });
		}
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

				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
					<div>
						<h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">
							Farmer Overview
						</h1>
						<p className="text-slate-500 mt-2 font-medium">Agricultural analytics and market performance tracking.</p>
					</div>
					<div className="flex gap-4">
						<button
							onClick={() => setShowAddProduct(true)}
							className="premium-btn grad-emerald text-white px-8 py-4 rounded-2xl font-bold hover:shadow-2xl hover:shadow-emerald-500/30 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
						>
							<Plus className="h-5 w-5" />
							List New Harvest
						</button>
						{!user?.isExportVerified && (
							<Link
								to="/export-verification"
								className="premium-btn bg-white border-2 border-emerald-600 text-emerald-700 px-8 py-4 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
							>
								<Globe className="h-5 w-5" />
								Verify Export
							</Link>
						)}
					</div>
				</div>

				{/* Quick Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
					<div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
						<div className="p-4 bg-emerald-50 w-fit rounded-2xl mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
							<Package className="h-6 w-6" />
						</div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Listings</p>
						<h3 className="text-4xl font-black text-slate-900 tracking-tight">{analytics?.overview.totalProducts || 0}</h3>
					</div>
					<div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
						<div className="p-4 bg-blue-50 w-fit rounded-2xl mb-6 text-blue-600 group-hover:scale-110 transition-transform">
							<DollarSign className="h-6 w-6" />
						</div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Verified Revenue</p>
						<h3 className="text-4xl font-black text-slate-900 tracking-tight">
							<span className="text-lg font-bold mr-1 opacity-30">UGX</span>
							{(analytics?.overview.totalRevenue || 0).toLocaleString()}
						</h3>
					</div>
					<div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
						<div className="p-4 bg-amber-50 w-fit rounded-2xl mb-6 text-amber-600 group-hover:scale-110 transition-transform">
							<TrendingUp className="h-6 w-6" />
						</div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Completed Sales</p>
						<h3 className="text-4xl font-black text-slate-900 tracking-tight">{analytics?.overview.totalSales || 0}</h3>
					</div>
					<div className="glass-card p-8 group hover:translate-y-[-4px] transition-all">
						<div className="p-4 bg-purple-50 w-fit rounded-2xl mb-6 text-purple-600 group-hover:scale-110 transition-transform">
							<Star className="h-6 w-6" />
						</div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Network Rating</p>
						<h3 className="text-4xl font-black text-slate-900 tracking-tight">{analytics?.overview.averageRating.toFixed(1) || '0.0'}</h3>
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
						{/* Financial Identity Section */}
						{credit && (
							<div className="glass-card p-10 relative overflow-hidden group">
								<div className="absolute top-0 right-0 p-10">
									<Award className={`h-24 w-24 opacity-5 transition-transform group-hover:scale-110 ${credit.score > 700 ? 'text-emerald-600' : 'text-blue-600'}`} />
								</div>
								
								<div className="flex flex-col md:flex-row gap-10 items-start">
									<div className="flex-1">
										<div className="flex items-center gap-3 mb-4">
											<div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
												<CreditCard className="h-5 w-5" />
											</div>
											<h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">verified financial identity</h3>
										</div>
										<p className="text-slate-500 text-sm mb-10 font-medium">Secure credit assessment based on DAFIS ledger activity.</p>
										
										<div className="grid grid-cols-2 gap-4">
											<div className="bg-gray-50 p-4 rounded-2xl">
												<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Credit Score</p>
												<h4 className="text-2xl font-black text-blue-600">{credit.score}</h4>
												<p className="text-xs font-bold text-gray-500">{credit.rating} Rating</p>
											</div>
											<div className="bg-gray-50 p-4 rounded-2xl">
												<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Verified Income</p>
												<h4 className="text-2xl font-black text-green-600">UGX {Math.floor(credit.totalIncome / 1000).toLocaleString()}k</h4>
												<p className="text-xs font-bold text-gray-500">Trailing 12mo</p>
											</div>
										</div>
									</div>

									<div className="w-full md:w-64 space-y-3">
										<p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Score Analysis</p>
										{credit.reasons.map((r, i) => (
											<div key={i} className="flex items-center gap-2 text-xs font-bold text-gray-600">
												<div className="h-1 w-1 rounded-full bg-green-500" />
												{r}
											</div>
										))}
										<button 
											onClick={handleDownloadReport}
											className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
										>
											Download Bank Report
										</button>
									</div>
								</div>
							</div>
						)}

						<ProfitMaximizer onSellDirect={() => setShowAddProduct(true)} />

						{/* My Listings */}
						<div className="glass-card overflow-hidden">
							<div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
								<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">inventory ledger</h3>
								<button 
									onClick={() => setShowAllProducts(!showAllProducts)}
									className="text-xs font-black text-emerald-600 hover:text-emerald-700 flex items-center gap-2 uppercase tracking-widest transition-colors"
								>
									{showAllProducts ? 'Minimize' : 'View All Assets'} <ArrowRight className={`h-4 w-4 transition-transform ${showAllProducts ? 'rotate-90' : ''}`} />
								</button>
							</div>
							<div className="divide-y divide-slate-50">
								{products.length > 0 ? (showAllProducts ? products : products.slice(0, 5)).map(product => (
									<div key={product.id} className="p-8 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
										<div className="flex items-center gap-6">
											<div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center font-black text-[10px] text-slate-400 uppercase shadow-sm group-hover:scale-110 transition-transform">
												{product.category.slice(0, 3)}
											</div>
											<div>
												<h4 className="font-bold text-slate-900 mt-1">{product.name}</h4>
												<p className="text-xs text-slate-500 font-medium">{product.quantity} {product.unit} · IN STOCK</p>
											</div>
										</div>
										<div className="text-right">
											<p className="font-black text-slate-900">UGX {product.price.toLocaleString()}</p>
											<p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{product.category}</p>
										</div>
									</div>
								)) : (
									<div className="p-16 text-center text-slate-400 font-medium">
										No active listings found in ledger.
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

						<div className="glass-card p-8 bg-slate-900 text-white border-0 shadow-emerald-900/20">
							<h4 className="font-black text-white mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
								<Zap className="h-4 w-4 text-amber-400" />
								Market Price Index
							</h4>
							<div className="space-y-4">
								{marketPrices.length > 0 ? marketPrices.map((mp, i) => (
									<div key={i} className="flex justify-between items-center text-sm border-b border-white/10 pb-3 last:border-0 last:pb-0">
										<span className="text-slate-400 font-medium">{mp.item}</span>
										<span className="font-black text-emerald-400">UGX {mp.price.toLocaleString()}</span>
									</div>
								)) : (
									<p className="text-xs text-slate-500 italic">No price baseline available.</p>
								)}
							</div>
						</div>

						<div className="glass-card p-8">
							<div className="flex justify-between items-center mb-6">
								<h4 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-xs">
									<FileText className="h-4 w-4 text-blue-500" />
									Financial Record
								</h4>
								<button 
									onClick={() => window.print()} 
									className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors"
								>
									Export PDF
								</button>
							</div>
							
							<div className="space-y-4 text-sm">
								<div className="flex justify-between pb-3 border-b border-slate-50">
									<span className="text-slate-500 font-medium">Gross Sales Portfolio</span>
									<span className="font-black text-slate-900">UGX {(analytics?.overview.totalRevenue || 0).toLocaleString()}</span>
								</div>
								<div className="flex justify-between pb-3 border-b border-slate-100">
									<span className="text-slate-500 font-medium">Verification Fees (2.5%)</span>
									<span className="font-black text-red-500">- UGX {((analytics?.overview.totalRevenue || 0) * 0.025).toLocaleString()}</span>
								</div>
								<div className="flex justify-between pt-2">
									<span className="font-black text-slate-900 uppercase text-xs tracking-tight">Net Estimated Payout</span>
									<span className="font-black text-emerald-600 text-lg">UGX {((analytics?.overview.totalRevenue || 0) * 0.975).toLocaleString()}</span>
								</div>
							</div>
							
							<div className="mt-8 p-4 bg-slate-50 rounded-2xl text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">
								verified ledger extract · {new Date().toLocaleDateString()}
							</div>
						</div>

						{/* USSD Simulation Trigger */}
						<div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl p-6 text-center">
							<Smartphone className="h-10 w-10 text-amber-600 mx-auto mb-3" />
							<h4 className="font-bold text-amber-900 mb-1">Feature Phone (USSD)</h4>
							<p className="text-xs text-amber-700 mb-4">Simulate how farmers without internet list products via *284#</p>
							<button 
								onClick={() => setShowUSSD(true)}
								className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition"
							>
								Open USSD Simulation
							</button>
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

				{/* USSD Simulation Modal (Fixed Mock Phone) */}
				{showUSSD && (
					<div className="fixed bottom-10 right-10 z-[60] animate-in slide-in-from-bottom-10 duration-500">
						<div className="w-72 bg-gray-900 rounded-[40px] p-4 shadow-2xl border-4 border-gray-800 relative overflow-hidden">
								<div className="h-4 w-1 bg-gray-800 absolute right-[-4px] top-20 rounded-l" />
							<div className="h-8 w-1 bg-gray-800 absolute right-[-4px] top-32 rounded-l" />
							
							{/* Screen */}
							<div className="bg-[#8fb8a3] aspect-[2/3] rounded-xl mb-2 p-4 font-mono text-[11px] text-black flex flex-col justify-between shadow-inner">
								<div className="whitespace-pre-wrap leading-tight">
									{ussdResponse.replace(/CON |END /, '')}
								</div>
								
								{ussdResponse.startsWith("CON") && (
									<form onSubmit={(e) => { e.preventDefault(); submitUSSD(); }} className="mt-4">
										<input
											autoFocus
											className="w-full bg-transparent border-b border-black outline-none font-bold"
											value={ussdInput}
											onChange={(e) => setUssdInput(e.target.value)}
										/>
									</form>
								)}
							</div>
							<div className="text-[9px] text-center text-gray-500 font-bold mb-2 uppercase tracking-widest">
								* Use digital keypad & Send *
							</div>

							{/* Buttons */}
							<div className="grid grid-cols-3 gap-2">
								{[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(num => (
									<button 
										key={num}
										onClick={() => setUssdInput(prev => prev + num)}
										className="h-10 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition border-b-2 border-black active:translate-y-0.5"
									>
										{num}
									</button>
								))}
							</div>

							<div className="flex gap-2 mt-4">
								<button 
									onClick={() => setShowUSSD(false)}
									className="flex-1 py-2 bg-red-900 text-white rounded-lg font-bold text-xs uppercase"
								>
									End
								</button>
								<button 
									onClick={() => submitUSSD()}
									className="flex-1 py-2 bg-green-900 text-white rounded-lg font-bold text-xs uppercase"
								>
									Send
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default FarmerDashboard;
