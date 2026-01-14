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
    // Phase 9: Logo & Competitive Intelligence
    logoType?: string; // wordmark, lettermark, emblem, combination mark
    imagery?: string; // symbols, icons, abstract shapes
    designGoals?: string;
    logoInspiration?: string;
    logoUsageContexts?: string[];
    competitorInsights?: {
        industry: string;
        analyzed: string[];
        patterns: string;
        recommendation: string;
    };
    logoAssets?: Array<{
        id: string;
        url: string;
        name?: string; // Brand name or alt text
        style?: string;
        reasoning?: string;
    }>;
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

// Logo structure suggestion
export interface LogoStructureOption {
    type: 'wordmark' | 'lettermark' | 'emblem' | 'combination';
    reasoning: string;
    suitability: string; // High, Medium, Low
}

// Imagery/Iconography suggestion
export interface ImagerySuggestion {
    concept: string;
    description: string;
    visualStyle: string;
}

// Progress item for tracking finalized decisions
export interface ProgressItem {
    field: 'name' | 'mission' | 'font' | 'colors' | 'voice' | 'logoType' | 'imagery';
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
        logoStructures?: LogoStructureOption[];
        imagery?: ImagerySuggestion[];
        previewText?: string;
    };
}
