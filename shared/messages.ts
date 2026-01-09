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
    selectionType: 'font' | 'color';
    value: string; // Font name or palette name
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
    updatedField?: keyof BrandDNA;
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
    | ErrorMessage
    | ConnectionStatusMessage;

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
        'INTERRUPT', 'TOOL_PROCESSING_START', 'TOOL_PROCESSING_END'
    ].includes(msg.type);
}
