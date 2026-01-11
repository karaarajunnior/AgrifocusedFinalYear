import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";

const prisma = new PrismaClient();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads", "docs");
const serverUploadsRoot = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(uploadsDir, { recursive: true });
			cb(null, uploadsDir);
		} catch (e) {
			cb(e);
		}
	},
	filename: (req, file, cb) => {
		const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
		const name = `${Date.now()}_${safe}`;
		cb(null, name);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
	fileFilter: (req, file, cb) => {
		const allowed = new Set([
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"text/plain",
		]);
		if (!allowed.has(file.mimetype)) {
			return cb(new Error("Only PDF, DOCX, or TXT files are allowed"));
		}
		cb(null, true);
	},
});

async function extractText(filePath, mimeType) {
	const buf = await fs.readFile(filePath);

	if (mimeType === "application/pdf") {
		const data = await pdfParse(buf);
		return data.text || "";
	}

	if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		const res = await mammoth.extractRawText({ buffer: buf });
		return res.value || "";
	}

	if (mimeType.startsWith("text/")) {
		return buf.toString("utf-8");
	}

	return "";
}

router.post(
	"/upload",
	authenticateToken,
	requireVerified,
	upload.single("file"),
	async (req, res) => {
		try {
			if (!req.file) return res.status(400).json({ error: "File required" });

			const extractedText = await extractText(req.file.path, req.file.mimetype);

			const doc = await prisma.document.create({
				data: {
					userId: req.user.id,
					originalName: req.file.originalname,
					mimeType: req.file.mimetype,
					sizeBytes: req.file.size,
					storagePath: `/uploads/docs/${path.basename(req.file.path)}`,
					extractedText,
				},
			});

			res.status(201).json({
				message: "Document uploaded",
				document: doc,
			});
		} catch (error) {
			console.error("Upload document error:", error);
			res.status(500).json({ error: "Failed to upload document" });
		}
	},
);

router.get("/", authenticateToken, async (req, res) => {
	try {
		const docs = await prisma.document.findMany({
			where: { userId: req.user.id },
			orderBy: { createdAt: "desc" },
		});
		res.json({ documents: docs });
	} catch (error) {
		console.error("List documents error:", error);
		res.status(500).json({ error: "Failed to fetch documents" });
	}
});

router.get("/:id", authenticateToken, async (req, res) => {
	try {
		const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
		if (!doc) return res.status(404).json({ error: "Document not found" });

		const hasAccess = doc.userId === req.user.id || req.user.role === "ADMIN";
		if (!hasAccess) return res.status(403).json({ error: "Access denied" });

		res.json({ document: doc });
	} catch (error) {
		console.error("Get document error:", error);
		res.status(500).json({ error: "Failed to fetch document" });
	}
});

// Download original document file
router.get("/:id/download", authenticateToken, async (req, res) => {
	try {
		const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
		if (!doc) return res.status(404).json({ error: "Document not found" });

		const hasAccess = doc.userId === req.user.id || req.user.role === "ADMIN";
		if (!hasAccess) return res.status(403).json({ error: "Access denied" });

		// storagePath is like /uploads/docs/<filename>
		const rel = doc.storagePath.replace(/^\/uploads\//, "");
		const absPath = path.join(serverUploadsRoot, rel);

		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${doc.originalName.replace(/"/g, "")}"`,
		);
		res.setHeader("Content-Type", doc.mimeType);
		return res.sendFile(absPath);
	} catch (error) {
		console.error("Download document error:", error);
		res.status(500).json({ error: "Failed to download document" });
	}
});

export default router;

