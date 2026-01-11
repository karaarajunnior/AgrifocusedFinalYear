import { validationResult } from "express-validator";
import prisma from "../db/prisma.js";
import { writeAuditLog } from "../services/auditLogService.js";

export async function createCoop(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { name, location, description } = req.body;

		const group = await prisma.cooperativeGroup.create({
			data: {
				name: String(name).trim(),
				location: location ? String(location).trim() : null,
				description: description ? String(description) : null,
				createdById: req.user.id,
				members: {
					create: { userId: req.user.id, role: "ADMIN" },
				},
			},
		});

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "coop_create",
			targetType: "cooperative_group",
			targetId: group.id,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});

		res.status(201).json({ group });
	} catch (error) {
		console.error("Create coop error:", error);
		res.status(500).json({ error: "Failed to create cooperative group" });
	}
}

export async function listCoops(req, res) {
	try {
		const groups = await prisma.cooperativeGroup.findMany({
			include: {
				createdBy: { select: { id: true, name: true } },
				members: { select: { userId: true, role: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});
		res.json({
			groups: groups.map((g) => ({
				...g,
				memberCount: g.members.length,
			})),
		});
	} catch (error) {
		console.error("List coops error:", error);
		res.status(500).json({ error: "Failed to list cooperative groups" });
	}
}

export async function myCoops(req, res) {
	try {
		const memberships = await prisma.cooperativeMember.findMany({
			where: { userId: req.user.id },
			include: { group: true },
			orderBy: { joinedAt: "desc" },
		});
		res.json({ groups: memberships.map((m) => ({ ...m.group, role: m.role })) });
	} catch (error) {
		console.error("My coops error:", error);
		res.status(500).json({ error: "Failed to fetch your groups" });
	}
}

export async function joinCoop(req, res) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { groupId } = req.body;

		const group = await prisma.cooperativeGroup.findUnique({ where: { id: groupId } });
		if (!group) return res.status(404).json({ error: "Group not found" });

		const member = await prisma.cooperativeMember.upsert({
			where: { groupId_userId: { groupId, userId: req.user.id } },
			update: {},
			create: { groupId, userId: req.user.id, role: "MEMBER" },
		});

		await writeAuditLog({
			actorUserId: req.user.id,
			action: "coop_join",
			targetType: "cooperative_group",
			targetId: groupId,
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		});

		res.json({ ok: true, member });
	} catch (error) {
		console.error("Join coop error:", error);
		res.status(500).json({ error: "Failed to join group" });
	}
}

