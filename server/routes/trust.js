import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getTrustScore } from "../controllers/trustController.js";

const router = express.Router();

// Any authenticated user can view a trust score (no sensitive PII included)
router.get("/:userId", authenticateToken, getTrustScore);

export default router;

