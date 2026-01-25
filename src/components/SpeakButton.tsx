import React from "react";
import { Volume2 } from "lucide-react";
import { speak, stopSpeaking } from "../utils/speech";

export default function SpeakButton({
	text,
	className = "",
	label = "Listen",
}: {
	text: string;
	className?: string;
	label?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => speak(text)}
			onDoubleClick={() => stopSpeaking()}
			className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm ${className}`.trim()}>
			<Volume2 className="h-4 w-4" />
			<span>{label}</span>
		</button>
	);
}

