import axios from "axios";
import { toast } from "react-hot-toast";

const API_BASE_URL =
	import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const api = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	method:[ "get","patch","post","delete","put"],
});

// Request interceptor to add auth token
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Response interceptor to handle errors
api.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			localStorage.removeItem("token");
			if (window.location.pathname !== "/login") {
				window.location.href = "/login";
			}
		}

		if (error.response?.status >= 500) {
			toast.error("Server error. Please try again later.");
		}

		return Promise.reject(error);
	},
);

export default api;
