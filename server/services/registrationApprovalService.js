import OpenAI from "openai";
import prisma from "../db/prisma.js";

const DEFAULT_REQUIRED_FIELDS = ["name", "email", "password", "role"];

let openaiClient = null;

function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!openaiClient) {
		openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return openaiClient;
}

function normalizeRequiredFields(rawFields) {
	if (!rawFields) return [...DEFAULT_REQUIRED_FIELDS];
	if (!Array.isArray(rawFields)) return [...DEFAULT_REQUIRED_FIELDS];

	const cleaned = rawFields
		.map((field) => String(field || "").trim())
		.filter(Boolean);

	return cleaned.length > 0 ? [...new Set(cleaned)] : [...DEFAULT_REQUIRED_FIELDS];
}

function collectMissingFields(payload, requiredFields) {
	return requiredFields.filter((field) => {
		const value = payload[field];
		if (typeof value === "string") return value.trim().length === 0;
		return value === null || value === undefined;
	});
}

function buildPrompt({ criteria, requiredFields, payload }) {
	return `You are a strict registration compliance reviewer.
Evaluate this registration submission against the provided policy.

Required fields:
${requiredFields.join(", ")}

Policy instructions:
${criteria || "Approve if all required fields are present and values look valid."}

Registration payload:
${JSON.stringify(payload, null, 2)}

Return strictly JSON:
{
  "approved": boolean,
  "reason": "single sentence explanation"
}`;
}

export async function evaluateRegistrationApproval(registrationInput) {
	const activeRule = await prisma.registrationApprovalRule.findFirst({
		where: { isActive: true },
		orderBy: [{ updatedAt: "desc" }],
	});

	const requiredFields = normalizeRequiredFields(activeRule?.requiredFields);
	const missingFields = collectMissingFields(registrationInput, requiredFields);
	if (missingFields.length > 0) {
		return {
			approved: false,
			reason: `Missing required fields: ${missingFields.join(", ")}`,
			ruleId: activeRule?.id || null,
		};
	}

	const policyPrompt = buildPrompt({
		criteria: activeRule?.criteria,
		requiredFields,
		payload: {
			name: registrationInput.name,
			email: registrationInput.email,
			role: registrationInput.role,
			phone: registrationInput.phone ?? null,
			location: registrationInput.location ?? null,
			address: registrationInput.address ?? null,
			latitude: registrationInput.latitude ?? null,
			longitude: registrationInput.longitude ?? null,
		},
	});

	const client = getOpenAI();
	if (!client) {
		return {
			approved: true,
			reason: "Approved automatically after required fields were provided.",
			ruleId: activeRule?.id || null,
		};
	}

	try {
		const completion = await client.chat.completions.create({
			model: "gpt-4o-mini",
			response_format: { type: "json_object" },
			messages: [{ role: "user", content: policyPrompt }],
		});

		const rawContent = completion.choices?.[0]?.message?.content || "{}";
		const parsed = JSON.parse(rawContent);

		return {
			approved: Boolean(parsed.approved),
			reason:
				typeof parsed.reason === "string" && parsed.reason.trim().length > 0
					? parsed.reason.trim()
					: parsed.approved
						? "Approved automatically."
						: "Rejected automatically.",
			ruleId: activeRule?.id || null,
		};
	} catch (error) {
		console.error("Registration approval automation failed:", error);
		return {
			approved: true,
			reason: "Approved automatically after required fields were provided.",
			ruleId: activeRule?.id || null,
		};
	}
}
