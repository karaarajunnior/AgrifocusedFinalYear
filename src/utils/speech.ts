export function speak(text: string) {
	if (typeof window === "undefined") return;
	const synth = window.speechSynthesis;
	if (!synth) return;

	try {
		synth.cancel();
		const utter = new SpeechSynthesisUtterance(text);
		utter.rate = 1;
		utter.pitch = 1;
		utter.volume = 1;
		synth.speak(utter);
	} catch {
		// no-op
	}
}

export function stopSpeaking() {
	if (typeof window === "undefined") return;
	const synth = window.speechSynthesis;
	if (!synth) return;
	try {
		synth.cancel();
	} catch {
		// no-op
	}
}

