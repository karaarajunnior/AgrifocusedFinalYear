import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import prisma from "../db/prisma.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = "server/uploads/documents";
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, JPG, and PNG are allowed"));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// POST /export/apply - Submit export application
router.post(
    "/apply",
    authenticateToken,
    requireRole(["FARMER"]),
    requireVerified,
    upload.array("documents", 5),
    [
        body("businessName").isString().trim().isLength({ min: 2, max: 100 }),
        body("tinNumber").isString().trim().isLength({ min: 5, max: 20 }),
        body("permitNumber").optional().isString().trim(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // Check for existing application
            const existing = await prisma.exportApplication.findFirst({
                where: { userId: req.user.id, NOT: { status: "REJECTED" } },
            });

            if (existing) {
                return res.status(400).json({ error: "You already have a pending or approved application" });
            }

            const { businessName, tinNumber, permitNumber } = req.body;
            const documents = req.files.map((file) => ({
                name: file.originalname,
                path: file.path,
                type: file.mimetype,
            }));

            const application = await prisma.exportApplication.create({
                data: {
                    userId: req.user.id,
                    businessName,
                    tinNumber,
                    permitNumber,
                    documents,
                },
            });

            res.status(201).json({ message: "Export application submitted successfully", application });
        } catch (error) {
            console.error("Export application error:", error);
            res.status(500).json({ error: "Failed to submit application" });
        }
    },
);

// GET /export/my-application - Get current user's application
router.get("/my-application", authenticateToken, async (req, res) => {
    try {
        const application = await prisma.exportApplication.findFirst({
            where: { userId: req.user.id },
            orderBy: { createdAt: "desc" },
        });
        res.json({ application });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch applicationStatus" });
    }
});

// GET /export/admin/pending - List pending applications
router.get("/admin/pending", authenticateToken, requireRole(["ADMIN"]), async (req, res) => {
    try {
        const applications = await prisma.exportApplication.findMany({
            where: { status: "PENDING" },
            include: { user: { select: { name: true, email: true, phone: true } } },
            orderBy: { createdAt: "asc" },
        });
        res.json({ applications });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pending applications" });
    }
});

// PATCH /export/admin/review/:id - Approve or reject application
router.patch(
    "/admin/review/:id",
    authenticateToken,
    requireRole(["ADMIN"]),
    [
        body("status").isIn(["APPROVED", "REJECTED"]),
        body("rejectionReason").optional().isString().trim(),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { status, rejectionReason } = req.body;
            const application = await prisma.exportApplication.findUnique({
                where: { id: req.params.id },
            });

            if (!application) return res.status(404).json({ error: "Application not found" });

            const updated = await prisma.exportApplication.update({
                where: { id: req.params.id },
                data: { status, rejectionReason },
            });

            if (status === "APPROVED") {
                await prisma.user.update({
                    where: { id: application.userId },
                    data: { isExportVerified: true },
                });
            }

            res.json({ message: `Application ${status.toLowerCase()}`, application: updated });
        } catch (error) {
            console.error("Export review error:", error);
            res.status(500).json({ error: "Failed to review application" });
        }
    },
);

export default router;
