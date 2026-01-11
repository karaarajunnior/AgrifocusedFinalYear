import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getUploadsDir() {
	// /workspace/server/services -> /workspace/server/uploads
	return path.join(__dirname, "..", "uploads");
}

export async function synthesizeToFile({ messageId, text }) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const openai = new OpenAI({ apiKey });
	const outDir = path.join(getUploadsDir(), "tts");
	await fs.mkdir(outDir, { recursive: true });

	const safeId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, "");
	const outPath = path.join(outDir, `${safeId}.mp3`);

	// OpenAI Node SDK returns a fetch-like Response with arrayBuffer()
	const audio = await openai.audio.speech.create({
		model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
		voice: process.env.OPENAI_TTS_VOICE || "alloy",
		input: text,
		format: "mp3",
	});

	const buf = Buffer.from(await audio.arrayBuffer());
	await fs.writeFile(outPath, buf);

	// Public URL served by express static (/uploads)
	return `/uploads/tts/${safeId}.mp3`;
}

