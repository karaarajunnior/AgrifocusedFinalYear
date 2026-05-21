import React, { useState } from 'react';
import { Save, Shield } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const REGISTRATION_FIELDS = [
	{ key: 'name', label: 'Full name' },
	{ key: 'email', label: 'Email address' },
	{ key: 'password', label: 'Password' },
	{ key: 'role', label: 'Account role' },
	{ key: 'phone', label: 'Phone number' },
	{ key: 'location', label: 'Location' },
	{ key: 'address', label: 'Address' },
];

const AdminVerificationPolicies: React.FC = () => {
	const [savingRegistrationRule, setSavingRegistrationRule] = useState(false);
	const [savingDocumentRule, setSavingDocumentRule] = useState(false);
	const [registrationRule, setRegistrationRule] = useState({
		name: 'Default registration rule',
		criteria: '',
		requiredFields: ['name', 'email', 'password', 'role'],
	});
	const [documentRule, setDocumentRule] = useState({
		documentType: '',
		criteria: '',
	});

	const toggleRequiredField = (field: string) => {
		setRegistrationRule((prev) => {
			const isSelected = prev.requiredFields.includes(field);
			return {
				...prev,
				requiredFields: isSelected
					? prev.requiredFields.filter((value) => value !== field)
					: [...prev.requiredFields, field],
			};
		});
	};

	const handleSaveRegistrationRule = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingRegistrationRule(true);
		try {
			await api.post('/verification/rules/registration', registrationRule);
			toast.success('Registration policy saved');
		} catch {
			toast.error('Failed to save registration policy');
		} finally {
			setSavingRegistrationRule(false);
		}
	};

	const handleSaveDocumentRule = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingDocumentRule(true);
		try {
			await api.post('/verification/rules/document', documentRule);
			toast.success('Document policy saved');
			setDocumentRule({ documentType: '', criteria: '' });
		} catch {
			toast.error('Failed to save document policy');
		} finally {
			setSavingDocumentRule(false);
		}
	};

	return (
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<div>
				<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Verification policy settings</h3>
				<p className="text-sm text-slate-500 font-medium">
					Policies saved here are stored internally and applied automatically.
				</p>
			</div>

			<form
				onSubmit={handleSaveRegistrationRule}
				className="glass-card p-8 border-2 border-slate-900/5 bg-white/50 backdrop-blur-xl"
			>
				<div className="flex items-center gap-2 mb-4">
					<Shield className="h-5 w-5 text-green-700" />
					<h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Registration policy</h4>
				</div>

				<div className="grid grid-cols-1 gap-6">
					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
							Policy name
						</label>
						<input
							type="text"
							required
							value={registrationRule.name}
							onChange={(e) => setRegistrationRule((prev) => ({ ...prev, name: e.target.value }))}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="Default registration rule"
						/>
					</div>

					<div>
						<p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
							Required fields
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{REGISTRATION_FIELDS.map((field) => (
								<label
									key={field.key}
									className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
								>
									<input
										type="checkbox"
										className="h-4 w-4 text-green-600 rounded border-slate-300"
										checked={registrationRule.requiredFields.includes(field.key)}
										onChange={() => toggleRequiredField(field.key)}
									/>
									<span>{field.label}</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
							Policy instructions
						</label>
						<textarea
							rows={4}
							value={registrationRule.criteria}
							onChange={(e) => setRegistrationRule((prev) => ({ ...prev, criteria: e.target.value }))}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="Describe standards for accepting or rejecting a registration."
						/>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={savingRegistrationRule}
							className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
						>
							<Save className="h-4 w-4 mr-2" />
							{savingRegistrationRule ? 'Saving...' : 'Save registration policy'}
						</button>
					</div>
				</div>
			</form>

			<form
				onSubmit={handleSaveDocumentRule}
				className="glass-card p-8 border-2 border-slate-900/5 bg-white/50 backdrop-blur-xl"
			>
				<div className="flex items-center gap-2 mb-4">
					<Shield className="h-5 w-5 text-blue-700" />
					<h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Document upload policy</h4>
				</div>

				<div className="grid grid-cols-1 gap-6">
					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
							Document type
						</label>
						<input
							type="text"
							required
							value={documentRule.documentType}
							onChange={(e) => setDocumentRule((prev) => ({ ...prev, documentType: e.target.value }))}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="e.g. National ID"
						/>
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
							Validation instructions
						</label>
						<textarea
							required
							rows={4}
							value={documentRule.criteria}
							onChange={(e) => setDocumentRule((prev) => ({ ...prev, criteria: e.target.value }))}
							className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
							placeholder="Describe what this document must contain to pass validation."
						/>
					</div>

					<div className="flex justify-end">
						<button
							type="submit"
							disabled={savingDocumentRule}
							className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
						>
							<Save className="h-4 w-4 mr-2" />
							{savingDocumentRule ? 'Saving...' : 'Save document policy'}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
};

export default AdminVerificationPolicies;
