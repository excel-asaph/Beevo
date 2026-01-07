// Shared types between client and server

export enum Junction {
    STRATEGIST = 'STRATEGIST',
    ARCHITECT = 'ARCHITECT',
    FORGE = 'FORGE',
    GUARDIAN = 'GUARDIAN'
}

export interface BrandDNA {
    name: string;
    mission: string;
    colors: string[];
    typography: string[];
    voice: string;
    logoUrl?: string;
}

export interface SWOT {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    strategicGap: string;
}

export interface CampaignAsset {
    id: string;
    type: 'image' | 'video';
    url: string;
    prompt: string;
    status: 'pending' | 'completed' | 'failed';
    feedback?: string;
}

export interface ThoughtSignature {
    id: string;
    junction: Junction;
    timestamp: number;
    logic: string;
    confidence: number;
}

// Font suggestion from AI
export interface FontSuggestion {
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
    reasoning: string;
}

// Color palette suggestion from AI
export interface ColorPalette {
    name: string;
    colors: string[];
    vibe: string;
}

// Progress item for tracking finalized decisions
export interface ProgressItem {
    field: 'name' | 'mission' | 'font' | 'colors' | 'voice';
    value: any;
    finalized: boolean;
    timestamp: number;
}

// Session state
export interface ArchitectSession {
    id: string;
    isActive: boolean;
    brandDNA: BrandDNA;
    progress: ProgressItem[];
    currentSuggestions: {
        fonts?: FontSuggestion[];
        colors?: ColorPalette[];
        previewText?: string;
    };
}
