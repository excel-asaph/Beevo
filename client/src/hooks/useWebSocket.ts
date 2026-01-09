import { useRef, useState, useCallback, useEffect } from 'react';
import type {
    ClientMessage,
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage,
    TranscriptionMessage,
    DNAUpdateMessage
} from '@shared/messages';
import type { BrandDNA, FontSuggestion, ColorPalette } from '@shared/types';

// WebSocket connection states
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
    onAudioReceived?: (base64Audio: string) => void;
    onTranscription?: (role: 'user' | 'model', text: string) => void;
    onFontSuggestions?: (fonts: FontSuggestion[], previewText: string) => void;
    onColorSuggestions?: (palettes: ColorPalette[]) => void;
    onDNAUpdate?: (dna: BrandDNA) => void;
    onThought?: (logic: string) => void;
    onError?: (message: string) => void;
    onSessionStarted?: (sessionId: string) => void;
    onSessionEnded?: () => void;
    onInterrupt?: () => void;
}

interface UseWebSocketReturn {
    status: ConnectionStatus;
    sessionId: string | null;
    isGeminiConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    startSession: () => void;
    endSession: () => void;
    sendAudio: (base64Audio: string) => void;
    sendText: (text: string) => void;
    sendSelection: (type: 'font' | 'color', value: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isGeminiConnected, setIsGeminiConnected] = useState(false);

    // Store options in ref to avoid stale closures
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const sendMessage = useCallback((message: ClientMessage) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const message: ServerMessage = JSON.parse(event.data);
            const opts = optionsRef.current;

            switch (message.type) {
                case 'SESSION_STARTED':
                    setSessionId(message.sessionId);
                    opts.onSessionStarted?.(message.sessionId);
                    break;

                case 'SESSION_ENDED':
                    setSessionId(null);
                    setIsGeminiConnected(false);
                    opts.onSessionEnded?.();
                    break;

                case 'AUDIO_CHUNK':
                    opts.onAudioReceived?.(message.data);
                    break;

                case 'TRANSCRIPTION':
                    opts.onTranscription?.(message.role, message.text);
                    break;

                case 'FONT_SUGGESTIONS':
                    opts.onFontSuggestions?.(message.fonts, message.previewText);
                    break;

                case 'COLOR_SUGGESTIONS':
                    opts.onColorSuggestions?.(message.palettes);
                    break;

                case 'DNA_UPDATE':
                    opts.onDNAUpdate?.(message.dna);
                    break;

                case 'THOUGHT':
                    opts.onThought?.(message.logic);
                    break;

                case 'CONNECTION_STATUS':
                    setIsGeminiConnected(message.geminiConnected);
                    break;

                case 'INTERRUPT':
                    opts.onInterrupt?.();
                    break;

                case 'ERROR':
                    console.error('WebSocket error:', message.message);
                    opts.onError?.(message.message);
                    break;
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }, []);

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        setStatus('connecting');

        // Connect to backend WebSocket
        const wsUrl = process.env.WS_URL || 'ws://localhost:3001';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setStatus('connected');
        };

        ws.onmessage = handleMessage;

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setStatus('error');
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            setStatus('disconnected');
            setSessionId(null);
            setIsGeminiConnected(false);
        };

        wsRef.current = ws;
    }, [handleMessage]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setStatus('disconnected');
        setSessionId(null);
        setIsGeminiConnected(false);
    }, []);

    const startSession = useCallback(() => {
        sendMessage({ type: 'START_SESSION' });
    }, [sendMessage]);

    const endSession = useCallback(() => {
        sendMessage({ type: 'END_SESSION' });
    }, [sendMessage]);

    const sendAudio = useCallback((base64Audio: string) => {
        sendMessage({ type: 'AUDIO_CHUNK', data: base64Audio });
    }, [sendMessage]);

    const sendText = useCallback((text: string) => {
        sendMessage({ type: 'TEXT_INPUT', text });
    }, [sendMessage]);

    const sendSelection = useCallback((selectionType: 'font' | 'color', value: string) => {
        sendMessage({ type: 'USER_SELECTION', selectionType, value });
    }, [sendMessage]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return {
        status,
        sessionId,
        isGeminiConnected,
        connect,
        disconnect,
        startSession,
        endSession,
        sendAudio,
        sendText,
        sendSelection
    };
}
