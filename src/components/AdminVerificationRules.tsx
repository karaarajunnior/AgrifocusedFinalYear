import React, { useState, useEffect } from 'react';
import { Shield, Plus, Save, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface VerificationRule {
	id: string;
	documentType: string;
	criteria: string;
	isActive: boolean;
	createdAt: string;
}

const AdminVerificationRules: React.FC = () => {
	const [rules, setRules] = useState<VerificationRule[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAddForm, setShowAddForm] = useState(false);
	const [newRule, setNewRule] = useState({ documentType: '', criteria: '' });

	useEffect(() => {
		fetchRules();
	}, []);

	const fetchRules = async () => {
		try {
			const res = await api.get('/verification/rules');
			setRules(res.data.rules);
		} catch (error) {
			toast.error('Failed to load verification rules');
		} finally {
			setLoading(false);
		}
	};

	const handleAddRule = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await api.post('/verification/rules', newRule);
			toast.success('Verification rule created');
			setNewRule({ documentType: '', criteria: '' });
			setShowAddForm(false);
			fetchRules();
		} catch (error) {
			toast.error('Failed to create rule');
		}
	};

	if (loading) return <div className="p-8 text-center text-slate-500">Loading AI Rules...</div>;

	return (
		<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">AI Verification Engine</h3>
					<p className="text-sm text-slate-500 font-medium">Configure rules for Gemini-powered document validation.</p>
				</div>
				<button
					onClick={() => setShowAddForm(!showAddForm)}
					className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
				>
					{showAddForm ? 'Cancel' : <><Plus className="h-4 w-4 mr-2" /> New Rule</>}
				</button>
			</div>

			{showAddForm && (
				<form onSubmit={handleAddRule} className="glass-card p-8 border-2 border-slate-900/5 bg-white/50 backdrop-blur-xl animate-in zoom-in-95 duration-300">
					<div className="grid grid-cols-1 gap-6">
						<div>
							<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Document Type (e.g. National ID, Land Title)</label>
							<input
								type="text"
								required
								value={newRule.documentType}
								onChange={(e) => setNewRule({ ...newRule, documentType: e.target.value })}
								className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
								placeholder="Enter document type..."
							/>
						</div>
						<div>
							<label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">AI Verification Criteria (Instruction for LLM)</label>
							<textarea
								required
								rows={4}
								value={newRule.criteria}
								onChange={(e) => setNewRule({ ...newRule, criteria: e.target.value })}
								className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-slate-900 focus:ring-0 transition-all font-medium"
								placeholder="Describe what the AI should check for... (e.g. Must have a clear photo, signature, and stamp)"
							/>
						</div>
						<div className="flex justify-end">
							<button
								type="submit"
								className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-md"
							>
								<Save className="h-4 w-4 mr-2" /> Activate AI Rule
							</button>
						</div>
					</div>
				</form>
			)}

			<div className="grid grid-cols-1 gap-6">
				{rules.length === 0 ? (
					<div className="text-center py-20 glass-card">
						<Shield className="h-12 w-12 text-slate-200 mx-auto mb-4" />
						<p className="text-slate-500 font-medium">No active AI verification rules defined.</p>
					</div>
				) : (
					rules.map((rule) => (
						<div key={rule.id} className="glass-card p-6 border-l-4 border-green-500 hover:shadow-xl transition-all">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{rule.documentType}</h4>
										<span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-black uppercase rounded-full border border-green-100">
											Active
										</span>
									</div>
									<p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center">
										<CheckCircle className="h-3 w-3 mr-1" /> Automated Verification Powered by Gemini
									</p>
								</div>
								<button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
									<Trash2 className="h-5 w-5" />
								</button>
							</div>
							<div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
								<p className="text-sm text-slate-600 font-medium leading-relaxed">
									{rule.criteria}
								</p>
							</div>
							<div className="mt-4 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
								<span>Created {new Date(rule.createdAt).toLocaleDateString()}</span>
								<div className="flex items-center text-blue-600">
									<AlertCircle className="h-3 w-3 mr-1" /> View Verification Logs
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default AdminVerificationRules;
