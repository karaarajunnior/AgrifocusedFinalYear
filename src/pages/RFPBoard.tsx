import React, { useState } from 'react';
import { 
    FileText, 
    Search, 
    Globe, 
    Zap, 
    ArrowRight, 
    UserPlus,
    Navigation,
    Clock,
    CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const RFPBoard: React.FC = () => {
    const [rfps] = useState([
        { id: 1, title: "Grade A Arabica", quantity: "5 Tons", region: "United Kingdom", urgency: "High", posted: "2h ago" },
        { id: 2, title: "Organic Robusta", quantity: "12 Tons", region: "Netherlands", urgency: "Standard", posted: "5h ago" },
        { id: 3, title: "Specialty Honey Process", quantity: "500kg", region: "USA", urgency: "Immediate", posted: "1h ago" }
    ]);

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="max-w-7xl mx-auto px-4">
                {/* Board Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-6">
                        <Globe className="h-3 w-3" /> External Trade Board
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 uppercase tracking-tight mb-4">
                        Global <span className="text-emerald-600">Sourcing</span> Requests
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
                        Public RFPs from international importers. Farmers can respond directly with their verified portfolios.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Active Requests */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Requests ({rfps.length})</h3>
                            <button className="text-xs font-bold text-emerald-600 hover:underline">Refresh Feed</button>
                        </div>

                        {rfps.map((rfp) => (
                            <div key={rfp.id} className="glass-card p-8 group hover:border-emerald-500/30 transition-all cursor-pointer">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                                            <FileText className="h-8 w-8 text-slate-400 group-hover:text-emerald-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{rfp.title}</h4>
                                                <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase ${rfp.urgency === 'Immediate' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                    {rfp.urgency}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                <span>Quantity: {rfp.quantity}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {rfp.region}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end gap-2">
                                        <p className="text-[10px] font-black text-slate-300 uppercase flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {rfp.posted}
                                        </p>
                                        <button className="flex-1 md:w-full px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all">
                                            Apply with Portfolio
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sidebar: For Foreign Buyers */}
                    <div className="space-y-8">
                        <div className="p-10 bg-slate-900 rounded-[3rem] text-white overflow-hidden relative shadow-2xl">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <Navigation className="h-48 w-48" />
                            </div>
                            <div className="relative z-10">
                                <Zap className="h-10 w-10 text-emerald-400 mb-8" />
                                <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Post a Sourcing Request</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-10">
                                    Not registered? No problem. Post your requirements and let verified Ugandan farmers find you.
                                </p>
                                <button className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 mb-4">
                                    Initiate Request
                                </button>
                                <p className="text-[9px] text-center text-slate-500 uppercase font-bold tracking-widest">
                                    Trusted by 400+ International Importers
                                </p>
                            </div>
                        </div>

                        <div className="glass-card p-8">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Why source via AgriFocused?</h4>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tighter">Zero middleman fees - pay farmers directly.</p>
                                </div>
                                <div className="flex gap-4">
                                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tighter">Blockchain-verified origin and quality history.</p>
                                </div>
                                <div className="flex gap-4">
                                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tighter">Live GPS tracking of your international batches.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RFPBoard;
