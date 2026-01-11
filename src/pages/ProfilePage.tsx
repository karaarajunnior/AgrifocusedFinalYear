import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
	User,
	Mail,
	Phone,
	MapPin,
	Calendar,
	CreditCard as Edit2,
	Save,
	X,
	Shield,
	Star,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import axios from "axios";

function ProfilePage() {
	const { user, updateProfile, refreshUser } = useAuth();
	const [isEditing, setIsEditing] = useState(false);
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		name: user?.name || "",
		phone: user?.phone || "",
		location: user?.location || "",
		address: user?.address || "",
	});

	const [pwLoading, setPwLoading] = useState(false);
	const [pwForm, setPwForm] = useState({
		currentPassword: "",
		newPassword: "",
		confirmNewPassword: "",
	});

	const [mfaLoading, setMfaLoading] = useState(false);
	const [mfaSetup, setMfaSetup] = useState<null | { qrCodeDataUrl: string }>(null);
	const [mfaCode, setMfaCode] = useState("");
	const [mfaDisable, setMfaDisable] = useState({ password: "", code: "" });
	const [automationLoading, setAutomationLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		const success = await updateProfile(formData);
		if (success) {
			setIsEditing(false);
		}

		setLoading(false);
	};

	const handleCancel = () => {
		setFormData({
			name: user?.name || "",
			phone: user?.phone || "",
			location: user?.location || "",
			address: user?.address || "",
		});
		setIsEditing(false);
	};

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (pwForm.newPassword !== pwForm.confirmNewPassword) {
			toast.error("New passwords do not match");
			return;
		}
		setPwLoading(true);
		try {
			await api.put("/users/change-password", {
				currentPassword: pwForm.currentPassword,
				newPassword: pwForm.newPassword,
			});
			toast.success("Password changed successfully");
			setPwForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
		} catch (err: unknown) {
			let message = "Failed to change password";
			if (axios.isAxiosError(err)) {
				const data = err.response?.data;
				if (data && typeof data === "object") {
					const maybe = data as Record<string, unknown>;
					if (typeof maybe.error === "string") message = maybe.error;
				}
			}
			toast.error(message);
		} finally {
			setPwLoading(false);
		}
	};

	const startMfaSetup = async () => {
		setMfaLoading(true);
		try {
			const res = await api.post("/auth/mfa/setup");
			setMfaSetup({ qrCodeDataUrl: res.data.mfa.qrCodeDataUrl });
			toast.success("Scan the QR with an authenticator app");
		} catch (err: unknown) {
			let message = "Failed to start MFA setup";
			if (axios.isAxiosError(err)) {
				const data = err.response?.data;
				if (data && typeof data === "object") {
					const maybe = data as Record<string, unknown>;
					if (typeof maybe.error === "string") message = maybe.error;
				}
			}
			toast.error(message);
		} finally {
			setMfaLoading(false);
		}
	};

	const verifyMfa = async () => {
		setMfaLoading(true);
		try {
			await api.post("/auth/mfa/verify", { code: mfaCode });
			toast.success("MFA enabled");
			setMfaSetup(null);
			setMfaCode("");
			await refreshUser();
		} catch (err: unknown) {
			let message = "Failed to enable MFA";
			if (axios.isAxiosError(err)) {
				const data = err.response?.data;
				if (data && typeof data === "object") {
					const maybe = data as Record<string, unknown>;
					if (typeof maybe.error === "string") message = maybe.error;
				}
			}
			toast.error(message);
		} finally {
			setMfaLoading(false);
		}
	};

	const disableMfa = async () => {
		setMfaLoading(true);
		try {
			await api.post("/auth/mfa/disable", mfaDisable);
			toast.success("MFA disabled");
			setMfaDisable({ password: "", code: "" });
			await refreshUser();
		} catch (err: unknown) {
			let message = "Failed to disable MFA";
			if (axios.isAxiosError(err)) {
				const data = err.response?.data;
				if (data && typeof data === "object") {
					const maybe = data as Record<string, unknown>;
					if (typeof maybe.error === "string") message = maybe.error;
				}
			}
			toast.error(message);
		} finally {
			setMfaLoading(false);
		}
	};

	const toggleAutoFulfill = async (value: boolean) => {
		setAutomationLoading(true);
		try {
			const ok = await updateProfile({ autoFulfillOnPayment: value });
			if (ok) toast.success("Automation setting updated");
		} finally {
			setAutomationLoading(false);
		}
	};

	if (!user) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 py-8">
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
					<p className="text-gray-600 mt-2">
						Manage your account information and preferences
					</p>
				</div>

				{/* Profile Card */}
				<div className="bg-white rounded-lg shadow">
					{/* Header */}
					<div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
						<h2 className="text-xl font-semibold text-gray-900">
							Personal Information
						</h2>
						{!isEditing ? (
							<button
								onClick={() => setIsEditing(true)}
								className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
								<Edit2 className="h-4 w-4 mr-2" />
								Edit Profile
							</button>
						) : (
							<div className="flex space-x-2">
								<button
									onClick={handleCancel}
									className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
									<X className="h-4 w-4 mr-2" />
									Cancel
								</button>
								<button
									onClick={handleSubmit}
									disabled={loading}
									className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
									{loading ? (
										<LoadingSpinner size="sm" />
									) : (
										<>
											<Save className="h-4 w-4 mr-2" />
											Save Changes
										</>
									)}
								</button>
							</div>
						)}
					</div>

					{/* Profile Content */}
					<div className="p-6">
						<div className="flex items-start space-x-6 mb-8">
							{/* Avatar */}
							<div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
								<User className="h-12 w-12 text-green-600" />
							</div>

							{/* Basic Info */}
							<div className="flex-1">
								<div className="flex items-center space-x-3 mb-2">
									<h3 className="text-2xl font-bold text-gray-900">
										{user.name}
									</h3>
									{user.verified ? (
										<div className="flex items-center text-blue-600">
											<Shield className="h-5 w-5 mr-1" />
											<span className="text-sm font-medium">Verified</span>
										</div>
									) : (
										<div className="flex items-center text-yellow-700">
											<Shield className="h-5 w-5 mr-1" />
											<span className="text-sm font-medium">
												Pending admin approval
											</span>
										</div>
									)}
								</div>

								<div className="flex items-center space-x-4 text-sm text-gray-600">
									<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
										{user.role.charAt(0) + user.role.slice(1).toLowerCase()}
									</span>
									<span className="flex items-center">
										<Calendar className="h-4 w-4 mr-1" />
										Joined {new Date(user.createdAt).toLocaleDateString()}
									</span>
								</div>
							</div>
						</div>

						{/* Form */}
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								{/* Name */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										Full Name
									</label>
									{isEditing ? (
										<input
											type="text"
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											required
										/>
									) : (
										<div className="flex items-center py-2">
											<User className="h-4 w-4 text-gray-400 mr-3" />
											<span className="text-gray-900">{user.name}</span>
										</div>
									)}
								</div>

								{/* Email (Read-only) */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										Email Address
									</label>
									<div className="flex items-center py-2">
										<Mail className="h-4 w-4 text-gray-400 mr-3" />
										<span className="text-gray-900">{user.email}</span>
										<span className="ml-2 text-xs text-gray-500">
											(Cannot be changed)
										</span>
									</div>
								</div>

								{/* Phone */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										Phone Number
									</label>
									{isEditing ? (
										<input
											type="tel"
											value={formData.phone}
											onChange={(e) =>
												setFormData({ ...formData, phone: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											placeholder="Enter your phone number"
										/>
									) : (
										<div className="flex items-center py-2">
											<Phone className="h-4 w-4 text-gray-400 mr-3" />
											<span className="text-gray-900">
												{user.phone || "Not provided"}
											</span>
										</div>
									)}
								</div>

								{/* Location */}
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										Location
									</label>
									{isEditing ? (
										<input
											type="text"
											value={formData.location}
											onChange={(e) =>
												setFormData({ ...formData, location: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
											placeholder="City, State"
										/>
									) : (
										<div className="flex items-center py-2">
											<MapPin className="h-4 w-4 text-gray-400 mr-3" />
											<span className="text-gray-900">
												{user.location || "Not provided"}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Address */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Address
								</label>
								{isEditing ? (
									<textarea
										rows={3}
										value={formData.address}
										onChange={(e) =>
											setFormData({ ...formData, address: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
										placeholder="Full address"
									/>
								) : (
									<div className="py-2">
										<span className="text-gray-900">
											{user.address || "Not provided"}
										</span>
									</div>
								)}
							</div>
						</form>
					</div>
				</div>

				{/* Account Stats */}
				<div className="mt-8 bg-white rounded-lg shadow">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold text-gray-900">
							Account Statistics
						</h2>
					</div>
					<div className="p-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="text-center">
								<div className="text-2xl font-bold text-green-600">
									{user.role === "FARMER" ? "12" : "8"}
								</div>
								<div className="text-sm text-gray-600">
									{user.role === "FARMER" ? "Products Listed" : "Orders Placed"}
								</div>
							</div>

							<div className="text-center">
								<div className="text-2xl font-bold text-blue-600">
									{user.role === "FARMER" ? "₹45,000" : "₹12,500"}
								</div>
								<div className="text-sm text-gray-600">
									{user.role === "FARMER" ? "Total Revenue" : "Total Spent"}
								</div>
							</div>

							<div className="text-center">
								<div className="flex items-center justify-center text-2xl font-bold text-yellow-600">
									<Star className="h-6 w-6 mr-1 fill-current" />
									4.8
								</div>
								<div className="text-sm text-gray-600">Average Rating</div>
							</div>
						</div>
					</div>
				</div>

				{/* Security Section */}
				<div className="mt-8 bg-white rounded-lg shadow">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold text-gray-900">Security</h2>
					</div>
					<div className="p-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<div className="bg-gray-50 rounded-lg p-4">
								<h3 className="font-medium text-gray-900 mb-3">
									Change password
								</h3>
								<form onSubmit={handleChangePassword} className="space-y-3">
									<input
										type="password"
										value={pwForm.currentPassword}
										onChange={(e) =>
											setPwForm({ ...pwForm, currentPassword: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg"
										placeholder="Current password"
										required
									/>
									<input
										type="password"
										value={pwForm.newPassword}
										onChange={(e) =>
											setPwForm({ ...pwForm, newPassword: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg"
										placeholder="New password (Aa1...)"
										required
									/>
									<input
										type="password"
										value={pwForm.confirmNewPassword}
										onChange={(e) =>
											setPwForm({ ...pwForm, confirmNewPassword: e.target.value })
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-lg"
										placeholder="Confirm new password"
										required
									/>
									<button
										type="submit"
										disabled={pwLoading}
										className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
										{pwLoading ? "Updating..." : "Update password"}
									</button>
								</form>
							</div>

							<div className="bg-gray-50 rounded-lg p-4">
								<h3 className="font-medium text-gray-900 mb-3">
									Two‑factor authentication (MFA)
								</h3>

								{user.mfaEnabled ? (
									<div className="space-y-3">
										<p className="text-sm text-gray-700">
											MFA is <span className="font-medium">enabled</span>.
										</p>
										<input
											type="password"
											value={mfaDisable.password}
											onChange={(e) =>
												setMfaDisable({
													...mfaDisable,
													password: e.target.value,
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg"
											placeholder="Password"
										/>
										<input
											type="text"
											inputMode="numeric"
											value={mfaDisable.code}
											onChange={(e) =>
												setMfaDisable({ ...mfaDisable, code: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-lg"
											placeholder="MFA code"
										/>
										<button
											type="button"
											onClick={disableMfa}
											disabled={mfaLoading}
											className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
											{mfaLoading ? "Working..." : "Disable MFA"}
										</button>
									</div>
								) : (
									<div className="space-y-3">
										<p className="text-sm text-gray-700">
											MFA is <span className="font-medium">disabled</span>.
										</p>
										<button
											type="button"
											onClick={startMfaSetup}
											disabled={mfaLoading}
											className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
											{mfaLoading ? "Generating..." : "Enable MFA"}
										</button>

										{mfaSetup && (
											<div className="pt-2">
												<img
													src={mfaSetup.qrCodeDataUrl}
													alt="MFA QR"
													className="w-full max-w-xs bg-white p-2 rounded"
												/>
												<div className="flex gap-2 mt-3">
													<input
														type="text"
														inputMode="numeric"
														value={mfaCode}
														onChange={(e) => setMfaCode(e.target.value)}
														className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
														placeholder="Enter code to confirm"
													/>
													<button
														type="button"
														onClick={verifyMfa}
														disabled={mfaLoading || !mfaCode}
														className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
														Verify
													</button>
												</div>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Automation (Farmers) */}
				{user.role === "FARMER" && (
					<div className="mt-8 bg-white rounded-lg shadow">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-xl font-semibold text-gray-900">Automation</h2>
						</div>
						<div className="p-6">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h3 className="font-medium text-gray-900">
										Auto‑mark paid orders as “In Transit”
									</h3>
									<p className="text-sm text-gray-600">
										When Airtel payment completes, automatically move orders from
										CONFIRMED → IN_TRANSIT and notify both parties.
									</p>
								</div>
								<label className="inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										className="h-4 w-4"
										checked={Boolean(user.autoFulfillOnPayment)}
										disabled={automationLoading}
										onChange={(e) => toggleAutoFulfill(e.target.checked)}
									/>
									<span className="ml-2 text-sm text-gray-700">
										{user.autoFulfillOnPayment ? "On" : "Off"}
									</span>
								</label>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default ProfilePage;
