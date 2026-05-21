import React, { useState } from 'react';
import { FileCheck, Save, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const AdminVerificationRules: React.FC = () => {
	const [registrationCriteria, setRegistrationCriteria] = useState('');
	const [documentRule, setDocumentRule] = useState({ documentType: '', criteria: '' });
	const [savingRegistration, setSavingRegistration] = useState(false);
	const [savingDocument, setSavingDocument] = useState(false);

	const handleSaveRegistration = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingRegistration(true);
		try {
			await api.post('/verification/registration-rule', { criteria: registrationCriteria });
			toast.success('Registration review rule saved');
			setRegistrationCriteria('');
		} catch (error) {
			toast.error('Failed to save registration rule');
		} finally {
			setSavingRegistration(false);
		}
	};

	const handleSaveDocumentRule = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingDocument(true);
		try {
			await api.post('/verification/rules', documentRule);
			toast.success('Document review rule saved');
			setDocumentRule({ documentType: '', criteria: '' });
		} catch (error) {
			toast.error('Failed to save document rule');
		} finally {
			setSavingDocument(false);
		}
	};

	return (
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Verification Settings</h3>
					<p className="text-sm text-slate-500 font-medium">
						Save approval standards securely. Saved criteria are stored in the database and are not displayed on this page.
					</p>
				</div>
				<div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
					Private configuration
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
				<form onSubmit={handleSaveRegistration} className="glass-card p-8 border-2 border-slate-900/5 bg-white/70 backdrop-blur-xl">
					<div className="flex items-start gap-4 mb-6">
						<div className="rounded-2xl bg-green-50 p-3 text-green-700">
							<ShieldCheck className="h-6 w-6" />
						</div>
						<div>
							<h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">User registration approval</h4>
							<p className="text-sm text-slate-500 font-medium">
								Define the private standards used when new users submit all required account details.
							</p>
						</div>
					</div>
					<textarea
						required
						rows={8}
						value={registrationCriteria}
						onChange={(e) => setRegistrationCriteria(e.target.value)}
						className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-green-600 focus:ring-0 transition-all font-medium"
						placeholder="Example: Approve only if full name, email, phone, location, and address are complete and realistic. Reject test accounts, invalid contact details, and incomplete applications."
					/>
					<div className="mt-5 flex items-center justify-between gap-4">
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved values stay hidden after submission.</p>
						<button
							type="submit"
							disabled={savingRegistration}
							className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-green-700 disabled:opacity-60 transition-all shadow-md"
						>
							<Save className="h-4 w-4 mr-2" /> {savingRegistration ? 'Saving...' : 'Save Rule'}
						</button>
					</div>
				</form>

				<form onSubmit={handleSaveDocumentRule} className="glass-card p-8 border-2 border-slate-900/5 bg-white/70 backdrop-blur-xl">
					<div className="flex items-start gap-4 mb-6">
						<div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
							<FileCheck className="h-6 w-6" />
						</div>
						<div>
							<h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Document upload review</h4>
							<p className="text-sm text-slate-500 font-medium">
								Add or replace a private rule for a document category users can submit.
							</p>
						</div>
					</div>
					<div className="space-y-5">
						<div>
							<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document category</label>
							<input
								type="text"
								required
								value={documentRule.documentType}
								onChange={(e) => setDocumentRule({ ...documentRule, documentType: e.target.value })}
								className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-600 focus:ring-0 transition-all font-medium"
								placeholder="National ID, land title, business permit..."
							/>
						</div>
						<div>
							<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Review criteria</label>
							<textarea
								required
								rows={5}
								value={documentRule.criteria}
								onChange={(e) => setDocumentRule({ ...documentRule, criteria: e.target.value })}
								className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-blue-600 focus:ring-0 transition-all font-medium"
								placeholder="Example: Approve only if the document is clear, not expired, names are readable, and the required stamp or signature is visible."
							/>
						</div>
					</div>
					<div className="mt-5 flex items-center justify-between gap-4">
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Criteria are saved privately.</p>
						<button
							type="submit"
							disabled={savingDocument}
							className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 disabled:opacity-60 transition-all shadow-md"
						>
							<Save className="h-4 w-4 mr-2" /> {savingDocument ? 'Saving...' : 'Save Rule'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AdminVerificationRules;
