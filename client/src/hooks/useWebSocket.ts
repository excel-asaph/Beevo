import { useRef, useState, useCallback, useEffect } from 'react';
import type {
    ClientMessage,
    ServerMessage
} from '@shared/messages';
import type { BrandDNA, FontSuggestion, ColorPalette, LogoStructureOption, ImagerySuggestion, ResearchPhaseObject } from '@shared/types';

// WebSocket connection states
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketOptions {
    onAudioReceived?: (base64Audio: string) => void;
    onTranscription?: (role: 'user' | 'model', text: string) => void;
    onFontSuggestions?: (fonts: FontSuggestion[], previewText: string) => void;
    onColorSuggestions?: (palettes: ColorPalette[]) => void;
    onDNAUpdate?: (dna: BrandDNA) => void;
    onFullStateUpdate?: (state: ResearchPhaseObject) => void;
    onThought?: (logic: string) => void;
    onError?: (message: string) => void;
    onSessionStarted?: (sessionId: string) => void;
    onSessionEnded?: () => void;
    onInterrupt?: () => void;
    onToolProcessingStart?: (toolType?: 'display_fonts' | 'display_colors' | 'update_dna' | 'search_logo_inspiration' | 'display_logo_structure_options' | 'display_imagery_suggestions', targetField?: string) => void;
    onToolProcessingEnd?: () => void;
    onLogoConcepts?: (concepts: Array<{ id: string; url: string; source: string; style: string; mood: string; reasoning: string; alt_text: string }>) => void;
    onLogoStructureOptions?: (options: LogoStructureOption[]) => void;
    onImagerySuggestions?: (suggestions: ImagerySuggestion[]) => void;
    // Logo research progress for browser automation
    onLogoResearchProgress?: (phase: 'starting' | 'browsing' | 'analyzing' | 'complete', source: string, progress: number, message: string) => void;
    onLogoResearchResult?: (logos: any[], insights: any, screenshots: string[]) => void;
    onVaultUpdate?: (stats: { fileCount: number; totalTokens: number; isIngesting: boolean }) => void;
    // Thinking levels for hackathon
    onThinkingStart?: (timestamp: number) => void;
    onThinkingStream?: (thought: string, phase: 'classify' | 'analyze' | 'decide' | 'execute') => void;
    onThinkingEnd?: (duration: number, toolDecided: string | null, thoughtSummary: string[]) => void;
    // Agentic Brand Discovery
    onResearchUpdate?: (status: 'started' | 'searching' | 'analyzing' | 'generating' | 'complete', message: string, step: number, totalSteps: number, competitors?: string[], thoughts?: Array<{ id: string; text: string; status: 'pending' | 'active' | 'complete' }>) => void;
    onThoughtSignature?: (nodeId: string, title: string, reasoning: string, confidence?: number) => void;
    // Research complete signal - all data is ready
    onResearchComplete?: (summary: { brandName: string; colorsGenerated: number; fontsGenerated: number; competitorsFound: number }) => void;
}

interface UseWebSocketReturn {
    status: ConnectionStatus;
    sessionId: string | null;
    isGeminiConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    startSession: () => void;
    endSession: () => void;
    sendAudio: (base64Audio: string) => boolean;
    sendText: (text: string) => boolean;
    sendSelection: (selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery', value: string, context?: any) => boolean;
    sendInterrupt: () => boolean;
    sendActivityEnd: () => boolean;
    sendActivityStart: () => boolean;
    sendFile: (file: File, base64Data: string, target?: 'extraction' | 'vault') => boolean;
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
            return true;
        }
        console.warn('⚠️ WebSocket not connected, failed to send message:', message.type);
        return false;
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

                case 'FULL_STATE_UPDATE':
                    opts.onFullStateUpdate?.(message.state);
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

                case 'TOOL_PROCESSING_START':
                    opts.onToolProcessingStart?.(message.toolType, message.targetField);
                    break;

                case 'TOOL_PROCESSING_END':
                    opts.onToolProcessingEnd?.();
                    break;

                case 'LOGO_CONCEPTS':
                    opts.onLogoConcepts?.(message.concepts);
                    break;

                case 'IMAGERY_SUGGESTIONS':
                    opts.onImagerySuggestions?.(message.suggestions);
                    break;

                // Thinking levels for hackathon
                case 'THINKING_START':
                    opts.onThinkingStart?.(message.timestamp);
                    break;

                case 'THINKING_STREAM':
                    opts.onThinkingStream?.(message.thought, message.phase);
                    break;

                case 'THINKING_END':
                    opts.onThinkingEnd?.(message.duration, message.toolDecided, message.thoughtSummary);
                    break;

                case 'LOGO_RESEARCH_PROGRESS':
                    opts.onLogoResearchProgress?.(message.phase, message.source, message.progress, message.message);
                    break;

                case 'LOGO_RESEARCH_RESULT':
                    opts.onLogoResearchResult?.(message.logos, message.insights, message.screenshots);
                    break;

                case 'LOGO_STRUCTURE_OPTIONS':
                    opts.onLogoStructureOptions?.(message.options);
                    break;



                case 'VAULT_UPDATE':
                    opts.onVaultUpdate?.(message.stats);
                    break;

                case 'RESEARCH_UPDATE':
                    opts.onResearchUpdate?.(message.status, message.message, message.step, message.totalSteps, message.competitors, message.thoughts);
                    break;

                case 'THOUGHT_SIGNATURE':
                    opts.onThoughtSignature?.(message.nodeId, message.title, message.reasoning, message.confidence);
                    break;

                case 'RESEARCH_COMPLETE':
                    console.log('🎉 Research complete signal received:', message.summary);
                    opts.onResearchComplete?.(message.summary);
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
        return sendMessage({ type: 'AUDIO_CHUNK', data: base64Audio });
    }, [sendMessage]);

    const sendText = useCallback((text: string) => {
        return sendMessage({ type: 'TEXT_INPUT', text });
    }, [sendMessage]);

    const sendSelection = useCallback((selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery', value: string, context?: any) => {
        return sendMessage({ type: 'SELECTION_EVENT', selectionType, value, context });
    }, [sendMessage]);

    const sendInterrupt = useCallback(() => {
        return sendMessage({ type: 'INTERRUPT' });
    }, [sendMessage]);

    // VAD: Signal that user has finished speaking
    const sendActivityEnd = useCallback(() => {
        return sendMessage({ type: 'ACTIVITY_END' });
    }, [sendMessage]);

    // VAD: Signal that user has started speaking
    const sendActivityStart = useCallback(() => {
        return sendMessage({ type: 'ACTIVITY_START' });
    }, [sendMessage]);

    // NEW: Send file content to server
    const sendFile = useCallback((file: File, base64Data: string, target?: 'extraction' | 'vault') => {
        return sendMessage({
            type: 'FILE_UPLOAD',
            base64: base64Data,
            mimeType: file.type,
            fileName: file.name,
            target
        });
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
        sendSelection,
        sendInterrupt,
        sendActivityEnd,
        sendActivityStart,
        sendFile
    };
}



export default useWebSocket;
