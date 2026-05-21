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
					<h3 className="text-lg font-black text-slate-900">Recommended next steps</h3>
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

export const MarketIntelligence: React.FC<{ commodity: string }> = ({ commodity }) => {
	const [trends, setTrends] = useState<MarketTrends | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.get(`/intelligence/trends?category=${commodity}`)
			.then(res => setTrends(res.data.trends))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [commodity]);

	if (loading) return <div className="h-40 bg-slate-900 rounded-3xl animate-pulse" />;

	return (
		<div className="glass-card p-8 bg-slate-900 text-white border-0 shadow-emerald-900/20 overflow-hidden relative">
			<div className="absolute -top-10 -right-10 opacity-10">
				<TrendingUp className="h-32 w-32" />
			</div>
			<h4 className="font-black text-white mb-2 flex items-center gap-2 text-lg relative z-10">
				<TrendingUp className="h-4 w-4 text-emerald-400" />
				{commodity} market today
			</h4>
			<p className="mb-6 text-sm text-slate-300 relative z-10">Use this to choose where to sell.</p>
			<div className="space-y-5 relative z-10">
				<div className="flex justify-between items-end border-b border-white/10 pb-4">
					<span className="text-sm font-bold text-slate-300 leading-none mb-1">Price</span>
					<span className="text-xl font-black text-emerald-400 leading-none">{trends?.priceRange}</span>
				</div>
				<div className="flex justify-between items-center py-1">
					<span className="text-sm font-bold text-slate-300">People buying</span>
					<span className="text-sm font-black px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">{trends?.demand}</span>
				</div>
				<div className="flex justify-between items-center py-1">
					<span className="text-sm font-bold text-slate-300">This week</span>
					<span className="text-sm font-black text-white">{trends?.outlook}</span>
				</div>
			</div>
			<p className="mt-6 text-xs font-bold text-slate-400">Based on current sales and market signals.</p>
		</div>
	);
};

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
