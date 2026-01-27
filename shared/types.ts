// Shared types between client and server

export enum Junction {
    STRATEGIST = 'STRATEGIST',
    ARCHITECT = 'ARCHITECT',
    FORGE = 'FORGE',
    GUARDIAN = 'GUARDIAN'
}

export interface SelectableString {
    value: string;
    isSelected: boolean;
}

export interface SelectableArray {
    items: string[];
    isSelected: boolean;
}

export interface BrandDNA {
    name: SelectableString;
    mission: SelectableString;

    voice: SelectableString;
    tagline: SelectableString;
    values: SelectableArray;
    targetAudience: SelectableArray;
    mood: SelectableArray;
    keywords?: SelectableArray;
    logoUrl?: SelectableString;
    industry?: SelectableString;
    rationale?: string;

    // Legacy/Optional fields kept for compatibility or future use
    paletteCount?: number;
    logoType?: string;
    imagery?: string;
    designGoals?: string;
    logoInspiration?: string;
    logoUsageContexts?: string[];
    competitorInsights?: any;
    researchInsights?: any[];
    logoAssets?: any[];
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
    id: string;
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace' | string;
    reasoning: string;
    pairing?: string;
    weight?: string;
    style?: string;
    isSelected: boolean;
}

// Color palette suggestion from AI
export interface ColorPalette {
    id: string;
    name: string;
    colors: string[];
    vibe: string;
    isSelected: boolean;
}

// Logo structure suggestion (simplified - no literal types)
export interface LogoStructureOption {
    id: string;
    type: string;
    reasoning: string;
    suitability: string;
    isSelected: boolean;
}

// Imagery/Iconography suggestion (simplified)
export interface ImagerySuggestion {
    id: string;
    concept: string;
    description: string;
    visualStyle?: string;
    isSelected: boolean;
}

// Logo search result/inspiration (simplified per user feedback)
export interface LogoInspiration {
    id: string;
    displayName: string;
    url: string;
    isSelected: boolean;
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

// ==========================================
// RESEARCH EXECUTION PHASE TYPES
// ==========================================

export interface CompetitorResearch {
    competitors: { name: string; domain: string; description: string }[];
    differentiationOpportunity: string;
    competitorBranding: { primaryColor?: string; secondaryColor?: string; name?: string; brandVibe?: string }[];
    rationale?: string;
}

export interface ColorPalettes {
    palettes: ColorPalette[];
    rationale?: string;
}

export interface TypographyPairings {
    fonts: FontSuggestion[];
    rationale?: string;
}

// ==========================================
// NEW: MODIFICATION PHASE TYPES
// ==========================================

// Logo structure options container
export interface LogoStructures {
    options: LogoStructureOption[];
    rationale?: string;
}

// Logo inspiration library container
export interface LogoInspirationLibrary {
    inspirations: LogoInspiration[];
    rationale?: string;
}

// Imagery options container
export interface ImageryOptions {
    suggestions: ImagerySuggestion[];
    rationale?: string;
}

// General research query log
export interface GeneralResearchQuery {
    id: string;
    query: string;
    result: string;
    timestamp: string;
}

export interface GeneralResearchLog {
    queries: GeneralResearchQuery[];
}

// ==========================================
// EXTENDED RESEARCH PHASE OBJECT
// ==========================================

export interface ResearchPhaseObject {
    // Core sections (from execution phase)
    brandDNA: BrandDNA;
    competitorResearch: CompetitorResearch;
    colorPalettes: ColorPalettes;
    typographyPairings: TypographyPairings;

    // New modification phase sections
    logoStructures?: LogoStructures;
    logoInspirations?: LogoInspirationLibrary;
    imagery?: ImageryOptions;
    generalResearch?: GeneralResearchLog;

    // Metadata
    summary: string;
    timestamp: string;
    stateVersion?: number;
}


// ==========================================
// LANDING PAGE BLOCK TYPES
// ==========================================

export interface ProofBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
        selected_imagery_concept?: string;
    };
    content: {
        headline: string;
        subhead: string;
        graphic_caption: string;
        data_points: { label: string; value: string | number; unit?: string }[];
    };
    graphic_config: {
        type: 'progress' | 'trend' | 'stat' | string;
        primary_color: string;
        accent_color: string;
        show_labels: boolean;
        animation_duration?: number;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}
