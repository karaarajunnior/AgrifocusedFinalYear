import React, { useEffect, useState } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
	Link,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "react-hot-toast";

// Components
import Navbar from "./components/Navbar";
import LoadingSpinner from "./components/LoadingSpinner";
import SplashScreen from "./components/SplashScreen";
import VoiceAssistant from "./components/VoiceAssistant";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import FarmerDashboard from "./pages/FarmerDashboard";
import BuyerDashboard from "./pages/BuyerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProductDetails from "./pages/ProductDetails";
import ProfilePage from "./pages/ProfilePage";
import MarketplacePage from "./pages/MarketplacePage";
import OrdersPage from "./pages/OrdersPage";
import ChatPage from "./pages/ChatPage";
import PublicPortfolio from "./pages/PublicPortfolio";
import RFPBoard from "./pages/RFPBoard";
import CoopPage from "./pages/CoopPage";
import FormBuilderPage from "./pages/FormBuilderPage";
import LogisticsPage from "./pages/LogisticsPage";
import ExportApplicationPage from "./pages/ExportApplicationPage";
import AgroStore from "./pages/AgroStore";
import TracePage from "./pages/TracePage";
import ContractsPage from "./pages/ContractsPage";
import GradingPage from "./pages/GradingPage";

function AppContent() {
	const { user, loading } = useAuth();
	const [isInitialized, setIsInitialized] = useState(false);
	const [showSplash, setShowSplash] = useState(true);

	useEffect(() => {
		if (!loading) {
			setIsInitialized(true);
		}
	}, [loading]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setShowSplash(false);
		}, 4000);
		return () => clearTimeout(timer);
	}, []);

	if (showSplash) {
		return <SplashScreen />;
	}

	if (!isInitialized) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<Navbar />
			<VoiceAssistant />
			<main>
				<Routes>
					{/* Public routes */}
					<Route path="/" element={<LandingPage />} />
					<Route path="/marketplace" element={<MarketplacePage />} />
					<Route path="/product/:id" element={<ProductDetails />} />
					<Route path="/portfolio/:id" element={<PublicPortfolio />} />
					<Route path="/requests" element={<RFPBoard />} />
					<Route path="/trace/:batchId" element={<TracePage />} />

					{/* Auth routes */}
					<Route
						path="/login"
						element={
							user ? <Navigate to="/dashboard" /> : <LoginPage />
						}
					/>
					<Route
						path="/register"
						element={
							user ? <Navigate to="/dashboard" /> : <RegisterPage />
						}
					/>

					{/* Protected dashboard */}
					<Route
						path="/dashboard"
						element={
							<ProtectedRoute>
								{(user?.role === "FARMER" || user?.role === "SUPERMARKET") && <FarmerDashboard />}
								{user?.role === "BUYER" && <BuyerDashboard />}
								{user?.role === "ADMIN" && <AdminDashboard />}
							</ProtectedRoute>
						}
					/>

					<Route
						path="/profile"
						element={
							<ProtectedRoute requireMfa={false}>
								<ProfilePage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/orders"
						element={
							<ProtectedRoute>
								<OrdersPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/chat"
						element={
							<ProtectedRoute>
								<ChatPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/coops"
						element={
							<ProtectedRoute>
								<CoopPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/form-builder"
						element={
							<ProtectedRoute>
								<FormBuilderPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/logistics"
						element={
							<ProtectedRoute>
								<LogisticsPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/export-verification"
						element={
							<ProtectedRoute>
								<ExportApplicationPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/agro-store"
						element={
							<ProtectedRoute>
								<AgroStore />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/contracts"
						element={
							<ProtectedRoute>
								<ContractsPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/grading"
						element={
							<ProtectedRoute>
								<GradingPage />
							</ProtectedRoute>
						}
					/>

					{/* Fallback */}
					<Route path="*" element={<Navigate to="/" />} />
				</Routes>
			</main>

			<Toaster
				position="top-right"
				toastOptions={{
					duration: 4000,
					style: {
						background: "#363636",
						color: "#fff",
					},
				}}
			/>
		</div>
	);
}

function ProtectedRoute({ children, requireMfa = true }: { children: React.ReactNode, requireMfa?: boolean }) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="flex justify-center py-10">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" />;
	}

	if (requireMfa && user && !user.mfaEnabled) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
				<div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
					<div className="flex justify-center mb-4 text-yellow-500">
						<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
					</div>
					<h2 className="text-2xl font-bold mb-2 text-gray-900">Two-Factor Auth Required</h2>
					<p className="text-gray-600 mb-6">
						For security purposes, 2FA is not optional. You must enable it in your profile before continuing to your dashboard.
					</p>
					<Link to="/profile" className="w-full inline-flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
						Go to Profile to Setup 2FA
					</Link>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

import { LanguageProvider } from "./contexts/LanguageContext";

function App() {
	return (
		<LanguageProvider>
			<AuthProvider>
				<Router>
					<AppContent />
				</Router>
			</AuthProvider>
		</LanguageProvider>
	);
}

export default App;
