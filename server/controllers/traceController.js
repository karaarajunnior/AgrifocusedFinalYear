import { body, validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";

export async function createBatch(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { productId, batchCode, harvestedAt } = req.body;

		const product = await prisma.product.findUnique({
			where: { id: productId },
			select: { id: true, farmerId: true },
		});
		if (!product) return res.status(404).json({ error: "Product not found" });
		if (product.farmerId !== req.user.id) return res.status(403).json({ error: "Not authorized" });

		const batch = await prisma.productBatch.create({
			data: {
				productId,
				batchCode: String(batchCode).trim(),
				harvestedAt: harvestedAt ? new Date(harvestedAt) : null,
				events: {
					create: [
						{
							type: "created",
							note: "Batch created",
							location: null,
						},
					],
				},
			},
		});

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "trace_batch_create",
			targetType: "product",
			targetId: productId,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { batchId: batch.id },
		});

		res.status(201).json({ batch });
	} catch (error) {
		console.error("Create batch error:", error);
		res.status(500).json({ error: "Failed to create batch" });
	}
}

export async function addTraceEvent(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { batchId, type, note, location } = req.body;
		const batch = await prisma.productBatch.findUnique({
			where: { id: batchId },
			include: { product: { select: { farmerId: true } } },
		});
		if (!batch) return res.status(404).json({ error: "Batch not found" });
		if (batch.product.farmerId !== req.user.id) return res.status(403).json({ error: "Not authorized" });

		const event = await prisma.traceEvent.create({
			data: {
				batchId,
				type: String(type).trim(),
				note: note ? String(note) : null,
				location: location ? String(location) : null,
			},
		});

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "trace_event_add",
			targetType: "product_batch",
			targetId: batchId,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
			metadata: { eventId: event.id, type: event.type },
		});

		res.status(201).json({ event });
	} catch (error) {
		console.error("Add trace event error:", error);
		res.status(500).json({ error: "Failed to add trace event" });
	}
}

export async function getProductTrace(req, res) {
	try {
		const productId = String(req.params.productId || "");
		if (!productId) return res.status(400).json({ error: "productId required" });

		const product = await prisma.product.findUnique({
			where: { id: productId },
			select: { id: true, farmerId: true },
		});
		if (!product) return res.status(404).json({ error: "Product not found" });

		// Public readable: traceability is a selling point (no PII)
		const batches = await prisma.productBatch.findMany({
			where: { productId },
			include: { events: { orderBy: { createdAt: "asc" } } },
			orderBy: { createdAt: "desc" },
			take: 20,
		});

		res.json({ productId, batches });
	} catch (error) {
		console.error("Get product trace error:", error);
		res.status(500).json({ error: "Failed to fetch traceability" });
	}
}

