import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    MapPin, 
    ShieldCheck, 
    Star, 
    Package, 
    Leaf, 
    Globe, 
    Share2, 
    Smartphone,
    TrendingUp,
    Navigation,
    Award
} from 'lucide-react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import LocationLink from '../components/LocationLink';

const PublicPortfolio: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [farmer, setFarmer] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                // Public endpoint to get farmer info
                const res = await api.get(`/users/public-portfolio/${id}`);
                setFarmer(res.data.farmer);
                setProducts(res.data.products);
                
                // Set SEO metadata
                document.title = `${res.data.farmer.name} | Verified Farmer Portfolio | AgriFocused`;
            } catch (error) {
                console.error('Failed to fetch portfolio', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPortfolio();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
    if (!farmer) return <div className="min-h-screen flex flex-col items-center justify-center"><p className="text-xl font-bold mb-4">Portfolio not found</p><Link to="/" className="text-emerald-600">Return Home</Link></div>;

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: farmer.name + ' Portfolio',
                text: `Check out ${farmer.name}'s verified agricultural portfolio on AgriFocused.`,
                url: window.location.href,
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* SEO Structured Data */}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "ProfilePage",
                    "mainEntity": {
                        "@type": "Person",
                        "name": farmer.name,
                        "description": farmer.bio || `Verified ${farmer.role} on AgriFocused Platform`,
                        "image": farmer.avatar,
                        "address": {
                            "@type": "PostalAddress",
                            "addressLocality": farmer.location
                        }
                    }
                })}
            </script>

            {/* Header Hero */}
            <div className="bg-slate-900 h-64 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="grid grid-cols-8 gap-4 p-4">
                        {[...Array(32)].map((_, i) => (
                            <Leaf key={i} className="text-emerald-500 h-12 w-12 transform rotate-12" />
                        ))}
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 h-full flex items-end pb-12">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-6 z-10">
                        <div className="w-32 h-32 bg-white rounded-[2.5rem] p-2 shadow-2xl">
                            <div className="w-full h-full bg-slate-100 rounded-[2rem] flex items-center justify-center font-black text-4xl text-slate-400 capitalize">
                                {farmer.name[0]}
                            </div>
                        </div>
                        <div className="text-center md:text-left text-white mb-2">
                            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">{farmer.name}</h1>
                            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <LocationLink
                                    location={farmer.location}
                                    latitude={farmer.latitude}
                                    longitude={farmer.longitude}
                                    className="flex items-center gap-1 text-slate-400 hover:text-emerald-400"
                                    iconClassName="h-3 w-3"
                                />
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="h-3 w-3" /> Identity Verified</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="flex items-center gap-1 text-blue-400"><Award className="h-3 w-3" /> Export Ready</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Sidebar Stats */}
                    <div className="space-y-8">
                        <div className="glass-card p-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Trust & Reliability</h3>
                            <div className={`rounded-2xl border p-5 ${farmer.verified ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                <p className={`text-sm font-bold ${farmer.verified ? 'text-emerald-900' : 'text-amber-900'}`}>
                                    {farmer.verified ? 'Identity verified farmer' : 'Identity review pending'}
                                </p>
                                <p className="text-xs text-emerald-700 mt-2">
                                    This public profile shows live listed products from AgriConnect records.
                                </p>
                            </div>
                            
                            <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-black text-slate-900">{products.length}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Live products</p>
                                </div>
                                <div className="text-center border-l border-slate-100">
                                    <p className="text-2xl font-black text-slate-900">{farmer.verified ? 'Yes' : 'No'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Verified</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-8 group overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Contact Farmer</h3>
                                <div className="bg-emerald-100 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                                    <Smartphone className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                Professional buyers and international roasters can contact this farmer directly through our secure interface.
                            </p>
                            <button 
                                onClick={handleShare}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                            >
                                <Share2 className="h-4 w-4" /> 
                                Share Portfolio
                            </button>
                        </div>
                    </div>

                    {/* Product Catalog */}
                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Current Harvest & Catalog</h2>
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {products.length} Items Live
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {products.map((product) => (
                                <div key={product.id} className="glass-card overflow-hidden group hover:translate-y-[-4px] transition-all">
                                    <div className="h-48 bg-slate-100 relative">
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                            <Package className="h-24 w-24 text-slate-900" />
                                        </div>
                                        {product.images && (
                                            <img src={JSON.parse(product.images)[0]} alt={product.name} className="w-full h-full object-cover" />
                                        )}
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-sm">
                                            {product.quantity} {product.unit} Available
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">{product.name}</h4>
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-xs font-bold text-slate-500">{product.category}</p>
                                            <p className="text-lg font-black text-emerald-600">UGX {product.price.toLocaleString()}</p>
                                        </div>
                                        <Link 
                                            to={`/product/${product.id}`}
                                            className="block w-full py-3 border-2 border-slate-200 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 rounded-xl group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all"
                                        >
                                            View Full Journey
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Story/Bio Section */}
                        <div className="mt-12 p-8 bg-emerald-900 rounded-[3rem] text-white overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-12 opacity-10">
                                <Globe className="h-48 w-48" />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tight mb-6">Farmer's Heritage Story</h3>
                            <p className="text-emerald-100 leading-relaxed max-w-2xl text-lg italic">
                                "{farmer.bio || `Generating wealth through sustainable agriculture in ${farmer.location}. My mission is to provide premium grade crops directly to global partners, ensuring quality at every step of the journey.`}"
                            </p>
                            <div className="mt-8 flex gap-4">
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3">
                                    <Navigation className="h-5 w-5 text-emerald-400" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Location</p>
                                        <p className="text-sm font-bold">{farmer.location || "Farm location shared by farmer"}</p>
                                    </div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3">
                                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Market Reach</p>
                                        <p className="text-sm font-bold">Local & Export</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicPortfolio;
