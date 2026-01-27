export declare enum Junction {
    STRATEGIST = "STRATEGIST",
    ARCHITECT = "ARCHITECT",
    FORGE = "FORGE",
    GUARDIAN = "GUARDIAN"
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
export interface ColorPalette {
    id: string;
    name: string;
    colors: string[];
    vibe: string;
    isSelected: boolean;
}
export interface LogoStructureOption {
    id: string;
    type: string;
    reasoning: string;
    suitability: string;
    isSelected: boolean;
}
export interface ImagerySuggestion {
    id: string;
    concept: string;
    description: string;
    isSelected: boolean;
}
export interface LogoInspiration {
    id: string;
    displayName: string;
    url: string;
    isSelected: boolean;
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
export interface CompetitorResearch {
    competitors: {
        name: string;
        domain: string;
        description: string;
    }[];
    differentiationOpportunity: string;
    competitorBranding: {
        primaryColor?: string;
        secondaryColor?: string;
        name?: string;
        brandVibe?: string;
    }[];
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
export interface LogoStructures {
    options: LogoStructureOption[];
    rationale?: string;
}
export interface LogoInspirationLibrary {
    inspirations: LogoInspiration[];
    rationale?: string;
}
export interface ImageryOptions {
    suggestions: ImagerySuggestion[];
    rationale?: string;
}
export interface GeneralResearchQuery {
    id: string;
    query: string;
    result: string;
    timestamp: string;
}
export interface GeneralResearchLog {
    queries: GeneralResearchQuery[];
}
export interface ResearchPhaseObject {
    brandDNA: BrandDNA;
    competitorResearch: CompetitorResearch;
    colorPalettes: ColorPalettes;
    typographyPairings: TypographyPairings;
    logoStructures?: LogoStructures;
    logoInspirations?: LogoInspirationLibrary;
    imagery?: ImageryOptions;
    generalResearch?: GeneralResearchLog;
    summary: string;
    timestamp: string;
    stateVersion?: number;
}
//# sourceMappingURL=types.d.ts.map