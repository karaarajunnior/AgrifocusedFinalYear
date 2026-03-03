import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    ShieldCheck,
    Building2,
    FileText,
    Upload,
    Clock,
    CheckCircle2,
    XCircle,
    Info,
    ChevronRight,
    AlertCircle
} from 'lucide-react';

interface ExportApplication {
    id: string;
    businessName: string;
    tinNumber: string;
    permitNumber: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    rejectionReason: string | null;
    createdAt: string;
}

function ExportApplicationPage() {
    useAuth();
    const [application, setApplication] = useState<ExportApplication | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        businessName: '',
        tinNumber: '',
        permitNumber: '',
    });
    const [files, setFiles] = useState<File[]>([]);

    useEffect(() => {
        fetchApplicationStatus();
    }, []);

    const fetchApplicationStatus = async () => {
        try {
            const res = await api.get('/export/my-application');
            setApplication(res.data.application);
        } catch (e) {
            console.error('Failed to fetch application status');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) {
            return toast.error('Please upload at least one supporting document');
        }

        const data = new FormData();
        data.append('businessName', formData.businessName);
        data.append('tinNumber', formData.tinNumber);
        data.append('permitNumber', formData.permitNumber);
        files.forEach(file => {
            data.append('documents', file);
        });

        try {
            setSubmitting(true);
            await api.post('/export/apply', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Export application submitted successfully');
            fetchApplicationStatus();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Clock className="animate-spin h-8 w-8 text-green-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-green-600" />
                    Export Verification
                </h1>
                <p className="text-gray-600 mt-2">
                    Apply for export verification to access international markets and higher profits for your coffee.
                </p>
            </div>

            {application ? (
                <div className="bg-white rounded-2xl shadow-sm border p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Application Status</h2>
                        <span className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${application.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            application.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                            {application.status === 'APPROVED' && <CheckCircle2 className="h-4 w-4" />}
                            {application.status === 'REJECTED' && <XCircle className="h-4 w-4" />}
                            {application.status === 'PENDING' && <Clock className="h-4 w-4" />}
                            {application.status}
                        </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</label>
                                <p className="text-lg font-medium text-gray-900">{application.businessName}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">TIN Number</label>
                                <p className="text-lg font-bold text-gray-900">{application.tinNumber}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</label>
                                <p className="text-gray-900">{new Date(application.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                            {application.status === 'PENDING' && (
                                <div className="flex items-start gap-3">
                                    <Info className="h-6 w-6 text-blue-600 mt-1 shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Under Review</h3>
                                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                            Our compliance team is verifying your business documents. This typically takes 2-3 business days. We will notify you via the dashboard once a decision is made.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {application.status === 'REJECTED' && (
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-6 w-6 text-red-600 mt-1 shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Application Rejected</h3>
                                        <p className="text-sm text-red-600 mt-1 leading-relaxed font-medium">
                                            Reason: {application.rejectionReason || 'Documents provided were insufficient or invalid.'}
                                        </p>
                                        <button
                                            onClick={() => setApplication(null)}
                                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                                        >
                                            Re-apply Now
                                        </button>
                                    </div>
                                </div>
                            )}

                            {application.status === 'APPROVED' && (
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="h-6 w-6 text-green-600 mt-1 shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-green-800">Verified Exporter</h3>
                                        <p className="text-sm text-green-700 mt-1 leading-relaxed">
                                            Congratulations! Your business is now verified for coffee export. You can now access exclusive export contracts from international buyers in the marketplace.
                                        </p>
                                        <div className="mt-4 p-3 bg-white/50 rounded-lg border border-green-200">
                                            <p className="text-xs text-green-800 font-bold uppercase">Export Permit No.</p>
                                            <p className="text-sm font-mono text-green-900 font-bold">UG-COF-{application.tinNumber.slice(-4)}-{new Date().getFullYear()}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-8 border-b bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">New Application</h2>
                        <p className="text-gray-600 text-sm mt-1">Please provide accurate business information for verification.</p>
                    </div>

                    <div className="p-8 space-y-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    Business / Trading Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                                    placeholder="e.g. Bugembe Quality Coffee Ltd"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-gray-400" />
                                    TIN Number (Uganda Revenue Authority)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.tinNumber}
                                    onChange={(e) => setFormData({ ...formData, tinNumber: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none font-mono"
                                    placeholder="100XXXXXXXX"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Upload className="h-4 w-4 text-gray-400" />
                                Supporting Documents (ID, License, Certificate)
                            </label>
                            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-green-500 transition-colors group relative cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    required
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center">
                                    <div className="p-4 bg-green-50 rounded-full group-hover:scale-110 transition-transform">
                                        <Upload className="h-8 w-8 text-green-600" />
                                    </div>
                                    <p className="mt-4 font-semibold text-gray-900 text-lg">
                                        {files.length > 0 ? `${files.length} files selected` : 'Click to upload or drag & drop'}
                                    </p>
                                    <p className="text-gray-500 text-sm mt-1">PDF, JPG or PNG (Max 5MB per file)</p>

                                    {files.length > 0 && (
                                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                                            {files.map((f, i) => (
                                                <span key={i} className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200">
                                                    {f.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 rounded-xl p-6 border border-amber-100 flex gap-4">
                            <Info className="h-6 w-6 text-amber-600 shrink-0" />
                            <div>
                                <h4 className="font-semibold text-amber-900">Why verify?</h4>
                                <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                                    Verified exporters earn on average **117% more profit** by accessing direct international contracts. To maintain quality standards on DAFIS, we require formal business registration for all exporters.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-gray-50/50 border-t flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-600/20"
                        >
                            {submitting ? (
                                <>
                                    <Clock className="animate-spin h-5 w-5" />
                                    Submitting Application...
                                </>
                            ) : (
                                <>
                                    <ChevronRight className="h-5 w-5" />
                                    Submit Application for Review
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default ExportApplicationPage;
