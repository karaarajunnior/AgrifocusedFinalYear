import OpenAI from "openai";
import prisma from "../db/prisma.js";

export const REGISTRATION_RULE_TYPE = "__USER_REGISTRATION__";

const DEFAULT_REGISTRATION_CRITERIA = [
	"Approve only when the applicant provides a valid full name, email address, role, phone number, location, and address.",
	"Reject disposable, test, or obviously invalid details.",
	"Reject incomplete applications and explain which required information is missing.",
].join(" ");

const REGISTRATION_FIELDS = ["name", "email", "role", "phone", "location", "address"];
const APPROVAL_MODEL = process.env.OPENAI_APPROVAL_MODEL || "gpt-4o-mini";

let openai = null;

function getOpenAIClient() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	return openai;
}

function cleanReason(reason, fallback = "The submission did not meet the configured review rules.") {
	const text = typeof reason === "string" && reason.trim() ? reason.trim() : fallback;
	return text
		.replace(/\bAI\b/gi, "automated review")
		.replace(/\bOpenAI\b/gi, "verification service")
		.replace(/\bGemini\b/gi, "verification service");
}

function normalizeDecision(raw, fallbackStatus = "REJECTED") {
	const approved = raw?.approved === true;
	const status = typeof raw?.status === "string" ? raw.status.toUpperCase() : approved ? "APPROVED" : fallbackStatus;

	if (status === "APPROVED" || approved) {
		return { status: "APPROVED", approved: true, reason: cleanReason(raw?.reason, "Approved.") };
	}
	if (status === "PENDING") {
		return {
			status: "PENDING",
			approved: false,
			reason: cleanReason(raw?.reason, "The submission needs manual review."),
		};
	}
	return {
		status: "REJECTED",
		approved: false,
		reason: cleanReason(raw?.reason),
	};
}

function parseJsonDecision(content, fallbackStatus) {
	try {
		return normalizeDecision(JSON.parse(content), fallbackStatus);
	} catch {
		return null;
	}
}

export async function getActiveRule(documentType) {
	return prisma.verificationRule.findFirst({
		where: { documentType, isActive: true },
		orderBy: { updatedAt: "desc" },
	});
}

export async function saveRule({ documentType, criteria, createdByUserId }) {
	return prisma.$transaction(async (tx) => {
		await tx.verificationRule.updateMany({
			where: { documentType, isActive: true },
			data: { isActive: false },
		});

		return tx.verificationRule.create({
			data: {
				documentType,
				criteria,
				createdByUserId,
			},
		});
	});
}

function findMissingRegistrationFields(application, criteria) {
	const criteriaText = String(criteria || "").toLowerCase();
	const mentionedFields = REGISTRATION_FIELDS.filter((field) => criteriaText.includes(field));
	const requiredFields = mentionedFields.length > 0 ? mentionedFields : REGISTRATION_FIELDS;

	return requiredFields.filter((field) => {
		const value = application[field];
		return value === undefined || value === null || String(value).trim() === "";
	});
}

function deterministicRegistrationDecision(application, criteria) {
	const missing = findMissingRegistrationFields(application, criteria);
	if (missing.length > 0) {
		return {
			status: "REJECTED",
			approved: false,
			reason: `Missing required information: ${missing.join(", ")}.`,
		};
	}

	if (!/^\S+@\S+\.\S+$/.test(String(application.email || ""))) {
		return { status: "REJECTED", approved: false, reason: "A valid email address is required." };
	}

	if (!["FARMER", "BUYER", "SUPERMARKET", "AGRO_SHOP"].includes(application.role)) {
		return { status: "REJECTED", approved: false, reason: "The selected account type is not eligible for automatic approval." };
	}

	return { status: "APPROVED", approved: true, reason: "Application meets the configured registration requirements." };
}

export async function evaluateRegistrationApplication(application) {
	const rule = await getActiveRule(REGISTRATION_RULE_TYPE);
	const criteria = rule?.criteria || DEFAULT_REGISTRATION_CRITERIA;
	const fallback = deterministicRegistrationDecision(application, criteria);
	const client = getOpenAIClient();

	if (!client) return fallback;

	try {
		const response = await client.chat.completions.create({
			model: APPROVAL_MODEL,
			temperature: 0,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"You are an internal registration approval service. Evaluate only the submitted fields against the configured rules. Return strict JSON with approved:boolean and reason:string. Do not mention AI, models, or internal tooling.",
				},
				{
					role: "user",
					content: JSON.stringify({
						rules: criteria,
						application,
					}),
				},
			],
		});

		return parseJsonDecision(response.choices[0]?.message?.content, fallback.status) || fallback;
	} catch (error) {
		console.error("Registration approval service error:", error);
		return fallback;
	}
}

export async function evaluateDocumentSubmission({ documentType, criteria, text, image }) {
	const client = getOpenAIClient();
	if (!client) {
		return {
			status: "PENDING",
			approved: false,
			reason: "Automated verification is temporarily unavailable. The document has been queued for review.",
		};
	}

	const content = [
		{
			type: "text",
			text: [
				"You are an internal document verification service.",
				"Evaluate the submission against the configured rules and return strict JSON with approved:boolean and reason:string.",
				"Do not mention AI, models, or internal tooling.",
				"",
				`Document type: ${documentType}`,
				`Rules: ${criteria}`,
				text ? `Extracted document text:\n${text.slice(0, 12000)}` : "",
			].join("\n"),
		},
	];

	if (image?.dataUrl) {
		content.push({
			type: "image_url",
			image_url: { url: image.dataUrl },
		});
	}

	try {
		const response = await client.chat.completions.create({
			model: process.env.OPENAI_DOCUMENT_MODEL || "gpt-4o",
			temperature: 0,
			response_format: { type: "json_object" },
			messages: [{ role: "user", content }],
		});

		return parseJsonDecision(response.choices[0]?.message?.content, "REJECTED") || {
			status: "PENDING",
			approved: false,
			reason: "The document could not be reviewed automatically and has been queued for review.",
		};
	} catch (error) {
		console.error("Document verification service error:", error);
		return {
			status: "PENDING",
			approved: false,
			reason: "The document could not be reviewed automatically and has been queued for review.",
		};
	}
}
