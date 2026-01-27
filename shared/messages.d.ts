import { BrandDNA, FontSuggestion, ColorPalette, ResearchPhaseObject } from './types';
export interface StartSessionMessage {
    type: 'START_SESSION';
}
export interface EndSessionMessage {
    type: 'END_SESSION';
}
export interface AudioChunkMessage {
    type: 'AUDIO_CHUNK';
    data: string;
}
export interface TextInputMessage {
    type: 'TEXT_INPUT';
    text: string;
}
export interface SelectionEventMessage {
    type: 'SELECTION_EVENT';
    selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery';
    value: string;
    context?: any;
}
export interface UpdateDNAMessage {
    type: 'UPDATE_DNA';
    field: keyof BrandDNA;
    value: any;
}
export interface InterruptRequestMessage {
    type: 'INTERRUPT';
}
export interface ActivityEndMessage {
    type: 'ACTIVITY_END';
}
export interface UIStateChangeMessage {
    type: 'UI_STATE_CHANGE';
    mode: 'chat' | 'thinking' | 'canvas';
    overlayVisible: boolean;
}
export type ClientMessage = StartSessionMessage | EndSessionMessage | AudioChunkMessage | TextInputMessage | SelectionEventMessage | UpdateDNAMessage | InterruptRequestMessage | ActivityEndMessage | FileUploadMessage;
export interface FileUploadMessage {
    type: 'FILE_UPLOAD';
    base64: string;
    mimeType: string;
    fileName: string;
    target?: 'extraction' | 'vault';
}
export interface SessionStartedMessage {
    type: 'SESSION_STARTED';
    sessionId: string;
}
export interface SessionEndedMessage {
    type: 'SESSION_ENDED';
}
export interface ServerAudioChunkMessage {
    type: 'AUDIO_CHUNK';
    data: string;
}
export interface TranscriptionMessage {
    type: 'TRANSCRIPTION';
    role: 'user' | 'model';
    text: string;
    isPartial?: boolean;
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
export interface ThinkingStartMessage {
    type: 'THINKING_START';
    timestamp: number;
}
export interface ThinkingStreamMessage {
    type: 'THINKING_STREAM';
    thought: string;
    phase: 'classify' | 'analyze' | 'decide' | 'execute';
}
export interface ThinkingEndMessage {
    type: 'THINKING_END';
    duration: number;
    toolDecided: string | null;
    thoughtSummary: string[];
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
export interface ToolProcessingStartMessage {
    type: 'TOOL_PROCESSING_START';
    toolType?: 'display_fonts' | 'display_colors' | 'update_dna';
    targetField?: string;
}
export interface ToolProcessingEndMessage {
    type: 'TOOL_PROCESSING_END';
}
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
export interface LogoResearchProgressMessage {
    type: 'LOGO_RESEARCH_PROGRESS';
    phase: 'starting' | 'browsing' | 'analyzing' | 'complete';
    source: string;
    progress: number;
    message: string;
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
    screenshots: string[];
}
export interface LogoStructureOptionsMessage {
    type: 'LOGO_STRUCTURE_OPTIONS';
    options: any[];
}
export interface ImagerySuggestionsMessage {
    type: 'IMAGERY_SUGGESTIONS';
    suggestions: any[];
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
export interface ResearchCompleteMessage {
    type: 'RESEARCH_COMPLETE';
    summary: {
        brandName: string;
        colorsGenerated: number;
        fontsGenerated: number;
        competitorsFound: number;
    };
    dna: ResearchPhaseObject;
}
export type ServerMessage = SessionStartedMessage | SessionEndedMessage | ServerAudioChunkMessage | TranscriptionMessage | FontSuggestionsMessage | ColorSuggestionsMessage | DNAUpdateMessage | InterruptMessage | ToolProcessingStartMessage | ToolProcessingEndMessage | ProgressUpdateMessage | ThoughtMessage | ThinkingStartMessage | ThinkingStreamMessage | ThinkingEndMessage | ErrorMessage | ConnectionStatusMessage | CompetitiveAnalysisMessage | LogoConceptsMessage | AuditResultMessage | LogoResearchProgressMessage | LogoResearchResultMessage | LogoStructureOptionsMessage | ImagerySuggestionsMessage | VaultUpdateMessage | ResearchUpdateMessage | ThoughtSignatureMessage | ResearchCompleteMessage | FullStateUpdateMessage | UIStateChangeMessage;
export interface FullStateUpdateMessage {
    type: 'FULL_STATE_UPDATE';
    state: ResearchPhaseObject;
}
export interface VaultUpdateMessage {
    type: 'VAULT_UPDATE';
    stats: {
        fileCount: number;
        totalTokens: number;
        isIngesting: boolean;
    };
}
export interface ResearchUpdateMessage {
    type: 'RESEARCH_UPDATE';
    status: 'started' | 'searching' | 'analyzing' | 'generating' | 'complete';
    message: string;
    step: number;
    totalSteps: number;
    competitors?: string[];
    industryInsights?: string;
    thoughts?: Array<{
        id: string;
        text: string;
        status: 'pending' | 'active' | 'complete';
    }>;
}
export interface ThoughtSignatureMessage {
    type: 'THOUGHT_SIGNATURE';
    nodeId: string;
    title: string;
    reasoning: string;
    confidence?: number;
}
export declare function isClientMessage(msg: any): msg is ClientMessage;
export declare function isServerMessage(msg: any): msg is ServerMessage;
//# sourceMappingURL=messages.d.ts.map