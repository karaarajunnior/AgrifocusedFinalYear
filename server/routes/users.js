import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import {
	changePassword,
	getUserProfile,
	listUsers,
	setUserVerified,
	updateUserProfile,
} from "../controllers/usersController.js";

const router = express.Router();

// Get user profile
router.get("/profile/:id", authenticateToken, getUserProfile);

// Update user profile
router.put(
	"/profile",
	authenticateToken,
	[
		body("name").optional().trim().isLength({ min: 2, max: 50 }),
		body("phone").optional().isMobilePhone(),
		body("location").optional().trim().isLength({ min: 2, max: 100 }),
		body("address").optional().trim().isLength({ max: 200 }),
		body("walletAddress").optional().isString().trim().isLength({ min: 10, max: 64 }),
		body("autoFulfillOnPayment").optional().isBoolean(),
		body("notifySms").optional().isBoolean(),
		body("notifyWhatsapp").optional().isBoolean(),
		body("notifyChat").optional().isBoolean(),
		body("notifyPayment").optional().isBoolean(),
		body("notifyOrder").optional().isBoolean(),
	],
	updateUserProfile,
);

// Change password
router.put(
	"/change-password",
	authenticateToken,
	[
		body("currentPassword").exists({ checkFalsy: true }),
		body("newPassword")
			.isLength({ min: 6 })
			.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
	],
	changePassword,
);

// Get all users (admin only)
router.get("/", authenticateToken, requireRole(["ADMIN"]), listUsers);

// Toggle user verification (admin only)
router.patch(
	"/:id/verify",
	authenticateToken,
	requireRole(["ADMIN"]),
	setUserVerified,
);

export default router;
