// Shared types between client and server

export enum Junction {
    STRATEGIST = 'STRATEGIST',
    ARCHITECT = 'ARCHITECT',
    FORGE = 'FORGE',
    GUARDIAN = 'GUARDIAN',
    LOGO_STUDIO = 'LOGO_STUDIO'
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
    logoVariants?: any; // 8-file kit
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
    type: 'image' | 'video' | 'logo_kit';
    url: string;
    prompt: string;
    status: 'pending' | 'completed' | 'failed';
    feedback?: string;
    variants?: any; // For flexible storage of kit items
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

export type LayoutStrategy = 'SPLIT' | 'CLOUDS' | 'TRIPTYCH' | 'FORENSIC_GRID';

export interface EvidenceItem {
    id: string;
    label: string;
    value: string | number;
    unit?: string;
    description?: string;
    icon?: string;
    visual_type?: 'chart' | 'stat' | 'icon' | 'mini-trend';
}

export interface ProofBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
        layout_strategy: LayoutStrategy;
        selected_imagery_concept?: string;
    };
    content: {
        headline: string;
        subhead: string;
        graphic_caption: string;
        evidence_items: EvidenceItem[];
    };
    graphic_config: {
        type: 'generative' | string;
        primary_color: string;
        accent_color: string;
        show_labels: boolean;
        animation_duration?: number;
        visual_code: string; // The full Tailwind/Grid JSX produced by AI
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
        maxWidth?: string;
    };
}

// ==========================================
// PAS (PROBLEM-AGITATION-SOLUTION) TYPES
// ==========================================

export interface PASStep {
    id: string;
    phase: 'PROBLEM' | 'AGITATION' | 'SOLUTION';
    title: string;
    description: string;
    icon?: string;
    visual_highlight?: string; // e.g. a color or a specific Tailwind accent
}

export interface PASBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
        layout_strategy: LayoutStrategy;
    };
    content: {
        headline: string;
        steps: PASStep[];
        closing_statement: string;
    };
    graphic_config: {
        type: 'generative';
        visual_code: string; // AI generated visual sequence
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}
// ==========================================
// INTERACTIVE SPEC BLOCK TYPES
// ==========================================

export interface SpecNode {
    id: string;
    label: string;
    description: string;
    icon?: string;
    technical_specs?: Record<string, string>;
}

export interface SpecBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
        layout_strategy: LayoutStrategy | 'NODES' | 'BLUEPRINT';
    };
    content: {
        headline: string;
        subhead: string;
        nodes: SpecNode[];
    };
    graphic_config: {
        type: 'generative';
        visual_code: string; // AI generated interactive HTML/JS
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}
// ==========================================
// SOCIAL / TESTIMONIAL BLOCK TYPES
// ==========================================

export interface Testimonial {
    id: string;
    name: string;
    title: string;
    company: string;
    quote: string;
    image_url: string; // Path to public asset
}

export interface SocialBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
    };
    content: {
        headline: string;
        subhead: string;
        testimonials: Testimonial[];
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
    graphic_config: {
        type: 'generative';
        visual_code: string; // The injected grid/masonry HTML
    };
}
// ==========================================
// OFFER / CONVERSION BLOCK TYPES
// ==========================================

export interface OfferTier {
    id: string;
    name: string;
    price: string;
    interval?: string; // e.g. / mo
    description: string;
    features: string[];
    cta_text: string;
    is_highlighted: boolean;
    badge?: string; // e.g. "Best Value"
}

export interface OfferBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        industry: string;
        offer_type: 'one-time' | 'subscription' | 'lead-gen' | 'custom';
        layout_strategy: LayoutStrategy;
    };
    content: {
        headline: string;
        subhead: string;
        tiers: OfferTier[];
        guarantee_text?: string;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
        accentColor: string;
    };
    graphic_config: {
        type: 'generative';
        visual_code: string; // The injected price cards / bundle HTML
    };
}

// ==========================================
// HUMAN-IN-THE-LOOP (HITL) CONFIG TYPE
// ==========================================

export interface SystemConfig {
    // 1. Watcher Optimization Thresholds (Server-Side Decision Logic)
    sections: {
        hero: {
            target_ctr: number;
            target_retention: number;
            min_views_data: number;
            watcher_confidence_min: number;
        };
        proof: {
            target_dwell_ms: number;
            min_views_data: number;
            watcher_confidence_min: number;
        };
        social: {
            target_dwell_ms: number;
            max_velocity_px_s: number;
            min_dwell_events: number;
            watcher_confidence_min: number;
        };
        pas: {
            target_dwell_ms: number;
            min_dwell_events: number;
            watcher_confidence_min: number;
        };
        spec: {
            target_interaction_rate: number;
            min_data_points: number;
            watcher_confidence_min: number;
        };
        offer: {
            target_conversion_rate: number;
            min_views_data: number;
            watcher_confidence_min: number;
        };
    };

    // 2. Client-Side Tracking Triggers
    client_tracking: {
        common_dwell_threshold_ms: number;
        retention_milestone_seconds: number;
        intersection_threshold: number;
    };

    // 3. Global HITL Settings
    hitl: {
        enabled: boolean;
        require_approval_pre: boolean;
        require_approval_post: boolean;
        auto_proceed_delay_m: number;
    };

    // 4. Section Locking
    locks: {
        hero: boolean;
        proof: boolean;
        pas: boolean;
        spec: boolean;
        social: boolean;
        offer: boolean;
    };

    // 5. Directive Feedback
    feedback: {
        hero_directive: string;
        proof_directive: string;
        pas_directive: string;
        spec_directive: string;
        social_directive: string;
        offer_directive: string;
    };
}

// ==========================================
// NOTIFICATION & INTERVENTION TYPES
// ==========================================

export type InterventionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface InterventionRequest {
    id: string;
    section: string;
    type: 'PRE_GENERATION' | 'POST_GENERATION';
    message: string;
    proposal?: any; // JSON of the new strategy if POST
    status: InterventionStatus;
    feedback?: string;
    timestamp: number;
}
