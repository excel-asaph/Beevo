import React, { useState, useCallback, useEffect } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioStream } from '../../hooks/useAudioStream';
import { useBrand } from '../../context/BrandContext';
import { VoicePanel } from './VoicePanel';
import { VisualCanvas } from './VisualCanvas';
import { ProgressPanel } from './ProgressPanel';
import { ChatHistory } from './ChatHistory';
import { Junction } from '@shared/types';
import type { FontSuggestion, ColorPalette, BrandDNA } from '@shared/types';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export const ArchitectMain: React.FC = () => {
    const { setDna, addThought } = useBrand();

    // Local state
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [fontSuggestions, setFontSuggestions] = useState<FontSuggestion[]>([]);
    const [colorSuggestions, setColorSuggestions] = useState<ColorPalette[]>([]);
    const [previewText, setPreviewText] = useState('Brand Name');
    const [suggestionMode, setSuggestionMode] = useState<'none' | 'fonts' | 'colors'>('none');
    const [callDuration, setCallDuration] = useState(0);
    const [localDNA, setLocalDNA] = useState<Partial<BrandDNA>>({});

    // WebSocket connection
    const ws = useWebSocket({
        onAudioReceived: (base64Audio) => {
            audioStream.playAudio(base64Audio);
        },
        onTranscription: (role, text) => {
            setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMsg = newHistory[newHistory.length - 1];

                // Append to existing message if same role
                if (lastMsg && lastMsg.role === role) {
                    newHistory[newHistory.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + text
                    };
                    return newHistory;
                }

                return [...newHistory, { role, text }];
            });
        },
        onFontSuggestions: (fonts, preview) => {
            setFontSuggestions(fonts);
            setPreviewText(preview);
            setSuggestionMode('fonts');
        },
        onColorSuggestions: (palettes) => {
            setColorSuggestions(palettes);
            setSuggestionMode('colors');
        },
        onDNAUpdate: (dna) => {
            setLocalDNA(dna);
            setDna(dna as BrandDNA);
            // Clear suggestions when DNA is updated (selection confirmed)
            setSuggestionMode('none');
        },
        onThought: (logic) => {
            addThought(logic, Junction.ARCHITECT);
        },
        onSessionStarted: (sessionId) => {
            console.log('Session started:', sessionId);
            addThought('Interactive Design Session initialized', Junction.ARCHITECT);
        },
        onSessionEnded: () => {
            console.log('Session ended');
            addThought('Design session completed', Junction.ARCHITECT);
            setCallDuration(0);
        },
        onError: (message) => {
            console.error('WebSocket error:', message);
            addThought(`Error: ${message}`, Junction.ARCHITECT);
        }
    });

    // Audio stream
    const audioStream = useAudioStream({
        onAudioData: (base64Audio) => {
            ws.sendAudio(base64Audio);
        }
    });

    // Connect WebSocket on mount
    useEffect(() => {
        ws.connect();
        return () => ws.disconnect();
    }, []);

    // Call duration timer
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (ws.isGeminiConnected) {
            timer = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [ws.isGeminiConnected]);

    // Start/end session handlers
    const handleStartSession = useCallback(async () => {
        try {
            await audioStream.startRecording();
            ws.startSession();
        } catch (error) {
            console.error('Failed to start session:', error);
        }
    }, [ws, audioStream]);

    const handleEndSession = useCallback(() => {
        audioStream.stopRecording();
        ws.endSession();
    }, [ws, audioStream]);

    // Selection handlers
    const handleFontSelect = useCallback((fontName: string) => {
        ws.sendSelection('font', fontName);
    }, [ws]);

    const handleColorSelect = useCallback((paletteName: string) => {
        ws.sendSelection('color', paletteName);
    }, [ws]);

    // Text input handler
    const handleTextInput = useCallback((text: string) => {
        ws.sendText(text);
        // Add to chat history as user message
        setChatHistory(prev => [...prev, { role: 'user', text }]);
    }, [ws]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
            {/* Left Column: Voice & Chat */}
            <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
                <VoicePanel
                    isConnected={ws.status === 'connected'}
                    isGeminiConnected={ws.isGeminiConnected}
                    isRecording={audioStream.isRecording}
                    isMuted={audioStream.isMuted}
                    callDuration={callDuration}
                    onStartSession={handleStartSession}
                    onEndSession={handleEndSession}
                    onToggleMute={audioStream.toggleMute}
                    onTextInput={handleTextInput}
                />

                <div className="flex-1 min-h-0 overflow-hidden">
                    <ChatHistory messages={chatHistory} />
                </div>
            </div>

            {/* Middle Column: Visual Canvas */}
            <div className="lg:col-span-1 min-h-0 overflow-hidden">
                <VisualCanvas
                    mode={suggestionMode}
                    fontSuggestions={fontSuggestions}
                    colorSuggestions={colorSuggestions}
                    previewText={previewText}
                    onFontSelect={handleFontSelect}
                    onColorSelect={handleColorSelect}
                />
            </div>

            {/* Right Column: Progress Panel */}
            <div className="lg:col-span-1 min-h-0 overflow-hidden">
                <ProgressPanel
                    brandDNA={localDNA as BrandDNA}
                    onEditRequest={(field) => {
                        ws.sendText(`I want to change the ${field}`);
                    }}
                />
            </div>
        </div>
    );
};
