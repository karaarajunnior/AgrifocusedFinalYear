import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-hot-toast";
import { Mic, MessageCircle, Volume2, Globe, Square, Play, Trash2 } from "lucide-react";

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
	const [socket, setSocket] = useState<Socket | null>(null);

	const [searchParams] = useSearchParams();
	const initialUserId = searchParams.get("userId");

	const [translations, setTranslations] = useState<{ [msgId: string]: string }>({});
	const [targetLang, setTargetLang] = useState("luganda");
	const [recording, setRecording] = useState(false);
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
	const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

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
				
				let fetchedConvs = res.data.conversations || [];

				if (initialUserId && !fetchedConvs.find((c: any) => c.id === initialUserId)) {
					try {
						const userRes = await api.get(`/users/${initialUserId}`);
						if (userRes.data?.user) {
							fetchedConvs = [userRes.data.user, ...fetchedConvs];
						}
					} catch (e) {
						console.error("Failed to fetch initial user", e);
					}
				}

				setConversations(fetchedConvs);
				setActiveUserId(initialUserId || fetchedConvs[0]?.id || null);
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
	}, [initialUserId]);

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
		let mounted = true;
		const token = localStorage.getItem("token");
		if (!token) return;

		const s: Socket = io(socketUrl, { auth: { token } });
		setSocket(s);

		s.on("connect_error", (err) => {
			console.error("Socket error:", err?.message || err);
		});

		s.on("notify", async (n) => {
			if (n?.type === "message") {
				toast("New message received");
				// Refresh conversation list to show new people
				try {
					const res = await api.get("/chat/conversations");
					if (mounted) setConversations(res.data.conversations || []);
				} catch (e) {
					console.error("Failed to refresh conversations", e);
				}
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
			mounted = false;
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
			// Use the actively maintained socket connection
			if (socket && socket.connected) {
				socket.emit(
					"chat:send",
					{ receiverId: activeUserId, content },
					(resp: ChatSendAck) => {
						if (!resp?.ok) {
							toast.error(resp?.error || "Failed to send");
						}
					},
				);
			} else {
				const res = await api.post("/chat/messages", { receiverId: activeUserId, content });
				// Manually update messages since we won't get the socket loopback
				if (res.data?.chat) {
					setMessages(prev => [...prev, res.data.chat]);
				}
			}
			setText("");
		} catch (e) {
			console.error(e);
			toast.error("Failed to send");
		}
	};

	const startVoiceInput = () => {
		// Web Speech API (best-effort; works in Chrome/Android)
		const AnyWindow = window as any;
		const WebSpeech = AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition;
		if (!WebSpeech) {
			toast.error("Voice input not supported on this device");
			return;
		}

		const rec = new WebSpeech();
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

	const stopVoiceInput = () => {
		setListening(false);
	};

	const readAloud = (text: string) => {
		if (!window.speechSynthesis) {
			toast.error("Text-to-speech not supported");
			return;
		}
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.rate = 0.9;
		window.speechSynthesis.speak(utterance);
	};

	const translateMessage = async (msgId: string, text: string) => {
		try {
			const res = await api.post("/chat/translate", { text, targetLang });
			if (res.data?.translated) {
				setTranslations((prev) => ({ ...prev, [msgId]: res.data.translated }));
			}
		} catch (e) {
			console.error(e);
			toast.error("Translation failed");
		}
	};

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			setMediaRecorder(recorder);
			setAudioChunks([]);

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					setAudioChunks((prev) => [...prev, e.data]);
				}
			};

			recorder.onstop = async () => {
				// We'll handle sending in a separate step or automatically
			};

			recorder.start();
			setRecording(true);
		} catch (err) {
			console.error("Failed to start recording", err);
			toast.error("Could not access microphone");
		}
	};

	const stopAndSendRecording = async () => {
		if (!mediaRecorder) return;

		mediaRecorder.onstop = async () => {
			const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
			if (audioBlob.size < 100) return;

			try {
				const formData = new FormData();
				formData.append("file", audioBlob, `voice_${Date.now()}.webm`);
				
				// Re-use existing document/upload logic or direct upload
				const uploadRes = await api.post("/documents/upload", formData, {
					headers: { "Content-Type": "multipart/form-data" }
				});

				if (uploadRes.data?.path) {
					const audioUrl = uploadRes.data.path;
					// Send as chat message
					if (socket && socket.connected) {
						socket.emit("chat:send", { 
							receiverId: activeUserId, 
							content: "[Voice Message]", 
							audioUrl 
						});
					} else {
						await api.post("/chat/messages", { 
							receiverId: activeUserId, 
							content: "[Voice Message]", 
							audioUrl 
						});
					}
					toast.success("Voice message sent");
				}
			} catch (e) {
				console.error(e);
				toast.error("Failed to send voice message");
			}
			
			// Clean up
			mediaRecorder.stream.getTracks().forEach(t => t.stop());
			setMediaRecorder(null);
			setAudioChunks([]);
			setRecording(false);
		};

		mediaRecorder.stop();
	};

	const cancelRecording = () => {
		if (mediaRecorder) {
			mediaRecorder.stop();
			mediaRecorder.stream.getTracks().forEach(t => t.stop());
		}
		setMediaRecorder(null);
		setAudioChunks([]);
		setRecording(false);
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
							<div className="flex flex-col items-center justify-center h-64 text-center">
								<div className="bg-green-50 p-4 rounded-full mb-4">
									<MessageCircle className="h-8 w-8 text-green-600" />
								</div>
								<h3 className="text-lg font-medium text-gray-900">Your Messages</h3>
								<p className="text-gray-500 mt-2 max-w-sm">
									{conversations.length === 0
										? "You don't have any active conversations yet. Visit the Products page to find a farmer you'd like to contact."
										: "Select a conversation from the sidebar to start chatting."}
								</p>
								{conversations.length === 0 && (
									<a
										href="/products"
										className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
									>
										Browse Products
									</a>
								)}
							</div>
						) : (
							<>
								<div className="h-[55vh] overflow-y-auto border border-gray-100 rounded-lg p-3 space-y-3">
									{messages.map((m) => {
										const isMine = m.senderId === user?.id;
										const translated = translations[m.id];
										return (
											<div
												key={m.id}
												className={`max-w-[85%] ${
													isMine ? "ml-auto text-right" : "mr-auto"
												}`}
											>
												<div
													className={`inline-block px-3 py-2 rounded-lg relative group ${
														isMine
															? "bg-green-600 text-white"
															: "bg-gray-100 text-gray-900"
													}`}
												>
													<p className="text-sm whitespace-pre-wrap">
														{translated || m.content}
													</p>
													
													{/* Accessibility Tools Overlay/Footer */}
													<div className={`flex items-center gap-2 mt-2 pt-1 border-t ${isMine ? "border-green-500 justify-end" : "border-gray-200"}`}>
														<button 
															onClick={() => readAloud(translated || m.content)}
															className="p-1 hover:bg-black/10 rounded transition-colors"
															title="Read aloud"
														>
															<Volume2 className="h-3.5 w-3.5" />
														</button>
														{!isMine && (
															<button 
																onClick={() => translateMessage(m.id, m.content)}
																className={`p-1 hover:bg-black/10 rounded transition-colors ${translated ? "text-blue-500" : ""}`}
																title={`Translate to ${targetLang}`}
															>
																<Globe className="h-3.5 w-3.5" />
															</button>
														)}
													</div>

													{m.audioUrl && (
														<div className="mt-2">
															<audio controls src={m.audioUrl} className="w-full h-8" />
														</div>
													)}
												</div>
												<div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
													{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</div>
											</div>
										);
									})}
								</div>

								<div className="mt-3 bg-gray-50 p-2 rounded-lg border border-gray-200 mb-2 flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Globe className="h-4 w-4 text-gray-400" />
										<select 
											value={targetLang}
											onChange={(e) => setTargetLang(e.target.value)}
											className="text-xs bg-transparent border-none focus:ring-0 text-gray-600"
										>
											<option value="luganda">Luganda (Central)</option>
											<option value="runyankore">Runyankore (West)</option>
											<option value="acholi">Acholi (North)</option>
										</select>
									</div>
									<div className="text-[10px] text-gray-400 font-medium uppercase">
										Accessibility Tools
									</div>
								</div>

								<div className="flex gap-2">
									{!recording ? (
										<>
											<input
												value={text}
												onChange={(e) => setText(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && send()}
												className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
												placeholder="Type a message…"
											/>
											<button
												type="button"
												onClick={listening ? stopVoiceInput : startVoiceInput}
												className={`px-3 py-2 rounded-lg border transition-all ${
													listening
														? "border-red-500 bg-red-50 text-red-600 animate-pulse"
														: "border-gray-300 hover:bg-gray-50 text-gray-700"
												}`}
												title="Speech to Text"
											>
												<Mic className="h-4 w-4" />
											</button>
											<button
												type="button"
												onClick={startRecording}
												className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-blue-600"
												title="Record Voice Note"
											>
												<Play className="h-4 w-4" />
											</button>
											<button
												onClick={send}
												disabled={!text.trim()}
												className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
											>
												Send
											</button>
										</>
									) : (
										<div className="flex-1 flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-200">
											<div className="flex-1 flex items-center gap-2 overflow-hidden">
												<div className="h-2 w-2 bg-red-500 rounded-full animate-ping shrink-0" />
												<span className="text-sm font-medium text-blue-700 truncate">Recording voice note...</span>
											</div>
											<button
												onClick={cancelRecording}
												className="p-2 text-gray-500 hover:text-red-600 transition-colors"
												title="Cancel"
											>
												<Trash2 className="h-5 w-5" />
											</button>
											<button
												onClick={stopAndSendRecording}
												className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
											>
												<Square className="h-4 w-4" />
												Stop & Send
											</button>
										</div>
									)}
								</div>
								<p className="text-[10px] text-gray-400 mt-2 italic text-center">
									Empowering farmers through local language translation and voice-first interaction.
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

