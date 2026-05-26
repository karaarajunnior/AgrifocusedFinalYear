import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../db/prisma.js";
import { evaluateDocumentUpload } from "../services/ruleAutomationService.js";
import {
	getDefaultRequiredFields,
	upsertRegistrationAutomationRule,
} from "../services/registrationAutomationService.js";

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
// Lazy-initialize OpenAI so it only runs after dotenv has loaded all env vars
let _openai = null;
function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!_openai) {
		_openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return _openai;
}

function buildVerificationPrompt(criteria) {
	return `You are a strict, objective document verification assistant.
Your task is to analyze the provided document or image against the hidden administrator policy.

Rules to evaluate:
${criteria}

Output strictly in JSON format matching this schema:
{
  "approved": boolean,
  "reason": "String explaining why it was approved or rejected based exactly on the criteria"
}`;
}

function parseVerificationResult(content) {
	try {
		const parsed = JSON.parse(content || "{}");
		return {
			approved: Boolean(parsed.approved),
			reason:
				typeof parsed.reason === "string" && parsed.reason.trim()
					? parsed.reason.trim()
					: "The automated review completed without a detailed reason.",
		};
	} catch {
		return {
			approved: false,
			reason: "The automated review returned an unreadable response.",
		};
	}
}

async function saveDocumentRule({ adminUserId, documentType, criteria }) {
	await prisma.$transaction([
		prisma.verificationRule.updateMany({
			where: { documentType, isActive: true },
			data: { isActive: false },
		}),
		prisma.verificationRule.create({
			data: {
				documentType,
				criteria,
				createdByUserId: adminUserId,
				isActive: true,
			},
		}),
	]);
}

/**
 * Utility to build OpenAI multimodal message
 */
async function buildOpenAIMessage(prompt, filePath, mimeType) {
	const base64Image = (await fs.readFile(filePath)).toString("base64");
	return [
		{
			role: "user",
			content: [
				{ type: "text", text: prompt },
				{
					type: "image_url",
					image_url: {
						url: `data:${mimeType};base64,${base64Image}`
					}
				}
			]
		}
	];
}

router.post("/upload", authenticateToken, upload.single("document"), async (req, res) => {
	try {
		const { documentType } = req.body;
		if (!req.file || !documentType) {
			return res.status(400).json({ success: false, error: "Missing document file or documentType" });
		}

		const rule = await prisma.verificationRule.findFirst({
			where: { documentType, isActive: true },
			orderBy: { createdAt: "desc" },
			orderBy: { updatedAt: "desc" },
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
		const prompt = buildVerificationPrompt(rule.criteria);
		const messages = await buildOpenAIMessage(prompt, req.file.path, req.file.mimetype);

		let statusEnum = "PENDING";
		let reviewReason = "The document was queued for review.";

		try {
			const openaiClient = getOpenAI();
			if (!openaiClient) {
				reviewReason = "Automatic review is currently unavailable. The document has been queued for review.";
			} else {
				const response = await openaiClient.chat.completions.create({
					model: "gpt-4o",
					messages: messages,
					response_format: { type: "json_object" },
				});

				const result = parseVerificationResult(response.choices?.[0]?.message?.content);
				statusEnum = result.approved ? "APPROVED" : "REJECTED";
				reviewReason = result.reason;
			}
		} catch (aiError) {
			console.error("OpenAI Verification Error:", aiError);
			reviewReason = "Automatic review could not analyze this document. The submission has been queued for review.";
		}

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
				aiSummary: documentType,
				verificationLog: reviewReason,
			},
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
			verificationFeedback: {
				status: statusEnum,
				reason: reviewReason,
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
			return res.status(400).json({ error: "documentType and criteria are required" });
		}

		await saveDocumentRule({
			adminUserId: req.user.id,
			documentType: String(documentType).trim(),
			criteria: String(criteria).trim(),
		});

		res.json({ success: true, message: "Document policy saved to the database." });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/rules/registration", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { targetRole, criteria, requiredFields } = req.body;
		if (!targetRole || !criteria) {
			return res.status(400).json({ error: "targetRole and criteria are required" });
		}

		const rule = await upsertRegistrationAutomationRule({
			adminUserId: req.user.id,
			targetRole: String(targetRole).trim().toUpperCase(),
			requiredFields,
			criteria,
		});

		res.json({
			success: true,
			message: "Registration policy saved to the database.",
			policy: {
				targetRole: rule.targetRole,
				requiredFields: Array.isArray(rule.requiredFields)
					? rule.requiredFields
					: getDefaultRequiredFields(rule.targetRole),
			},
		});
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
			select: { id: true, documentType: true },
			orderBy: { documentType: "asc" },
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
			orderBy: { createdAt: "desc" },
		});
		res.json({
			success: true,
			documents: docs.map((doc) => ({
				id: doc.id,
				type: doc.aiSummary || doc.originalName,
				status: doc.status,
				verificationLog: doc.verificationLog,
				createdAt: doc.createdAt,
			})),
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

export default router;
