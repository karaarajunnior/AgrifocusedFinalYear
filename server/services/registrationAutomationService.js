import OpenAI from "openai";
import prisma from "../db/prisma.js";

const OPENAI_MODEL = process.env.REGISTRATION_AUTOMATION_MODEL || "gpt-4o";
const ALLOWED_REQUIRED_FIELDS = [
	"name",
	"email",
	"password",
	"phone",
	"location",
	"address",
];

const DEFAULT_REQUIRED_FIELDS_BY_ROLE = {
	FARMER: ["name", "email", "password", "phone", "location", "address"],
	BUYER: ["name", "email", "password", "phone", "location"],
	SUPERMARKET: ["name", "email", "password", "phone", "location", "address"],
	AGRO_SHOP: ["name", "email", "password", "phone", "location", "address"],
	ADMIN: ["name", "email", "password"],
};

let openaiClient = null;

function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!openaiClient) {
		openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return openaiClient;
}

function isBlank(value) {
	return value === undefined || value === null || String(value).trim() === "";
}

function normalizeRequiredFields(requiredFields, role) {
	if (!Array.isArray(requiredFields)) {
		return DEFAULT_REQUIRED_FIELDS_BY_ROLE[role] || DEFAULT_REQUIRED_FIELDS_BY_ROLE.FARMER;
	}

	const normalized = requiredFields
		.map((field) => String(field || "").trim())
		.filter((field, index, items) => field && items.indexOf(field) === index)
		.filter((field) => ALLOWED_REQUIRED_FIELDS.includes(field));

	return normalized.length > 0
		? normalized
		: DEFAULT_REQUIRED_FIELDS_BY_ROLE[role] || DEFAULT_REQUIRED_FIELDS_BY_ROLE.FARMER;
}

function buildApplicantSummary(registrationData) {
	return {
		name: registrationData.name || "",
		email: registrationData.email || "",
		role: registrationData.role || "",
		phone: registrationData.phone || "",
		location: registrationData.location || "",
		address: registrationData.address || "",
		hasCoordinates: Boolean(registrationData.latitude && registrationData.longitude),
		passwordProvided: !isBlank(registrationData.password),
	};
}

function buildFallbackDecision({ missingFields }) {
	if (missingFields.length > 0) {
		return {
			approved: false,
			reason: `Missing required registration fields: ${missingFields.join(", ")}.`,
			source: "required_fields",
		};
	}

	return {
		approved: true,
		reason: "Registration passed the stored approval policy checks.",
		source: "fallback",
	};
}

export function getDefaultRequiredFields(role) {
	return [...(DEFAULT_REQUIRED_FIELDS_BY_ROLE[role] || DEFAULT_REQUIRED_FIELDS_BY_ROLE.FARMER)];
}

export async function upsertRegistrationAutomationRule({
	adminUserId,
	targetRole,
	requiredFields,
	criteria,
	isActive = true,
}) {
	const normalizedRequiredFields = normalizeRequiredFields(requiredFields, targetRole);

	return prisma.registrationAutomationRule.upsert({
		where: { targetRole },
		update: {
			requiredFields: normalizedRequiredFields,
			criteria: String(criteria || "").trim(),
			isActive: Boolean(isActive),
			createdByUserId: adminUserId,
		},
		create: {
			targetRole,
			requiredFields: normalizedRequiredFields,
			criteria: String(criteria || "").trim(),
			isActive: Boolean(isActive),
			createdByUserId: adminUserId,
		},
	});
}

export async function evaluateRegistrationSubmission({ role, registrationData }) {
	const storedRule = await prisma.registrationAutomationRule.findFirst({
		where: { targetRole: role, isActive: true },
		orderBy: { updatedAt: "desc" },
	});

	const requiredFields = normalizeRequiredFields(storedRule?.requiredFields, role);
	const missingFields = requiredFields.filter((field) => isBlank(registrationData[field]));
	const fallbackDecision = buildFallbackDecision({ missingFields });

	if (missingFields.length > 0) {
		return {
			...fallbackDecision,
			requiredFields,
			missingFields,
			ruleId: storedRule?.id || null,
		};
	}

	const criteria = String(storedRule?.criteria || "").trim();
	if (!criteria) {
		return {
			approved: true,
			reason: "Registration passed the stored approval policy checks.",
			requiredFields,
			missingFields: [],
			source: "default_policy",
			ruleId: storedRule?.id || null,
		};
	}

	const openai = getOpenAI();
	if (!openai) {
		return {
			...fallbackDecision,
			requiredFields,
			missingFields: [],
			ruleId: storedRule?.id || null,
		};
	}

	try {
		const response = await openai.chat.completions.create({
			model: OPENAI_MODEL,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"You are a registration compliance reviewer. Apply the hidden administrator policy strictly. Return JSON only with keys approved (boolean) and reason (string). Approve only when the applicant satisfies every required field and the policy criteria. Reject with a short professional reason when the policy is not satisfied.",
				},
				{
					role: "user",
					content: JSON.stringify({
						targetRole: role,
						requiredFields,
						adminCriteria: criteria,
						applicant: buildApplicantSummary(registrationData),
					}),
				},
			],
		});

		const raw = response.choices?.[0]?.message?.content || "{}";
		const parsed = JSON.parse(raw);

		return {
			approved: Boolean(parsed.approved),
			reason:
				typeof parsed.reason === "string" && parsed.reason.trim()
					? parsed.reason.trim()
					: fallbackDecision.reason,
			requiredFields,
			missingFields: [],
			source: "openai",
			ruleId: storedRule?.id || null,
		};
	} catch (error) {
		console.error("Registration automation review failed:", error);
		return {
			...fallbackDecision,
			requiredFields,
			missingFields: [],
			ruleId: storedRule?.id || null,
		};
	}
}
