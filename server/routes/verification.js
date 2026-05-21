import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { evaluateDocumentUpload } from "../services/ruleAutomationService.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const verificationUploadsDir = path.join(__dirname, "..", "uploads", "verification");

const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(verificationUploadsDir, { recursive: true });
			cb(null, verificationUploadsDir);
		} catch (error) {
			cb(error);
		}
	},
	filename: (req, file, cb) => {
		const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
		cb(null, `${req.user.id}_${Date.now()}_${safe}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 8 * 1024 * 1024 },
});

/**
 * POST /api/verification/upload
 * Validates a single document using stored administrator rules.
 */
router.post("/upload", authenticateToken, upload.single("document"), async (req, res) => {
	try {
		const { documentType } = req.body;
		if (!req.file || !documentType) {
			return res.status(400).json({ success: false, error: "Missing document file or documentType" });
		}

		const rule = await prisma.verificationRule.findFirst({
			where: { documentType, isActive: true },
			orderBy: { createdAt: "desc" },
		});

		if (!rule) {
			return res.status(400).json({ success: false, error: `No active verification rules found for type: ${documentType}` });
		}

		const decision = await evaluateDocumentUpload({
			criteria: rule.criteria,
			filePath: req.file.path,
			mimeType: req.file.mimetype,
		});
		const statusEnum = decision.approved ? "APPROVED" : "REJECTED";

		const newDoc = await prisma.document.create({
			data: {
				userId: req.user.id,
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				sizeBytes: req.file.size,
				storagePath: `/uploads/verification/${path.basename(req.file.path)}`,
				aiSummary: documentType,
				status: statusEnum,
				verificationLog: decision.reason,
			}
		});

		res.json({
			success: true,
			document: newDoc,
			feedback: {
				approved: decision.approved,
				reason: decision.reason,
			},
			aiFeedback: {
				approved: decision.approved,
				reason: decision.reason,
			},
		});

	} catch (error) {
		console.error("Verification upload error:", error);
		res.status(500).json({ success: false, error: "Internal server error during verification computation" });
	}
});

// Admin route: store a private document verification rule.
router.post("/rules", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { documentType, criteria } = req.body;
		if (!documentType || !criteria) {
			return res.status(400).json({ error: "Document type and criteria are required" });
		}
		await prisma.verificationRule.updateMany({
			where: { documentType, isActive: true },
			data: { isActive: false },
		});
		const rule = await prisma.verificationRule.create({
			data: {
				documentType,
				criteria,
				createdByUserId: req.user.id
			},
			select: {
				id: true,
				documentType: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		res.json({ success: true, rule });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Return rule metadata only. Criteria stays private in the database.
router.get("/rules", authenticateToken, async (req, res) => {
	try {
		const rules = await prisma.verificationRule.findMany({
			where: { isActive: true },
			select: {
				id: true,
				documentType: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
			orderBy: { createdAt: "desc" },
		});
		res.json({ success: true, rules });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/registration-rules", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const rules = await prisma.registrationRule.findMany({
			where: { isActive: true },
			select: {
				id: true,
				name: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
			orderBy: { createdAt: "desc" },
		});
		res.json({ success: true, rules });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/registration-rules", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { name = "Registration eligibility", criteria } = req.body;
		if (!criteria) {
			return res.status(400).json({ error: "Criteria are required" });
		}
		await prisma.registrationRule.updateMany({
			where: { isActive: true },
			data: { isActive: false },
		});
		const rule = await prisma.registrationRule.create({
			data: {
				name,
				criteria,
				createdByUserId: req.user.id,
			},
			select: {
				id: true,
				name: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		res.json({ success: true, rule });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Get User's verified documents
router.get("/my-documents", authenticateToken, async (req, res) => {
	try {
		const docs = await prisma.document.findMany({
			where: { userId: req.user.id },
			orderBy: { createdAt: "desc" }
		});
		res.json({ success: true, documents: docs });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

export default router;
