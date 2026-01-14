// WebSocket message types for client-server communication

import { BrandDNA, FontSuggestion, ColorPalette } from './types';

// ============================================
// CLIENT → SERVER MESSAGES
// ============================================

export interface StartSessionMessage {
    type: 'START_SESSION';
}

export interface EndSessionMessage {
    type: 'END_SESSION';
}

export interface AudioChunkMessage {
    type: 'AUDIO_CHUNK';
    data: string; // Base64 encoded PCM audio
}

export interface TextInputMessage {
    type: 'TEXT_INPUT';
    text: string;
}

export interface UserSelectionMessage {
    type: 'USER_SELECTION';
    selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery';
    value: string; // Font name, palette name, logo ID, structure type, or imagery concept
}

export interface UpdateDNAMessage {
    type: 'UPDATE_DNA';
    field: keyof BrandDNA;
    value: any;
}

export type ClientMessage =
    | StartSessionMessage
    | EndSessionMessage
    | AudioChunkMessage
    | TextInputMessage
    | UserSelectionMessage
    | UpdateDNAMessage;

// ============================================
// SERVER → CLIENT MESSAGES
// ============================================

export interface SessionStartedMessage {
    type: 'SESSION_STARTED';
    sessionId: string;
}

export interface SessionEndedMessage {
    type: 'SESSION_ENDED';
}

export interface ServerAudioChunkMessage {
    type: 'AUDIO_CHUNK';
    data: string; // Base64 encoded PCM audio
}

export interface TranscriptionMessage {
    type: 'TRANSCRIPTION';
    role: 'user' | 'model';
    text: string;
    isPartial?: boolean; // True if this is a partial transcription
}

export interface FontSuggestionsMessage {
    type: 'FONT_SUGGESTIONS';
    fonts: FontSuggestion[];
    previewText: string;
}

export interface ColorSuggestionsMessage {
    type: 'COLOR_SUGGESTIONS';
    palettes: ColorPalette[];
}

export interface DNAUpdateMessage {
    type: 'DNA_UPDATE';
    dna: BrandDNA;
    updatedField?: keyof BrandDNA | string;
}

export interface ProgressUpdateMessage {
    type: 'PROGRESS_UPDATE';
    field: string;
    value: any;
    finalized: boolean;
}

export interface ThoughtMessage {
    type: 'THOUGHT';
    logic: string;
    confidence: number;
}

// Thinking levels for hackathon - shows AI reasoning in real-time
export interface ThinkingStartMessage {
    type: 'THINKING_START';
    timestamp: number;  // Start time for timer
}

export interface ThinkingStreamMessage {
    type: 'THINKING_STREAM';
    thought: string;    // Current thought/reasoning step
    phase: 'classify' | 'analyze' | 'decide' | 'execute';
}

export interface ThinkingEndMessage {
    type: 'THINKING_END';
    duration: number;       // Total thinking time in ms
    toolDecided: string | null;  // Which tool was chosen (or null if none)
    thoughtSummary: string[];    // All thoughts collected
}

export interface ErrorMessage {
    type: 'ERROR';
    message: string;
    code?: string;
}

export interface ConnectionStatusMessage {
    type: 'CONNECTION_STATUS';
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    geminiConnected: boolean;
}

export interface InterruptMessage {
    type: 'INTERRUPT';
}

// Tool processing state messages
export interface ToolProcessingStartMessage {
    type: 'TOOL_PROCESSING_START';
    toolType?: 'display_fonts' | 'display_colors' | 'update_dna';
    targetField?: string; // For DNA updates
}

export interface ToolProcessingEndMessage {
    type: 'TOOL_PROCESSING_END';
}

// Phase 9: Competitive Intelligence & Logo Design
export interface CompetitiveAnalysisMessage {
    type: 'COMPETITIVE_ANALYSIS';
    industry: string;
    brands: string[];
    patterns: string;
    recommendation: string;
}

export interface LogoConceptsMessage {
    type: 'LOGO_CONCEPTS';
    concepts: Array<{
        id: string;
        url: string;
        source: string;
        style: string;
        mood: string;
        reasoning: string;
        alt_text: string;
    }>;
}

// Logo research progress - shows browser automation status
export interface LogoResearchProgressMessage {
    type: 'LOGO_RESEARCH_PROGRESS';
    phase: 'starting' | 'browsing' | 'analyzing' | 'complete';
    source: string;  // e.g., "Dribbble", "Behance", "Nike.com"
    progress: number; // 0-100
    message: string;  // e.g., "Searching for shoe brand logos..."
}

export interface LogoResearchResultMessage {
    type: 'LOGO_RESEARCH_RESULT';
    logos: Array<{
        id: string;
        imageUrl: string;
        brandName: string;
        source: string;
        style: string;
        designPrinciples: string[];
    }>;
    insights: {
        dominantStyles: string[];
        commonPatterns: string[];
        recommendation: string;
    };
    screenshots: string[]; // Base64 screenshots from research
}

export interface LogoStructureOptionsMessage {
    type: 'LOGO_STRUCTURE_OPTIONS';
    options: any[]; // Used strict types in client
}

export interface ImagerySuggestionsMessage {
    type: 'IMAGERY_SUGGESTIONS';
    suggestions: any[]; // Used strict types in client
}

export interface AuditResultMessage {
    type: 'AUDIT_RESULT';
    assetUrl: string;
    pass: boolean;
    findings: {
        colorMatch?: string;
        styleMatch?: string;
        accessibility?: string;
    };
    thoughtSignature: string;
}

export type ServerMessage =
    | SessionStartedMessage
    | SessionEndedMessage
    | ServerAudioChunkMessage
    | TranscriptionMessage
    | FontSuggestionsMessage
    | ColorSuggestionsMessage
    | DNAUpdateMessage
    | InterruptMessage
    | ToolProcessingStartMessage
    | ToolProcessingEndMessage
    | ProgressUpdateMessage
    | ThoughtMessage
    | ThinkingStartMessage
    | ThinkingStreamMessage
    | ThinkingEndMessage
    | ErrorMessage
    | ConnectionStatusMessage
    | CompetitiveAnalysisMessage
    | LogoConceptsMessage
    | AuditResultMessage
    | LogoResearchProgressMessage
    | LogoResearchResultMessage
    | LogoStructureOptionsMessage
    | ImagerySuggestionsMessage;

// ============================================
// MESSAGE HELPERS
// ============================================

export function isClientMessage(msg: any): msg is ClientMessage {
    return msg && typeof msg.type === 'string' && [
        'START_SESSION', 'END_SESSION', 'AUDIO_CHUNK',
        'TEXT_INPUT', 'USER_SELECTION', 'UPDATE_DNA'
    ].includes(msg.type);
}

export function isServerMessage(msg: any): msg is ServerMessage {
    return msg && typeof msg.type === 'string' && [
        'SESSION_STARTED', 'SESSION_ENDED', 'AUDIO_CHUNK',
        'TRANSCRIPTION', 'FONT_SUGGESTIONS', 'COLOR_SUGGESTIONS',
        'DNA_UPDATE', 'PROGRESS_UPDATE', 'THOUGHT', 'ERROR', 'CONNECTION_STATUS',
        'INTERRUPT', 'TOOL_PROCESSING_START', 'TOOL_PROCESSING_END',
        'THINKING_START', 'THINKING_STREAM', 'THINKING_END',
        'COMPETITIVE_ANALYSIS', 'LOGO_CONCEPTS', 'AUDIT_RESULT',
        'LOGO_RESEARCH_PROGRESS', 'LOGO_RESEARCH_RESULT',
        'LOGO_STRUCTURE_OPTIONS', 'IMAGERY_SUGGESTIONS'
    ].includes(msg.type);
}
