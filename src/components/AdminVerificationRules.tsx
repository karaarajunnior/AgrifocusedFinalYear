import React, { useState, useEffect } from 'react';
import { FileCheck, Save, Shield, UserCheck } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface DocumentRule {
	id: string;
	documentType: string;
	isActive: boolean;
	createdAt: string;
	updatedAt?: string;
}

interface RegistrationRule {
	id: string;
	name: string;
	isActive: boolean;
	createdAt: string;
	updatedAt?: string;
}

const AdminVerificationRules: React.FC = () => {
	const [documentRules, setDocumentRules] = useState<DocumentRule[]>([]);
	const [registrationRules, setRegistrationRules] = useState<RegistrationRule[]>([]);
	const [loading, setLoading] = useState(true);
	const [savingDocument, setSavingDocument] = useState(false);
	const [savingRegistration, setSavingRegistration] = useState(false);
	const [documentRule, setDocumentRule] = useState({ documentType: '', criteria: '' });
	const [registrationRule, setRegistrationRule] = useState({
		name: 'Registration eligibility',
		criteria: '',
	});

	useEffect(() => {
		fetchRules();
	}, []);

	const fetchRules = async () => {
		try {
			const [documentsRes, registrationRes] = await Promise.all([
				api.get('/verification/rules'),
				api.get('/verification/registration-rules'),
			]);
			setDocumentRules(documentsRes.data.rules || []);
			setRegistrationRules(registrationRes.data.rules || []);
		} catch (error) {
			toast.error('Failed to load rule settings');
		} finally {
			setLoading(false);
		}
	};

	const handleSaveDocumentRule = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingDocument(true);
		try {
			await api.post('/verification/rules', documentRule);
			toast.success('Document rule saved privately');
			setDocumentRule({ documentType: '', criteria: '' });
			fetchRules();
		} catch (error) {
			toast.error('Failed to save document rule');
		} finally {
			setSavingDocument(false);
		}
	};

	const handleSaveRegistrationRule = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingRegistration(true);
		try {
			await api.post('/verification/registration-rules', registrationRule);
			toast.success('Registration rule saved privately');
			setRegistrationRule({ name: 'Registration eligibility', criteria: '' });
			fetchRules();
		} catch (error) {
			toast.error('Failed to save registration rule');
		} finally {
			setSavingRegistration(false);
		}
	};

	if (loading) return <div className="p-8 text-center text-slate-500">Loading rule settings...</div>;

	return (
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<div>
				<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Private Rule Settings</h3>
				<p className="text-sm text-slate-500 font-medium">
					Rules are saved to the database and used automatically. Rule text is not displayed after saving.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<form onSubmit={handleSaveRegistrationRule} className="glass-card p-6 border border-slate-100">
					<div className="mb-6 flex items-start justify-between gap-4">
						<div>
							<div className="mb-3 inline-flex rounded-2xl bg-green-50 p-3 text-green-700">
								<UserCheck className="h-6 w-6" />
							</div>
							<h4 className="text-lg font-black text-slate-900">Registration approvals</h4>
							<p className="mt-1 text-sm text-slate-500">
								Define how new accounts are approved or rejected after signup.
							</p>
						</div>
						<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
							{registrationRules.length} active
						</span>
					</div>

					<div className="space-y-4">
						<div>
							<label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
								Rule name
							</label>
							<input
								type="text"
								required
								value={registrationRule.name}
								onChange={(e) => setRegistrationRule({ ...registrationRule, name: e.target.value })}
								className="w-full rounded-xl border-2 border-slate-100 px-4 py-3 font-medium transition-all focus:border-green-600 focus:ring-0"
							/>
						</div>
						<div>
							<label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
								Private criteria
							</label>
							<textarea
								required
								rows={5}
								value={registrationRule.criteria}
								onChange={(e) => setRegistrationRule({ ...registrationRule, criteria: e.target.value })}
								className="w-full rounded-xl border-2 border-slate-100 px-4 py-3 font-medium transition-all focus:border-green-600 focus:ring-0"
								placeholder="Example: Approve only when name, phone number, location, and address are present. Reject clearly invalid contact details."
							/>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-between">
						<p className="text-xs text-slate-400">
							Last saved: {registrationRules[0] ? new Date(registrationRules[0].createdAt).toLocaleDateString() : 'Never'}
						</p>
						<button
							type="submit"
							disabled={savingRegistration}
							className="inline-flex items-center rounded-xl bg-green-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-green-700 disabled:opacity-50"
						>
							<Save className="mr-2 h-4 w-4" /> {savingRegistration ? 'Saving...' : 'Save privately'}
						</button>
					</div>
				</form>

				<form onSubmit={handleSaveDocumentRule} className="glass-card p-6 border border-slate-100">
					<div className="mb-6 flex items-start justify-between gap-4">
						<div>
							<div className="mb-3 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">
								<FileCheck className="h-6 w-6" />
							</div>
							<h4 className="text-lg font-black text-slate-900">Document uploads</h4>
							<p className="mt-1 text-sm text-slate-500">
								Define private criteria for uploaded identity or business documents.
							</p>
						</div>
						<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
							{documentRules.length} active
						</span>
					</div>

					<div className="space-y-4">
						<div>
							<label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
								Document type
							</label>
							<input
								type="text"
								required
								value={documentRule.documentType}
								onChange={(e) => setDocumentRule({ ...documentRule, documentType: e.target.value })}
								className="w-full rounded-xl border-2 border-slate-100 px-4 py-3 font-medium transition-all focus:border-blue-600 focus:ring-0"
								placeholder="Example: National ID"
							/>
						</div>
						<div>
							<label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
								Private criteria
							</label>
							<textarea
								required
								rows={5}
								value={documentRule.criteria}
								onChange={(e) => setDocumentRule({ ...documentRule, criteria: e.target.value })}
								className="w-full rounded-xl border-2 border-slate-100 px-4 py-3 font-medium transition-all focus:border-blue-600 focus:ring-0"
								placeholder="Example: Must show a readable name, valid document number, clear photo, and current issuing authority."
							/>
						</div>
					</div>

					<div className="mt-6 flex items-center justify-between">
						<p className="text-xs text-slate-400">
							Types: {documentRules.length > 0 ? documentRules.map((rule) => rule.documentType).join(', ') : 'None'}
						</p>
						<button
							type="submit"
							disabled={savingDocument}
							className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50"
						>
							<Save className="mr-2 h-4 w-4" /> {savingDocument ? 'Saving...' : 'Save privately'}
						</button>
					</div>
				</form>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
				<div className="mb-2 flex items-center font-bold text-slate-800">
					<Shield className="mr-2 h-4 w-4" /> Privacy notice
				</div>
				<p>
					Saved criteria are kept in the database for automated decisions and are not returned in dashboard or user-facing responses.
				</p>
			</div>
		</div>
	);
};

export default AdminVerificationRules;
