import React, { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-hot-toast";
import { Mic } from "lucide-react";

type UserSummary = {
	id: string;
	name: string;
	role: string;
	location?: string | null;
	verified: boolean;
};

type ChatMessage = {
	id: string;
	content: string;
	audioUrl?: string | null;
	senderId: string;
	receiverId: string;
	read: boolean;
	createdAt: string;
};

type ChatSendAck = { ok: boolean; error?: string; message?: ChatMessage };

function ChatPage() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [conversations, setConversations] = useState<UserSummary[]>([]);
	const [activeUserId, setActiveUserId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const [listening, setListening] = useState(false);

	const socketUrl = useMemo(() => {
		// Use same host as API; works for local + mobile webview (proxy as needed)
		const apiUrl =
			import.meta.env.VITE_API_URL || "http://localhost:3001/api";
		return apiUrl.replace(/\/api\/?$/, "");
	}, []);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await api.get("/chat/conversations");
				if (!mounted) return;
				setConversations(res.data.conversations || []);
				setActiveUserId(res.data.conversations?.[0]?.id || null);
			} catch (e) {
				console.error(e);
				toast.error("Failed to load chats");
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!activeUserId) return;
		(async () => {
			try {
				const res = await api.get(`/chat/messages/${activeUserId}`);
				setMessages(res.data.messages || []);
			} catch (e) {
				console.error(e);
				toast.error("Failed to load messages");
			}
		})();
	}, [activeUserId]);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) return;

		const s: Socket = io(socketUrl, { auth: { token } });

		s.on("connect_error", (err) => {
			console.error("Socket error:", err?.message || err);
		});

		s.on("notify", (n) => {
			if (n?.type === "message") {
				toast("New message received");
			}
		});

		s.on("chat:message", (msg: ChatMessage) => {
			// Incoming message
			if (
				(activeUserId && msg.senderId === activeUserId) ||
				(activeUserId && msg.receiverId === activeUserId)
			) {
				setMessages((prev) => [...prev, msg]);
			}
		});

		s.on("chat:message:sent", (msg: ChatMessage) => {
			// Ack mirror for sent messages
			if (
				(activeUserId && msg.senderId === activeUserId) ||
				(activeUserId && msg.receiverId === activeUserId)
			) {
				setMessages((prev) => [...prev, msg]);
			}
		});

		return () => {
			s.disconnect();
		};
	}, [socketUrl, activeUserId]);

	const send = async () => {
		if (!user) return;
		if (!activeUserId) return;
		const content = text.trim();
		if (!content) return;
		if (!user.verified) {
			toast.error("Your account is not verified yet.");
			return;
		}

		try {
			// Use socket when available; fallback to REST
			const token = localStorage.getItem("token");
			if (token) {
				const s: Socket = io(socketUrl, { auth: { token } });
				s.emit(
					"chat:send",
					{ receiverId: activeUserId, content },
					(resp: ChatSendAck) => {
						if (!resp?.ok) {
							toast.error(resp?.error || "Failed to send");
						}
					},
				);
				s.disconnect();
			} else {
				await api.post("/chat/messages", { receiverId: activeUserId, content });
			}
			setText("");
		} catch (e) {
			console.error(e);
			toast.error("Failed to send");
		}
	};

	const startVoiceInput = () => {
		// Web Speech API (best-effort; works in Chrome/Android)
		const AnyWindow = window as unknown as {
			SpeechRecognition?: new () => SpeechRecognition;
			webkitSpeechRecognition?: new () => SpeechRecognition;
		};
		const SpeechRecognition = AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			toast.error("Voice input not supported on this device");
			return;
		}

		const rec = new SpeechRecognition();
		rec.lang = "en-US";
		rec.interimResults = false;
		rec.maxAlternatives = 1;

		rec.onstart = () => setListening(true);
		rec.onend = () => setListening(false);
		rec.onerror = () => setListening(false);
		rec.onresult = (e: Event) => {
			const maybe = e as unknown as {
				results?: ArrayLike<ArrayLike<{ transcript?: unknown }>>;
			};
			const transcript = maybe?.results?.[0]?.[0]?.transcript;
			if (typeof transcript === "string" && transcript.trim()) {
				setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
			}
		};

		rec.start();
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 py-6">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<div className="bg-white rounded-lg shadow p-4 lg:col-span-1">
						<h2 className="text-sm font-semibold text-gray-700 mb-3">
							Conversations
						</h2>
						<div className="space-y-2">
							{conversations.length === 0 ? (
								<p className="text-sm text-gray-500">
									No conversations yet.
								</p>
							) : (
								conversations.map((c) => (
									<button
										key={c.id}
										onClick={() => setActiveUserId(c.id)}
										className={`w-full text-left px-3 py-2 rounded-lg border ${
											activeUserId === c.id
												? "border-green-500 bg-green-50"
												: "border-gray-200 hover:bg-gray-50"
										}`}
									>
										<div className="text-sm font-medium text-gray-900">
											{c.name}{" "}
											{c.verified ? (
												<span className="text-xs text-blue-600">(verified)</span>
											) : (
												<span className="text-xs text-yellow-700">(pending)</span>
											)}
										</div>
										<div className="text-xs text-gray-500">{c.role}</div>
									</button>
								))
							)}
						</div>
					</div>

					<div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
						{!activeUserId ? (
							<p className="text-sm text-gray-500">Select a conversation.</p>
						) : (
							<>
								<div className="h-[55vh] overflow-y-auto border border-gray-100 rounded-lg p-3 space-y-3">
									{messages.map((m) => {
										const isMine = m.senderId === user?.id;
										return (
											<div
												key={m.id}
												className={`max-w-[85%] ${
													isMine ? "ml-auto text-right" : "mr-auto"
												}`}
											>
												<div
													className={`inline-block px-3 py-2 rounded-lg ${
														isMine
															? "bg-green-600 text-white"
															: "bg-gray-100 text-gray-900"
													}`}
												>
													<p className="text-sm whitespace-pre-wrap">{m.content}</p>
													{m.audioUrl && (
														<div className="mt-2">
															<audio controls src={m.audioUrl} className="w-full" />
														</div>
													)}
												</div>
												<div className="text-xs text-gray-500 mt-1">
													{new Date(m.createdAt).toLocaleString()}
												</div>
											</div>
										);
									})}
								</div>

								<div className="mt-3 flex gap-2">
									<input
										value={text}
										onChange={(e) => setText(e.target.value)}
										className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
										placeholder="Type a message…"
									/>
									<button
										type="button"
										onClick={startVoiceInput}
										className={`px-3 py-2 rounded-lg border ${
											listening
												? "border-green-600 bg-green-50 text-green-700"
												: "border-gray-300 hover:bg-gray-50 text-gray-700"
										}`}
										title="Voice input"
									>
										<Mic className="h-4 w-4" />
									</button>
									<button
										onClick={send}
										className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
									>
										Send
									</button>
								</div>
								<p className="text-xs text-gray-500 mt-2">
									Receiver gets text + (if configured) a voice version automatically.
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default ChatPage;

