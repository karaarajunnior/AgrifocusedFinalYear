import express from "express";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { authenticateToken } from "../middleware/auth.js";
import {
	login,
	logout,
	me,
	mfaDisable,
	mfaSetup,
	mfaVerify,
	mfaSendOtp,
	mfaSendSetupOtp,
	refresh,
	register,
} from "../controllers/authController.js";

const router = express.Router();

const registerLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
});

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 15,
	standardHeaders: true,
	legacyHeaders: false,
});

// Register
router.post(
	"/register",
	registerLimiter,
	[
		body("email").isEmail().normalizeEmail(),
		body("password").isLength({ min: 6 }),
		body("name").trim().isLength({ min: 2 }),
		body("role").isIn(["FARMER", "BUYER", "ADMIN", "SUPERMARKET", "AGRO_SHOP"]),
		body("phone").optional({ checkFalsy: true }).isString().trim().isLength({ min: 6, max: 30 }),
		body("location").optional({ checkFalsy: true }).isString().trim().isLength({ min: 2, max: 100 }),
		body("address").optional({ checkFalsy: true }).isString().trim().isLength({ min: 2, max: 200 }),
		body("latitude").optional().isFloat({ min: -90, max: 90 }),
		body("longitude").optional().isFloat({ min: -180, max: 180 }),
	],
	register,
);

// Login
router.post(
	"/login",
	loginLimiter,
	[
		body("email").isEmail().normalizeEmail(),
		body("password").exists(),
		body("mfaCode").optional().isString().trim().isLength({ min: 4, max: 10 }),
	],
	login,
);

// Refresh access token (optional; keeps user experience smooth)
router.post(
	"/refresh",
	[body("refreshToken").exists({ checkFalsy: true }).isString().trim().isLength({ min: 20 })],
	refresh,
);

// Logout (optional; revokes refresh token)
router.post(
	"/logout",
	[body("refreshToken").optional().isString().trim().isLength({ min: 20 })],
	logout,
);

// MFA setup (generate secret + QR). Does NOT enable until verified.
router.post("/mfa/setup", authenticateToken, mfaSetup);

// Request SMS OTP code for login
router.post(
	"/mfa/send-otp",
	loginLimiter,
	[body("email").isEmail().normalizeEmail()],
	mfaSendOtp
);

// Request SMS OTP code for setup/disable
router.post("/mfa/send-setup-otp", authenticateToken, mfaSendSetupOtp);

// MFA verify/setup complete
router.post(
	"/mfa/verify",
	authenticateToken,
	[body("code").isString().trim().isLength({ min: 4, max: 10 })],
	mfaVerify,
);

router.post(
	"/mfa/disable",
	authenticateToken,
	[
		body("password").exists({ checkFalsy: true }),
		body("code").isString().trim().isLength({ min: 4, max: 10 }),
	],
	mfaDisable,
);

// Get current user
router.get("/me", authenticateToken, me);

export default router;
