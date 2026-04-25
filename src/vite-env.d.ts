/// <reference types="vite/client" />

interface SpeechRecognitionAlternative {
	transcript: string;
}

interface SpeechRecognitionResult {
	readonly isFinal: boolean;
	readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEvent {
	readonly resultIndex: number;
	readonly results: {
		readonly [index: number]: SpeechRecognitionResult;
	};
}

interface SpeechRecognitionErrorEvent {
	readonly error: string;
}

interface SpeechRecognition {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	maxAlternatives?: number;
	start: () => void;
	stop: () => void;
	abort: () => void;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onstart?: (() => void) | null;
	onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
	new (): SpeechRecognition;
}

interface Window {
	SpeechRecognition?: SpeechRecognitionConstructor;
	webkitSpeechRecognition?: SpeechRecognitionConstructor;
}
