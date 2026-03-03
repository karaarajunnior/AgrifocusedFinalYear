import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import {
    Coffee,
    MapPin,
    User,
    TrendingUp,
    ShieldCheck,
    Thermometer,
    Mountain,
    History,
    Calendar,
    Waves,
    Heart
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface TraceRecord {
    batchNumber: string;
    altitude: number;
    variety: string;
    processingMethod: string;
    cuppingScore: number;
    story: string;
    mapLocation: string;
    farmer: {
        name: string;
        location: string;
        avatar: string;
        country: string;
    };
}

function TracePage() {
    const { batchId } = useParams();
    const [record, setRecord] = useState<TraceRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRecord() {
            try {
                const response = await api.get(`/trace/${batchId}`);
                setRecord(response.data.record);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchRecord();
    }, [batchId]);

    if (loading) return <LoadingSpinner size="lg" />;

    if (!record) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <ShieldCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900">Information Sealed</h2>
                    <p className="text-gray-500 mt-2">The traceability record for this batch is not yet public.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative h-[400px] bg-green-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent z-10" />
                <div className="absolute inset-0 flex items-center justify-center text-center z-20 px-4">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-green-600/30 backdrop-blur-md px-4 py-1.5 rounded-full text-green-100 text-xs font-black uppercase tracking-[0.2em] mb-6 border border-green-400/30">
                            <ShieldCheck className="h-4 w-4" /> Verified Traceability
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight">
                            From {record.farmer.location}
                        </h1>
                        <p className="text-xl text-green-100/80 font-medium lowercase tracking-wide">
                            batch #{record.batchNumber} • {record.variety}
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-30 pb-24">
                <div className="grid lg:grid-cols-3 gap-8">

                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Story Card */}
                        <div className="bg-white rounded-[40px] shadow-2xl p-10 border border-gray-100">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-16 w-16 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                                    <Coffee className="h-8 w-8" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">The Story</h2>
                                    <p className="text-gray-400 text-sm font-medium">Journey of this coffee batch</p>
                                </div>
                            </div>
                            <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line font-medium italic">
                                "{record.story}"
                            </p>
                        </div>

                        {/* Farm Stats */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-orange-50 rounded-[32px] p-8 border border-orange-100">
                                <Mountain className="h-8 w-8 text-orange-600 mb-4" />
                                <p className="text-orange-900/60 text-xs font-black uppercase tracking-wider mb-1">Altitude</p>
                                <h4 className="text-2xl font-black text-orange-900">{record.altitude}m <span className="text-sm font-normal">ASL</span></h4>
                            </div>
                            <div className="bg-blue-50 rounded-[32px] p-8 border border-blue-100">
                                <Waves className="h-8 w-8 text-blue-600 mb-4" />
                                <p className="text-blue-900/60 text-xs font-black uppercase tracking-wider mb-1">Process</p>
                                <h4 className="text-2xl font-black text-blue-900">{record.processingMethod}</h4>
                            </div>
                            <div className="bg-purple-50 rounded-[32px] p-8 border border-purple-100">
                                <History className="h-8 w-8 text-purple-600 mb-4" />
                                <p className="text-purple-900/60 text-xs font-black uppercase tracking-wider mb-1">Variety</p>
                                <h4 className="text-2xl font-black text-purple-900">{record.variety}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Farmer Profile */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-[40px] shadow-2xl p-8 border border-gray-100 sticky top-24">
                            <div className="text-center mb-8">
                                <div className="relative inline-block">
                                    <img
                                        src={record.farmer.avatar || 'https://images.unsplash.com/photo-1542444459-db37a5da9d5f?auto=format&fit=crop&q=80&w=200'}
                                        alt={record.farmer.name}
                                        className="h-32 w-32 rounded-[2rem] object-cover border-4 border-green-50 shadow-xl mx-auto mb-4"
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-2 rounded-xl shadow-lg">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{record.farmer.name}</h3>
                                <div className="flex items-center justify-center gap-1.5 text-gray-400 mt-1 font-bold uppercase text-[10px] tracking-widest">
                                    <MapPin className="h-3 w-3" />
                                    {record.farmer.location}, {record.farmer.country}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Verification Status</span>
                                    <span className="text-green-600 font-black">DAFIS SECURED</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Quality Score</span>
                                    <span className="text-amber-600 font-black">9.2 / 10</span>
                                </div>
                            </div>

                            <button className="w-full mt-8 py-4 bg-green-600 text-white rounded-[20px] font-black text-sm tracking-widest uppercase shadow-xl shadow-green-600/30 hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                                <Heart className="h-4 w-4" /> Tip the farmer
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default TracePage;
