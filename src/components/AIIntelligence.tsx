// import React, { useState, useEffect } from 'react';
// import { Zap, TrendingUp, UserCheck, ChevronRight, MapPin, Volume2 } from 'lucide-react';
// import api from '../services/api';

// interface GuidanceStep {
// 	title: string;
// 	description: string;
// 	priority: 'HIGH' | 'MEDIUM';
// }

// interface MarketTrends {
// 	priceRange: string;
// 	demand: string;
// 	outlook: string;
// 	summary?: string;
// 	confidence?: number;
// 	updatedAt?: string;
// 	isFresh?: boolean;
// 	sources?: {
// 		activeListings?: number;
// 		priceHistoryPoints30d?: number;
// 		webSignals?: number;
// 		deliveredOrders7d?: number;
// 		totalSignals?: number;
// 	};
// 	source?: string;
// 	sourceType?: string;
// 	lastUpdated?: string;
// 	confidence?: number;
// 	confidence?: number;
// 	updatedAt?: string;
// 	priceAvailable?: boolean;
// 	currency?: string;
// 	unit?: string;
// 	updatedAt?: string;
// 	source?: string;
// 	stale?: boolean;
// 	updatedAt?: string;
// 	source?: string;
// }

// interface Lead {
// 	id: string;
// 	name: string;
// 	location: string;
// 	reason: string;
// }

// export const AIAdvisor: React.FC = () => {
// 	const [steps, setSteps] = useState<GuidanceStep[]>([]);
// 	const [loading, setLoading] = useState(true);

// 	useEffect(() => {
// 		api.get('/intelligence/advisor')
// 			.then(res => setSteps(res.data.guidance))
// 			.catch(() => {})
// 			.finally(() => setLoading(false));
// 	}, []);

// 	if (loading) return <div className="h-48 flex items-center justify-center bg-slate-50 rounded-2xl animate-pulse text-slate-500 font-bold">Checking what to do next...</div>;

// 	return (
// 		<div className="glass-card p-6 border-l-4 border-amber-400">
// 			<div className="flex items-start gap-3 mb-6 text-amber-700">
// 				<Zap className="h-5 w-5 fill-amber-400" />
// 				<div>
// 					<h3 className="text-lg font-black text-slate-900">What to do next</h3>
// 					<p className="text-sm text-slate-600">Short tips in simple words.</p>
// 					<h3 className="text-lg font-black text-slate-900">Recommended next steps</h3>
// 					<p className="text-sm text-slate-600">Short, practical guidance based on your current activity.</p>
// 				</div>
// 			</div>
// 			<div className="space-y-4">
// 				{steps.map((step, i) => (
// 					<div key={i} className="flex gap-4 group rounded-2xl bg-slate-50 p-4">
// 						<div className="flex flex-col items-center pt-1">
// 							<div className={`w-4 h-4 rounded-full ${step.priority === 'HIGH' ? 'bg-red-500' : 'bg-amber-400'}`} />
// 							<div className="w-0.5 h-full bg-slate-100 mt-2" />
// 						</div>
// 						<div>
// 							<h4 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{step.title}</h4>
// 							<p className="text-sm text-slate-600 font-medium leading-relaxed">{step.description}</p>
// 						</div>
// 					</div>
// 				))}
// 			</div>
// 			<button className="w-full mt-5 py-4 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
// 				Show me one step at a time <ChevronRight className="h-4 w-4" />
// 			</button>
// 		</div>
// 	);
// };

// export const MarketIntelligence: React.FC<{ commodity: string; location?: string }> = ({ commodity, location }) => {
// 	const [trends, setTrends] = useState<MarketTrends | null>(null);
// 	const [loading, setLoading] = useState(true);
// 	const [error, setError] = useState(false);
// interface MarketIntelligenceProps {
// 	commodity: string;
// 	location?: string;
// 	refreshIntervalMs?: number;
// }

// export const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({
// 	commodity,
// 	location,
// 	refreshIntervalMs = 5 * 60 * 1000,
// }) => {
// 	const [trends, setTrends] = useState<MarketTrends | null>(null);
// 	const [loading, setLoading] = useState(true);
// 	const [error, setError] = useState<string | null>(null);

// 	useEffect(() => {
// 		setLoading(true);
// 		api.get(`/intelligence/trends?category=${commodity}`)
// 			.then((res) => {
// 				const next = res.data?.trends || {};
// 				setTrends({
// 					priceRange: next.priceRange || "Refreshing live market range...",
// 					demand: next.demand || "Medium",
// 					outlook: next.outlook || "Current price movement is being updated.",
// 					summary: next.summary,
// 					confidence: next.confidence,
// 					updatedAt: next.updatedAt,
// 					isFresh: next.isFresh,
// 					sources: next.sources,
// 				});
// 			})
// 			.catch(() => {
// 				setTrends({
// 					priceRange: "Refreshing live market range...",
// 					demand: "Medium",
// 					outlook: "Current price movement is being updated.",
// 				});
// 			})
// 		setError(false);
// 		const params = new URLSearchParams({ category: commodity });
// 		if (location) params.set('location', location);
// 		api.get(`/intelligence/trends?${params.toString()}`)
// 			.then(res => setTrends(res.data.trends))
// 			.catch(() => {
// 				setError(true);
// 				setTrends({
// 					priceRange: "UGX 1,500 - 4,500/kg",
// 					demand: "Stable",
// 					outlook: "Showing benchmark while live feed reconnects",
// 					source: "Uganda benchmark price",
// 					sourceType: "benchmark",
// 					lastUpdated: new Date().toISOString(),
// 					confidence: 0.45,
// 				});
// 			})
// 			.catch(() => setTrends(getFallbackTrends(commodity)))
// 			.finally(() => setLoading(false));
// 	}, [commodity, location]);

// 	if (loading) return <div className="h-40 bg-slate-900 rounded-3xl animate-pulse" />;
// 	const displayTrends = trends || getFallbackTrends(commodity);
// 		let cancelled = false;
// 		const fetchTrends = async () => {
// 			try {
// 				const params = new URLSearchParams({ category: commodity });
// 				if (location) params.append("location", location);
// 				const res = await api.get(`/intelligence/trends?${params.toString()}`);
// 				if (!cancelled) {
// 					setTrends(res.data?.trends || null);
// 					setError(null);
// 				}
// 			} catch (err: unknown) {
// 				if (!cancelled) {
// 					const message =
// 						(err as { message?: string })?.message || "Could not load trends";
// 					setError(message);
// 				}
// 			} finally {
// 				if (!cancelled) setLoading(false);
// 			}
// 		};

// 	const formatUpdatedAt = (iso?: string) => {
// 		if (!iso) return 'just now';
// 		const ts = new Date(iso).getTime();
// 		if (Number.isNaN(ts)) return 'just now';
// 		const diffMs = Date.now() - ts;
// 		const minutes = Math.max(0, Math.floor(diffMs / 60000));
// 		if (minutes < 1) return 'just now';
// 		if (minutes < 60) return `${minutes}m ago`;
// 		const hours = Math.floor(minutes / 60);
// 		if (hours < 24) return `${hours}h ago`;
// 		const days = Math.floor(hours / 24);
// 		return `${days}d ago`;
// 	};

// 	useEffect(() => {
// 		let mounted = true;
// 		const fetchTrends = async () => {
// 			try {
// 				const res = await api.get('/intelligence/trends', {
// 					params: { category: commodity, t: Date.now() },
// 				});
// 				if (!mounted) return;
// 				setTrends(res.data.trends);
// 				setError(null);
// 			} catch {
// 				if (!mounted) return;
// 				setError('Live prices syncing...');
// 			} finally {
// 				if (mounted) setLoading(false);
// 			}
// 		};

// 		fetchTrends();
// 		const intervalId = window.setInterval(fetchTrends, 60000);
// 		const focusHandler = () => fetchTrends();
// 		window.addEventListener('focus', focusHandler);

// 		return () => {
// 			mounted = false;
// 			window.clearInterval(intervalId);
// 			window.removeEventListener('focus', focusHandler);
// 		};
// 	}, [commodity]);

// 		fetchTrends();
// 		// Auto-refresh so the price display stays current 24/7
// 		const interval = setInterval(fetchTrends, refreshIntervalMs);
// 		return () => {
// 			cancelled = true;
// 			clearInterval(interval);
// 		};
// 	}, [commodity, location, refreshIntervalMs]);

// 	if (loading && !trends)
// 		return <div className="h-40 bg-slate-900 rounded-3xl animate-pulse" />;

// 	const priceText = trends?.priceRange || "Loading live price…";
// 	const demandText = trends?.demand || "—";
// 	const outlookText = trends?.outlook || "Checking the latest market signals.";
// 	const updatedText = trends?.updatedAt
// 		? new Date(trends.updatedAt).toLocaleTimeString([], {
// 				hour: "2-digit",
// 				minute: "2-digit",
// 		  })
// 		: null;

// 	const lastUpdated = trends?.lastUpdated
// 		? new Date(trends.lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
// 		: null;

// 	return (
// 		<div className="glass-card p-8 bg-slate-900 text-white border-0 shadow-emerald-900/20 overflow-hidden relative">
// 			<div className="absolute -top-10 -right-10 opacity-10">
// 				<TrendingUp className="h-32 w-32" />
// 			</div>
// 			<h4 className="font-black text-white mb-2 flex items-center gap-2 text-lg relative z-10">
// 				<TrendingUp className="h-4 w-4 text-emerald-400" />
// 				{commodity} market today
// 			</h4>
// 			<p className="mb-6 text-sm text-slate-300 relative z-10">
// 				Use this to choose where to sell.
// 			</p>
// 			<div className="space-y-5 relative z-10">
// 				<div className="flex justify-between items-end border-b border-white/10 pb-4">
// 					<span className="text-sm font-bold text-slate-300 leading-none mb-1">
// 						Price
// 					</span>
// 					<span className="text-xl font-black text-emerald-400 leading-none text-right">
// 						{priceText}
// 					<span className="text-sm font-bold text-slate-300 leading-none mb-1">Price</span>
// 					<span className="text-xl font-black text-emerald-400 leading-none">{trends?.priceRange || "Refreshing live market range..."}</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">People buying</span>
// 					<span className="text-sm font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">{trends?.demand || "Medium"}</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">This week</span>
// 					<span className="text-sm font-black text-white">{trends?.outlook || "Current price movement is being updated."}</span>
// 				</div>
// 			</div>
// 			<p className="mt-6 text-xs font-bold text-slate-400">Checks app sales and market signals.</p>
// 			<p className="mt-6 text-xs font-bold text-slate-400">Based on app sales and market signals.</p>
// 			<p className="mt-6 text-xs font-bold text-slate-400">Based on current sales and market signals.</p>
// 			<div className="mt-6 relative z-10 space-y-3">
// 				<div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest">
// 					<span className={`rounded-full px-3 py-1 ${trends?.isFresh === false ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
// 						{trends?.isFresh === false ? "Cached market signal" : "Live market signal"}
// 					</span>
// 					{typeof trends?.confidence === "number" && (
// 						<span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
// 							{Math.round(trends.confidence * 100)}% confidence
// 						</span>
// 					)}
// 					{typeof trends?.sources?.totalSignals === "number" && (
// 						<span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
// 							{trends.sources.totalSignals} signals
// 						</span>
// 					)}
// 					<span className="text-xl font-black text-emerald-400 leading-none text-right">{trends?.priceRange || "UGX 1,500 - 4,500/kg"}</span>
// 					<span className="text-xl font-black text-emerald-400 leading-none text-right">{displayTrends.priceRange}</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">People buying</span>
// 					<span className="text-sm font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">{displayTrends.demand}</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">This week</span>
// 					<span className="text-sm font-black text-white">{displayTrends.outlook}</span>
// 				</div>
// 			</div>
// 			<p className="mt-6 text-xs font-bold text-slate-400">
// 				{error ? "Offline fallback" : trends?.source || "Market signal"}{lastUpdated ? ` · updated ${lastUpdated}` : ""}.
// 			</p>
// 			<div className="mt-6 text-xs font-bold text-slate-400 space-y-1">
// 				<p>AI checks app sales and market signals 24/7.</p>
// 				{displayTrends.source && (
// 					<p>
// 						Source: {displayTrends.source}
// 						{typeof displayTrends.confidence === 'number' ? ` · ${Math.round(displayTrends.confidence * 100)}% confidence` : ''}
// 					</p>
// 				)}
// 					<span className="text-xl font-black text-emerald-400 leading-none">
// 						{trends?.priceRange || 'Updating...'}
// 					</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">People buying</span>
// 					<span className="text-sm font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
// 						{demandText}
// 						{trends?.demand || 'Medium'}
// 					</span>
// 				</div>
// 				<div className="flex justify-between items-center py-1">
// 					<span className="text-sm font-bold text-slate-300">This week</span>
// 					<span className="text-sm font-black text-white text-right max-w-[60%]">
// 						{outlookText}
// 					<span className="text-sm font-black text-white">
// 						{trends?.outlook || 'Live trend updates are in progress.'}
// 					</span>
// 				</div>
// 				{trends?.summary && (
// 					<p className="text-xs leading-relaxed text-slate-300">{trends.summary}</p>
// 				)}
// 				<p className="text-xs font-bold text-slate-400">
// 					{trends?.updatedAt
// 						? `Updated ${new Date(trends.updatedAt).toLocaleString()}`
// 						: "AI checks app sales and market signals."}
// 				</p>
// 			</div>
// 			<div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-400">
// 				<span>
// 					{trends?.source
// 						? `Source: ${trends.source}${trends.stale ? " (cached)" : ""}`
// 						: "AI checks app sales and market signals."}
// 				</span>
// 				{updatedText && <span>Updated {updatedText}</span>}
// 			</div>
// 			{error && !trends && (
// 				<p className="mt-3 text-xs text-amber-400 font-bold">
// 					Live feed offline – retrying soon.
// 				</p>
// 			)}
// 				<p>Live 24/7 · updated {formatUpdatedAt(trends?.updatedAt)}</p>
// 				{error && <p className="text-amber-300">{error}</p>}
// 			</div>
// 		</div>
// 	);
// };

// function getFallbackTrends(commodity: string): MarketTrends {
// 	const normalized = commodity.trim().toUpperCase();
// 	const ranges: Record<string, string> = {
// 		COFFEE: 'UGX 5,500 - 8,500/kg',
// 		VEGETABLES: 'UGX 1,200 - 4,500/kg',
// 		FRUITS: 'UGX 1,500 - 5,000/kg',
// 		GRAINS: 'UGX 1,800 - 3,600/kg',
// 		PULSES: 'UGX 3,000 - 6,500/kg',
// 		SPICES: 'UGX 6,000 - 16,000/kg',
// 		DAIRY: 'UGX 1,800 - 3,200/kg',
// 		POULTRY: 'UGX 9,000 - 15,000/kg',
// 	};

// 	return {
// 		priceRange: ranges[normalized] || ranges.COFFEE,
// 		demand: 'Medium',
// 		outlook: 'Baseline estimate available 24/7.',
// 		source: 'DAFIS baseline',
// 		confidence: 0.55,
// 		priceAvailable: true,
// 	};
// }

// export const ProactiveLeads: React.FC = () => {
// 	const [leads, setLeads] = useState<Lead[]>([]);
// 	const [loading, setLoading] = useState(true);

// 	useEffect(() => {
// 		api.get('/intelligence/leads')
// 			.then(res => setLeads(res.data.matches))
// 			.catch(() => {})
// 			.finally(() => setLoading(false));
// 	}, []);

// 	if (loading) return null;

// 	return (
// 		<div className="space-y-4">
// 			<h3 className="text-lg font-black text-slate-900 px-1 flex items-center gap-2">
// 				<Volume2 className="h-5 w-5 text-emerald-600" />
// 				Good people to contact
// 			</h3>
// 			{leads.map(lead => (
// 				<div key={lead.id} className="glass-card p-4 flex items-center justify-between group hover:border-emerald-500 transition-all cursor-pointer">
// 					<div className="flex items-center gap-3">
// 						<div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
// 							<UserCheck className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
// 						</div>
// 						<div>
// 							<p className="text-base font-bold text-slate-900">{lead.name}</p>
// 							<p className="text-sm font-bold text-slate-500 flex items-center gap-1">
// 								<MapPin className="h-2 w-2" /> {lead.location} · {lead.reason}
// 							</p>
// 						</div>
// 					</div>
// 					<button className="p-2 text-slate-300 group-hover:text-emerald-600">
// 						<ChevronRight className="h-5 w-5" />
// 					</button>
// 				</div>
// 			))}
// 		</div>
// 	);
// };
//------------------------clean----------------------------
import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, UserCheck, ChevronRight, MapPin, Volume2 } from 'lucide-react';
import api from '../services/api';

interface GuidanceStep {
	title: string;
	description: string;
	priority: 'HIGH' | 'MEDIUM';
}

interface MarketTrends {
	priceRange: string;
	demand: string;
	outlook: string;
	summary?: string;
	confidence?: number;
	updatedAt?: string;
	isFresh?: boolean;
	sources?: {
		activeListings?: number;
		priceHistoryPoints30d?: number;
		webSignals?: number;
		deliveredOrders7d?: number;
		totalSignals?: number;
	};
	source?: string;
	sourceType?: string;
	lastUpdated?: string;
	priceAvailable?: boolean;
	currency?: string;
	unit?: string;
	stale?: boolean;
}

interface Lead {
	id: string;
	name: string;
	location: string;
	reason: string;
}

export const AIAdvisor: React.FC = () => {
	const [steps, setSteps] = useState<GuidanceStep[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.get('/intelligence/advisor')
			.then(res => setSteps(res.data.guidance))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <div className="h-48 flex items-center justify-center bg-slate-50 rounded-2xl animate-pulse text-slate-500 font-bold">Checking what to do next...</div>;

	return (
		<div className="glass-card p-6 border-l-4 border-amber-400">
			<div className="flex items-start gap-3 mb-6 text-amber-700">
				<Zap className="h-5 w-5 fill-amber-400" />
				<div>
					<h3 className="text-lg font-black text-slate-900">What to do next</h3>
					<p className="text-sm text-slate-600">Short, practical guidance based on your current activity.</p>
				</div>
			</div>
			<div className="space-y-4">
				{steps.map((step, i) => (
					<div key={i} className="flex gap-4 group rounded-2xl bg-slate-50 p-4">
						<div className="flex flex-col items-center pt-1">
							<div className={`w-4 h-4 rounded-full ${step.priority === 'HIGH' ? 'bg-red-500' : 'bg-amber-400'}`} />
							<div className="w-0.5 h-full bg-slate-100 mt-2" />
						</div>
						<div>
							<h4 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{step.title}</h4>
							<p className="text-sm text-slate-600 font-medium leading-relaxed">{step.description}</p>
						</div>
					</div>
				))}
			</div>
			<button className="w-full mt-5 py-4 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
				Show me one step at a time <ChevronRight className="h-4 w-4" />
			</button>
		</div>
	);
};

interface MarketIntelligenceProps {
	commodity: string;
	location?: string;
	refreshIntervalMs?: number;
}

export const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({
	commodity,
	location,
	refreshIntervalMs = 5 * 60 * 1000,
}) => {
	const [trends, setTrends] = useState<MarketTrends | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const formatUpdatedAt = (iso?: string) => {
		if (!iso) return 'just now';
		const ts = new Date(iso).getTime();
		if (Number.isNaN(ts)) return 'just now';
		const diffMs = Date.now() - ts;
		const minutes = Math.max(0, Math.floor(diffMs / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	};

	useEffect(() => {
		let mounted = true;

		const fetchTrends = async () => {
			try {
				const params = new URLSearchParams({ category: commodity });
				if (location) params.append('location', location);
				const res = await api.get(`/intelligence/trends?${params.toString()}`);
				if (!mounted) return;
				setTrends(res.data?.trends || null);
				setError(null);
			} catch (err: unknown) {
				if (!mounted) return;
				const message = (err as { message?: string })?.message || 'Could not load trends';
				setError(message);
				setTrends(getFallbackTrends(commodity));
			} finally {
				if (mounted) setLoading(false);
			}
		};

		fetchTrends();
		const interval = setInterval(fetchTrends, refreshIntervalMs);
		const focusHandler = () => fetchTrends();
		window.addEventListener('focus', focusHandler);

		return () => {
			mounted = false;
			clearInterval(interval);
			window.removeEventListener('focus', focusHandler);
		};
	}, [commodity, location, refreshIntervalMs]);

	if (loading && !trends) return <div className="h-40 bg-slate-900 rounded-3xl animate-pulse" />;

	const displayTrends = trends || getFallbackTrends(commodity);

	return (
		<div className="glass-card p-8 bg-slate-900 text-white border-0 shadow-emerald-900/20 overflow-hidden relative">
			<div className="absolute -top-10 -right-10 opacity-10">
				<TrendingUp className="h-32 w-32" />
			</div>
			<h4 className="font-black text-white mb-2 flex items-center gap-2 text-lg relative z-10">
				<TrendingUp className="h-4 w-4 text-emerald-400" />
				{commodity} market today
			</h4>
			<p className="mb-6 text-sm text-slate-300 relative z-10">
				Use this to choose where to sell.
			</p>
			<div className="space-y-5 relative z-10">
				<div className="flex justify-between items-end border-b border-white/10 pb-4">
					<span className="text-sm font-bold text-slate-300 leading-none mb-1">Price</span>
					<span className="text-xl font-black text-emerald-400 leading-none text-right">
						{displayTrends.priceRange}
					</span>
				</div>
				<div className="flex justify-between items-center py-1">
					<span className="text-sm font-bold text-slate-300">People buying</span>
					<span className="text-sm font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">{displayTrends.demand}</span>
				</div>
				<div className="flex justify-between items-center py-1">
					<span className="text-sm font-bold text-slate-300">This week</span>
					<span className="text-sm font-black text-white">{displayTrends.outlook}</span>
				</div>
				{displayTrends.summary && (
					<p className="text-xs leading-relaxed text-slate-300">{displayTrends.summary}</p>
				)}
			</div>
			<div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest">
				<span className={`rounded-full px-3 py-1 ${displayTrends.isFresh === false ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
					{displayTrends.isFresh === false ? 'Cached market signal' : 'Live market signal'}
				</span>
				{typeof displayTrends.confidence === 'number' && (
					<span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
						{Math.round(displayTrends.confidence * 100)}% confidence
					</span>
				)}
				{typeof displayTrends.sources?.totalSignals === 'number' && (
					<span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
						{displayTrends.sources.totalSignals} signals
					</span>
				)}
			</div>
			<div className="mt-3 text-xs font-bold text-slate-400 space-y-1">
				{displayTrends.source && (
					<p>
						Source: {displayTrends.source}
						{typeof displayTrends.confidence === 'number' ? ` · ${Math.round(displayTrends.confidence * 100)}% confidence` : ''}
					</p>
				)}
				<p>Live 24/7 · updated {formatUpdatedAt(displayTrends.updatedAt)}</p>
				{error && <p className="text-amber-300">{error}</p>}
			</div>
		</div>
	);
};

function getFallbackTrends(commodity: string): MarketTrends {
	const normalized = commodity.trim().toUpperCase();
	const ranges: Record<string, string> = {
		COFFEE: 'UGX 5,500 - 8,500/kg',
		VEGETABLES: 'UGX 1,200 - 4,500/kg',
		FRUITS: 'UGX 1,500 - 5,000/kg',
		GRAINS: 'UGX 1,800 - 3,600/kg',
		PULSES: 'UGX 3,000 - 6,500/kg',
		SPICES: 'UGX 6,000 - 16,000/kg',
		DAIRY: 'UGX 1,800 - 3,200/kg',
		POULTRY: 'UGX 9,000 - 15,000/kg',
	};

	return {
		priceRange: ranges[normalized] || ranges.COFFEE,
		demand: 'Medium',
		outlook: 'Baseline estimate available 24/7.',
		source: 'DAFIS baseline',
		confidence: 0.55,
		priceAvailable: true,
	};
}

export const ProactiveLeads: React.FC = () => {
	const [leads, setLeads] = useState<Lead[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.get('/intelligence/leads')
			.then(res => setLeads(res.data.matches))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	if (loading) return null;

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-black text-slate-900 px-1 flex items-center gap-2">
				<Volume2 className="h-5 w-5 text-emerald-600" />
				Good people to contact
			</h3>
			{leads.map(lead => (
				<div key={lead.id} className="glass-card p-4 flex items-center justify-between group hover:border-emerald-500 transition-all cursor-pointer">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
							<UserCheck className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
						</div>
						<div>
							<p className="text-base font-bold text-slate-900">{lead.name}</p>
							<p className="text-sm font-bold text-slate-500 flex items-center gap-1">
								<MapPin className="h-2 w-2" /> {lead.location} · {lead.reason}
							</p>
						</div>
					</div>
					<button className="p-2 text-slate-300 group-hover:text-emerald-600">
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>
			))}
		</div>
	);
};
