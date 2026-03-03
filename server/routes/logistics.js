import express from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { requireVerified } from "../middleware/verified.js";
import prisma from "../db/prisma.js";

const router = express.Router();

// POST /logistics/schedules — Buyer/aggregator posts a collection schedule
router.post(
    "/schedules",
    authenticateToken,
    requireRole(["BUYER", "ADMIN"]),
    requireVerified,
    [
        body("title").isString().trim().isLength({ min: 3, max: 120 }),
        body("subcounty").isString().trim().isLength({ min: 2, max: 120 }),
        body("district").optional().isString().trim().isLength({ min: 2, max: 120 }),
        body("collectionDate").isISO8601(),
        body("vehicleType").optional().isIn(["truck", "pickup", "motorcycle"]),
        body("maxCapacityKg").optional().isInt({ min: 50, max: 50000 }),
        body("pricePerKg").optional().isFloat({ min: 0 }),
        body("notes").optional().trim().isLength({ max: 2000 }),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { title, subcounty, district, collectionDate, vehicleType, maxCapacityKg, pricePerKg, notes } = req.body;

            const schedule = await prisma.collectionSchedule.create({
                data: {
                    title,
                    subcounty,
                    district: district || "Jinja",
                    collectionDate: new Date(collectionDate),
                    vehicleType: vehicleType || "truck",
                    maxCapacityKg: maxCapacityKg || 5000,
                    pricePerKg: pricePerKg || null,
                    notes,
                    postedById: req.user.id,
                },
                include: {
                    postedBy: { select: { id: true, name: true, phone: true, location: true } },
                },
            });

            res.status(201).json({ message: "Collection schedule posted", schedule });
        } catch (error) {
            console.error("Create schedule error:", error);
            res.status(500).json({ error: "Failed to create collection schedule" });
        }
    },
);

// GET /logistics/schedules — List open collection schedules
router.get("/schedules", authenticateToken, async (req, res) => {
    try {
        const { subcounty, status, district } = req.query;

        const where = {};
        if (subcounty) where.subcounty = { contains: subcounty };
        if (district) where.district = { contains: district };
        if (status) where.status = status;
        else where.status = { in: ["OPEN", "FULL", "IN_PROGRESS"] };

        const schedules = await prisma.collectionSchedule.findMany({
            where,
            include: {
                postedBy: { select: { id: true, name: true, phone: true, location: true } },
                requests: {
                    include: {
                        farmer: { select: { id: true, name: true, phone: true, location: true } },
                    },
                },
            },
            orderBy: { collectionDate: "asc" },
        });

        res.json({ schedules });
    } catch (error) {
        console.error("List schedules error:", error);
        res.status(500).json({ error: "Failed to list collection schedules" });
    }
});

// GET /logistics/schedules/:id — Get single schedule with farmer requests
router.get("/schedules/:id", authenticateToken, async (req, res) => {
    try {
        const schedule = await prisma.collectionSchedule.findUnique({
            where: { id: req.params.id },
            include: {
                postedBy: { select: { id: true, name: true, phone: true, location: true } },
                requests: {
                    include: {
                        farmer: { select: { id: true, name: true, phone: true, location: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!schedule) return res.status(404).json({ error: "Schedule not found" });
        res.json({ schedule });
    } catch (error) {
        console.error("Get schedule error:", error);
        res.status(500).json({ error: "Failed to fetch schedule" });
    }
});

// POST /logistics/schedules/:id/request — Farmer requests to join a collection
router.post(
    "/schedules/:id/request",
    authenticateToken,
    requireRole(["FARMER"]),
    requireVerified,
    [
        body("quantityKg").isInt({ min: 1 }),
        body("pickupLocation").optional().isString().trim().isLength({ max: 200 }),
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const schedule = await prisma.collectionSchedule.findUnique({
                where: { id: req.params.id },
            });
            if (!schedule) return res.status(404).json({ error: "Schedule not found" });
            if (schedule.status !== "OPEN") {
                return res.status(400).json({ error: "This collection schedule is no longer accepting requests" });
            }

            const { quantityKg, pickupLocation } = req.body;
            const remainingCapacity = schedule.maxCapacityKg - schedule.currentBookedKg;
            if (quantityKg > remainingCapacity) {
                return res.status(400).json({
                    error: `Insufficient capacity. Only ${remainingCapacity} kg remaining.`,
                });
            }

            // Check for duplicate request
            const existing = await prisma.collectionRequest.findUnique({
                where: {
                    scheduleId_farmerId: {
                        scheduleId: schedule.id,
                        farmerId: req.user.id,
                    },
                },
            });
            if (existing) {
                return res.status(400).json({ error: "You have already requested to join this collection" });
            }

            const request = await prisma.collectionRequest.create({
                data: {
                    scheduleId: schedule.id,
                    farmerId: req.user.id,
                    quantityKg,
                    pickupLocation,
                },
                include: {
                    farmer: { select: { id: true, name: true, phone: true, location: true } },
                },
            });

            // Update booked capacity
            const newBooked = schedule.currentBookedKg + quantityKg;
            const newStatus = newBooked >= schedule.maxCapacityKg ? "FULL" : "OPEN";
            await prisma.collectionSchedule.update({
                where: { id: schedule.id },
                data: {
                    currentBookedKg: newBooked,
                    status: newStatus,
                },
            });

            res.status(201).json({ message: "Collection request submitted", request });
        } catch (error) {
            console.error("Create request error:", error);
            res.status(500).json({ error: "Failed to submit collection request" });
        }
    },
);

// PATCH /logistics/requests/:id/status — Buyer/poster accepts or rejects a request
router.patch(
    "/requests/:id/status",
    authenticateToken,
    requireRole(["BUYER", "ADMIN"]),
    [body("status").isIn(["ACCEPTED", "REJECTED", "COLLECTED"])],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const request = await prisma.collectionRequest.findUnique({
                where: { id: req.params.id },
                include: { schedule: true },
            });

            if (!request) return res.status(404).json({ error: "Request not found" });

            // Only the poster or admin can update
            if (request.schedule.postedById !== req.user.id && req.user.role !== "ADMIN") {
                return res.status(403).json({ error: "Not authorized" });
            }

            const { status } = req.body;

            // If rejecting, reduce booked capacity
            if (status === "REJECTED" && request.status !== "REJECTED") {
                const newBooked = Math.max(0, request.schedule.currentBookedKg - request.quantityKg);
                await prisma.collectionSchedule.update({
                    where: { id: request.scheduleId },
                    data: {
                        currentBookedKg: newBooked,
                        status: newBooked < request.schedule.maxCapacityKg ? "OPEN" : request.schedule.status,
                    },
                });
            }

            const updated = await prisma.collectionRequest.update({
                where: { id: req.params.id },
                data: { status },
                include: {
                    farmer: { select: { id: true, name: true, phone: true, location: true } },
                },
            });

            res.json({ message: "Request status updated", request: updated });
        } catch (error) {
            console.error("Update request status error:", error);
            res.status(500).json({ error: "Failed to update request status" });
        }
    },
);

// PATCH /logistics/schedules/:id/status — Update schedule status
router.patch(
    "/schedules/:id/status",
    authenticateToken,
    requireRole(["BUYER", "ADMIN"]),
    [body("status").isIn(["OPEN", "FULL", "IN_PROGRESS", "COMPLETED", "CANCELLED"])],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const schedule = await prisma.collectionSchedule.findUnique({
                where: { id: req.params.id },
            });
            if (!schedule) return res.status(404).json({ error: "Schedule not found" });
            if (schedule.postedById !== req.user.id && req.user.role !== "ADMIN") {
                return res.status(403).json({ error: "Not authorized" });
            }

            const updated = await prisma.collectionSchedule.update({
                where: { id: req.params.id },
                data: { status: req.body.status },
                include: {
                    postedBy: { select: { id: true, name: true } },
                    requests: {
                        include: {
                            farmer: { select: { id: true, name: true, phone: true } },
                        },
                    },
                },
            });

            res.json({ message: "Schedule status updated", schedule: updated });
        } catch (error) {
            console.error("Update schedule status error:", error);
            res.status(500).json({ error: "Failed to update schedule status" });
        }
    },
);

// GET /logistics/my-requests — Farmer's own collection requests
router.get("/my-requests", authenticateToken, async (req, res) => {
    try {
        const requests = await prisma.collectionRequest.findMany({
            where: { farmerId: req.user.id },
            include: {
                schedule: {
                    include: {
                        postedBy: { select: { id: true, name: true, phone: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ requests });
    } catch (error) {
        console.error("My requests error:", error);
        res.status(500).json({ error: "Failed to fetch your collection requests" });
    }
});

export default router;
