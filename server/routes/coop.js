import express from "express";
import { body } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import { createCoop, joinCoop, listCoops, myCoops } from "../controllers/coopController.js";

const router = express.Router();

router.get("/", authenticateToken, listCoops);
router.get("/mine", authenticateToken, myCoops);

router.post(
	"/",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("name").isString().trim().isLength({ min: 3, max: 80 }),
		body("location").optional().isString().trim().isLength({ min: 2, max: 120 }),
		body("description").optional().isString().trim().isLength({ min: 0, max: 5000 }),
	],
	createCoop,
);

router.post(
	"/join",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[body("groupId").isString()],
	joinCoop,
);

export default router;

