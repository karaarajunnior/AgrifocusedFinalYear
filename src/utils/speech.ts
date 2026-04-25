import api from "../services/api";

export function mediaUrl(pathOrUrl?: string | null): string | undefined {
	if (!pathOrUrl) return undefined;
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const apiBase = (import.meta.env.VITE_API_URL || "https://agrifocused-api.onrender.com/api").replace(/\/api\/?$/, "");
	return `${apiBase}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

// ── Voice Mode Tracking ───────────────────────────────────────────────────────
// Tracks which voice tier is currently active so the UI can show a status badge.
export type VoiceMode = "openai" | "browser" | "silent";
let _voiceMode: VoiceMode = "openai";

export function getVoiceMode(): VoiceMode {
	return _voiceMode;
}

// ── Tier 2: Browser SpeechSynthesis ──────────────────────────────────────────
function speakWithBrowser(text: string): Promise<void> {
	return new Promise((resolve) => {
		if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
		try {
			window.speechSynthesis.cancel();
			const utter = new SpeechSynthesisUtterance(text);
			utter.rate = 1;
			utter.pitch = 1;
			utter.volume = 1;
			utter.onend = () => resolve();
			utter.onerror = () => resolve();
			window.speechSynthesis.speak(utter);
		} catch {
			resolve();
		}
	});
}

// ── Tier 1: OpenAI TTS via backend ───────────────────────────────────────────
async function speakWithOpenAI(text: string, messageId?: string): Promise<boolean> {
	try {
		const id = messageId ?? `tts-${Date.now()}`;
		const res = await api.post("/chat/tts", { text, messageId: id });
		const url: string | null = res.data?.url ?? null;
		if (!url) return false;

		return new Promise((resolve) => {
			const audio = new Audio(mediaUrl(url));
			audio.onended = () => resolve(true);
			audio.onerror = () => resolve(false);
			audio.play().catch(() => resolve(false));
		});
	} catch {
		return false;
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * speak() — plays text audio via the best available voice tier:
 *   1. OpenAI TTS  (premium, natural)
 *   2. Browser SpeechSynthesis (free, built-in)
 *   3. Silent no-op  (never breaks the UI)
 *
 * @param text       Text to speak
 * @param messageId  Optional stable ID used for backend caching
 */
export async function speak(text: string, messageId?: string): Promise<void> {
	// Tier 1 — OpenAI TTS
	const openaiOk = await speakWithOpenAI(text, messageId);
	if (openaiOk) {
		_voiceMode = "openai";
		return;
	}

	// Tier 2 — Browser SpeechSynthesis
	if (typeof window !== "undefined" && window.speechSynthesis) {
		await speakWithBrowser(text);
		_voiceMode = "browser";
		return;
	}

	// Tier 3 — Silent (no-op)
	_voiceMode = "silent";
}

export function stopSpeaking(): void {
	if (typeof window === "undefined") return;
	try { window.speechSynthesis?.cancel(); } catch { /* no-op */ }
}

