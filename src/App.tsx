import React, { useState, useEffect } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "react-hot-toast";

// Components
import Navbar from "./components/Navbar";
import LoadingSpinner from "./components/LoadingSpinner";

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
import AIModelPage from "./pages/AiModelpage";
import ChatPage from "./pages/ChatPage";
import CoopPage from "./pages/CoopPage";

import FormBuilderPage from "./pages/FormBuilderPage";


function AppContent() {
	const { user, loading } = useAuth();
	const [isInitialized, setIsInitialized] = useState(false);

	useEffect(() => {
		if (!loading) {
			setIsInitialized(true);
		}
	}, [loading]);

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
			<main>
				<Routes>
					{/* Public routes */}
					<Route path="/" element={<LandingPage />} />
					<Route path="/marketplace" element={<MarketplacePage />} />
					<Route path="/product/:id" element={<ProductDetails />} />

					{/* Auth routes */}
					<Route
						path="/login"
						element={
							user ? (
								<Navigate to={getDashboardRoute()} />
							) : (
								<LoginPage />
							)
						}
					/>
					<Route
						path="/register"
						element={
							user ? (
								<Navigate to={getDashboardRoute()} />
							) : (
								<RegisterPage />
							)
						}
					/>

					{/* Protected routes */}
					<Route
						path="/dashboard"
						element={
							<ProtectedRoute>
								{user?.role === "FARMER" && <FarmerDashboard />}
								{user?.role === "BUYER" && <BuyerDashboard />}
								{user?.role === "ADMIN" && <AdminDashboard />}
							</ProtectedRoute>
						}
					/>
					<Route
						path="/profile"
						element={
							<ProtectedRoute>
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
						path="/ai-models"
						element={
							<ProtectedRoute>
								<AIModelPage />
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();

	if (loading) {
		return <LoadingSpinner size="lg" />;
	}

	if (!user) {
		return <Navigate to="/login" />;
	}

	return <>{children}</>;
}

function getDashboardRoute() {
	return "/dashboard";
}

function App() {
	return (
		<AuthProvider>
			<Router>
				<AppContent />
			</Router>
		</AuthProvider>
	);
}

export default App;
