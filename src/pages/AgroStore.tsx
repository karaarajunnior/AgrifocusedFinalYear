import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    ShoppingBag,
    MapPin,
    Leaf,
    Percent,
    AlertCircle,
    Clock,
    CheckCircle2,
    ChevronRight,
    Search,
    Zap
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface AgroInput {
    id: string;
    name: string;
    description: string;
    price: number;
    unit: string;
    category: string;
    inStock: boolean;
    shop: {
        name: string;
        location: string;
    };
}

interface CreditRequest {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'SETTLED' | 'REJECTED';
    totalAmount: number;
    agroInput: {
        name: string;
    };
    createdAt: string;
}

function AgroStore() {
    const [inputs, setInputs] = useState<AgroInput[]>([]);
    const [credits, setCredits] = useState<CreditRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('');
    const [applying, setApplying] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [category]);

    const fetchData = async () => {
        try {
            const [inputsRes, creditsRes] = await Promise.all([
                api.get('/inputs', { params: { category } }),
                api.get('/inputs/my-credits')
            ]);
            setInputs(inputsRes.data.inputs);
            setCredits(creditsRes.data.credits);
        } catch (e) {
            toast.error('Failed to load store data');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyCredit = async (inputId: string, quantity: number = 1) => {
        try {
            setApplying(inputId);
            await api.post('/inputs/credit/apply', { agroInputId: inputId, quantity });
            toast.success('Credit application submitted!');
            fetchData();
        } catch (e) {
            toast.error('Failed to submit application');
        } finally {
            setApplying(null);
        }
    };

    if (loading) return <LoadingSpinner size="lg" />;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                        <ShoppingBag className="h-10 w-10 text-green-600" />
                        Agro-Input Store
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        High-quality fertilizers, tools, and seedlings direct to your farm.
                    </p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3 max-w-md">
                    <Zap className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-amber-900 text-sm">Buy Now, Pay Later</h4>
                        <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                            Verified farmers can get inputs on credit. Repayment is automatically deducted from your harvest sales.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-8">
                {/* Sidebar Filters & Credit Status */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white rounded-2xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Search className="h-4 w-4" /> Filter Categories
                        </h3>
                        <div className="space-y-2">
                            {['', 'Fertilizer', 'Seedling', 'Tools', 'Pesticide'].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${category === cat
                                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                                        : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {cat || 'All Items'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border p-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Credit Status
                        </h3>
                        {credits.length === 0 ? (
                            <p className="text-gray-400 text-sm">No active credit requests.</p>
                        ) : (
                            <div className="space-y-4">
                                {credits.slice(0, 5).map((c) => (
                                    <div key={c.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-gray-900 truncate w-24">{c.agroInput.name}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">UGX {c.totalAmount.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="lg:col-span-3">
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {inputs.map((input) => (
                            <div key={input.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group">
                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-green-700 shadow-sm border border-green-100">
                                        {input.category}
                                    </div>
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Leaf className="h-20 w-20 text-gray-200 group-hover:text-green-100 transition-colors" />
                                    </div>
                                </div>

                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">{input.name}</h3>
                                    <div className="flex items-center gap-1.5 text-gray-500 mb-4">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="text-xs font-medium">{input.shop.name} • {input.shop.location}</span>
                                    </div>

                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <span className="text-2xl font-black text-green-600">UGX {input.price.toLocaleString()}</span>
                                            <span className="text-xs text-gray-400 font-bold ml-1">/{input.unit}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button className="px-4 py-2.5 bg-gray-100 text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                                            Cash Buy
                                        </button>
                                        <button
                                            onClick={() => handleApplyCredit(input.id)}
                                            disabled={applying === input.id}
                                            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                                        >
                                            {applying === input.id ? 'Applying...' : 'Get on Credit'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {inputs.length === 0 && (
                        <div className="text-center py-32 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                            <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900">No items found</h3>
                            <p className="text-gray-500">Try adjusting your filters or category.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AgroStore;
