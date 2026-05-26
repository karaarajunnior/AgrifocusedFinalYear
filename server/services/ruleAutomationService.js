import fs from "fs/promises";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

let openaiClient = null;

function getOpenAI() {
	if (!process.env.OPENAI_API_KEY) return null;
	if (!openaiClient) {
		openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
	}
	return openaiClient;
}

function parseJsonObject(content) {
	if (!content) throw new Error("empty_decision");
	try {
		return JSON.parse(content);
	} catch {
		const match = String(content).match(/\{[\s\S]*\}/);
		if (!match) throw new Error("invalid_decision_json");
		return JSON.parse(match[0]);
	}
}

function normalizeDecision(result, fallbackReason) {
	return {
		approved: Boolean(result?.approved),
		reason: String(result?.reason || fallbackReason || "Decision completed.").slice(0, 1000),
	};
}

function missingField(value) {
	return value === undefined || value === null || String(value).trim() === "";
}

function evaluateRegistrationFallback(submission, rules) {
	const missing = [];
	if (missingField(submission.name)) missing.push("full name");
	if (missingField(submission.email)) missing.push("email");
	if (missingField(submission.role)) missing.push("role");

	const criteria = rules.map((rule) => rule.criteria).join("\n").toLowerCase();
	if (criteria.includes("phone") || criteria.includes("mobile") || criteria.includes("contact")) {
		if (missingField(submission.phone)) missing.push("phone number");
	}
	if (criteria.includes("location") || criteria.includes("district") || criteria.includes("city")) {
		if (missingField(submission.location)) missing.push("location");
	}
	if (criteria.includes("address")) {
		if (missingField(submission.address)) missing.push("address");
	}
	if (criteria.includes("gps") || criteria.includes("coordinate") || criteria.includes("latitude") || criteria.includes("longitude")) {
		if (submission.latitude === undefined || submission.longitude === undefined) missing.push("GPS coordinates");
	}

	if (missing.length > 0) {
		return {
			approved: false,
			reason: `Registration rejected because these required fields are missing: ${missing.join(", ")}.`,
			source: "fallback",
		};
	}

	return {
		approved: true,
		reason: rules.length > 0
			? "Registration meets the configured rules."
			: "Registration contains the required account fields.",
		source: "fallback",
	};
}

export async function evaluateRegistrationSubmission({ submission, rules = [] }) {
	const client = getOpenAI();
	if (!client) {
		return evaluateRegistrationFallback(submission, rules);
	}

	if (rules.length === 0) {
		return {
			approved: true,
			reason: "Registration contains the required account fields.",
			source: "default",
		};
	}

	const safeSubmission = {
		name: submission.name,
		email: submission.email,
		role: submission.role,
		phone: submission.phone || null,
		location: submission.location || null,
		address: submission.address || null,
		hasGpsCoordinates: submission.latitude !== undefined && submission.longitude !== undefined,
	};

	const prompt = `You are an account eligibility decision engine for an agricultural marketplace.
Use only the administrator rules below and the submitted registration fields.
Reject if any rule requires information that is missing or clearly invalid.
Return strict JSON with this shape: {"approved": boolean, "reason": "short professional reason"}.

Administrator rules:
${rules.map((rule, index) => `${index + 1}. ${rule.criteria}`).join("\n")}

Registration submission:
${JSON.stringify(safeSubmission, null, 2)}`;

	try {
		const response = await client.chat.completions.create({
			model: process.env.OPENAI_RULE_MODEL || "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			response_format: { type: "json_object" },
			temperature: 0,
		});
		const parsed = parseJsonObject(response.choices[0]?.message?.content);
		return { ...normalizeDecision(parsed, "Registration decision completed."), source: "openai" };
	} catch (error) {
		console.error("Registration rule decision failed:", error);
		return evaluateRegistrationFallback(submission, rules);
	}
}

async function extractDocumentText(filePath, mimeType) {
	const buffer = await fs.readFile(filePath);
	if (mimeType === "application/pdf") {
		const parsed = await PDFParse(buffer);
		return parsed.text || "";
	}
	if (mimeType?.startsWith("text/")) {
		return buffer.toString("utf-8");
	}
	return "";
}

async function buildDocumentMessage({ criteria, filePath, mimeType }) {
	const prompt = `You are a strict, objective document verification engine.
Evaluate the uploaded document against the administrator rules.
Return strict JSON with this shape: {"approved": boolean, "reason": "short professional reason"}.

Administrator rules:
${criteria}`;

	if (mimeType?.startsWith("image/")) {
		const base64Image = (await fs.readFile(filePath)).toString("base64");
		return [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					{
						type: "image_url",
						image_url: { url: `data:${mimeType};base64,${base64Image}` },
					},
				],
			},
		];
	}

	const extractedText = await extractDocumentText(filePath, mimeType);
	return [
		{
			role: "user",
			content: `${prompt}\n\nExtracted document text:\n${extractedText.slice(0, 12000) || "[No readable text extracted]"}`,
		},
	];
}

export async function evaluateDocumentUpload({ criteria, filePath, mimeType }) {
	const client = getOpenAI();
	if (!client) {
		return {
			approved: false,
			reason: "Automatic verification is not configured. Please try again later or contact support.",
			source: "unavailable",
		};
	}

	try {
		const messages = await buildDocumentMessage({ criteria, filePath, mimeType });
		const response = await client.chat.completions.create({
			model: process.env.OPENAI_DOCUMENT_RULE_MODEL || "gpt-4o",
			messages,
			response_format: { type: "json_object" },
			temperature: 0,
		});
		const parsed = parseJsonObject(response.choices[0]?.message?.content);
		return { ...normalizeDecision(parsed, "Document verification completed."), source: "openai" };
	} catch (error) {
		console.error("Document rule decision failed:", error);
		return {
			approved: false,
			reason: "The document could not be verified automatically. Please upload a clear PDF, text file, or image.",
			source: "error",
		};
	}
}
