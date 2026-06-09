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
import React, { useMemo, useState } from 'react';
import { FileText, Save, Shield, UserCheck } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const ROLE_OPTIONS = [
	{ value: 'FARMER', label: 'Farmer' },
	{ value: 'BUYER', label: 'Buyer' },
	{ value: 'SUPERMARKET', label: 'Supermarket' },
	{ value: 'AGRO_SHOP', label: 'Agro-shop' },
	{ value: 'ADMIN', label: 'Administrator' },
];

const FIELD_OPTIONS = [
	{ value: 'name', label: 'Full name' },
	{ value: 'email', label: 'Email address' },
	{ value: 'password', label: 'Password' },
	{ value: 'phone', label: 'Phone number' },
	{ value: 'location', label: 'Location' },
	{ value: 'address', label: 'Address' },
];

const AdminVerificationRules: React.FC = () => {
	const [registrationPolicy, setRegistrationPolicy] = useState({
		targetRole: 'FARMER',
		requiredFields: ['name', 'email', 'password', 'phone', 'location', 'address'],
		criteria: '',
	});
	const [documentPolicy, setDocumentPolicy] = useState({
		documentType: '',
		criteria: '',
	});
	const [savingRegistration, setSavingRegistration] = useState(false);
	const [savingDocument, setSavingDocument] = useState(false);

	const selectedFields = useMemo(
		() => new Set(registrationPolicy.requiredFields),
		[registrationPolicy.requiredFields],
	);

	const handleRegistrationPolicySave = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingRegistration(true);
		try {
			const [documentsRes, registrationRes] = await Promise.all([
				api.get('/verification/rules'),
				api.get('/verification/registration-rules'),
			]);
			setDocumentRules(documentsRes.data.rules || []);
			setRegistrationRules(registrationRes.data.rules || []);
		} catch (error) {
			toast.error('Failed to load rule settings');
			await api.post('/verification/rules/registration', registrationPolicy);
			toast.success('Registration policy saved securely');
		} catch {
			toast.error('Failed to save registration policy');
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
			toast.success('Document rule saved privately');
			setDocumentRule({ documentType: '', criteria: '' });
			fetchRules();
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
	const handleDocumentPolicySave = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingDocument(true);
		try {
			await api.post('/verification/rules', documentPolicy);
			toast.success('Document policy saved securely');
			setDocumentPolicy({ documentType: '', criteria: '' });
		} catch {
			toast.error('Failed to save document policy');
		} finally {
			setSavingDocument(false);
		}
	};

	return (
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<div className="glass-card p-8 border border-slate-100">
				<div className="flex items-start gap-4">
					<div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
						<Shield className="h-6 w-6" />
					</div>
					<div>
						<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Verification settings</h3>
						<p className="mt-2 text-sm text-slate-500 font-medium">
							Registration and document policies are stored in the database and are not listed anywhere else in the application.
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
				<form onSubmit={handleRegistrationPolicySave} className="glass-card p-8 border border-slate-100 space-y-6">
					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
							<UserCheck className="h-5 w-5" />
						</div>
						<div>
							<h4 className="text-lg font-black text-slate-900">Registration automation</h4>
							<p className="text-sm text-slate-500">Save a hidden approval policy for each account type.</p>
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account type</label>
						<select
							value={registrationPolicy.targetRole}
							onChange={(e) => setRegistrationPolicy({ ...registrationPolicy, targetRole: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium bg-white"
						>
							{ROLE_OPTIONS.map((role) => (
								<option key={role.value} value={role.value}>
									{role.label}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Required fields</label>
						<div className="grid grid-cols-2 gap-3">
							{FIELD_OPTIONS.map((field) => (
								<label key={field.value} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
									<input
										type="checkbox"
										checked={selectedFields.has(field.value)}
										onChange={(e) => {
											const nextFields = e.target.checked
												? [...registrationPolicy.requiredFields, field.value]
												: registrationPolicy.requiredFields.filter((value) => value !== field.value);
											setRegistrationPolicy({ ...registrationPolicy, requiredFields: nextFields });
										}}
										className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
									/>
									<span>{field.label}</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Approval policy</label>
						<textarea
							required
							rows={6}
							value={registrationPolicy.criteria}
							onChange={(e) => setRegistrationPolicy({ ...registrationPolicy, criteria: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="Example: Approve only complete profiles with a valid business context and reject suspicious or inconsistent registrations."
						/>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={savingRegistration || registrationPolicy.requiredFields.length === 0}
							className="flex items-center px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-md disabled:opacity-60"
						>
							<Save className="h-4 w-4 mr-2" />
							{savingRegistration ? 'Saving...' : 'Save registration policy'}
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
				<form onSubmit={handleDocumentPolicySave} className="glass-card p-8 border border-slate-100 space-y-6">
					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
							<FileText className="h-5 w-5" />
						</div>
						<div>
							<h4 className="text-lg font-black text-slate-900">Document checks</h4>
							<p className="text-sm text-slate-500">Save hidden upload rules without listing them on the dashboard.</p>
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document type</label>
						<input
							type="text"
							required
							value={documentPolicy.documentType}
							onChange={(e) => setDocumentPolicy({ ...documentPolicy, documentType: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="National ID, trading license, land title..."
						/>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document policy</label>
						<textarea
							required
							rows={6}
							value={documentPolicy.criteria}
							onChange={(e) => setDocumentPolicy({ ...documentPolicy, criteria: e.target.value })}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="Describe what the automatic check should confirm before approving the upload."
						/>
					</div>

					<div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
						Saved policies stay in the database and are only used by the automated review flow.
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={savingDocument}
							className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-md disabled:opacity-60"
						>
							<Save className="h-4 w-4 mr-2" />
							{savingDocument ? 'Saving...' : 'Save document policy'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default AdminVerificationRules;
