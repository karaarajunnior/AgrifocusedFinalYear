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
			await api.post('/verification/rules/registration', registrationPolicy);
			toast.success('Registration policy saved securely');
		} catch {
			toast.error('Failed to save registration policy');
		} finally {
			setSavingRegistration(false);
		}
	};

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
