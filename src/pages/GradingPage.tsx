import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    Award,
    FlaskConical,
    FileText,
    AlertCircle,
    Clock,
    History as HistoryIcon,
    Zap
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface GradingRequest {
    id: string;
    commodity: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    grade?: string;
    aromaScore?: number;
    flavorScore?: number;
    bodyScore?: number;
    notes?: string;
    createdAt: string;
}

function GradingPage() {
    const [requests, setRequests] = useState<GradingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [commodity, setCommodity] = useState('Arabic Coffee');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/grading/my-requests');
            setRequests(response.data.requests);
        } catch (e) {
            toast.error('Failed to load grading history');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestGrading = async () => {
        try {
            setSubmitting(true);
            await api.post('/grading/apply', { commodity });
            toast.success('Grading request submitted!');
            fetchRequests();
        } catch (e) {
            toast.error('Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner size="lg" />;

    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                <div>
                    <h1 className="text-5xl font-black text-gray-900 flex items-center gap-4">
                        <FlaskConical className="h-12 w-12 text-blue-600" />
                        Quality Grading
                    </h1>
                    <p className="text-gray-500 mt-2 text-xl font-medium">
                        Professional cupping and certification for your coffee batches.
                    </p>
                </div>

                <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-2xl shadow-blue-600/30 flex items-center gap-6 max-w-md">
                    <Zap className="h-10 w-10 text-blue-200 shrink-0" />
                    <div>
                        <h4 className="font-black text-lg">Premium Prices</h4>
                        <p className="text-blue-100 text-sm mt-1 leading-relaxed">
                            Certified Grade 1 batches sell for an average of <span className="text-white font-black underline decoration-blue-400">22% more</span> in international markets.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-12">
                {/* Application Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-[40px] shadow-2xl p-10 border border-gray-100 sticky top-24">
                        <h2 className="text-2xl font-black text-gray-900 mb-8">New Request</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Commodity</label>
                                <select
                                    value={commodity}
                                    onChange={(e) => setCommodity(e.target.value)}
                                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-blue-600 transition-all"
                                >
                                    <option>Arabic Coffee</option>
                                    <option>Robusta Coffee</option>
                                    <option>Specialty Micro-lot</option>
                                </select>
                            </div>

                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                    Applying requires an inspection fee of <strong>UGX 15,000</strong>. A certified grader will visit your drying facility.
                                </p>
                            </div>

                            <button
                                onClick={handleRequestGrading}
                                disabled={submitting}
                                className="w-full py-5 bg-blue-600 text-white rounded-[20px] font-black text-sm tracking-widest uppercase shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Submitting...' : 'Request Grading'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="lg:col-span-2 space-y-8">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <HistoryIcon className="h-6 w-6 text-gray-400" />
                        Grading History
                    </h2>

                    <div className="grid gap-6">
                        {requests.length === 0 ? (
                            <div className="bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-200 py-32 text-center">
                                <FlaskConical className="h-20 w-20 text-gray-200 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-gray-400">No grading history found.</h3>
                            </div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.id} className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 hover:shadow-xl transition-all group">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex items-center gap-6">
                                            <div className={`h-20 w-20 rounded-3xl flex items-center justify-center relative ${req.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {req.status === 'COMPLETED' ? <Award className="h-10 w-10" /> : <Clock className="h-10 w-10 animate-pulse" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${req.status === 'COMPLETED' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {req.status}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-bold">{new Date(req.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{req.commodity}</h3>
                                            </div>
                                        </div>

                                        {req.status === 'COMPLETED' && (
                                            <div className="flex gap-4">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Grade</p>
                                                    <p className="text-2xl font-black text-green-600">{req.grade}</p>
                                                </div>
                                                <div className="h-10 w-px bg-gray-100 self-center"></div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Aroma</p>
                                                    <p className="text-2xl font-black text-gray-900">{req.aromaScore}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Flavor</p>
                                                    <p className="text-2xl font-black text-gray-900">{req.flavorScore}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {req.notes && (
                                        <div className="mt-8 pt-8 border-t border-gray-50">
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <FileText className="h-3 w-3" /> Grader Notes
                                            </p>
                                            <p className="text-gray-600 font-medium italic">"{req.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GradingPage;
