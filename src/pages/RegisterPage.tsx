import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
	Eye,
	EyeOff,
	Leaf,
	Mail,
	Lock,
	User,
	Phone,
	MapPin,
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";

function RegisterPage() {
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		role: "FARMER" as "FARMER" | "BUYER",
		phone: "",
		location: "",
		address: "",
	});
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const { register } = useAuth();
	const navigate = useNavigate();

	const validateForm = () => {
		const newErrors: Record<string, string> = {};

		if (formData.name.length < 2) {
			newErrors.name = "Name must be at least 2 characters";
		}

		if (!/\S+@\S+\.\S+/.test(formData.email)) {
			newErrors.email = "Please enter a valid email";
		}

		if (formData.password.length < 6) {
			newErrors.password = "Password must be at least 6 characters";
		}

		if (formData.password !== formData.confirmPassword) {
			newErrors.confirmPassword = "Passwords do not match";
		}

		if (formData.phone && !/^\+?[\d\s-()]+$/.test(formData.phone)) {
			newErrors.phone = "Please enter a valid phone number";
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setLoading(true);

		const success = await register({
			name: formData.name,
			email: formData.email,
			password: formData.password,
			role: formData.role,
			phone: formData.phone || undefined,
			location: formData.location || undefined,
			address: formData.address || undefined,
		});

		if (success) {
			navigate("/dashboard");
		}

		setLoading(false);
	};

	const handleChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>,
	) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value,
		});

		// Clear error when user starts typing
		if (errors[e.target.name]) {
			setErrors({
				...errors,
				[e.target.name]: "",
			});
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div className="text-center">
					<div className="flex justify-center">
						<Leaf className="h-12 w-12 text-green-600" />
					</div>
					<h2 className="mt-6 text-3xl font-bold text-gray-900">
						Join AgriConnect
					</h2>
					<p className="mt-2 text-sm text-gray-600">
						Create your account to start connecting
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="space-y-4">
						{/* Role Selection */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								I am a
							</label>
							<div className="grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => setFormData({ ...formData, role: "FARMER" })}
									className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
										formData.role === "FARMER"
											? "border-green-500 bg-green-50 text-green-700"
											: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
									}`}>
									🌾 Farmer
								</button>
								<button
									type="button"
									onClick={() => setFormData({ ...formData, role: "BUYER" })}
									className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
										formData.role === "BUYER"
											? "border-green-500 bg-green-50 text-green-700"
											: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
									}`}>
									🛒 Buyer
								</button>
							</div>
						</div>

						{/* Name */}
						<div>
							<label
								htmlFor="name"
								className="block text-sm font-medium text-gray-700">
								Full Name *
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<User className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="name"
									name="name"
									type="text"
									required
									value={formData.name}
									onChange={handleChange}
									className={`appearance-none relative block w-full pl-10 pr-3 py-3 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
										errors.name ? "border-red-300" : "border-gray-300"
									}`}
									placeholder="Enter your full name"
								/>
							</div>
							{errors.name && (
								<p className="mt-1 text-sm text-red-600">{errors.name}</p>
							)}
						</div>

						{/* Email */}
						<div>
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700">
								Email Address *
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Mail className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="email"
									name="email"
									type="email"
									required
									value={formData.email}
									onChange={handleChange}
									className={`appearance-none relative block w-full pl-10 pr-3 py-3 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
										errors.email ? "border-red-300" : "border-gray-300"
									}`}
									placeholder="Enter your email"
								/>
							</div>
							{errors.email && (
								<p className="mt-1 text-sm text-red-600">{errors.email}</p>
							)}
						</div>

						{/* Password */}
						<div>
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700">
								Password *
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Lock className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="password"
									name="password"
									type={showPassword ? "text" : "password"}
									required
									value={formData.password}
									onChange={handleChange}
									className={`appearance-none relative block w-full pl-10 pr-10 py-3 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
										errors.password ? "border-red-300" : "border-gray-300"
									}`}
									placeholder="Create a password"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-0 pr-3 flex items-center"
									onClick={() => setShowPassword(!showPassword)}>
									{showPassword ? (
										<EyeOff className="h-5 w-5 text-gray-400" />
									) : (
										<Eye className="h-5 w-5 text-gray-400" />
									)}
								</button>
							</div>
							{errors.password && (
								<p className="mt-1 text-sm text-red-600">{errors.password}</p>
							)}
						</div>

						{/* Confirm Password */}
						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm font-medium text-gray-700">
								Confirm Password *
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Lock className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type={showConfirmPassword ? "text" : "password"}
									required
									value={formData.confirmPassword}
									onChange={handleChange}
									className={`appearance-none relative block w-full pl-10 pr-10 py-3 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
										errors.confirmPassword
											? "border-red-300"
											: "border-gray-300"
									}`}
									placeholder="Confirm your password"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-0 pr-3 flex items-center"
									onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
									{showConfirmPassword ? (
										<EyeOff className="h-5 w-5 text-gray-400" />
									) : (
										<Eye className="h-5 w-5 text-gray-400" />
									)}
								</button>
							</div>
							{errors.confirmPassword && (
								<p className="mt-1 text-sm text-red-600">
									{errors.confirmPassword}
								</p>
							)}
						</div>

						{/* Phone */}
						<div>
							<label
								htmlFor="phone"
								className="block text-sm font-medium text-gray-700">
								Phone Number
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<Phone className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="phone"
									name="phone"
									type="tel"
									value={formData.phone}
									onChange={handleChange}
									className={`appearance-none relative block w-full pl-10 pr-3 py-3 border placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
										errors.phone ? "border-red-300" : "border-gray-300"
									}`}
									placeholder="Enter your phone number"
								/>
							</div>
							{errors.phone && (
								<p className="mt-1 text-sm text-red-600">{errors.phone}</p>
							)}
						</div>

						{/* Location */}
						<div>
							<label
								htmlFor="location"
								className="block text-sm font-medium text-gray-700">
								Location
							</label>
							<div className="mt-1 relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									<MapPin className="h-5 w-5 text-gray-400" />
								</div>
								<input
									id="location"
									name="location"
									type="text"
									value={formData.location}
									onChange={handleChange}
									className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
									placeholder="City, State"
								/>
							</div>
						</div>

						{/* Address */}
						<div>
							<label
								htmlFor="address"
								className="block text-sm font-medium text-gray-700">
								Address
							</label>
							<textarea
								id="address"
								name="address"
								rows={3}
								value={formData.address}
								onChange={handleChange}
								className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
								placeholder="Full address (optional)"
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={loading}
							className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
							{loading ? <LoadingSpinner size="sm" /> : "Create Account"}
						</button>
					</div>

					<div className="text-center">
						<p className="text-sm text-gray-600">
							Already have an account?{" "}
							<Link
								to="/login"
								className="font-medium text-green-600 hover:text-green-500">
								Sign in here
							</Link>
						</p>
					</div>
				</form>
			</div>
		</div>
	);
}

export default RegisterPage;
