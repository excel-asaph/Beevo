export declare enum Junction {
    STRATEGIST = "STRATEGIST",
    ARCHITECT = "ARCHITECT",
    FORGE = "FORGE",
    GUARDIAN = "GUARDIAN"
}
export interface BrandDNA {
    name: string;
    mission: string;
    colors: string[];
    typography: string[];
    voice: string;
    tagline?: string;
    values?: string[];
    targetAudience?: string;
    keywords?: string[];
    logoUrl?: string;
    logoType?: string;
    imagery?: string;
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
        name?: string;
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
export interface FontSuggestion {
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
    reasoning: string;
}
export interface ColorPalette {
    name: string;
    colors: string[];
    vibe: string;
}
export interface LogoStructureOption {
    type: 'wordmark' | 'lettermark' | 'emblem' | 'combination';
    reasoning: string;
    suitability: string;
}
export interface ImagerySuggestion {
    concept: string;
    description: string;
    visualStyle: string;
}
export interface LogoInspiration {
    id: string;
    url: string;
    brandName?: string;
    source?: string;
    description?: string;
}
export interface ProgressItem {
    field: 'name' | 'mission' | 'font' | 'colors' | 'voice' | 'logoType' | 'imagery';
    value: any;
    finalized: boolean;
    timestamp: number;
}
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
//# sourceMappingURL=types.d.ts.map