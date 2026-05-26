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
	Target
} from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { getCurrentPosition } from "../utils/geolocation";

function RegisterPage() {
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		role: "FARMER" as "FARMER" | "BUYER" | "ADMIN" | "SUPERMARKET" | "AGRO_SHOP",
		phone: "",
		location: "",
		address: "",
		latitude: undefined as number | undefined,
		longitude: undefined as number | undefined,
	});
	const [showPassword, setShowPassword] = useState(false);
	const [countryCode, setCountryCode] = useState("+256");
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [locating, setLocating] = useState(false);

	const handleDetectLocation = async () => {
		setLocating(true);
		try {
			// Try GPS first
			try {
				const coords = await getCurrentPosition();
				setFormData({ 
					...formData, 
					latitude: coords.latitude, 
					longitude: coords.longitude,
					location: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
				});
				toast.success("GPS Location Captured");
				return;
			} catch (gpsErr) {
				console.warn("GPS failed, falling back to IP:", gpsErr);
			}

			// Fallback to IP detect
			const res = await api.get("/location/detect");
			if (res.data?.detected && res.data.city) {
				const locString = `${res.data.city}, ${res.data.country}`;
				setFormData({ 
					...formData, 
					location: locString,
					latitude: res.data.latitude,
					longitude: res.data.longitude
				});
				toast.success(`Detected: ${locString}`);
			} else {
				toast.error("Could not detect your location. Please enter it manually.");
			}
		} catch (error) {
			toast.error("Failed to detect location");
		} finally {
			setLocating(false);
		}
	};
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

		const fullPhone = formData.phone ? `${countryCode}${formData.phone}` : "";
		if (fullPhone && !/^\+?[\d\s-()]+$/.test(fullPhone)) {
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
			phone: formData.phone ? `${countryCode}${formData.phone}` : undefined,
			location: formData.location || undefined,
			address: formData.address || undefined,
			latitude: formData.latitude,
			longitude: formData.longitude,
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
							<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
								<button
									type="button"
									onClick={() => setFormData({ ...formData, role: "SUPERMARKET" })}
									className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
										formData.role === "SUPERMARKET"
											? "border-green-500 bg-green-50 text-green-700"
											: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
									}`}>
									🏬 Market
								</button>
								<button
									type="button"
									onClick={() => setFormData({ ...formData, role: "ADMIN" })}
									className={`p-3 text-sm font-medium rounded-lg border-2 transition-colors ${
										formData.role === "ADMIN"
											? "border-green-500 bg-green-50 text-green-700"
											: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
									}`}>
									🛡️ Admin
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
							<div className="mt-1 relative flex rounded-md shadow-sm">
								<div className="relative flex-none">
									<select
										id="countryCode"
										name="countryCode"
										value={countryCode}
										onChange={(e) => setCountryCode(e.target.value)}
										className="h-full py-0 pl-3 pr-7 border border-r-0 border-gray-300 bg-gray-50 text-gray-700 rounded-l-md focus:ring-green-500 focus:border-green-500 sm:text-sm"
									>
										<option value="+256">UG (+256)</option>
										<option value="+254">KE (+254)</option>
										<option value="+250">RW (+250)</option>
										<option value="+255">TZ (+255)</option>
										<option value="+211">SS (+211)</option>
										<option value="+243">CD (+243)</option>
									</select>
								</div>
								<div className="relative flex-grow">
									<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
										<Phone className="h-5 w-5 text-gray-400" />
									</div>
									<input
										id="phone"
										name="phone"
										type="tel"
										value={formData.phone}
										onChange={handleChange}
										className={`appearance-none block w-full pl-10 pr-3 py-3 border placeholder-gray-500 text-gray-900 rounded-r-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm ${
											errors.phone ? "border-red-300" : "border-gray-300 border-l-0"
										}`}
										placeholder="e.g. 700 123 456"
									/>
								</div>
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
									className="appearance-none relative block w-full pl-10 pr-12 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
									placeholder="City, State"
								/>
								<button
									type="button"
									onClick={handleDetectLocation}
									disabled={locating}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
									title="Detect current location"
								>
									<Target className={`h-5 w-5 ${locating ? 'animate-pulse text-green-500' : ''}`} />
								</button>
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
