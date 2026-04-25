import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import {
	changePassword,
	getAccountReview,
	getUserProfile,
	listUsers,
	setUserVerified,
	updateAccountStatus,
	updateUserProfile,
	uploadAvatar,
	getPublicPortfolio,
} from "../controllers/usersController.js";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarUploadsDir = path.join(__dirname, "..", "uploads", "avatars");

const avatarStorage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(avatarUploadsDir, { recursive: true });
			cb(null, avatarUploadsDir);
		} catch (e) {
			cb(e);
		}
	},
	filename: (req, file, cb) => {
		const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
		cb(null, `${req.user.id}_${Date.now()}_${safe}`);
	},
});

const uploadAvatarMw = multer({
	storage: avatarStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
		if (!allowed.has(file.mimetype)) {
			return cb(new Error("Only JPG, PNG, WEBP images are allowed"));
		}
		cb(null, true);
	},
});

const router = express.Router();

// Get user profile
router.get("/profile/:id", authenticateToken, getUserProfile);

// Public Portfolio (No token required)
router.get("/public-portfolio/:id", getPublicPortfolio);

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

// Upload profile avatar
router.post("/profile/avatar", authenticateToken, uploadAvatarMw.single("avatar"), uploadAvatar);

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

// AI-assisted account review alerts for admins
router.get(
	"/account-review/alerts",
	authenticateToken,
	requireRole(["ADMIN"]),
	getAccountReview,
);

// Toggle user verification (admin only)
router.patch(
	"/:id/verify",
	authenticateToken,
	requireRole(["ADMIN"]),
	setUserVerified,
);

// Admin action: keep active, place under review, or suspend
router.patch(
	"/:id/account-status",
	authenticateToken,
	requireRole(["ADMIN"]),
	[
		body("status").isIn(["ACTIVE", "REVIEW_REQUESTED", "DISABLED"]),
		body("reason").optional().isString().trim().isLength({ max: 1000 }),
	],
	updateAccountStatus,
);

export default router;
