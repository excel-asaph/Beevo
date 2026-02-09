import { useRef, useState, useCallback, useEffect } from 'react';
import type {
    ClientMessage,
    ServerMessage
} from '@shared/messages';
import type { BrandDNA, FontSuggestion, ColorPalette, LogoStructureOption, ImagerySuggestion, ResearchPhaseObject } from '@shared/types';
import { useWorkspace } from '../context/WorkspaceContext';

// WebSocket connection states
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Callback options for WebSocket events.
 */
interface UseWebSocketOptions {
    /** Received audio chunk (base64). */
    onAudioReceived?: (base64Audio: string) => void;
    /** Received transcription text. */
    onTranscription?: (role: 'user' | 'model', text: string) => void;
    /** Received font suggestions. */
    onFontSuggestions?: (fonts: FontSuggestion[], previewText: string) => void;
    /** Received color palette suggestions. */
    onColorSuggestions?: (palettes: ColorPalette[]) => void;
    /** Received updated Brand DNA. */
    onDNAUpdate?: (dna: BrandDNA) => void;
    /** Received full state update (legacy). */
    onFullStateUpdate?: (state: ResearchPhaseObject) => void;
    /** Received an AI thought log. */
    onThought?: (logic: string) => void;
    /** Received an error message. */
    onError?: (message: string, code?: string, redirect?: boolean) => void;
    /** Session started successfully. */
    onSessionStarted?: (sessionId: string) => void;
    /** Session ended. */
    onSessionEnded?: () => void;
    /** Received interrupt signal. */
    onInterrupt?: () => void;
    /** Tool processing started (e.g., 'analyzing'). */
    onToolProcessingStart?: (toolType?: 'display_fonts' | 'display_colors' | 'update_dna' | 'search_logo_inspiration' | 'display_logo_structure_options' | 'display_imagery_suggestions', targetField?: string) => void;
    /** Tool processing ended. */
    onToolProcessingEnd?: () => void;
    /** Detailed tool execution log. */
    onToolExecution?: (message: any) => void;
    /** Received generated logo concepts. */
    onLogoConcepts?: (concepts: Array<{ id: string; url: string; source: string; style: string; mood: string; reasoning: string; alt_text: string }>) => void;
    /** Received logo structure options. */
    onLogoStructureOptions?: (options: LogoStructureOption[]) => void;
    /** Received imagery suggestions. */
    onImagerySuggestions?: (suggestions: ImagerySuggestion[]) => void;
    /** Logo research progress update. */
    onLogoResearchProgress?: (phase: 'starting' | 'browsing' | 'analyzing' | 'complete', source: string, progress: number, message: string) => void;
    /** Logo research results complete. */
    onLogoResearchResult?: (logos: any[], insights: any, screenshots: string[]) => void;
    /** Vault status update. */
    onVaultUpdate?: (stats: { fileCount: number; totalTokens: number; isIngesting: boolean }) => void;
    /** Thinking process started. */
    onThinkingStart?: (timestamp: number) => void;
    /** Thinking process stream update. */
    onThinkingStream?: (thought: string, phase: 'classify' | 'analyze' | 'decide' | 'execute') => void;
    /** Thinking process ended. */
    onThinkingEnd?: (duration: number, toolDecided: string | null, thoughtSummary: string[]) => void;
    /** Agent research status update. */
    onResearchUpdate?: (status: 'started' | 'searching' | 'analyzing' | 'generating' | 'complete', message: string, step: number, totalSteps: number, competitors?: string[], thoughts?: Array<{ id: string; text: string; status: 'pending' | 'active' | 'complete' }>) => void;
    /** Received a formal thought signature (for UI cards). */
    onThoughtSignature?: (nodeId: string, title: string, reasoning: string, confidence?: number) => void;
    /** Research phase complete. */
    onResearchComplete?: (summary: { brandName: string; colorsGenerated: number; fontsGenerated: number; competitorsFound: number }) => void;
    /** Human intervention required. */
    onInterventionRequired?: (count: number, requests: any[]) => void;
    /** Signal-driven architecture: State hash update. */
    onStateUpdate?: (hash: string, path: string) => void;
    /** Signal-driven architecture: Asset resource update. */
    onAssetUpdate?: (resource: string) => void;
}

/**
 * Return type definition for useWebSocket hook.
 */
interface UseWebSocketReturn {
    status: ConnectionStatus;
    sessionId: string | null;
    isGeminiConnected: boolean;
    /** Connects to the WebSocket server. */
    connect: () => void;
    /** Disconnects from the WebSocket server. */
    disconnect: () => void;
    /** Starts a Gemini session. */
    startSession: () => void;
    /** Ends the current Gemini session. */
    endSession: () => void;
    /** Sends audio chunk to server. */
    sendAudio: (base64Audio: string) => boolean;
    /** Sends text input to server. */
    sendText: (text: string) => boolean;
    /** Sends a UI selection event to server. */
    sendSelection: (selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery', value: string, context?: any) => boolean;
    /** Sends an interrupt signal to stop current generation. */
    sendInterrupt: () => boolean;
    /** Signals end of user activity (e.g. speech end). */
    sendActivityEnd: () => boolean;
    /** Signals start of user activity (e.g. speech start). */
    sendActivityStart: () => boolean;
    /** Uploads a file to the server. */
    sendFile: (file: File, base64Data: string, target?: 'extraction' | 'vault') => boolean;
}

/**
 * A powerful hook for managing WebSocket communication with the Beevo backend and Gemini Agent.
 * 
 * Features:
 * - Manages connection lifecycle (connect, disconnect, reconnect).
 * - routes incoming server messages to appropriate callbacks.
 * - Provides methods for sending various data types (audio, text, files, selections).
 * - Handles session management.
 * 
 * @param {UseWebSocketOptions} options - Event handlers for server messages.
 * @returns {UseWebSocketReturn} Connection state and send methods.
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const { workspaceId } = useWorkspace();
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

                case 'TOOL_EXECUTION_LOG':
                    opts.onToolExecution?.(message);
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

                case 'INTERVENTION_REQUIRED':
                    opts.onInterventionRequired?.(message.payload.count, message.payload.requests);
                    break;

                case 'STATE_UPDATE':
                    console.log('📡 WS: Received STATE_UPDATE', message.hash);
                    opts.onStateUpdate?.(message.hash, message.path);
                    break;

                case 'ASSET_UPDATE':
                    console.log('📡 WS: Received ASSET_UPDATE', message.resource);
                    opts.onAssetUpdate?.(message.resource);
                    break;

                case 'ERROR':
                    console.error('WebSocket error:', message.message);
                    opts.onError?.(message.message, (message as any).code, (message as any).redirect);
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
        const baseUrl = process.env.WS_URL || 'ws://localhost:3001';
        const wsUrl = `${baseUrl}?workspaceId=${workspaceId}`;
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
            if (wsRef.current !== ws) return; // Stale socket closed, ignore it

            console.log('WebSocket closed');
            setStatus('disconnected');
            setSessionId(null);
            setIsGeminiConnected(false);
        };

        wsRef.current = ws;
    }, [handleMessage, workspaceId]);

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
