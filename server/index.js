import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import analyticsRoutes from "./routes/analytics.js";
import aiRoutes from "./routes/ai.js";
import blockchainRoutes from "./routes/blockchain.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
const defaultAllowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:4173",
	"http://127.0.0.1:4173",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	// Common hybrid-mobile/webview origins
	"capacitor://localhost",
	"ionic://localhost",
];

const envAllowedOrigins = (process.env.CORS_ORIGINS || "")
	.split(",")
	.map((o) => o.trim())
	.filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];

app.use(
	cors({
		origin: (origin, callback) => {
			// Non-browser clients (curl, server-to-server, mobile native) may not send Origin
			if (!origin) {
				return callback(null, true);
			}

			// In development, allow any origin to avoid front/back iteration friction.
			if ((process.env.NODE_ENV || "development") !== "production") {
				return callback(null, true);
			}

			if (allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				console.warn("Blocked by CORS:", origin);
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
);

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/blockchain", blockchainRoutes);

app.get("/api/health", (req, res) => {
	res.json({
		status: "OK",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
	});
});

// Global error handler
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({
		error: "Something went wrong!",
		message:
			process.env.NODE_ENV === "development"
				? err.message
				: "Internal server error",
	});
});

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
