import express from "express";
import { body } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import { addTraceEvent, createBatch, getProductTrace } from "../controllers/traceController.js";

const router = express.Router();

// Public read (no PII): traceability timeline for a product
router.get("/product/:productId", getProductTrace);

// Farmers manage batches/events
router.post(
	"/batch",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("productId").isString(),
		body("batchCode").isString().trim().isLength({ min: 3, max: 64 }),
		body("harvestedAt").optional().isISO8601(),
	],
	createBatch,
);

router.post(
	"/event",
	authenticateToken,
	requireRole(["FARMER"]),
	requireVerified,
	[
		body("batchId").isString(),
		body("type").isString().trim().isLength({ min: 2, max: 32 }),
		body("note").optional().isString().trim().isLength({ max: 2000 }),
		body("location").optional().isString().trim().isLength({ max: 120 }),
	],
	addTraceEvent,
);

export default router;

