import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-hot-toast";
import { Mic, MessageCircle, Volume2, Globe, Square, Play, Trash2 } from "lucide-react";
import { t, languageNames } from "../utils/translation";
import { useLanguage } from "../contexts/LanguageContext";

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
	const [potentialContacts, setPotentialContacts] = useState<UserSummary[]>([]);
	const [activeUserId, setActiveUserId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const [listening, setListening] = useState(false);
	const [socket, setSocket] = useState<Socket | null>(null);
	const recognitionRef = useRef<SpeechRecognition | null>(null);

	const [searchParams] = useSearchParams();
	const initialUserId = searchParams.get("userId");

	const { language } = useLanguage();
	const [recording, setRecording] = useState(false);
	const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
	const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

	const socketUrl = useMemo(() => {
		const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
		return apiUrl.replace(/\/api\/?$/, "");
	}, []);

	const mediaUrl = (url?: string | null) => {
		if (!url) return "";
		if (/^https?:\/\//i.test(url)) return url;
		return `${socketUrl}${url.startsWith("/") ? "" : "/"}${url}`;
	};

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await api.get("/chat/conversations");
				if (!mounted) return;
				
				let fetchedConvs = res.data.conversations || [];

				if (initialUserId && !fetchedConvs.find((c: UserSummary) => c.id === initialUserId)) {
					try {
						const userRes = await api.get(`/users/profile/${initialUserId}`);
						if (userRes.data?.user) {
							fetchedConvs = [userRes.data.user, ...fetchedConvs];
						}
					} catch (e) {
						console.error("Failed to fetch initial user", e);
					}
				}

				setConversations(fetchedConvs);
				
				const potentialRes = await api.get("/chat/potential-contacts");
				setPotentialContacts(potentialRes.data.users || []);

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
				try {
					const res = await api.get("/chat/conversations");
					if (mounted) setConversations(res.data.conversations || []);
				} catch (e) {
					console.error("Failed to refresh conversations", e);
				}
			}
		});

		s.on("chat:message", (msg: ChatMessage) => {
			if (
				(activeUserId && msg.senderId === activeUserId) ||
				(activeUserId && msg.receiverId === activeUserId)
			) {
				setMessages((prev) => [...prev, msg]);
			}
		});

		s.on("chat:message:sent", (msg: ChatMessage) => {
			if (
				(activeUserId && msg.senderId === activeUserId) ||
				(activeUserId && msg.receiverId === activeUserId)
			) {
				setMessages((prev) => [...prev, msg]);
			}
		});

		return () => {
			mounted = false;
			recognitionRef.current?.abort();
			s.disconnect();
		};
	}, [socketUrl, activeUserId]);

	const send = async () => {
		if (!user || !activeUserId) return;
		const content = text.trim();
		if (!content) return;
		if (!user.verified) {
			toast.error("Your account is not verified yet.");
			return;
		}

		try {
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
		const WebSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!WebSpeech) {
			toast.error("Voice input not supported on this device");
			return;
		}

		const rec = new WebSpeech();
		recognitionRef.current = rec;
		rec.lang = "en-US";
		rec.interimResults = false;
		rec.maxAlternatives = 1;

		rec.onstart = () => setListening(true);
		rec.onend = () => setListening(false);
		rec.onerror = () => setListening(false);
		rec.onresult = (e: SpeechRecognitionEvent) => {
			const transcript = e?.results?.[0]?.[0]?.transcript;
			if (typeof transcript === "string" && transcript.trim()) {
				setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
			}
		};

		rec.start();
	};

	const stopVoiceInput = () => {
		recognitionRef.current?.stop();
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

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			setMediaRecorder(recorder);
			setAudioChunks([]);

			recorder.ondataavailable = (e: BlobEvent) => {
				if (e.data.size > 0) {
					setAudioChunks((prev) => [...prev, e.data]);
				}
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
				const uploadRes = await api.post("/chat/voice", formData, {
					headers: { "Content-Type": "multipart/form-data" }
				});

				if (uploadRes.data?.url) {
					const audioUrl = uploadRes.data.url;
					if (socket && socket.connected) {
						socket.emit("chat:send", { receiverId: activeUserId, content: "[Voice Message]", audioUrl });
					} else {
						await api.post("/chat/messages", { receiverId: activeUserId, content: "[Voice Message]", audioUrl });
					}
					toast.success("Voice message sent");
				}
			} catch (e) {
				console.error(e);
				toast.error("Failed to send voice message");
			}
			
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
		<div className="min-h-screen bg-gray-50 py-10">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase mb-10">
					Communication Hub
				</h1>
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
					<div className="glass-card p-6 lg:col-span-1">
						<h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
							Active Sessions
						</h2>
						<div className="space-y-2">
							{conversations.length === 0 ? (
								<p className="text-sm text-gray-500">No conversations yet.</p>
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
										<div className="flex items-center justify-between">
											<div className="text-sm font-black text-slate-900 truncate">{c.name}</div>
											{c.verified && (
												<div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shrink-0 ml-2 shadow-sm">
													<span className="text-[10px] text-white font-bold">✓</span>
												</div>
											)}
										</div>
										<div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.role}</div>
									</button>
								))
							)}
						</div>
						
						{potentialContacts.length > 0 && (
							<>
								<h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 mt-10">
									Potential Contacts
								</h2>
								<div className="space-y-2">
									{potentialContacts.filter(pc => !conversations.some(c => c.id === pc.id)).map((c) => (
										<button
											key={c.id}
											onClick={() => setActiveUserId(c.id)}
											className={`w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-all`}
										>
											<div className="flex items-center justify-between">
												<div className="text-sm font-black text-slate-900 truncate">{c.name}</div>
												{c.verified && (
													<div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shrink-0 ml-2 shadow-sm">
														<span className="text-[10px] text-white font-bold">✓</span>
													</div>
												)}
											</div>
											<div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.role}</div>
										</button>
									))}
								</div>
							</>
						)}
					</div>

					<div className="glass-card p-0 overflow-hidden lg:col-span-3 flex flex-col">
						{!activeUserId ? (
							<div className="flex flex-col items-center justify-center h-[70vh] text-center p-12">
								<div className="bg-emerald-50 p-8 rounded-3xl mb-8 shadow-sm">
									<MessageCircle className="h-12 w-12 text-emerald-600" />
								</div>
								<h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Terminal Idle</h3>
								<p className="text-slate-500 mt-4 max-w-sm font-medium">
									{conversations.length === 0
										? "No active encrypted channels found. Initialize a session via the Market Inventory."
										: "Select a secure channel from the directory to begin data transmission."}
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
										const finalContent = t(m.content);
										return (
											<div key={m.id} className={`max-w-[85%] ${isMine ? "ml-auto text-right" : "mr-auto"}`}>
												<div className={`inline-block px-3 py-2 rounded-lg relative group ${isMine ? "bg-green-600 text-white" : "bg-gray-100 text-gray-900"}`}>
													<p className="text-sm whitespace-pre-wrap">{finalContent}</p>
													<div className={`flex items-center gap-2 mt-2 pt-1 border-t ${isMine ? "border-green-500 justify-end" : "border-gray-200"}`}>
														<button onClick={() => readAloud(finalContent)} className="p-1 hover:bg-black/10 rounded transition-colors" title="Read aloud">
															<Volume2 className="h-3.5 w-3.5" />
														</button>
													</div>
													{m.audioUrl && (
														<div className="mt-2">
															<audio controls src={mediaUrl(m.audioUrl)} className="w-full h-8" />
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
										<Globe className="h-4 w-4 text-emerald-500" />
										<span className="text-xs text-gray-600 font-bold tracking-wide">
											{language === 'en' ? 'Displaying raw English' : `Auto-Translating Chat to ${languageNames[language] || language}`}
										</span>
									</div>
									<div className="text-[10px] text-gray-400 font-medium uppercase">Accessibility Tools</div>
								</div>

								<div className="flex gap-2">
									{!recording ? (
										<>
											<input
												value={text}
												onChange={(e) => setText(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && send()}
												className="flex-1 px-6 py-5 bg-slate-50 border-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 font-medium text-slate-900"
												placeholder="Enter secure message..."
											/>
											<button
												type="button"
												onClick={listening ? stopVoiceInput : startVoiceInput}
												className={`px-5 py-5 rounded-2xl transition-all ${listening ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse" : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
												title="Speech to Text"
											>
												<Mic className="h-5 w-5" />
											</button>
											<button type="button" onClick={startRecording} className="px-5 py-5 bg-slate-50 text-blue-400 hover:text-blue-600 hover:bg-slate-100 rounded-2xl transition-all" title="Record Voice Note">
												<Play className="h-5 w-5" />
											</button>
											<button onClick={send} disabled={!text.trim()} className="px-8 py-5 bg-slate-900 text-white rounded-2xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:shadow-emerald-500/20 transition-all">
												Transmit
											</button>
										</>
									) : (
										<div className="flex-1 flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-200">
											<div className="flex-1 flex items-center gap-2 overflow-hidden">
												<div className="h-2 w-2 bg-red-500 rounded-full animate-ping shrink-0" />
												<span className="text-sm font-medium text-blue-700 truncate">Recording voice note...</span>
											</div>
											<button onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Cancel">
												<Trash2 className="h-5 w-5" />
											</button>
											<button onClick={stopAndSendRecording} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium">
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
