/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import { toast } from "react-hot-toast";
import api from "../services/api";

interface User {
	id: string;
	name: string;
	email: string;
	role: "FARMER" | "BUYER" | "ADMIN";
	phone?: string;
	location?: string;
	address?: string;
	avatar?: string;
	verified: boolean;
	createdAt: string;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<boolean>;
	register: (data: RegisterData) => Promise<boolean>;
	logout: () => void;
	updateProfile: (data: Partial<User>) => Promise<boolean>;
	refreshUser: () => Promise<void>;
}

interface RegisterData {
	name: string;
	email: string;
	password: string;
	role: "FARMER" | "BUYER";
	phone?: string;
	location?: string;
	address?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		checkAuth();
	}, []);

	const checkAuth = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				setLoading(false);
				return;
			}

			const response = await api.get("/auth/me");
			setUser(response.data.user);
		} catch (error) {
			localStorage.removeItem("token");
			console.error("Auth check failed:", error);
		} finally {
			setLoading(false);
		}
	};

	const login = async (email: string, password: string): Promise<boolean> => {
		try {
			const response = await api.post("/auth/login", { email, password });
			const { user, token } = response.data;

			localStorage.setItem("token", token);
			setUser(user);

			toast.success(`Welcome back, ${user.name}!`);
			return true;
		} catch (error: any) {
			const message = error.response?.data?.error || "Login failed";
			toast.error(message);
			return false;
		}
	};

	const register = async (data: RegisterData): Promise<boolean> => {
		try {
			const response = await api.post("/auth/register", data);
			const { user, token } = response.data;

			localStorage.setItem("token", token);
			setUser(user);

			toast.success(`Welcome to AgriConnect, ${user.name}!`);
			return true;
		} catch (error: any) {
			const message = error.response?.data?.error || "Registration failed";
			toast.error(message);
			return false;
		}
	};

	const logout = () => {
		localStorage.removeItem("token");
		setUser(null);
		toast.success("Logged out successfully");
	};

	const updateProfile = async (data: Partial<User>): Promise<boolean> => {
		try {
			const response = await api.put("/users/profile", data);
			setUser(response.data.user);
			toast.success("Profile updated successfully");
			return true;
		} catch (error: any) {
			const message = error.response?.data?.error || "Failed to update profile";
			toast.error(message);
			return false;
		}
	};

	const refreshUser = async () => {
		try {
			const response = await api.get("/auth/me");
			setUser(response.data.user);
		} catch (error) {
			console.error("Failed to refresh user data:", error);
		}
	};

	const value = {
		user,
		loading,
		login,
		register,
		logout,
		updateProfile,
		refreshUser,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
