import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Search, Navigation, Info, X, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { speak, stopSpeaking } from '../utils/speech';
import { toast } from 'react-hot-toast';
import { t, getLanguage, translateCommandAsync } from '../utils/translation';
import api from '../services/api';

const VoiceAssistant: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [showAssistant, setShowAssistant] = useState(false);
    const navigate = useNavigate();
    const recognitionRef = React.useRef<any>(null);

    type VoiceState = 'IDLE' | 'AWAITING_PRODUCT_NAME' | 'AWAITING_QUANTITY' | 'AWAITING_PRICE' | 'AWAITING_CONFIRMATION' | 'AWAITING_SEARCH_QUERY';
    const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
    const [pendingProduct, setPendingProduct] = useState({ name: '', quantity: 0, price: 0 });

    const processCommand = useCallback(async (command: string) => {
        const cmd = command.toLowerCase();

        if (cmd.includes('stop') || cmd.includes('cancel')) {
            stopSpeaking();
            setVoiceState('IDLE');
            setShowAssistant(false);
            await speak("Operation cancelled.");
            return;
        }
        
        switch (voiceState) {
            case 'IDLE':
                if (cmd.includes('list') || cmd.includes('add harvest') || cmd.includes('sell')) {
                    setVoiceState('AWAITING_PRODUCT_NAME');
                    await speak("What crop are you selling?");
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                } else if (cmd.includes('search') || cmd.includes('buy')) {
                    setVoiceState('AWAITING_SEARCH_QUERY');
                    await speak("What are you looking to buy?");
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                } else if (cmd.includes('go to') || cmd.includes('navigate to')) {
                    if (cmd.includes('home') || cmd.includes('landing')) navigate('/');
                    else if (cmd.includes('dashboard') || cmd.includes('market')) navigate('/buyer-dashboard');
                    else if (cmd.includes('farmer') || cmd.includes('my farm')) navigate('/farmer-dashboard');
                    else if (cmd.includes('chat') || cmd.includes('messages')) navigate('/chat');
                    else if (cmd.includes('logistics') || cmd.includes('truck')) navigate('/logistics');
                    else if (cmd.includes('orders')) navigate('/orders');
                    else if (cmd.includes('profile') || cmd.includes('account')) navigate('/profile');
                    else await speak("I'm sorry, I couldn't find that page.");
                } else if (cmd.includes('what is this') || cmd.includes('tell me about this page')) {
                    const pageTitle = document.title || 'this page';
                    const h1 = document.querySelector('h1')?.innerText || '';
                    await speak(`You are currently on ${h1 || pageTitle}. This platform helps you connect with local and international agricultural markets.`);
                } else {
                    await speak("Command not recognized. Say 'list harvest' or 'search market'.");
                }
                break;

            case 'AWAITING_PRODUCT_NAME':
                setPendingProduct(prev => ({ ...prev, name: cmd }));
                setVoiceState('AWAITING_QUANTITY');
                await speak(`Got it, ${cmd}. How many kilograms are you selling?`);
                if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                break;

            case 'AWAITING_QUANTITY':
                const qtyMatch = cmd.match(/\d+/);
                if (qtyMatch) {
                    setPendingProduct(prev => ({ ...prev, quantity: parseInt(qtyMatch[0]) }));
                    setVoiceState('AWAITING_PRICE');
                    await speak(`Okay, ${qtyMatch[0]} kilograms. What is your asking price per kilogram in shillings?`);
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                } else {
                    await speak("I didn't catch the number. Please say the amount in kilograms.");
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                }
                break;

            case 'AWAITING_PRICE':
                const priceMatch = cmd.match(/\d+/);
                if (priceMatch) {
                    setPendingProduct(prev => ({ ...prev, price: parseInt(priceMatch[0]) }));
                    setVoiceState('AWAITING_CONFIRMATION');
                    await speak(`Listing ${pendingProduct.quantity} kilograms of ${pendingProduct.name} at ${priceMatch[0]} shillings. Say Yes to confirm or No to cancel.`);
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                } else {
                    await speak("I didn't catch the price. Please state the price clearly.");
                    if (recognitionRef.current) { setIsListening(true); recognitionRef.current.start(); }
                }
                break;

            case 'AWAITING_CONFIRMATION':
                if (cmd.includes('yes') || cmd.includes('yeah') || cmd.includes('correct') || cmd.includes('yep')) {
                    await speak("Listing confirmed. Saving to the market ledger.");
                    api.post('/products', {
                        name: pendingProduct.name,
                        category: 'ORGANIC',
                        quantity: pendingProduct.quantity,
                        unit: 'kg',
                        price: pendingProduct.price,
                        origin: 'LOCAL',
                        location: 'Voice Direct Listing'
                    }).then(() => {
                        toast.success("Crop listed via Voice!");
                        setVoiceState('IDLE');
                        setPendingProduct({ name: '', quantity: 0, price: 0 });
                    }).catch(() => {
                        speak("Failed to connect to the network. Please try again later.");
                        setVoiceState('IDLE');
                    });
                } else {
                    await speak("Listing cancelled.");
                    setVoiceState('IDLE');
                }
                break;

            case 'AWAITING_SEARCH_QUERY':
                navigate(`/buyer-dashboard?search=${encodeURIComponent(cmd)}`);
                await speak(`Searching the market for ${cmd}.`);
                setVoiceState('IDLE');
                break;
        }
    }, [navigate, voiceState, pendingProduct]);

    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const r = new SpeechRecognition();
            r.continuous = false;
            r.interimResults = true;
            r.lang = 'en-US';

            r.onresult = async (event: any) => {
                const current = event.resultIndex;
                const rawText = event.results[current][0].transcript;
                
                setTranscript(rawText);
                
                if (event.results[current].isFinal) {
                    setIsListening(false); // prevent overlapping
                    
                    // Route through Sunbird API for real-time local-language-to-english intent mapping
                    const text = await translateCommandAsync(rawText);
                    setTranscript(text);
                    
                    processCommand(text);
                }
            };

            r.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                toast.error('Voice recognition error. Check microphone permissions.');
            };

            r.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = r;
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, [processCommand]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            toast.error('Voice recognition not supported in this browser');
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setTranscript('');
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (err) {
                console.error("Speech Recognition start failed:", err);
            }
        }
    };

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100]">
            {!showAssistant ? (
                <button
                    onClick={() => {
                        setShowAssistant(true);
                        speak("Voice assistant active. How can I help you today?");
                    }}
                    className="p-4 bg-emerald-600 text-white rounded-full shadow-2xl hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95 group"
                    title="Activate Voice Assistant"
                >
                    <Mic className="h-6 w-6 group-hover:animate-pulse" />
                </button>
            ) : (
                <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-2xl w-80 animate-in slide-in-from-bottom-10 border border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Voice Assistant</span>
                        </div>
                        <button onClick={() => setShowAssistant(false)} className="text-slate-500 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 min-h-[80px] flex items-center justify-center text-center">
                        {isListening ? (
                            <div className="space-y-3">
                                <div className="flex gap-1 justify-center">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="w-1 bg-emerald-500 rounded-full animate-bounce" style={{ height: '12px', animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                                <p className="text-emerald-400 font-bold text-sm tracking-tight leading-relaxed max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {t("Listening...")}
                                </p>
                                <p className="text-white font-black text-xs uppercase tracking-widest">{transcript}</p>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm font-medium">{t('suggested_commands')}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <div className="p-3 bg-slate-800/30 rounded-xl">
                            <Navigation className="h-4 w-4 text-blue-400 mb-2" />
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{t('navigation_command_hint')}</p>
                            <p className="text-[10px] text-slate-300">"Go to dashboard"</p>
                        </div>
                        <div className="p-3 bg-slate-800/30 rounded-xl flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <Search className="h-4 w-4 text-emerald-400 mb-2" />
                                <Leaf className="h-4 w-4 text-emerald-600 animate-pulse" />
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Auto Listing</p>
                            <p className="text-[10px] text-slate-300">{t('list_command_hint')}</p>
                        </div>
                    </div>

                    <button
                        onClick={toggleListening}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isListening ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'}`}
                    >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {isListening ? 'Stop Listening' : 'Start Command'}
                    </button>
                    
                    <button 
                        onClick={() => processCommand('what is this')}
                        className="w-full mt-3 py-2 text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                        <Info className="h-3 w-3" />
                        What can I do here?
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceAssistant;
