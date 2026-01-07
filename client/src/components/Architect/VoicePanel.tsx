import React, { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Send, Loader2, Sparkles } from 'lucide-react';

interface VoicePanelProps {
    isConnected: boolean;
    isGeminiConnected: boolean;
    isRecording: boolean;
    isMuted: boolean;
    callDuration: number;
    onStartSession: () => void;
    onEndSession: () => void;
    onToggleMute: () => void;
    onTextInput: (text: string) => void;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({
    isConnected,
    isGeminiConnected,
    isRecording,
    isMuted,
    callDuration,
    onStartSession,
    onEndSession,
    onToggleMute,
    onTextInput
}) => {
    const [textInput, setTextInput] = useState('');

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendText = () => {
        if (textInput.trim()) {
            onTextInput(textInput.trim());
            setTextInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendText();
        }
    };

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold flex items-center text-purple-400">
                        <Sparkles className="mr-3 w-6 h-6" /> The Architect
                    </h2>
                    <p className="text-slate-400 text-sm">Interactive Vibe Coding</p>
                </div>

                {isGeminiConnected && (
                    <div className="flex items-center space-x-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-900/30">
                        <Mic size={12} className="text-purple-300" />
                        <span className="font-mono text-sm text-purple-200">
                            {formatTime(callDuration)}
                        </span>
                    </div>
                )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 mb-4 text-xs">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-slate-400">
                    {isConnected ? 'Connected to server' : 'Disconnected'}
                </span>
                {isGeminiConnected && (
                    <>
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-purple-400">Gemini Live Active</span>
                    </>
                )}
            </div>

            {/* Call Controls */}
            <div className="flex items-center gap-3 mb-4">
                {!isGeminiConnected ? (
                    <button
                        onClick={onStartSession}
                        disabled={!isConnected}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold shadow-lg shadow-green-900/30 transition-all hover:scale-[1.02]"
                    >
                        {!isConnected ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Phone size={20} fill="currentColor" />
                        )}
                        <span>{!isConnected ? 'Connecting...' : 'Start Design Call'}</span>
                    </button>
                ) : (
                    <>
                        <button
                            onClick={onToggleMute}
                            className={`p-4 rounded-xl font-bold transition-all ${isMuted
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                                }`}
                        >
                            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>

                        <button
                            onClick={onEndSession}
                            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-900/30 transition-all"
                        >
                            <PhoneOff size={20} fill="currentColor" />
                            <span>End Session</span>
                        </button>
                    </>
                )}
            </div>

            {/* Text Input */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isGeminiConnected ? "Type a message..." : "Start call to interact..."}
                    disabled={!isGeminiConnected}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50 text-sm"
                />
                <button
                    onClick={handleSendText}
                    disabled={!isGeminiConnected || !textInput.trim()}
                    className="p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-30 disabled:hover:bg-purple-600 transition-colors"
                >
                    <Send size={16} />
                </button>
            </div>

            {/* Mute indicator */}
            {isMuted && isGeminiConnected && (
                <div className="mt-3 text-center text-amber-400 text-xs flex items-center justify-center gap-1">
                    <MicOff size={12} />
                    <span>Microphone muted - AI cannot hear you</span>
                </div>
            )}
        </div>
    );
};
