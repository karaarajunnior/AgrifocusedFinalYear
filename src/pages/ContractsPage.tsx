import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    FileSignature,
    Calendar,
    DollarSign,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Briefcase
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface Contract {
    id: string;
    commodity: string;
    quantity: number;
    pricePerUnit: number;
    totalValuation: number;
    deliveryMonth: string;
    status: 'PROPOSED' | 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
    farmer: { name: string };
    buyer: { name: string };
    terms: string;
}

function ContractsPage() {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        try {
            const response = await api.get('/contracts/my-contracts');
            setContracts(response.data.contracts);
        } catch (e) {
            toast.error('Failed to load contracts');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/contracts/${id}/status`, { status });
            toast.success(`Contract ${status.toLowerCase()}`);
            fetchContracts();
        } catch (e) {
            toast.error('Update failed');
        }
    };

    if (loading) return <LoadingSpinner size="lg" />;

    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                    <FileSignature className="h-10 w-10 text-green-600" />
                    Forward Contracts
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Secure your future harvest with pre-negotiated price locks.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main List */}
                <div className="lg:col-span-2 space-y-6">
                    {contracts.length === 0 ? (
                        <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
                            <FileSignature className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900">No active contracts</h3>
                            <p className="text-gray-500">Proposed contracts will appear here.</p>
                        </div>
                    ) : (
                        contracts.map((contract) => (
                            <div key={contract.id} className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 hover:shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-2 inline-block ${contract.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                            contract.status === 'PROPOSED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {contract.status}
                                        </span>
                                        <h3 className="text-2xl font-black text-gray-900">{contract.commodity}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-black text-green-600">UGX {contract.totalValuation.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Total Valuation</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 mb-8 bg-gray-50 rounded-2xl p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                            <Briefcase className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity</p>
                                            <p className="font-bold text-gray-900">{contract.quantity} kg</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                            <DollarSign className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price / kg</p>
                                            <p className="font-bold text-gray-900">UGX {contract.pricePerUnit.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm border border-gray-100">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery</p>
                                            <p className="font-bold text-gray-900">{contract.deliveryMonth}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white font-black text-xs">
                                            {contract.buyer.name[0]}
                                        </div>
                                        <span className="text-sm font-bold text-gray-500">Buyer: <span className="text-gray-900">{contract.buyer.name}</span></span>
                                    </div>

                                    {contract.status === 'PROPOSED' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleUpdateStatus(contract.id, 'CANCELLED')}
                                                className="px-6 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-black shadow-sm"
                                            >
                                                REJECT
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(contract.id, 'ACTIVE')}
                                                className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-600/20"
                                            >
                                                ACCEPT
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Info Area */}
                <div className="space-y-6">
                    <div className="bg-black text-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <HelpCircle className="h-12 w-12 text-green-500 mb-6" />
                            <h3 className="text-2xl font-black mb-4">How it works</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="h-6 w-6 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 shrink-0 mt-1">1</div>
                                    <p className="text-sm text-gray-400 font-medium">Negotiate price and quantity with a buyer before the harvest begins.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="h-6 w-6 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 shrink-0 mt-1">2</div>
                                    <p className="text-sm text-gray-400 font-medium">Sign the digital contract to lock in the price, protecting you from mid-season market volatility.</p>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="h-6 w-6 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 shrink-0 mt-1">3</div>
                                    <p className="text-sm text-gray-400 font-medium">Platform holds an escrow deposit to guarantee fulfillment from both sides.</p>
                                </li>
                            </ul>
                        </div>
                        {/* Abstract Background Element */}
                        <div className="absolute -bottom-20 -right-20 h-64 w-64 bg-green-900/20 rounded-full blur-3xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ContractsPage;
