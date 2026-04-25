import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Circuit Breaker ────────────────────────────────────────────
// If TTS fails too many times, back off for a while before retrying.
let _failCount = 0;
let _circuitOpenUntil = 0;
const CIRCUIT_FAIL_THRESHOLD = 3;   // open after 3 consecutive failures
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // try again after 5 minutes

function getUploadsDir() {
	return path.join(__dirname, "..", "uploads");
}

/**
 * Sleep for `ms` milliseconds.
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt a single TTS call.
 * Returns the audio response or throws.
 */
async function attemptTTS(openai, text) {
	return openai.audio.speech.create({
		model: process.env.OPENAI_TTS_MODEL || "tts-1",
		voice: process.env.OPENAI_TTS_VOICE || "alloy",
		input: text,
		response_format: "mp3",
	});
}

/**
 * synthesizeToFile — generates an MP3 via OpenAI TTS with:
 *   • Exponential backoff on 429 rate-limit errors (up to 3 retries)
 *   • Circuit breaker: if repeated failures occur, pauses for CIRCUIT_RESET_MS
 *   • Returns null (never throws) so callers can silently skip audio
 */
export async function synthesizeToFile({ messageId, text }) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	// Circuit breaker – if open, fail fast
	if (_failCount >= CIRCUIT_FAIL_THRESHOLD && Date.now() < _circuitOpenUntil) {
		console.warn("TTS circuit open – skipping until", new Date(_circuitOpenUntil).toISOString());
		return null;
	}

	const openai = new OpenAI({ apiKey });
	const outDir = path.join(getUploadsDir(), "tts");
	await fs.mkdir(outDir, { recursive: true });

	const safeId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, "");
	const outPath = path.join(outDir, `${safeId}.mp3`);

	const MAX_RETRIES = 3;
	let lastError;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const audio = await attemptTTS(openai, text);
			const buf = Buffer.from(await audio.arrayBuffer());
			await fs.writeFile(outPath, buf);

			// Success – reset circuit breaker
			_failCount = 0;
			_circuitOpenUntil = 0;

			return `/uploads/tts/${safeId}.mp3`;
		} catch (err) {
			lastError = err;
			const status = err?.status ?? err?.response?.status;

			if (status === 429) {
				// Rate-limited: exponential backoff (1s, 2s, 4s)
				const delay = Math.pow(2, attempt) * 1000;
				console.warn(`TTS rate-limited (429). Retrying in ${delay}ms… (attempt ${attempt + 1}/${MAX_RETRIES})`);
				await sleep(delay);
			} else {
				// Non-retryable error (auth, server error, etc.)
				break;
			}
		}
	}

	// All retries exhausted – update circuit breaker
	_failCount++;
	if (_failCount >= CIRCUIT_FAIL_THRESHOLD) {
		_circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
		console.warn(`TTS circuit opened after ${_failCount} failures. Pausing for ${CIRCUIT_RESET_MS / 60000} min.`);
	}

	console.warn("TTS failed (silent fallback):", lastError?.message ?? lastError);
	return null; // Caller must handle null — never crash
}


