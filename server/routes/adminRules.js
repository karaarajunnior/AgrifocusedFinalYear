import express from "express";
import prisma from "../db/prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import {
	ensureDefaultRegistrationRules,
	evaluateRegistration,
} from "../services/registrationRuleService.js";

/**
 * Internal administration endpoints for managing automation rules.
 *
 * Rules are intentionally not surfaced in any front-end page; administrators
 * configure them via these REST endpoints (or seeded defaults). The frontend
 * never lists or edits them, by design.
 */

const router = express.Router();

function requireAdmin(req, res, next) {
	if (!req.user) return res.status(401).json({ error: "Authentication required" });
	if (req.user.role !== "ADMIN") {
		return res.status(403).json({ error: "Admin access required" });
	}
	next();
}

function serializeRule(rule) {
	let config = {};
	try {
		config = rule.config ? JSON.parse(rule.config) : {};
	} catch {
		config = {};
	}
	return {
		id: rule.id,
		name: rule.name,
		ruleType: rule.ruleType,
		appliesToRole: rule.appliesToRole,
		action: rule.action,
		reason: rule.reason,
		priority: rule.priority,
		isActive: rule.isActive,
		config,
		createdAt: rule.createdAt,
		updatedAt: rule.updatedAt,
	};
}

// ------------------------- Registration rules --------------------------------

router.get(
	"/registration",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const rules = await prisma.registrationRule.findMany({
				orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
			});
			res.json({ rules: rules.map(serializeRule) });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.post(
	"/registration",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const {
				name,
				ruleType,
				appliesToRole = null,
				action = "APPROVE",
				reason = null,
				priority = 0,
				isActive = true,
				config = {},
			} = req.body || {};

			if (!name || !ruleType) {
				return res
					.status(400)
					.json({ error: "name and ruleType are required" });
			}

			const rule = await prisma.registrationRule.create({
				data: {
					name,
					ruleType,
					appliesToRole,
					action: String(action).toUpperCase(),
					reason,
					priority: Number(priority) || 0,
					isActive: Boolean(isActive),
					config: JSON.stringify(config || {}),
					createdByUserId: req.user.id,
				},
			});

			res.status(201).json({ rule: serializeRule(rule) });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.patch(
	"/registration/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const { id } = req.params;
			const data = { ...req.body };
			if (data.config && typeof data.config !== "string") {
				data.config = JSON.stringify(data.config);
			}
			if (data.action) data.action = String(data.action).toUpperCase();
			if (data.priority !== undefined) data.priority = Number(data.priority) || 0;
			if (data.isActive !== undefined) data.isActive = Boolean(data.isActive);
			delete data.id;
			delete data.createdAt;
			delete data.updatedAt;

			const rule = await prisma.registrationRule.update({
				where: { id },
				data,
			});
			res.json({ rule: serializeRule(rule) });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.delete(
	"/registration/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			await prisma.registrationRule.delete({ where: { id: req.params.id } });
			res.json({ ok: true });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.post(
	"/registration/seed-defaults",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			await ensureDefaultRegistrationRules();
			res.json({ ok: true });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.post(
	"/registration/test",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const decision = await evaluateRegistration(req.body || {});
			res.json({ decision });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.get(
	"/registration/decisions",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const limit = Math.min(Number(req.query.limit) || 50, 200);
			const decisions = await prisma.registrationDecision.findMany({
				orderBy: { createdAt: "desc" },
				take: limit,
			});
			res.json({ decisions });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

// ------------------------- Document verification rules -----------------------
// These rules drive the document validator. They are stored in the database
// and intentionally hidden from any UI; admins manage them through this API.

router.get(
	"/verification",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const rules = await prisma.verificationRule.findMany({
				orderBy: { createdAt: "desc" },
			});
			res.json({ rules });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.post(
	"/verification",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const { documentType, criteria, isActive = true } = req.body || {};
			if (!documentType || !criteria) {
				return res
					.status(400)
					.json({ error: "documentType and criteria are required" });
			}
			const rule = await prisma.verificationRule.create({
				data: {
					documentType,
					criteria,
					isActive: Boolean(isActive),
					createdByUserId: req.user.id,
				},
			});
			res.status(201).json({ rule });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.patch(
	"/verification/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const data = { ...req.body };
			delete data.id;
			delete data.createdAt;
			delete data.updatedAt;
			const rule = await prisma.verificationRule.update({
				where: { id: req.params.id },
				data,
			});
			res.json({ rule });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

router.delete(
	"/verification/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			await prisma.verificationRule.delete({ where: { id: req.params.id } });
			res.json({ ok: true });
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	},
);

export default router;
