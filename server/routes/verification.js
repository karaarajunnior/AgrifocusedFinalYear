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

let openaiClient = null;
function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!openaiClient) {
		openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return openaiClient;
}

function buildVerificationPrompt(criteria) {
	return `You are a strict, objective document compliance reviewer.
Analyze this uploaded document against the policy below.

Policy criteria:
${criteria}

Output strictly JSON:
{
  "approved": boolean,
  "reason": "short explanation for approval or rejection"
}`;
}

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
						url: `data:${mimeType};base64,${base64Image}`,
					},
				},
			],
		},
	];
}

router.post("/upload", authenticateToken, upload.single("document"), async (req, res) => {
	try {
		const { documentType } = req.body;
		if (!req.file || !documentType) {
			return res.status(400).json({ success: false, error: "Missing document file or document type" });
		}

		const rule = await prisma.verificationRule.findFirst({
			where: { documentType: String(documentType), isActive: true },
			orderBy: [{ updatedAt: "desc" }],
		});
		if (!rule) {
			return res.status(400).json({
				success: false,
				error: `No active document policy found for type: ${documentType}`,
			});
		}

		const prompt = buildVerificationPrompt(rule.criteria);
		const messages = await buildOpenAIMessage(prompt, req.file.path, req.file.mimetype);

		let approved = false;
		let reason = "Automated verification failed unexpectedly.";

		try {
			const client = getOpenAI();
			if (!client) {
				reason = "Automated verification is unavailable. Please contact support.";
			} else {
				const response = await client.chat.completions.create({
					model: "gpt-4o",
					messages,
					response_format: { type: "json_object" },
				});

				const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
				approved = Boolean(parsed.approved);
				reason =
					typeof parsed.reason === "string" && parsed.reason.trim().length > 0
						? parsed.reason.trim()
						: approved
							? "Document approved by policy."
							: "Document rejected by policy.";
			}
		} catch (error) {
			console.error("Document verification automation error:", error);
			reason = "Unable to automatically review this document format.";
		}

		const status = approved ? "APPROVED" : "REJECTED";
		const savedDoc = await prisma.document.create({
			data: {
				userId: req.user.id,
				originalName: req.file.originalname,
				mimeType: req.file.mimetype,
				sizeBytes: req.file.size,
				storagePath: `/uploads/verification/${path.basename(req.file.path)}`,
				status,
				verificationLog: reason,
			},
		});

		res.json({
			success: true,
			document: savedDoc,
			reviewFeedback: { approved, reason },
		});
	} catch (error) {
		console.error("Verification upload error:", error);
		res.status(500).json({ success: false, error: "Internal server error during verification" });
	}
});

router.get("/document-types", authenticateToken, async (req, res) => {
	try {
		const documentTypes = await prisma.verificationRule.findMany({
			where: { isActive: true },
			select: {
				id: true,
				documentType: true,
			},
			orderBy: [{ updatedAt: "desc" }],
		});
		res.json({ success: true, documentTypes });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/rules/document", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { documentType, criteria } = req.body;
		if (!documentType || !criteria) {
			return res.status(400).json({ error: "documentType and criteria are required" });
		}

		await prisma.verificationRule.updateMany({
			where: { documentType: String(documentType).trim(), isActive: true },
			data: { isActive: false },
		});

		const savedRule = await prisma.verificationRule.create({
			data: {
				documentType: String(documentType).trim(),
				criteria: String(criteria).trim(),
				createdByUserId: req.user.id,
			},
		});

		res.json({
			success: true,
			message: "Document policy saved successfully",
			ruleId: savedRule.id,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/rules/registration", authenticateToken, async (req, res) => {
	if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Access denied" });
	try {
		const { criteria, requiredFields, name } = req.body;
		const normalizedRequiredFields = Array.isArray(requiredFields)
			? requiredFields.map((field) => String(field || "").trim()).filter(Boolean)
			: [];

		if (normalizedRequiredFields.length === 0 && !criteria) {
			return res.status(400).json({
				error: "Provide at least one required field or policy instruction",
			});
		}

		await prisma.registrationApprovalRule.updateMany({
			where: { isActive: true },
			data: { isActive: false },
		});

		const savedRule = await prisma.registrationApprovalRule.create({
			data: {
				name:
					typeof name === "string" && name.trim().length > 0
						? name.trim()
						: "Default registration rule",
				criteria: typeof criteria === "string" ? criteria.trim() : null,
				requiredFields: normalizedRequiredFields,
				isActive: true,
				createdByUserId: req.user.id,
			},
		});

		res.json({
			success: true,
			message: "Registration policy saved successfully",
			ruleId: savedRule.id,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/rules", authenticateToken, async (req, res) => {
	try {
		const rules = await prisma.verificationRule.findMany({
			where: { isActive: true },
			select: {
				id: true,
				documentType: true,
				createdAt: true,
			},
			orderBy: [{ updatedAt: "desc" }],
		});
		res.json({ success: true, rules });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.get("/my-documents", authenticateToken, async (req, res) => {
	try {
		const documents = await prisma.document.findMany({
			where: { userId: req.user.id },
			orderBy: { createdAt: "desc" },
		});
		res.json({ success: true, documents });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

export default router;
