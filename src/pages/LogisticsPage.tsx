import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    Truck,
    MapPin,
    Calendar,
    Package,
    Users,
    Plus,
    CheckCircle,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

interface CollectionSchedule {
    id: string;
    title: string;
    subcounty: string;
    district: string;
    collectionDate: string;
    vehicleType: string;
    maxCapacityKg: number;
    currentBookedKg: number;
    pricePerKg: number | null;
    notes: string | null;
    status: string;
    postedBy: { id: string; name: string; phone: string; location: string };
    requests: CollectionRequest[];
}

interface CollectionRequest {
    id: string;
    farmerId: string;
    quantityKg: number;
    pickupLocation: string | null;
    status: string;
    createdAt: string;
    farmer: { id: string; name: string; phone: string; location: string };
}

function LogisticsPage() {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState<CollectionSchedule[]>([]);
    const [myRequests, setMyRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Form state for posting a schedule
    const [formData, setFormData] = useState({
        title: '',
        subcounty: '',
        district: 'Jinja',
        collectionDate: '',
        vehicleType: 'truck',
        maxCapacityKg: 5000,
        pricePerKg: '',
        notes: '',
    });

    // Form state for farmer join request
    const [joinData, setJoinData] = useState({
        quantityKg: 100,
        pickupLocation: '',
    });
    const [joiningScheduleId, setJoiningScheduleId] = useState<string | null>(null);

    const isBuyer = user?.role === 'BUYER' || user?.role === 'ADMIN';
    const isFarmer = user?.role === 'FARMER';

    useEffect(() => {
        loadSchedules();
        if (isFarmer) loadMyRequests();
    }, []);

    async function loadSchedules() {
        try {
            setLoading(true);
            const res = await api.get('/logistics/schedules');
            setSchedules(res.data.schedules);
        } catch (e) {
            toast.error('Failed to load collection schedules');
        } finally {
            setLoading(false);
        }
    }

    async function loadMyRequests() {
        try {
            const res = await api.get('/logistics/my-requests');
            setMyRequests(res.data.requests);
        } catch (e) {
            // silently fail
        }
    }

    async function handlePostSchedule(e: React.FormEvent) {
        e.preventDefault();
        try {
            await api.post('/logistics/schedules', {
                ...formData,
                maxCapacityKg: Number(formData.maxCapacityKg),
                pricePerKg: formData.pricePerKg ? Number(formData.pricePerKg) : undefined,
            });
            toast.success('Collection schedule posted successfully');
            setShowForm(false);
            setFormData({ title: '', subcounty: '', district: 'Jinja', collectionDate: '', vehicleType: 'truck', maxCapacityKg: 5000, pricePerKg: '', notes: '' });
            loadSchedules();
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to post schedule');
        }
    }

    async function handleJoinRequest(scheduleId: string) {
        try {
            await api.post(`/logistics/schedules/${scheduleId}/request`, {
                quantityKg: Number(joinData.quantityKg),
                pickupLocation: joinData.pickupLocation || undefined,
            });
            toast.success('Collection request submitted');
            setJoiningScheduleId(null);
            setJoinData({ quantityKg: 100, pickupLocation: '' });
            loadSchedules();
            loadMyRequests();
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to submit request');
        }
    }

    async function handleRequestAction(requestId: string, status: string) {
        try {
            await api.patch(`/logistics/requests/${requestId}/status`, { status });
            toast.success(`Request ${status.toLowerCase()}`);
            loadSchedules();
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to update request');
        }
    }

    async function handleScheduleStatusChange(scheduleId: string, status: string) {
        try {
            await api.patch(`/logistics/schedules/${scheduleId}/status`, { status });
            toast.success(`Schedule marked as ${status}`);
            loadSchedules();
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to update schedule');
        }
    }

    const capacityPercent = (s: CollectionSchedule) =>
        Math.round((s.currentBookedKg / s.maxCapacityKg) * 100);

    const statusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-green-100 text-green-800';
            case 'FULL': return 'bg-yellow-100 text-yellow-800';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
            case 'COMPLETED': return 'bg-gray-100 text-gray-800';
            case 'CANCELLED': return 'bg-red-100 text-red-800';
            case 'ACCEPTED': return 'bg-green-100 text-green-800';
            case 'REJECTED': return 'bg-red-100 text-red-800';
            case 'COLLECTED': return 'bg-blue-100 text-blue-800';
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const vehicleIcon = (type: string) => {
        if (type === 'motorcycle') return '🏍️';
        if (type === 'pickup') return '🚙';
        return '🚛';
    };

    const alreadyJoined = (scheduleId: string) =>
        myRequests.some((r: any) => r.scheduleId === scheduleId);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Truck className="h-7 w-7 text-green-600" />
                        Logistics Coordination
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {isBuyer
                            ? 'Post collection schedules for farmers in your area'
                            : 'Browse and join collection trucks near you to reduce transport costs'}
                    </p>
                </div>
                {isBuyer && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                        Post Collection Schedule
                    </button>
                )}
            </div>

            {/* Post Schedule Form (Buyers) */}
            {showForm && isBuyer && (
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">New Collection Schedule</h2>
                    <form onSubmit={handlePostSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="e.g. Jinja Coffee Collection Run" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-county</label>
                            <input type="text" required value={formData.subcounty} onChange={(e) => setFormData({ ...formData, subcounty: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="e.g. Bugembe" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                            <input type="text" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date</label>
                            <input type="datetime-local" required value={formData.collectionDate} onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                            <select value={formData.vehicleType} onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
                                <option value="truck">Truck (Large)</option>
                                <option value="pickup">Pickup</option>
                                <option value="motorcycle">Motorcycle</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity (kg)</label>
                            <input type="number" min={50} value={formData.maxCapacityKg} onChange={(e) => setFormData({ ...formData, maxCapacityKg: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transport Cost (UGX/kg)</label>
                            <input type="number" min={0} step={10} value={formData.pricePerKg} onChange={(e) => setFormData({ ...formData, pricePerKg: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Optional" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Any additional details for farmers..." />
                        </div>
                        <div className="md:col-span-2 flex gap-3">
                            <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Post Schedule</button>
                            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
                    <p className="mt-2 text-gray-600">Loading schedules...</p>
                </div>
            )}

            {/* Schedules List */}
            {!loading && schedules.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border">
                    <Truck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No collection schedules yet</h3>
                    <p className="text-gray-600">
                        {isBuyer ? 'Post the first collection schedule for farmers in your area.' : 'No collection schedules available in your area yet. Check back later.'}
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {schedules.map((schedule) => {
                    const isExpanded = expandedId === schedule.id;
                    const pct = capacityPercent(schedule);
                    const isOwner = schedule.postedBy.id === user?.id;

                    return (
                        <div key={schedule.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            {/* Schedule Header */}
                            <div
                                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setExpandedId(isExpanded ? null : schedule.id)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">{vehicleIcon(schedule.vehicleType)}</span>
                                            <h3 className="text-lg font-semibold text-gray-900">{schedule.title}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(schedule.status)}`}>
                                                {schedule.status}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2">
                                            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {schedule.subcounty}, {schedule.district}</span>
                                            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(schedule.collectionDate).toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {schedule.requests.length} farmer{schedule.requests.length !== 1 ? 's' : ''}</span>
                                            {schedule.pricePerKg && (
                                                <span className="flex items-center gap-1"><Package className="h-4 w-4" /> UGX {schedule.pricePerKg.toLocaleString()}/kg</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                                    </div>
                                </div>

                                {/* Capacity Bar */}
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>{schedule.currentBookedKg.toLocaleString()} kg booked</span>
                                        <span>{schedule.maxCapacityKg.toLocaleString()} kg capacity</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-yellow-500' : pct >= 75 ? 'bg-orange-400' : 'bg-green-500'}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 text-right">{pct}% full</div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t px-5 py-4 bg-gray-50">
                                    {schedule.notes && (
                                        <p className="text-sm text-gray-600 mb-4 italic">"{schedule.notes}"</p>
                                    )}

                                    <p className="text-sm text-gray-500 mb-2">
                                        Posted by: <strong>{schedule.postedBy.name}</strong>
                                        {schedule.postedBy.phone && ` • ${schedule.postedBy.phone}`}
                                    </p>

                                    {/* Farmer Requests List */}
                                    {schedule.requests.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="text-sm font-semibold text-gray-800 mb-2">Farmers ({schedule.requests.length})</h4>
                                            <div className="space-y-2">
                                                {schedule.requests.map((req) => (
                                                    <div key={req.id} className="flex items-center justify-between bg-white p-3 rounded-lg border text-sm">
                                                        <div>
                                                            <span className="font-medium text-gray-900">{req.farmer.name}</span>
                                                            <span className="text-gray-500 ml-2">{req.quantityKg} kg</span>
                                                            {req.pickupLocation && <span className="text-gray-400 ml-2">📍 {req.pickupLocation}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(req.status)}`}>
                                                                {req.status}
                                                            </span>
                                                            {isOwner && req.status === 'PENDING' && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'ACCEPTED'); }} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Accept">
                                                                        <CheckCircle className="h-5 w-5" />
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'REJECTED'); }} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Reject">
                                                                        <XCircle className="h-5 w-5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Farmer Join Button */}
                                    {isFarmer && schedule.status === 'OPEN' && !alreadyJoined(schedule.id) && (
                                        <>
                                            {joiningScheduleId === schedule.id ? (
                                                <div className="bg-white p-4 rounded-lg border">
                                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Request to Join Collection</h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity (kg)</label>
                                                            <input type="number" min={1} max={schedule.maxCapacityKg - schedule.currentBookedKg} value={joinData.quantityKg} onChange={(e) => setJoinData({ ...joinData, quantityKg: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Location</label>
                                                            <input type="text" value={joinData.pickupLocation} onChange={(e) => setJoinData({ ...joinData, pickupLocation: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="e.g. Near Bugembe market" />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleJoinRequest(schedule.id)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">Submit Request</button>
                                                        <button onClick={() => setJoiningScheduleId(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => setJoiningScheduleId(schedule.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                                                    <Package className="h-4 w-4" />
                                                    Join This Collection
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {isFarmer && alreadyJoined(schedule.id) && (
                                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                            <CheckCircle className="h-4 w-4" />
                                            You have already requested to join this collection
                                        </div>
                                    )}

                                    {/* Owner actions */}
                                    {isOwner && schedule.status === 'OPEN' && (
                                        <div className="flex gap-2 mt-3">
                                            <button onClick={() => handleScheduleStatusChange(schedule.id, 'IN_PROGRESS')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                                                Start Collection
                                            </button>
                                            <button onClick={() => handleScheduleStatusChange(schedule.id, 'CANCELLED')} className="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50 transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                    {isOwner && schedule.status === 'IN_PROGRESS' && (
                                        <button onClick={() => handleScheduleStatusChange(schedule.id, 'COMPLETED')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors mt-3">
                                            Mark Completed
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Farmer's Own Requests Section */}
            {isFarmer && myRequests.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-500" />
                        Your Collection Requests
                    </h2>
                    <div className="space-y-3">
                        {myRequests.map((req: any) => (
                            <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-gray-900">{req.schedule?.title || 'Collection'}</h4>
                                    <p className="text-sm text-gray-600">
                                        {req.quantityKg} kg • {req.schedule?.subcounty}, {req.schedule?.district}
                                        {req.schedule?.collectionDate && ` • ${new Date(req.schedule.collectionDate).toLocaleDateString()}`}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Posted by: {req.schedule?.postedBy?.name}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(req.status)}`}>
                                    {req.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default LogisticsPage;
