import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { authenticateToken } from "../middleware/auth.js";
import prisma from "../db/prisma.js";

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
		const messages = await buildOpenAIMessage(prompt, req.file.path, req.file.mimetype);

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
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				sizeBytes: req.file.size,
				storagePath: `/uploads/verification/${path.basename(req.file.path)}`,
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

// Lightweight public-ish list of acceptable document types only.
// Criteria are intentionally never exposed: rules live in the DB and are
// configured by admins through internal endpoints, not through any UI.
router.get("/rules", authenticateToken, async (req, res) => {
	try {
		const rules = await prisma.verificationRule.findMany({
			where: { isActive: true },
			select: { id: true, documentType: true },
		});
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
