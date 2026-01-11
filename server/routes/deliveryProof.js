import express from "express";
import { body } from "express-validator";
import { authenticateToken } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import { confirmProof, generateProof, getProof } from "../controllers/deliveryProofController.js";

const router = express.Router();

router.post(
	"/generate",
	authenticateToken,
	requireVerified,
	[body("orderId").isString(), body("gpsLocation").optional().isString().trim().isLength({ min: 3, max: 128 })],
	generateProof,
);

router.post(
	"/confirm",
	authenticateToken,
	requireVerified,
	[
		body("orderId").isString(),
		body("code").isString().trim().isLength({ min: 4, max: 64 }),
		body("gpsLocation").optional().isString().trim().isLength({ min: 3, max: 128 }),
	],
	confirmProof,
);

router.get("/:orderId", authenticateToken, getProof);

export default router;

