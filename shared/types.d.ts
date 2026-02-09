export declare enum Junction {
    STRATEGIST = "STRATEGIST",
    ARCHITECT = "ARCHITECT",
    FORGE = "FORGE",
    GUARDIAN = "GUARDIAN",
    LOGO_STUDIO = "LOGO_STUDIO"
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
    industry: SelectableString;
    rationale?: string;
    typography: SelectableArray;
    colors: SelectableArray;
    logoType?: string;
    imagery?: string;
    designGoals?: string;
    logoAssets?: Array<{
        url: string;
        name?: string;
    }>;
    logoUrl?: SelectableString;
    logoInvertedUrl?: SelectableString;
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
    variants?: any;
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
    visualStyle?: string;
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
export type LayoutStrategy = 'SPLIT' | 'CLOUDS' | 'TRIPTYCH' | 'FORENSIC_GRID';
export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
    placeholder?: string;
    required: boolean;
    options?: string[];
}
export interface FormConfig {
    id: string;
    title: string;
    subtitle?: string;
    submit_text: string;
    fields: FormField[];
}
export interface HeroBlockConfig {
    id: string;
    variant_id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
    };
    visual_asset: {
        type: 'video' | 'image';
        source_url: string;
        source_id: string;
        prompt_signature?: string;
        attributes?: any;
    };
    overlay_content: {
        headline: {
            text: string;
            styles: any;
        };
        subhead: {
            text: string;
            styles: any;
        };
        cta: {
            text: string;
            action_id: string;
            styles: any;
        };
    };
    navigation: {
        links: Array<{
            label: string;
            action_id: 'open_intent_form' | 'open_contact_form' | 'open_offer_form';
        }>;
        styles?: {
            color?: string;
            fontFamily?: string;
            fontSize?: string;
            fontWeight?: string;
            letterSpacing?: string;
            textTransform?: 'uppercase' | 'none';
        };
    };
    forms: {
        contact: FormConfig;
        intent: FormConfig;
    };
    layout_config: {
        container_styles: any;
        overlay_gradient: string;
    };
}
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
        visual_code: string;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
        maxWidth?: string;
    };
}
export interface PASStep {
    id: string;
    phase: 'PROBLEM' | 'AGITATION' | 'SOLUTION';
    title: string;
    description: string;
    icon?: string;
    visual_highlight?: string;
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
        visual_code: string;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}
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
        visual_code: string;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}
export interface Testimonial {
    id: string;
    name: string;
    title: string;
    company: string;
    quote: string;
    image_url: string;
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
        visual_code: string;
    };
}
export interface OfferTier {
    id: string;
    name: string;
    price: string;
    interval?: string;
    description: string;
    features: string[];
    cta_text: string;
    is_highlighted: boolean;
    badge?: string;
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
        visual_code: string;
    };
}
export interface SystemConfig {
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
            target_scroll_depth: number;
            min_views_data: number;
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
    client_tracking: {
        common_dwell_threshold_ms: number;
        retention_milestone_seconds: number;
        intersection_threshold: number;
    };
    hitl: {
        enabled: boolean;
        require_approval_pre: boolean;
        require_approval_post: boolean;
        auto_proceed_delay_m: number;
    };
    locks: {
        hero: boolean;
        proof: boolean;
        pas: boolean;
        spec: boolean;
        social: boolean;
        offer: boolean;
    };
    feedback: {
        hero_directive: string;
        proof_directive: string;
        pas_directive: string;
        spec_directive: string;
        social_directive: string;
        offer_directive: string;
    };
    current_state_hash?: string;
    active_assets_path?: string;
}
export type InterventionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface InterventionRequest {
    id: string;
    section: string;
    type: 'PRE_GENERATION' | 'POST_GENERATION';
    message: string;
    proposal?: any;
    status: InterventionStatus;
    feedback?: string;
    timestamp: number;
}
//# sourceMappingURL=types.d.ts.map