import prisma from "../db/prisma.js";

/**
 * Registration rule engine.
 *
 * Rules are stored in the `registration_rules` table and are never surfaced
 * through any UI. Administrators manage them strictly through internal API
 * endpoints (and seeded defaults). When a new user signs up the engine
 * evaluates active rules in priority order against the submitted payload and
 * returns one of three decisions:
 *
 *   - APPROVE: account is created and immediately marked as verified.
 *   - REJECT:  account is created but disabled with the rule's reason.
 *   - REVIEW:  account is created, left unverified, queued for admin review.
 *
 * Supported rule types (see DEFAULT_RULES below for the seed set):
 *   - REQUIRED_FIELDS    -> { fields: string[] }
 *   - EMAIL_DOMAIN_BLOCK -> { domains: string[] }
 *   - EMAIL_DOMAIN_ALLOW -> { domains: string[] }
 *   - PHONE_FORMAT       -> { pattern: string }            (regex source)
 *   - LOCATION_REQUIRED  -> {}                             (location must be set)
 *   - ROLE_AUTO_APPROVE  -> { roles: string[] }
 *   - ROLE_REVIEW        -> { roles: string[] }
 *   - PASSWORD_MIN       -> { length: number }
 */

const DEFAULT_RULES = [
	{
		name: "Required profile fields",
		ruleType: "REQUIRED_FIELDS",
		appliesToRole: null,
		action: "REVIEW",
		reason: "Missing required profile information",
		priority: 100,
		config: { fields: ["name", "email", "phone", "location"] },
	},
	{
		name: "Valid phone format",
		ruleType: "PHONE_FORMAT",
		appliesToRole: null,
		action: "REVIEW",
		reason: "Phone number is missing or in an unsupported format",
		priority: 90,
		config: { pattern: "^\\+?[0-9][0-9\\s\\-()]{6,18}$" },
	},
	{
		name: "Block disposable email domains",
		ruleType: "EMAIL_DOMAIN_BLOCK",
		appliesToRole: null,
		action: "REJECT",
		reason: "Registration with disposable email domains is not allowed",
		priority: 80,
		config: {
			domains: [
				"mailinator.com",
				"tempmail.com",
				"10minutemail.com",
				"guerrillamail.com",
				"yopmail.com",
				"trashmail.com",
				"sharklasers.com",
			],
		},
	},
	{
		name: "Auto approve farmers and buyers with complete profile",
		ruleType: "ROLE_AUTO_APPROVE",
		appliesToRole: null,
		action: "APPROVE",
		reason: "Profile passes baseline integrity checks",
		priority: 10,
		config: { roles: ["FARMER", "BUYER", "AGRO_SHOP", "SUPERMARKET"] },
	},
];

function safeParseConfig(raw) {
	if (!raw) return {};
	if (typeof raw === "object") return raw;
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function getEmailDomain(email) {
	if (!email || typeof email !== "string") return "";
	const at = email.lastIndexOf("@");
	if (at < 0) return "";
	return email.slice(at + 1).trim().toLowerCase();
}

function ruleAppliesToRole(rule, role) {
	if (!rule.appliesToRole) return true;
	return String(rule.appliesToRole).toUpperCase() === String(role || "").toUpperCase();
}

function evaluateSingleRule(rule, payload) {
	const cfg = safeParseConfig(rule.config);
	const role = payload.role;

	if (!ruleAppliesToRole(rule, role)) {
		return { matched: false };
	}

	switch (rule.ruleType) {
		case "REQUIRED_FIELDS": {
			const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
			const missing = fields.filter((f) => {
				const v = payload[f];
				return v === undefined || v === null || String(v).trim().length === 0;
			});
			if (missing.length > 0) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason:
						rule.reason ||
						`Missing required field(s): ${missing.join(", ")}`,
					details: { missing },
				};
			}
			return { matched: false };
		}

		case "PHONE_FORMAT": {
			const pattern = cfg.pattern;
			if (!pattern) return { matched: false };
			const value = payload.phone || "";
			if (!value) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || "Phone number missing",
				};
			}
			let re;
			try {
				re = new RegExp(pattern);
			} catch {
				return { matched: false };
			}
			if (!re.test(value)) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || "Phone number format is not accepted",
				};
			}
			return { matched: false };
		}

		case "LOCATION_REQUIRED": {
			const v = payload.location;
			if (!v || String(v).trim().length === 0) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || "Location is required",
				};
			}
			return { matched: false };
		}

		case "EMAIL_DOMAIN_BLOCK": {
			const domains = Array.isArray(cfg.domains) ? cfg.domains : [];
			const domain = getEmailDomain(payload.email);
			if (domain && domains.map((d) => String(d).toLowerCase()).includes(domain)) {
				return {
					matched: true,
					action: rule.action || "REJECT",
					reason: rule.reason || "Email domain is not allowed",
					details: { domain },
				};
			}
			return { matched: false };
		}

		case "EMAIL_DOMAIN_ALLOW": {
			const domains = Array.isArray(cfg.domains) ? cfg.domains : [];
			if (domains.length === 0) return { matched: false };
			const domain = getEmailDomain(payload.email);
			if (!domains.map((d) => String(d).toLowerCase()).includes(domain)) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || "Email domain is not on the allow list",
					details: { domain },
				};
			}
			return { matched: false };
		}

		case "PASSWORD_MIN": {
			const len = Number(cfg.length) || 0;
			const pw = payload.password || "";
			if (pw.length < len) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || `Password must be at least ${len} characters`,
				};
			}
			return { matched: false };
		}

		case "ROLE_AUTO_APPROVE": {
			const roles = (Array.isArray(cfg.roles) ? cfg.roles : []).map((r) =>
				String(r).toUpperCase(),
			);
			if (roles.length === 0) return { matched: false };
			if (roles.includes(String(role || "").toUpperCase())) {
				return {
					matched: true,
					action: rule.action || "APPROVE",
					reason: rule.reason || "Role qualifies for automatic approval",
				};
			}
			return { matched: false };
		}

		case "ROLE_REVIEW": {
			const roles = (Array.isArray(cfg.roles) ? cfg.roles : []).map((r) =>
				String(r).toUpperCase(),
			);
			if (roles.length === 0) return { matched: false };
			if (roles.includes(String(role || "").toUpperCase())) {
				return {
					matched: true,
					action: rule.action || "REVIEW",
					reason: rule.reason || "Role requires manual review",
				};
			}
			return { matched: false };
		}

		default:
			return { matched: false };
	}
}

/**
 * Ensure default rules exist in the database. Safe to call repeatedly:
 * only inserts rules whose name+ruleType combination is missing.
 */
export async function ensureDefaultRegistrationRules() {
	try {
		const existing = await prisma.registrationRule.findMany({
			select: { name: true, ruleType: true },
		});
		const key = (n, t) => `${n}::${t}`;
		const have = new Set(existing.map((r) => key(r.name, r.ruleType)));
		const missing = DEFAULT_RULES.filter(
			(r) => !have.has(key(r.name, r.ruleType)),
		);
		if (missing.length === 0) return;
		for (const m of missing) {
			await prisma.registrationRule.create({
				data: {
					name: m.name,
					ruleType: m.ruleType,
					appliesToRole: m.appliesToRole,
					action: m.action,
					reason: m.reason || null,
					priority: m.priority,
					isActive: true,
					config: JSON.stringify(m.config || {}),
				},
			});
		}
	} catch (err) {
		console.warn(
			"ensureDefaultRegistrationRules failed:",
			err?.message || err,
		);
	}
}

/**
 * Evaluate the registration payload against active rules.
 * Returns { decision: 'APPROVE' | 'REJECT' | 'REVIEW', reason, matchedRuleId }
 *
 * Decision precedence (regardless of priority order):
 *   REJECT > REVIEW > APPROVE.
 * Higher numeric priority is evaluated first; the first matching rule that
 * sets a stronger decision wins, but REJECT short-circuits evaluation.
 */
export async function evaluateRegistration(payload) {
	let rules = [];
	try {
		rules = await prisma.registrationRule.findMany({
			where: { isActive: true },
			orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
		});
	} catch (err) {
		console.warn(
			"evaluateRegistration: failed to load rules:",
			err?.message || err,
		);
		rules = [];
	}

	if (rules.length === 0) {
		return {
			decision: "REVIEW",
			reason: "No active registration rules configured",
			matchedRuleId: null,
		};
	}

	let current = {
		decision: "REVIEW",
		reason: "Awaiting admin review",
		matchedRuleId: null,
	};

	for (const rule of rules) {
		let result;
		try {
			result = evaluateSingleRule(rule, payload);
		} catch (err) {
			console.warn(`Rule ${rule.id} threw:`, err?.message || err);
			continue;
		}
		if (!result.matched) continue;

		const action = (result.action || rule.action || "REVIEW").toUpperCase();

		if (action === "REJECT") {
			return {
				decision: "REJECT",
				reason: result.reason,
				matchedRuleId: rule.id,
			};
		}

		if (action === "REVIEW") {
			if (current.decision !== "REJECT") {
				current = {
					decision: "REVIEW",
					reason: result.reason,
					matchedRuleId: rule.id,
				};
			}
			continue;
		}

		if (action === "APPROVE") {
			if (current.decision === "REVIEW" && current.matchedRuleId === null) {
				current = {
					decision: "APPROVE",
					reason: result.reason,
					matchedRuleId: rule.id,
				};
			} else if (current.decision === "APPROVE") {
				continue;
			}
		}
	}

	return current;
}

export async function recordRegistrationDecision({
	userId,
	email,
	role,
	decision,
	matchedRuleId,
	reason,
	payloadSnap,
}) {
	try {
		await prisma.registrationDecision.create({
			data: {
				userId: String(userId || ""),
				email: String(email || ""),
				role: String(role || ""),
				decision: String(decision || ""),
				matchedRuleId: matchedRuleId || null,
				reason: reason || null,
				payloadSnap: payloadSnap ? JSON.stringify(payloadSnap) : null,
			},
		});
	} catch (err) {
		console.warn(
			"recordRegistrationDecision failed:",
			err?.message || err,
		);
	}
}
