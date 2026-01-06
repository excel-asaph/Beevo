import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBrand } from '../context/BrandContext';
import { Junction } from '../types';
import { Phone, PhoneOff, Palette, Code, Radio, User, Bot, Type as TypeIcon, Check, Send, Sparkles, MousePointerClick, Loader2, Terminal, Mic, MicOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Tool } from '@google/genai';
import { MODELS } from '../constants';

// --- Tool Definitions ---
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "display_font_suggestions",
    description: "Display visual font options on the canvas. Use this whenever discussing typography choices.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        fonts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Font family name (e.g., 'Playfair Display', 'Inter', 'Pacifico')" },
              category: { type: Type.STRING, description: "serif, sans-serif, display, handwriting, monospace" },
              reasoning: { type: Type.STRING, description: "Brief reason for this suggestion" }
            },
            required: ["name", "category", "reasoning"]
          }
        },
        context_text: {
            type: Type.STRING,
            description: "The text to preview in this font (e.g. Brand Name or 'Kid Shoes')"
        }
      },
      required: ["fonts", "context_text"]
    }
  },
  {
    name: "display_color_suggestions",
    description: "Display color palette options on the canvas. Use this whenever discussing colors.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        palettes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              colors: { type: Type.ARRAY, items: { type: Type.STRING } },
              vibe: { type: Type.STRING }
            },
            required: ["name", "colors", "vibe"]
          }
        }
      },
      required: ["palettes"]
    }
  },
  {
    name: "update_live_brand_dna",
    description: "Save the Brand DNA to memory. Call this when the user makes a decision or provides new info.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        brandName: { type: Type.STRING },
        mission: { type: Type.STRING },
        selectedColors: { type: Type.ARRAY, items: { type: Type.STRING } },
        selectedFont: { type: Type.STRING },
        voice: { type: Type.STRING }
      }
    }
  }
];

const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];

const logError = (source: string, error: any) => {
    // Silent error logging for internal debugging, keeping UI clean
    console.groupCollapsed(`[${source}] Error`);
    console.error(error);
    console.groupEnd();
};

export const Architect: React.FC = () => {
  const { setDna, dna, addThought } = useBrand();
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);
  const [textInput, setTextInput] = useState('');
  
  // Visual State
  const [suggestionMode, setSuggestionMode] = useState<'none' | 'fonts' | 'colors'>('none');
  const [fontSuggestions, setFontSuggestions] = useState<any[]>([]);
  const [previewText, setPreviewText] = useState("Brand Name");
  const [colorSuggestions, setColorSuggestions] = useState<any[]>([]);
  const [callDuration, setCallDuration] = useState(0);

  // Audio & Session Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTime = useRef<number>(0);
  
  // CRITICAL: Use Ref for active session to avoid Closure/Promise race conditions
  const activeSessionRef = useRef<any>(null); 
  const timerRef = useRef<any>(null);
  
  // State Machine Refs
  // isToolProcessing: TRUE when server has requested a tool, FALSE when server sends content (modelTurn)
  const isToolProcessing = useRef(false);
  // isAudioWarmup: TRUE during initial connection to prevent burst noise causing 1011
  const isAudioWarmup = useRef(true);

  const INPUT_SAMPLE_RATE = 16000;
  const OUTPUT_SAMPLE_RATE = 24000;

  const SYSTEM_INSTRUCTION = `You are a visual Brand Architect. Your goal is to build a Style Guide interactively.
  1. Ask for the Brand Name & Mission. As you understand it, call 'update_live_brand_dna'.
  2. Discuss Typography. BEFORE asking the user to pick, call 'display_font_suggestions' with 3 distinct options AND a relevant 'context_text'.
  3. When the user picks a font, call 'update_live_brand_dna'.
  4. Discuss Colors. BEFORE asking the user to pick, call 'display_color_suggestions' with 3 distinct palettes.
  5. When the user picks a palette, call 'update_live_brand_dna'.
  Be concise and professional.`;
  
  const cleanup = useCallback(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (outputContextRef.current) outputContextRef.current.close();
      if (processorRef.current) processorRef.current.disconnect();
      
      streamRef.current = null;
      audioContextRef.current = null;
      outputContextRef.current = null;
      processorRef.current = null;
      activeSessionRef.current = null;
      
      isToolProcessing.current = false;
      isAudioWarmup.current = true;
      setIsConnecting(false);
  }, []);

  useEffect(() => {
      return () => cleanup();
  }, [cleanup]);

  const connectLive = async () => {
    if (isLive || isConnecting) return;
    setIsConnecting(true);
    cleanup();

    try {
      addThought("Initializing Interactive Design Session...", Junction.ARCHITECT);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      audioContextRef.current = ac;
      const source = ac.createMediaStreamSource(stream);
      const processor = ac.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(ac.destination);

      const outAc = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputContextRef.current = outAc;
      nextStartTime.current = 0;

      // Initialize session
      const sessionPromise = ai.live.connect({
        model: MODELS.ARCHITECT_LIVE,
        callbacks: {
          onopen: () => {
            console.log("Live Session Open");
            setIsLive(true);
            setIsConnecting(false);
            setCallDuration(0);
            timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
            
            // WARMUP PHASE: Don't send audio for first 500ms to allow socket to stabilize
            isAudioWarmup.current = true;
            setTimeout(() => {
                isAudioWarmup.current = false;
                console.log("Audio Warmup Complete - Mic Live");
            }, 500);

            processor.onaudioprocess = (e) => {
              // 1. Check Global Locks
              if (isAudioWarmup.current) return;
              if (isToolProcessing.current) return;
              if (!activeSessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // 2. Downsample/Convert
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                 int16[i] = inputData[i] * 32768;
              }
              let binary = '';
              const bytes = new Uint8Array(int16.buffer);
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const b64 = btoa(binary);

              // 3. Send via Ref (Synchronous check against ref)
              try {
                  // Double check lock before sending
                  if (!isToolProcessing.current) {
                      activeSessionRef.current.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: b64 } });
                  }
              } catch (err) {
                  // Silent fail on session close
              }
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            const { serverContent, toolCall } = msg;

            // --- TOOL HANDLING (LOCK) ---
            if (toolCall) {
              console.log(`🛠️ Tool Call: ${toolCall.functionCalls.map(f => f.name).join(', ')}`);
              
              // 1. LOCK MIC
              isToolProcessing.current = true;

              const functionResponses = toolCall.functionCalls.map(fc => ({
                  id: fc.id,
                  name: fc.name,
                  response: { result: "success" } 
              }));

              // 2. SEND RESPONSE
              if (activeSessionRef.current) {
                  try {
                      await activeSessionRef.current.sendToolResponse({ functionResponses });
                      console.log("✅ Tool Response Sent");
                  } catch (e) {
                      logError("sendToolResponse", e);
                  }
              }

              // 3. UPDATE UI (Silent background update)
              requestAnimationFrame(() => {
                  toolCall.functionCalls.forEach(fc => {
                      const args = fc.args as any;
                      if (fc.name === "display_font_suggestions") {
                             setFontSuggestions(args.fonts || []);
                             if (args.context_text) setPreviewText(args.context_text);
                             setSuggestionMode('fonts');
                             addThought(`Visual Thread: Rendering typography for '${args.context_text}'`, Junction.ARCHITECT);
                      } 
                      else if (fc.name === "display_color_suggestions") {
                             setColorSuggestions(args.palettes || []);
                             setSuggestionMode('colors');
                             addThought("Visual Thread: Rendering color palettes", Junction.ARCHITECT);
                      }
                      else if (fc.name === "update_live_brand_dna") {
                             setDna(prev => ({
                                 name: args.brandName || prev?.name || "Untitled Brand",
                                 mission: args.mission || prev?.mission || "",
                                 colors: args.selectedColors || prev?.colors || [],
                                 typography: args.selectedFont ? [args.selectedFont] : (prev?.typography || []),
                                 voice: args.voice || prev?.voice || "Professional",
                                 logoUrl: prev?.logoUrl
                             }));
                             if (args.selectedFont || args.selectedColors) {
                                 setSuggestionMode('none');
                                 addThought("Visual Thread: Updated Brand DNA", Junction.ARCHITECT);
                             }
                      }
                  });
              });
              
              // RETURN EARLY to prevent unlocking logic from running on this message
              return;
            }

            // --- CONTENT HANDLING (UNLOCK) ---
            // Unlock ONLY when model provides content (modelTurn)
            if (serverContent?.modelTurn) {
                if (isToolProcessing.current) {
                    console.log("🔊 Model Speaking - Unlocking Mic");
                    isToolProcessing.current = false;
                }
            }

            // --- AUDIO OUTPUT ---
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputContextRef.current) {
                playAudioChunk(audioData, outputContextRef.current);
            }
            
            // --- TRANSCRIPTION ---
            const outText = serverContent?.outputTranscription?.text;
            const inText = serverContent?.inputTranscription?.text;
            if (outText || inText) {
                const incomingText = outText || inText || '';
                const incomingRole = outText ? 'model' : 'user';
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    if (lastMsg && lastMsg.role === incomingRole) {
                        newHistory[newHistory.length - 1] = { ...lastMsg, text: lastMsg.text + incomingText };
                        return newHistory;
                    } else {
                        return [...newHistory, { role: incomingRole, text: incomingText }];
                    }
                });
            }
          },
          onclose: (e) => {
              console.log("Session Closed", e);
              setIsLive(false);
              cleanup();
          },
          onerror: (err) => {
              logError("Live API Fatal", err);
              setIsLive(false);
              cleanup();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            tools: tools,
            systemInstruction: SYSTEM_INSTRUCTION,
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}, 
        }
      });

      // Assign Ref immediately after promise creation (for access in closure if needed, though we wait for resolution)
      // Actually, we need the resolved session.
      sessionPromise.then(s => {
          activeSessionRef.current = s;
      }).catch(e => {
          logError("Session Connect Fail", e);
          setIsLive(false);
          setIsConnecting(false);
          cleanup();
      });

    } catch (err) {
      logError("Session Initialization", err);
      setIsLive(false);
      setIsConnecting(false);
      cleanup();
    }
  };

  const sendTextMessage = async (text: string) => {
      if (!text.trim() || !activeSessionRef.current) return;
      if (isToolProcessing.current) return; // Don't send text while tool is processing

      const msgText = text;
      setTextInput('');
      setChatHistory(prev => [...prev, { role: 'user', text: msgText }]);
      try {
          activeSessionRef.current.send({ parts: [{ text: msgText }], turnComplete: true });
      } catch (e) {
          logError("sendTextMessage", e);
      }
  };

  const handleSelection = (type: 'font' | 'color', value: string) => {
      const message = type === 'font' 
        ? `I choose the ${value} font.` 
        : `I choose the ${value} palette.`;
      sendTextMessage(message);
  };

  const playAudioChunk = (base64Data: string, ctx: AudioContext) => {
      try {
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
          const int16Data = new Int16Array(bytes.buffer);
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) float32Data[i] = int16Data[i] / 32768.0;
          const buffer = ctx.createBuffer(1, float32Data.length, OUTPUT_SAMPLE_RATE);
          buffer.copyToChannel(float32Data, 0);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          const startTime = Math.max(ctx.currentTime, nextStartTime.current);
          source.start(startTime);
          nextStartTime.current = startTime + buffer.duration;
      } catch (e) { 
          // Ignore audio decode errors (often happens on close)
      }
  };

  const disconnectLive = () => {
    setIsLive(false);
    cleanup();
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatHistory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Interaction Panel */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 flex flex-col h-full max-h-[calc(100vh-100px)] overflow-hidden relative">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center">
          <div>
              <h2 className="text-2xl font-bold flex items-center text-purple-400">
                <Sparkles className="mr-3 w-6 h-6" /> The Architect
              </h2>
              <p className="text-slate-400 text-sm">
                Interactive Vibe Coding
              </p>
          </div>
          {isLive && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-900/30">
                  <Mic size={12} className="text-purple-300"/>
                  <span className="font-mono text-sm text-purple-200">{formatTime(callDuration)}</span>
              </div>
          )}
        </div>

        {/* Chat History Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/30 custom-scrollbar relative">
            {chatHistory.length === 0 && !isLive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
                    <div className="p-6 rounded-full bg-slate-800 mb-6 ring-1 ring-slate-700">
                        <Radio size={48} className="text-slate-500" />
                    </div>
                    <p className="text-lg font-light">Start call to begin interview</p>
                </div>
            ) : null}
            
            {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                     <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                         msg.role === 'user' 
                         ? 'bg-purple-600 text-white rounded-br-none' 
                         : 'bg-slate-700 text-slate-200 rounded-bl-none'
                     }`}>
                         <div className="flex items-center space-x-2 mb-1.5 opacity-60 text-[10px] uppercase font-bold tracking-wider">
                             {msg.role === 'user' ? <User size={10}/> : <Bot size={10}/>}
                             <span>{msg.role === 'user' ? 'You' : 'Architect'}</span>
                         </div>
                         {msg.text}
                     </div>
                </div>
            ))}
        </div>

        {/* Unified Control Bar */}
        <div className="p-4 bg-slate-800 border-t border-slate-700">
            {/* Call Status & Controls */}
            <div className="flex items-center space-x-4 mb-4">
                {!isLive ? (
                    <button 
                        onClick={connectLive} 
                        disabled={isConnecting}
                        className="w-full flex items-center justify-center space-x-3 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-900/30 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isConnecting ? <Loader2 className="animate-spin" size={20} /> : <Phone size={20} fill="currentColor" />}
                        <span>{isConnecting ? "Connecting..." : "Start Design Call"}</span>
                    </button>
                ) : (
                    <button 
                        onClick={disconnectLive} 
                        className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-900/30 transition-all"
                    >
                        <PhoneOff size={20} fill="currentColor" />
                        <span>End Session</span>
                    </button>
                )}
            </div>

            {/* Text Input Fallback */}
            <div className="flex items-center space-x-3">
                <input 
                    type="text" 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendTextMessage(textInput)}
                    placeholder={isLive ? "Type a message..." : "Start call to interact..."}
                    disabled={!isLive}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-4 pr-10 text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 text-sm"
                />
                <button 
                    onClick={() => sendTextMessage(textInput)}
                    disabled={!isLive || !textInput.trim()}
                    className="p-2.5 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700"
                >
                    <Send size={16} />
                </button>
            </div>
            {/* Debug Console Access (Hidden/Subtle) */}
            <div className="mt-2 text-[10px] text-slate-600 text-center flex justify-center items-center cursor-help" title="Check console for detailed logs">
                <Terminal size={10} className="mr-1" /> 
                System: {isLive ? 'Active' : 'Standby'}
            </div>
        </div>
      </div>

      {/* Dynamic Canvas (Morphing based on state) */}
      <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl relative overflow-hidden h-full flex flex-col">
        <div className="absolute top-0 right-0 p-4 bg-slate-100 rounded-bl-xl text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center z-10">
            {suggestionMode === 'fonts' && <TypeIcon className="w-4 h-4 mr-2 text-purple-600"/>}
            {suggestionMode === 'colors' && <Palette className="w-4 h-4 mr-2 text-orange-600"/>}
            {suggestionMode === 'none' && <Code className="w-4 h-4 mr-2 text-slate-600"/>}
            {suggestionMode === 'fonts' ? 'Reviewing Fonts' : suggestionMode === 'colors' ? 'Reviewing Palettes' : 'Live Style Guide'}
        </div>

        {/* Suggestion Mode: Fonts */}
        {suggestionMode === 'fonts' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 flex-1 flex flex-col">
                <h3 className="text-2xl font-bold mb-2 text-slate-800">Typography Options</h3>
                <p className="text-slate-500 mb-6 text-sm">Context: "{previewText}" — Click an option to select it.</p>
                
                <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 custom-light-scrollbar pb-10">
                    {fontSuggestions.map((font, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => handleSelection('font', font.name)}
                            className="p-6 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:shadow-xl transition-all cursor-pointer group bg-slate-50 relative"
                        >
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 text-white p-1 rounded-full">
                                <MousePointerClick size={16} />
                            </div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-1 bg-white text-xs font-bold uppercase tracking-wider text-slate-500 rounded border border-slate-200">{font.category}</span>
                            </div>
                            {/* Uses the loaded Google Fonts now! */}
                            <h4 className="text-5xl mb-4 leading-tight text-slate-900" style={{ fontFamily: `"${font.name}", sans-serif` }}>
                                {previewText}
                            </h4>
                            <p className="text-lg text-slate-600 mb-2 font-light" style={{ fontFamily: `"${font.name}", sans-serif` }}>
                                The quick brown fox jumps over the lazy dog.
                            </p>
                            <div className="flex items-center text-xs text-slate-400 mt-4 border-t border-slate-200 pt-3">
                                <Sparkles className="w-3 h-3 mr-1 text-purple-400"/>
                                <span className="italic">"{font.reasoning}"</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Suggestion Mode: Colors */}
        {suggestionMode === 'colors' && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 flex-1 flex flex-col">
                <h3 className="text-2xl font-bold mb-2 text-slate-800">Palette Options</h3>
                <p className="text-slate-500 mb-6 text-sm">Click a palette to apply it to your Brand DNA.</p>

                <div className="grid grid-cols-1 gap-6 overflow-y-auto pr-2 custom-light-scrollbar pb-10">
                    {colorSuggestions.map((palette, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => handleSelection('color', palette.name)}
                            className="border-2 border-slate-200 rounded-xl overflow-hidden hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer group relative"
                        >
                            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur text-white p-1 rounded-full">
                                <MousePointerClick size={16} />
                            </div>
                            <div className="h-32 flex">
                                {palette.colors.map((c: string, i: number) => (
                                    <div key={i} className="flex-1 h-full flex items-end justify-center pb-2 group/color relative" style={{ backgroundColor: c }}>
                                        <span className="text-[10px] font-mono uppercase bg-black/20 text-white px-1 rounded opacity-0 group-hover/color:opacity-100 transition-opacity">{c}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-white">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className="font-bold text-lg text-slate-800">{palette.name}</h4>
                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{palette.vibe}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Default Mode: DNA Builder */}
        {suggestionMode === 'none' && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500 overflow-y-auto h-full pb-20 pt-8 custom-light-scrollbar">
                {dna ? (
                    <>
                        <div className="pb-6 border-b border-slate-200">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Brand Identity</span>
                            <h1 className="text-6xl font-black tracking-tight mb-2 transition-all duration-500" style={{ color: dna.colors?.[0] || '#0f172a', fontFamily: `"${dna.typography?.[0]}", sans-serif` }}>
                                {dna.name || "Untitled Brand"}
                            </h1>
                            <p className="text-xl font-light text-slate-600 italic">
                                "{dna.mission || "Identifying brand mission..."}"
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
                                <Palette className="w-4 h-4 mr-2"/> Official Palette
                            </h3>
                            {dna.colors && dna.colors.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {dna.colors.map((color, i) => (
                                        <div key={i} className="space-y-2 group animate-in zoom-in duration-300" style={{ animationDelay: `${i*100}ms` }}>
                                            <div className="h-24 rounded-lg shadow-md ring-1 ring-slate-900/5 transition-transform hover:scale-105" style={{ backgroundColor: color }}></div>
                                            <div className="text-xs font-mono font-bold text-slate-500">{color}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                                    Waiting for color selection...
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center">
                                <TypeIcon className="w-4 h-4 mr-2"/> Primary Typography
                            </h3>
                            {dna.typography && dna.typography.length > 0 ? (
                                <div className="p-8 bg-slate-50 rounded-xl border border-slate-100 animate-in slide-in-from-bottom-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="text-xs font-mono text-slate-400 uppercase border border-slate-200 px-2 py-1 rounded bg-white">{dna.typography[0]}</span>
                                        <Check className="w-6 h-6 text-green-500"/>
                                    </div>
                                    <p className="text-5xl font-bold mb-4 text-slate-900" style={{ fontFamily: `"${dna.typography[0]}", sans-serif` }}>
                                        {dna.name}
                                    </p>
                                    <p className="text-xl opacity-80 leading-relaxed text-slate-700" style={{ fontFamily: `"${dna.typography[0]}", sans-serif` }}>
                                        This is how your brand voice looks in print. The quick brown fox jumps over the lazy dog to verify legibility and style across all mediums.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                                    Waiting for font selection...
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <div className="bg-slate-100 p-6 rounded-full mb-6">
                             <Code className="w-12 h-12 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-400 mb-2">Architect Standby</h3>
                        <p className="max-w-xs text-center text-slate-400">Start the session call to begin building your visual identity.</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};