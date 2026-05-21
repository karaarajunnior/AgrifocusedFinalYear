import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import {
	REGISTRATION_RULE_TYPE,
	evaluateDocumentSubmission,
	getActiveRule,
	saveRule,
} from "../services/approvalRulesService.js";

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
	fileFilter: (req, file, cb) => {
		const allowed = new Set([
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"text/plain",
		]);
		if (!allowed.has(file.mimetype)) {
			return cb(new Error("Only JPG, PNG, WEBP, PDF, DOCX, or TXT files are allowed"));
		}
		cb(null, true);
	},
});

async function extractText(filePath, mimeType) {
	const buffer = await fs.readFile(filePath);
	if (mimeType === "application/pdf") {
		const data = await PDFParse(buffer);
		return data.text || "";
	}
	if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
		const data = await mammoth.extractRawText({ buffer });
		return data.value || "";
	}
	if (mimeType.startsWith("text/")) {
		return buffer.toString("utf-8");
	}
	return "";
}

async function buildSubmissionInput(file) {
	if (file.mimetype.startsWith("image/")) {
		const base64Image = (await fs.readFile(file.path)).toString("base64");
		return {
			image: { dataUrl: `data:${file.mimetype};base64,${base64Image}` },
			text: "",
		};
	}

	return {
		image: null,
		text: await extractText(file.path, file.mimetype),
	};
}

/**
 * POST /api/verification/upload
 * Validates a single document using configured review rules.
 */
router.post("/upload", authenticateToken, upload.single("document"), async (req, res) => {
	try {
		const { title, documentType } = req.body;
		if (!req.file || !documentType) {
			return res.status(400).json({ success: false, error: "Missing document file or documentType" });
		}

		const rule = await getActiveRule(documentType);

		if (!rule) {
			return res.status(400).json({ success: false, error: `No active verification rules found for type: ${documentType}` });
		}

		const submission = await buildSubmissionInput(req.file);
		const decision = await evaluateDocumentSubmission({
			documentType,
			criteria: rule.criteria,
			text: submission.text,
			image: submission.image,
		});

		const newDoc = await prisma.document.create({
			data: {
				userId: req.user.id,
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				sizeBytes: req.file.size,
				storagePath: `/uploads/verification/${path.basename(req.file.path)}`,
				extractedText: submission.text || null,
				aiSummary: documentType,
				status: decision.status,
				verificationLog: decision.reason,
			}
		});

		if (decision.status === "APPROVED") {
			await prisma.user.update({
				where: { id: req.user.id },
				data: {
					verified: true,
					accountStatus: "ACTIVE",
					accountStatusReason: null,
					accountStatusChangedAt: new Date(),
				},
			});
		} else if (decision.status === "REJECTED") {
			await prisma.user.update({
				where: { id: req.user.id },
				data: {
					accountStatus: "REVIEW_REQUESTED",
					accountStatusReason: decision.reason,
					accountStatusChangedAt: new Date(),
				},
			});
		}

		res.json({
			success: true,
			document: newDoc,
			decision,
			aiFeedback: {
				approved: decision.approved,
				reason: decision.reason
			},
		});

	} catch (error) {
		console.error("Verification upload error:", error);
		res.status(500).json({ success: false, error: "Internal server error during verification review" });
	}
});

// Admin Route: Save registration review rule. Criteria remain server-side only.
router.post("/registration-rule", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
	try {
		const criteria = String(req.body.criteria || "").trim();
		if (criteria.length < 10) {
			return res.status(400).json({ error: "Registration rule must be at least 10 characters" });
		}

		await saveRule({
			documentType: REGISTRATION_RULE_TYPE,
			criteria,
			createdByUserId: req.user.id,
		});
		res.json({ success: true, message: "Registration rule saved" });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Admin Route: Create or replace a document verification rule. Criteria remain server-side only.
router.post("/rules", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
	try {
		const documentType = String(req.body.documentType || "").trim();
		const criteria = String(req.body.criteria || "").trim();
		if (documentType.length < 2 || criteria.length < 10) {
			return res.status(400).json({ error: "Document type and review criteria are required" });
		}
		if (documentType === REGISTRATION_RULE_TYPE) {
			return res.status(400).json({ error: "Use the registration rule endpoint for account rules" });
		}

		const rule = await saveRule({
			documentType,
			criteria,
			createdByUserId: req.user.id,
		});
		res.json({
			success: true,
			rule: {
				id: rule.id,
				documentType: rule.documentType,
				isActive: rule.isActive,
				createdAt: rule.createdAt,
			},
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Get active document categories only. Rule criteria are never returned to the UI.
router.get("/rules", authenticateToken, async (req, res) => {
	try {
		const rules = await prisma.verificationRule.findMany();
		const safeRules = rules
			.filter((rule) => rule.isActive && rule.documentType !== REGISTRATION_RULE_TYPE)
			.map((rule) => ({
				id: rule.id,
				documentType: rule.documentType,
				isActive: rule.isActive,
				createdAt: rule.createdAt,
			}));
		res.json({ success: true, rules: safeRules });
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
