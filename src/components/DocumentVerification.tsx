import React, { useState, useEffect } from 'react';
import { Upload, FileCheck, Loader2, Info, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface VerificationRule {
	id: string;
	documentType: string;
}

interface UserDocument {
	id: string;
	originalName: string;
	aiSummary?: string | null;
	type: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	verificationLog: string | null;
	createdAt: string;
}

const DocumentVerification: React.FC = () => {
	const [rules, setRules] = useState<VerificationRule[]>([]);
	const [myDocs, setMyDocs] = useState<UserDocument[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [selectedType, setSelectedType] = useState('');
	const [file, setFile] = useState<File | null>(null);

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		try {
			const [rulesRes, docsRes] = await Promise.all([
				api.get('/verification/rules'),
				api.get('/verification/my-documents')
			]);
			setRules(rulesRes.data.rules || []);
			setMyDocs(docsRes.data.documents || []);
			if (rulesRes.data.rules?.length > 0) {
				setSelectedType(rulesRes.data.rules[0].documentType);
			}
		} catch {
			console.error('Failed to load verification data');
		} finally {
			setLoading(false);
		}
	};

	const handleUpload = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file || !selectedType) return;

		setUploading(true);
		const formData = new FormData();
		formData.append('document', file);
		formData.append('documentType', selectedType);
		formData.append('title', `${selectedType} Verification`);

		try {
			const res = await api.post('/verification/upload', formData, {
				headers: { 'Content-Type': 'multipart/form-data' }
			});
			
			const { approved, reason } = res.data.feedback || res.data.aiFeedback;
			if (approved) {
				toast.success('Document verified successfully');
			} else {
				toast.error(`Verification rejected: ${reason}`);
			const { status, reason } = res.data.verificationFeedback;
			if (status === 'APPROVED') {
				toast.success('Document approved successfully');
			} else if (status === 'REJECTED') {
				toast.error(`Document rejected: ${reason}`);
			} else {
				toast.success('Document submitted for review');
			}
			
			setFile(null);
			fetchData();
		} catch (error: unknown) {
			const message = typeof error === 'object' && error !== null && 'response' in error
				? (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Upload failed'
				: 'Upload failed';
			toast.error(message);
		} finally {
			setUploading(false);
		}
	};

	if (loading) return <div className="p-4 text-center text-slate-400">Loading details...</div>;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
			{/* Upload Section */}
			<div className="space-y-6">
				<div className="glass-card p-6 bg-white/80 border-t-4 border-green-600">
					<h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Document verification</h3>
					<p className="text-sm text-slate-500 font-medium mb-6">Upload official documents for automatic compliance review.</p>
					
					<form onSubmit={handleUpload} className="space-y-4">
						<div>
							<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Document Category</label>
							<select
								value={selectedType}
								onChange={(e) => setSelectedType(e.target.value)}
								className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-green-600 focus:ring-0 transition-all font-bold text-slate-700 bg-slate-50"
							>
								{rules.length === 0 ? (
									<option disabled>No verification required at this time</option>
								) : (
									rules.map(r => <option key={r.id} value={r.documentType}>{r.documentType}</option>)
								)}
							</select>
						</div>

						<div className="relative">
							<input
								type="file"
								id="doc-upload"
								className="hidden"
								onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
								accept="image/*,.pdf"
							/>
							<label
								htmlFor="doc-upload"
								className={`flex flex-col items-center justify-center w-full py-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
									file ? 'border-green-600 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-green-400'
								}`}
							>
								{file ? (
									<>
										<FileCheck className="h-10 w-10 text-green-600 mb-2" />
										<span className="text-sm font-bold text-green-800">{file.name}</span>
										<span className="text-xs text-green-600 font-medium mt-1">Ready for review</span>
									</>
								) : (
									<>
										<Upload className="h-10 w-10 text-slate-300 mb-2" />
										<span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Select Document File</span>
										<span className="text-xs text-slate-400 font-medium mt-1">Images or PDFs (max 10MB)</span>
									</>
								)}
							</label>
						</div>

						<button
							disabled={!file || uploading || rules.length === 0}
							className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg ${
								uploading ? 'bg-slate-200 text-slate-400' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95'
							}`}
						>
							{uploading ? (
								<div className="flex items-center justify-center">
									<Loader2 className="h-5 w-5 mr-2 animate-spin" /> Reviewing...
								</div>
							) : 'Start Verification'}
							) : 'Submit for Review'}
						</button>
					</form>
				</div>
			</div>

			{/* Status List */}
			<div className="space-y-6">
				<h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Verification History</h3>
				{myDocs.length === 0 ? (
					<div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
						<p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No documents submitted yet</p>
					</div>
				) : (
					<div className="space-y-4">
						{myDocs.map(doc => (
							<div key={doc.id} className="glass-card p-5 group hover:translate-x-2 transition-all">
								<div className="flex items-center justify-between font-black uppercase tracking-tighter text-slate-900 border-b pb-3 mb-3 border-slate-100">
									<div className="flex items-center">
										<div className={`p-2 rounded-lg mr-3 ${
											doc.status === 'APPROVED' ? 'bg-green-50 text-green-600' :
											doc.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
										}`}>
											<FileCheck className="h-4 w-4" />
										</div>
										<span>{doc.aiSummary || doc.originalName}</span>
									</div>
									<div className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
										doc.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-100' :
										doc.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'
									}`}>
										{doc.status}
									</div>
								</div>
								
								{doc.verificationLog && (
									<div className="flex items-start bg-slate-50 p-3 rounded-lg">
										<Info className="h-4 w-4 text-slate-400 mr-2 mt-0.5 shrink-0" />
										<p className="text-xs text-slate-600 font-medium italic leading-relaxed">
											Review note: "{doc.verificationLog}"
										</p>
									</div>
								)}
								
								<div className="mt-3 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
									<span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
									<span className="text-green-600 group-hover:underline cursor-pointer flex items-center">
										View Details <ChevronRight className="h-3 w-3 ml-0.5" />
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default DocumentVerification;
