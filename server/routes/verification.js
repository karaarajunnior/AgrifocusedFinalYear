import express from "express";
import multer from "multer";
import OpenAI from "openai";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../db/prisma.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Lazy-initialize OpenAI so it only runs after dotenv has loaded all env vars
let _openai = null;
function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!_openai) {
		_openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return _openai;
}

/**
 * Creates a generic prompt for Gemini based on custom Verification Rules
 */
function buildVerificationPrompt(criteria) {
	return `You are a strict, objective document verification assistant.
Your task is to analyze the provided document/image based on the administrator's criteria.

Rules to evaluate:
${criteria}

Output strictly in JSON format matching this schema:
{
  "approved": boolean,
  "reason": "String explaining why it was approved or rejected based exactly on the criteria"
}
`;
}

/**
 * Utility to build OpenAI multimodal message
 */
function buildOpenAIMessage(prompt, buffer, mimeType) {
	const base64Image = buffer.toString("base64");
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

/**
 * POST /api/verification/upload
 * Validates a single document using Google Gemini Vision
 */
router.post("/upload", authenticateToken, upload.single("document"), async (req, res) => {
	try {
		const { title, documentType } = req.body;
		if (!req.file || !documentType) {
			return res.status(400).json({ success: false, error: "Missing document file or documentType" });
		}

		const rule = await prisma.verificationRule.findFirst({
			where: { documentType, isActive: true }
		});

		if (!rule) {
			return res.status(400).json({ success: false, error: `No active verification rules found for type: ${documentType}` });
		}

		console.log(`Starting AI verification for ${documentType} using OpenAI...`);
		const prompt = buildVerificationPrompt(rule.criteria);
		const messages = buildOpenAIMessage(prompt, req.file.buffer, req.file.mimetype);

		let aiApproved = false;
		let aiReason = "Verification failed unexpectedly.";

		try {
			const openaiClient = getOpenAI();
			if (!openaiClient) {
				aiReason = "AI verification unavailable (API key not configured). Document queued for manual review.";
			} else {
				const response = await openaiClient.chat.completions.create({
					model: "gpt-4o",
					messages: messages,
					response_format: { type: "json_object" }
				});
				
				const result = JSON.parse(response.choices[0].message.content);
				aiApproved = result.approved;
				aiReason = result.reason;
			}
		} catch (aiError) {
			console.error("OpenAI Verification Error:", aiError);
			aiReason = "AI engine failed to analyze the document format.";
		}

		const statusEnum = aiApproved ? "APPROVED" : "REJECTED";

		const newDoc = await prisma.document.create({
			data: {
				userId: req.user.id,
				title: title || `${documentType} Upload`,
				type: documentType,
				fileUrl: "local_buffer_discarded_for_demo", // Assuming no cloud storage for now
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				sizeBytes: req.file.size,
				storagePath: "memory",
				status: statusEnum,
				verificationLog: aiReason,
			}
		});

		res.json({
			success: true,
			document: newDoc,
			aiFeedback: {
				approved: aiApproved,
				reason: aiReason
			}
		});

	} catch (error) {
		console.error("Verification upload error:", error);
		res.status(500).json({ success: false, error: "Internal server error during verification computation" });
	}
});

// Admin Route: Create new verification rule
router.post("/rules", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { documentType, criteria } = req.body;
		const rule = await prisma.verificationRule.create({
			data: {
				documentType,
				criteria,
				createdByUserId: req.user.id
			}
		});
		res.json({ success: true, rule });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Get all rules (for Admin dashboard or lookup)
router.get("/rules", authenticateToken, async (req, res) => {
	try {
		const rules = await prisma.verificationRule.findMany();
		res.json({ success: true, rules });
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
