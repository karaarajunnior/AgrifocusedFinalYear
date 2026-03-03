import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    TrendingUp,
    TrendingDown,
    ChevronRight,
    Zap,
    AlertTriangle
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface ProfitProof {
    commodity: string;
    region: string;
    quantity: number;
    scenarios: Array<{
        name: string;
        pricePerKg: number;
        totalRevenue: number;
        lossComparedToDirect?: number;
        lossPercentage?: number;
        gainOverMiddleman?: number;
    }>;
    mathProof: string;
}

function ProfitMaximizer() {
    const [data, setData] = useState<ProfitProof | null>(null);
    const [loading, setLoading] = useState(true);
    const [qty, setQty] = useState(500);
    const [commodity, setCommodity] = useState('Arabic Coffee');

    useEffect(() => {
        fetchProof();
    }, [qty, commodity]);

    const fetchProof = async () => {
        try {
            setLoading(true);
            const res = await api.get('/analytics/profit-proof', {
                params: { quantityKg: qty, commodity }
            });
            setData(res.data);
        } catch (e) {
            console.error('Failed to fetch profit proof');
        } finally {
            setLoading(false);
        }
    };

    const chartData = {
        labels: data?.scenarios.map(s => s.name) || [],
        datasets: [
            {
                label: 'Total Revenue (UGX)',
                data: data?.scenarios.map(s => s.totalRevenue) || [],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.7)', // Red for middleman
                    'rgba(34, 197, 94, 0.7)', // Green for DAFIS
                    'rgba(37, 99, 235, 0.7)', // Blue for Export
                ],
                borderRadius: 8,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => `UGX ${context.raw.toLocaleString()}`
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    callback: (value: any) => `UGX ${value / 1000}k`
                }
            }
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-green-50 to-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Zap className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Profit Maximizer</h3>
                            <p className="text-sm text-gray-600">The mathematical proof of direct selling</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={commodity}
                            onChange={(e) => setCommodity(e.target.value)}
                            className="text-sm border-gray-200 rounded-lg focus:ring-green-500"
                        >
                            <option value="Arabic Coffee">Arabic Coffee</option>
                            <option value="Robusta Coffee">Robusta Coffee</option>
                        </select>
                        <div className="flex items-center gap-2 bg-white px-3 border border-gray-200 rounded-lg">
                            <input
                                type="number"
                                value={qty}
                                onChange={(e) => setQty(Number(e.target.value))}
                                className="w-16 border-none text-sm p-0 focus:ring-0 font-bold"
                            />
                            <span className="text-xs text-gray-400 font-bold uppercase">KG</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="animate-spin h-6 w-6 text-green-600 border-2 border-green-600 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-2 gap-8 items-center">
                        <div className="h-64">
                            <Bar data={chartData} options={chartOptions} />
                        </div>

                        <div className="space-y-4">
                            {data?.scenarios.map((s, i) => (
                                <div key={i} className={`p-4 rounded-xl border-2 transition-all ${s.name === 'DAFIS Marketplace' ? 'border-green-600 bg-green-50/50' :
                                    s.name === 'Direct Export' ? 'border-blue-600 bg-blue-50/50' :
                                        'border-gray-100 bg-white'
                                    }`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-gray-900">{s.name}</h4>
                                            <p className="text-sm text-gray-500">UGX {s.pricePerKg.toLocaleString()}/kg</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-gray-900">UGX {s.totalRevenue.toLocaleString()}</p>
                                            {s.lossComparedToDirect && (
                                                <p className="text-xs text-red-600 font-bold flex items-center justify-end gap-1">
                                                    <TrendingDown className="h-3 w-3" />
                                                    -{Math.round(s.lossPercentage || 0)}% Lost
                                                </p>
                                            )}
                                            {s.gainOverMiddleman && (
                                                <p className="text-xs text-green-600 font-bold flex items-center justify-end gap-1">
                                                    <TrendingUp className="h-3 w-3" />
                                                    +{Math.round((s.gainOverMiddleman / (qty * (data.scenarios[0].pricePerKg))) * 100)}% Gain
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="mt-8 p-4 bg-gray-50 rounded-xl border flex gap-4">
                        <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">Mathematical Insight:</h4>
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed italic">
                                {data?.mathProof}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-between items-center bg-green-900 text-white rounded-xl p-6">
                    <div>
                        <h4 className="text-lg font-bold">Ready to maximize?</h4>
                        <p className="text-green-100 text-sm">Join the 5,000+ farmers already earning fair prices.</p>
                    </div>
                    <button className="px-6 py-2 bg-white text-green-900 rounded-lg font-bold hover:bg-green-50 transition-colors flex items-center gap-2">
                        Sell Direct <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProfitMaximizer;
