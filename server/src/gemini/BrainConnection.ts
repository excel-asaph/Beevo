/**
 * BrainConnection - Gemini 3 Pro Tool Orchestrator
 * 
 * This is "The Brain" in the dual-model Bridge architecture.
 * It receives batched audio/transcript data and decides when to call tools.
 * Gemini Live handles voice-only responses; Brain handles reliable tool calls.
 */

import { GoogleGenAI, FunctionDeclaration, Type, Tool } from '@google/genai';
import { MODELS } from '../../../shared/constants';
import { ServerMessage } from '../../../shared/messages';
import { ToolHandler } from './ToolHandler';
import { BrandDNA } from '../../../shared/types';

// Tool declarations for the Brain (same as before, but ONLY here)
const brainToolDeclarations: FunctionDeclaration[] = [
    {
        name: "display_font_suggestions",
        description: "Generate and display font options on the canvas. Supports quantity control, style/mood filtering, font pairing, and similarity matching. Call this for ANY font-related request.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fonts: {
                    type: Type.ARRAY,
                    description: "Array of fonts to display. Generate as many as user requests (1-20).",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Google Font family name (e.g., 'Roboto', 'Playfair Display')" },
                            category: { type: Type.STRING, description: "Font category: serif, sans-serif, display, handwriting, monospace" },
                            reasoning: { type: Type.STRING, description: "Why this font fits the brand" },
                            weight: { type: Type.STRING, description: "Font weight: light, regular, medium, bold, black" },
                            style: { type: Type.STRING, description: "Visual style: modern, classic, elegant, playful, professional, artistic" }
                        },
                        required: ["name", "category", "reasoning"]
                    }
                },
                context_text: {
                    type: Type.STRING,
                    description: "Text to preview fonts with (brand name, tagline, etc.)"
                },
                font_count: {
                    type: Type.INTEGER,
                    description: "Number of fonts to generate. Default 3, can be 1-20. Honor user's exact request."
                },
                style_filter: {
                    type: Type.STRING,
                    description: "Filter by category: serif, sans-serif, handwriting, display, monospace, script"
                },
                mood_filter: {
                    type: Type.STRING,
                    description: "Filter by mood: sophisticated, playful, modern, classic, bold, elegant, minimal, artistic, corporate, friendly"
                },
                similar_to: {
                    type: Type.STRING,
                    description: "Find fonts similar to this font name. User says 'fonts like Roboto'"
                },
                pair_with: {
                    type: Type.STRING,
                    description: "Find fonts that pair well with this font (for heading+body combos)"
                },
                exclude_fonts: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Font names to exclude from suggestions"
                },
                include_variations: {
                    type: Type.BOOLEAN,
                    description: "If true, show same font in multiple weights/styles"
                },
                query: {
                    type: Type.STRING,
                    description: "The original user intent/query that triggered this tool"
                }
            },
            required: ["fonts", "context_text"]
        }
    },
    {
        name: "generate_brand_colors",
        description: "STEP 1 of Build: Generate color palettes. Call this immediately after research is complete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                palettes: {
                    type: Type.ARRAY,
                    description: "Optional: Suggest specific palettes if user provided them. Usually empty to let AI generate.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            vibe: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    },
    {
        name: "generate_brand_fonts",
        description: "STEP 2 of Build: Generate typography options. Call this AFTER color generation.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fonts: {
                    type: Type.ARRAY,
                    description: "Optional: specific fonts if user requested them.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            category: { type: Type.STRING },
                            reasoning: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    },
    {
        name: "finalize_brand_dna",
        description: "STEP 3 (FINAL): Commit the Brand DNA and reveal the canvas. Call this ONLY after Colors and Fonts are generated.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "Brief summary of what was built." }
            }
        }
    },
    {
        name: "update_live_brand_dna",
        description: "Save or update Brand DNA fields after user confirms selection. WORKFLOW: 1) Display options (fonts/colors/logos), 2) User picks one, 3) CALL THIS TOOL to save their choice. When user says 'you should save something in the brand DNA and the likes you should call this tool', ALWAYS call this tool. Saves ALL data exactly as provided - if user selects 7 colors, save all 7.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                brandName: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Brand name - save exactly as user provides it"
                },
                mission: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Full mission statement - can be any length"
                },
                selectedColors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    nullable: true,
                    description: "ALL selected colors as hex codes. Save the ENTIRE array, not just first 5."
                },
                selectedFont: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Selected font family name"
                },
                voice: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Brand voice description (e.g., 'sophisticated', 'playful and energetic')"
                },
                tagline: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Brand tagline or slogan"
                },
                targetAudience: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Description of target audience"
                },
                secondaryFont: {
                    type: Type.STRING,
                    nullable: true,
                    description: "Secondary/body font if user picks a font pair"
                },
                colorUsage: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        primary: { type: Type.STRING },
                        secondary: { type: Type.STRING },
                        accent: { type: Type.STRING },
                        background: { type: Type.STRING },
                        text: { type: Type.STRING }
                    },
                    description: "How colors should be used (primary, secondary, accent, etc.)"
                },
                logoType: {
                    type: Type.STRING,
                    description: "Logo structure: 'wordmark', 'lettermark', 'emblem', or 'combination mark'. ONLY these values."
                },
                imagery: {
                    type: Type.STRING,
                    description: "Visual elements: symbols, icons, or abstract shapes used in the logo."
                },
                savedLogos: {
                    type: Type.ARRAY,
                    description: "Array of logo objects to SAVE to Brand DNA. Use this when user says 'save this logo' or 'I like these'.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            url: { type: Type.STRING },
                            name: { type: Type.STRING, description: "Brand name or alt text" },
                            style: { type: Type.STRING, description: "Style tag (e.g. 'Minimal')" },
                            reasoning: { type: Type.STRING, description: "Why user liked it" }
                        },
                        required: ["url"]
                    }
                },
                query: {
                    type: Type.STRING,
                    description: "The original user intent/query that triggered this tool"
                }
            },
            required: []
        }
    },
    {
        name: "display_logo_structure_options",
        description: "Generate and display logo structure options (Wordmark, Lettermark, Emblem, Combination Mark). Call this when user wants to decide on the FORM of the logo. Provide DEEP expert analysis.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                options: {
                    type: Type.ARRAY,
                    description: "List of structure options tailored to the brand",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, description: "One of: 'wordmark', 'lettermark', 'emblem', 'combination'" },
                            reasoning: { type: Type.STRING, description: "Why this structure fits the brand" },
                            suitability: { type: Type.STRING, description: "High, Medium, or Low" }
                        },
                        required: ["type", "reasoning", "suitability"]
                    }
                },
                structure_count: {
                    type: Type.INTEGER,
                    description: "Number of options to generate. Default 3, range 1-5."
                },
                complexity_preference: {
                    type: Type.STRING,
                    description: "User preference for complexity: 'minimalist', 'moderate', 'detailed', 'adaptive'"
                },
                style_filter: {
                    type: Type.STRING,
                    description: "Filter by style: 'modern', 'vintage', 'tech', 'luxury', 'playful'"
                },
                industry_context: {
                    type: Type.STRING,
                    description: "Specific industry nuances to consider (e.g. 'SaaS logos usually prefer wordmarks')"
                },
                exclude_types: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Structure types to exclude (e.g. 'No mascots')"
                },
                query: {
                    type: Type.STRING,
                    description: "Original user intent"
                }
            },
            required: ["options"]
        }
    },
    {
        name: "display_imagery_suggestions",
        description: "Generate and display imagery/iconography concepts. Call this when user asks about 'symbols', 'icons', or 'imagery'. Provide DEEP creative direction.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    description: "List of imagery concepts",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            concept: { type: Type.STRING, description: "Short name (e.g., 'Soaring Wing', 'Geometric Cube')" },
                            description: { type: Type.STRING, description: "Detailed visual description" },
                            visualStyle: { type: Type.STRING, description: "Style tag (e.g., 'Minimalist', 'Abstract')" }
                        },
                        required: ["concept", "description", "visualStyle"]
                    }
                },
                suggestion_count: {
                    type: Type.INTEGER,
                    description: "Number of suggestions to generate. Default 3, range 1-6."
                },
                abstraction_level: {
                    type: Type.STRING,
                    description: "Level of abstraction: 'literal' (apple), 'abstract' (shape), 'symbolic' (metaphor), 'mixed'"
                },
                art_style: {
                    type: Type.STRING,
                    description: "Artistic style: 'geometric', 'organic', 'line_art', 'flat', '3d', 'sketch'"
                },
                mood_filter: {
                    type: Type.STRING,
                    description: "Mood to evoke: 'trust', 'speed', 'creativity', 'luxury', 'friendliness'"
                },
                focus_element: {
                    type: Type.STRING,
                    description: "Specific element to focus on: 'nature', 'technology', 'human', 'typography'"
                },
                query: {
                    type: Type.STRING,
                    description: "Original user intent"
                }
            },
            required: ["suggestions"]
        }
    },
    {
        name: "research_competitors",
        description: "Deep competitive intelligence using headless browser automation. Extracts logos, colors, typography, and design patterns from competitor websites. Supports visual analysis and trend synthesis.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                industry: {
                    type: Type.STRING,
                    description: "Industry to analyze (e.g., 'fitness', 'tech startup', 'luxury fashion')"
                },
                competitor_count: {
                    type: Type.INTEGER,
                    description: "Number of competitors to analyze. Default 5, range 3-10."
                },
                focus_areas: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "What to extract: ['logos', 'colors', 'typography', 'messaging', 'layout']. Default: all."
                },
                depth: {
                    type: Type.STRING,
                    description: "'quick' (homepage only, 30s) or 'comprehensive' (multi-page, 90s)"
                },
                specific_brands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Optional: Force specific brands ['Nike', 'Adidas']. If empty, auto-discover top brands."
                },
                extract_assets: {
                    type: Type.BOOLEAN,
                    description: "If true, download logo images. If false, just describe them."
                },
                color_analysis: {
                    type: Type.BOOLEAN,
                    description: "If true, extract hex codes from screenshots using computer vision."
                },
                font_detection: {
                    type: Type.BOOLEAN,
                    description: "If true, detect typography from CSS/rendered text."
                },
                screenshot_mode: {
                    type: Type.STRING,
                    description: "'full' (entire homepage), 'hero' (above fold), 'logo_only' (header)"
                },
                exclude_brands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Brands to skip (e.g., ['Reebok'])"
                },
                synthesis_prompt: {
                    type: Type.STRING,
                    description: "Custom question for synthesis (e.g., 'What makes a luxury tech logo?')"
                },
                query: {
                    type: Type.STRING,
                    description: "Original user intent that triggered this research"
                },
                // Brand DNA fields - Brain extracts these from conversation context during research
                brandName: {
                    type: Type.STRING,
                    description: "Brand name mentioned in conversation"
                },
                mission: {
                    type: Type.STRING,
                    description: "Brand mission statement if discussed"
                },
                tagline: {
                    type: Type.STRING,
                    description: "Brand slogan/tagline if discussed"
                },
                values: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Core brand values (e.g., 'Quality', 'Innovation') if discussed"
                },
                voice: {
                    type: Type.STRING,
                    description: "Brand voice/personality (e.g., 'sophisticated and bold') if discussed"
                },
                targetAudience: {
                    type: Type.STRING,
                    description: "Target audience description if discussed"
                }
            },
            required: ["industry", "query"]
        }
    },
    {
        name: "search_logo_inspiration",
        description: "Search the web for real logo examples using Google Search grounding. Find existing logos that match desired styles, industries, and moods. Returns actual image URLs for display and inspiration.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                style_keywords: {
                    type: Type.STRING,
                    description: "Primary style descriptors (e.g., 'minimalist tech wordmark', 'bold geometric emblem', 'playful handwritten script')"
                },
                industry: {
                    type: Type.STRING,
                    description: "Target industry or niche (e.g., 'fitness', 'saas', 'luxury fashion', 'eco-friendly')"
                },
                result_count: {
                    type: Type.INTEGER,
                    description: "Number of logo examples to return. Default 6, range 3-12."
                },
                mood_filters: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Mood/vibe keywords: ['professional', 'playful', 'sophisticated', 'bold', 'minimal', 'vintage']"
                },
                color_preference: {
                    type: Type.STRING,
                    description: "Preferred color scheme (e.g., 'monochrome', 'blue and white', 'vibrant multicolor', 'pastel')"
                },
                logo_types: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Specific types to include: ['wordmark', 'emblem', 'lettermark', 'abstract', 'mascot', 'combination']"
                },
                exclude_types: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Logo types to exclude from results"
                },
                reference_brands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Example brands with similar style (e.g., ['Stripe', 'Linear', 'Notion']). Used for 'logos like X' queries."
                },
                exclude_brands: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Brands to avoid in results (e.g., direct competitors)"
                },
                complexity_level: {
                    type: Type.STRING,
                    description: "'simple' (1-2 elements), 'moderate' (3-5 elements), 'complex' (detailed illustrations)"
                },
                text_emphasis: {
                    type: Type.STRING,
                    description: "'text-only' (pure wordmark), 'text-primary' (icon secondary), 'balanced', 'icon-primary', 'icon-only'"
                },
                use_cases: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Where logo will be used: ['social_media', 'business_card', 'website_header', 'app_icon', 'merchandise']"
                },
                cultural_context: {
                    type: Type.STRING,
                    description: "Target audience region/culture (e.g., 'western', 'asian', 'global', 'urban youth')"
                },
                era_preference: {
                    type: Type.STRING,
                    description: "Design era aesthetic (e.g., 'modern 2020s', 'retro 80s', 'classic timeless', 'futuristic')"
                },
                query: {
                    type: Type.STRING,
                    description: "REQUIRED: Original user intent that triggered this search"
                }
            },
            required: ["style_keywords", "industry", "query"]
        }
    },
    {
        name: "verify_asset_compliance",
        description: "Pixel-precise brand compliance audit using vision AI. Checks colors, style, readability, accessibility. Can fail assets or generate detailed reports.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                asset_url: {
                    type: Type.STRING,
                    description: "URL or path to the asset to audit"
                },
                asset_type: {
                    type: Type.STRING,
                    description: "'logo', 'banner', 'social_post', 'video_frame'"
                },
                brand_colors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Required hex codes. Asset MUST contain these."
                },
                color_tolerance: {
                    type: Type.NUMBER,
                    description: "Allowed hex deviation. 0 = exact match, 15 = close enough. Default 10."
                },
                expected_style: {
                    type: Type.STRING,
                    description: "Required visual style (e.g., 'minimalist', 'bold wordmark')"
                },
                expected_mood: {
                    type: Type.STRING,
                    description: "Required emotional tone (e.g., 'sophisticated', 'playful')"
                },
                check_dimensions: {
                    type: Type.BOOLEAN,
                    description: "Verify asset meets size requirements"
                },
                required_dimensions: {
                    type: Type.STRING,
                    description: "e.g., 'output_dimensions' or 'square aspect ratio'"
                },
                check_readability: {
                    type: Type.BOOLEAN,
                    description: "Test if text is legible at small sizes"
                },
                check_accessibility: {
                    type: Type.BOOLEAN,
                    description: "Verify WCAG contrast ratios"
                },
                min_contrast_ratio: {
                    type: Type.NUMBER,
                    description: "WCAG standard. 4.5 (normal), 3.0 (large text), 7.0 (AAA)"
                },
                fail_on_mismatch: {
                    type: Type.BOOLEAN,
                    description: "If true, reject asset. If false, just warn."
                },
                generate_report: {
                    type: Type.BOOLEAN,
                    description: "Return detailed audit trail with 'Thought Signature'"
                },
                spatial_analysis: {
                    type: Type.BOOLEAN,
                    description: "Run pixel-level coordinate analysis (for 'Pixel-Precise Pointing' demo)"
                },
                query: {
                    type: Type.STRING,
                    description: "Original user intent"
                }
            },
            required: ["asset_url", "brand_colors", "query"]
        }
    },
    {
        name: "get_canvas_state",
        description: "Get the current state of the canvas including displayed options and saved DNA. Call this BEFORE making changes to understand what's currently shown to the user.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "What aspect of canvas state you need (e.g., 'current colors', 'displayed fonts', 'full state')"
                }
            },
            required: []
        }
    },
    {
        name: "general_research",
        description: "Research any topic to inform design decisions. Use this for questions about trends, color psychology, typography history, industry best practices, etc. Results will be displayed in the Research Insights panel on the canvas.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "The research topic or question (e.g., 'color psychology in tech branding', 'serif vs sans-serif for luxury brands')"
                },
                depth: {
                    type: Type.STRING,
                    description: "Research depth: 'quick' (summary) or 'detailed' (comprehensive)"
                },
                focus: {
                    type: Type.STRING,
                    description: "Focus area: 'visual_trends', 'historical_context', 'scientific_facts', 'market_data'"
                }
            },
            required: ["query"]
        }
    }
];

const brainTools: Tool[] = [{ functionDeclarations: brainToolDeclarations }];

interface ConversationTurn {
    role: 'user' | 'assistant' | 'system';
    timestamp: number;
    transcript: string;
    audioBase64?: string;
}

export class BrainConnection {
    private client: GoogleGenAI;
    private conversationHistory: ConversationTurn[] = [];
    private lastToolCall: number = 0;
    private readonly TOOL_COOLDOWN_MS = 8000;
    private toolExecutionHistory: {
        id: string;
        name: string;
        timestamp: number;
        args: any;
        result: string;
    }[] = [];

    private recentToolCalls: { name: string; timestamp: number; args: string }[] = [];

    // Debounce properties
    private cachedTranscript: string = '';
    private lastAnalysisTime: number = 0;

    // THREE-BRAIN ARCHITECTURE STATE
    // - 'discovery': Listener Brain - waits for handshake to start research
    // - 'execution': Builder Brain - one-time chain to populate canvas
    // - 'modification': Modifier Brain - handles user's post-canvas changes
    private phase: 'discovery' | 'execution' | 'modification' = 'discovery';

    // Flag to track if extract_brand_identity was ever DECIDED (not just executed)
    // This prevents parallel Brain analyses from making duplicate decisions
    private extractBrandIdentityDecided: boolean = false;

    // Track when the current phase started to isolate history for Modification phase
    private phaseStartTime: number = Date.now();

    public setPhase(phase: 'discovery' | 'execution' | 'modification') {
        if (this.phase !== phase) {
            this.phase = phase;
            this.phaseStartTime = Date.now();
            console.log(`🧠 [BrainConnection] Phase Switched to: ${phase.toUpperCase()} at ${this.phaseStartTime}`);
        }
    }

    // Called by ToolHandler when extract_brand_identity is about to execute
    public markExtractBrandIdentityDecided() {
        this.extractBrandIdentityDecided = true;
        console.log('🧠 [BrainConnection] extract_brand_identity marked as DECIDED - removing from future tool lists');
    }

    constructor(
        private sessionId: string,
        private sendToClient: (msg: ServerMessage) => void,
        private toolHandler: ToolHandler,
        private interruptLive: () => void,
        private getBrandDNA: () => Partial<BrandDNA>
    ) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not set');
        this.client = new GoogleGenAI({ apiKey });
        console.log(`🧠 Brain initialized for session: ${sessionId}`);
        this.phaseStartTime = Date.now();
    }

    /**
     * Analyze a conversation window and decide if tools are needed
     * Called every 3 seconds with accumulated audio/transcript
     */
    async analyzeConversation(
        userTranscript: string,
        aiTranscript: string
    ): Promise<void> {
        try {
            const now = Date.now();

            // Prevent rapid-fire tool calls
            if (now - this.lastToolCall < this.TOOL_COOLDOWN_MS) {
                return;
            }

            // Skip if no meaningful content
            if (!userTranscript.trim() && !aiTranscript.trim()) {
                return;
            }

            // ---------------------------------------------------------
            // PREPARE CONTEXT
            // ---------------------------------------------------------
            this.conversationHistory.push({
                role: 'user',
                transcript: userTranscript,
                timestamp: now
            });

            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            // Check cache for identical requests
            if (userTranscript === this.cachedTranscript && (now - this.lastAnalysisTime) < 2000) {
                console.log('🧠 Skipping duplicate analysis (debounce)');
                return;
            }
            this.cachedTranscript = userTranscript;
            this.lastAnalysisTime = now;

            // STALE ANALYSIS PREVENTION: If extract_brand_identity was already decided,
            // ensure we're in MODIFICATION phase (not stuck in EXECUTION from a parallel analysis)
            if (this.extractBrandIdentityDecided && this.phase === 'execution') {
                console.log('🧠 STALE ANALYSIS DETECTED: extract_brand_identity already decided but phase is still EXECUTION → forcing MODIFICATION');
                this.setPhase('modification'); // Use setter to update timestamp
            }

            // FILTER HISTORY FOR ISOLATION
            // If in Modification phase, only show history that belongs to THIS phase (or is very recent)
            // This prevents the "Interviewer" context from Discovery from confusing the "Modifier" brain.
            let relevantHistory = this.conversationHistory;
            if (this.phase === 'modification') {
                relevantHistory = this.conversationHistory.filter(t => t.timestamp >= this.phaseStartTime);
                // Ensure at least the current user message is included if timestamp mismatch occurs
                if (relevantHistory.length === 0) {
                    relevantHistory.push(this.conversationHistory[this.conversationHistory.length - 1]);
                }
            }

            // Build prompt from history
            const historyText = relevantHistory
                .map(t => {
                    const secondsAgo = Math.round((now - t.timestamp) / 1000);
                    const timeTag = secondsAgo === 0 ? '[JUST NOW]' : `[${secondsAgo}s ago]`;
                    return `${timeTag} ${t.role.toUpperCase()}: ${t.transcript}`;
                })
                .join('\n');

            // Build context of recently executed tools
            const recentToolsText = this.recentToolCalls
                .filter(t => now - t.timestamp < 60000) // Look back 60 seconds
                .map(t => `- ${t.name} (${Math.round((now - t.timestamp) / 1000)}s ago)`)
                .join('\n') || 'None';

            // Detect if AI previously asked a question
            const lastAiTurn = [...this.conversationHistory].reverse().find(t => t.role === 'assistant');
            const aiIsWaitingForAnswer = lastAiTurn ? (
                lastAiTurn.transcript.toLowerCase().includes('?') ||
                lastAiTurn.transcript.toLowerCase().includes('brand name') ||
                lastAiTurn.transcript.toLowerCase().includes('mission') ||
                lastAiTurn.transcript.toLowerCase().includes('color')
            ) : false;

            // ---------------------------------------------------------
            // STRUCTURED TOOL HISTORY (XML)
            // ---------------------------------------------------------
            const toolHistoryXML = this.toolExecutionHistory.length > 0
                ? `<ToolHistory>\n${this.toolExecutionHistory.map(t => {
                    const timeAgo = Math.round((now - t.timestamp) / 1000);
                    return `  <Execution id="${t.id}" timestamp="${t.timestamp}" timeAgo="${timeAgo}s" tool="${t.name}">
    <Arguments>${JSON.stringify(t.args)}</Arguments>
    <Result>${t.result}</Result>
  </Execution>`;
                }).join('\n')}\n</ToolHistory>`
                : '<ToolHistory>No tools executed yet.</ToolHistory>';

            const dnaContext = JSON.stringify(this.getBrandDNA(), null, 2);

            // DYNAMIC PROMPT & TOOLS BASED ON PHASE
            const systemPrompt = this.getPhaseSystemInstruction(this.phase, dnaContext, toolHistoryXML, historyText);
            const phaseTools = [{ functionDeclarations: this.getPhaseTools(this.phase) }];

            try {
                console.log(`🧠 Brain: Analyzing ${this.conversationHistory.length} turns in phase: ${this.phase.toUpperCase()}`);

                const response = await this.client.models.generateContent({
                    model: MODELS.ARCHITECT_TEXT,
                    contents: [{
                        role: 'user',
                        parts: [{ text: systemPrompt }]
                    }],
                    config: {
                        tools: phaseTools
                    }
                });

                // Check for tool calls
                const candidate = response.candidates?.[0];
                if (candidate?.content?.parts) {
                    for (const part of candidate.content.parts) {
                        if (part.functionCall) {
                            const toolName = part.functionCall.name;
                            const toolArgs = JSON.stringify(part.functionCall.args || {});

                            // Check if USER explicitly requested something (not just AI talking)
                            const userHasRequest = userTranscript.trim().length > 3;

                            // SMART DUPLICATE CHECK
                            const recentSameTool = this.recentToolCalls.find(
                                t => t.name === toolName && (now - t.timestamp) < 15000
                            );

                            if (recentSameTool && !userHasRequest) {
                                console.log(`🧠 Skipping duplicate: ${toolName} (AI repeat, no user request)`);
                                return;
                            }

                            // ========== EXECUTION-TIME VALIDATION ==========
                            // Check if this tool is STILL valid in the CURRENT phase.
                            // This catches stale decisions from parallel analyses that started before phase transitions.
                            // IMPORTANT: Check BEFORE setting flags so first call isn't blocked.
                            const currentValidTools = this.getPhaseTools(this.phase);
                            const toolIsValid = currentValidTools.some(t => t.name === toolName);
                            if (!toolIsValid) {
                                console.log(`🚫 [IGNORED] Stale decision for "${toolName}" from previous phase. Current phase: "${this.phase}".`);
                                return;
                            }

                            console.log(`🧠 Brain decided to call: ${toolName}`);

                            // IMMEDIATE FLAG SET: Prevent parallel Brain analyses from executing again
                            if (toolName === 'finalize_brand_dna') {
                                this.extractBrandIdentityDecided = true;
                                console.log('🧠 [BrainConnection] finalize_brand_dna EXECUTING - blocking future calls');
                            }

                            this.interruptLive();

                            // Execute the tool
                            if (toolName) {
                                // Pass conversation history for brand extraction
                                if (toolName === 'research_competitors') {
                                    const historyString = this.conversationHistory
                                        .map(t => `${t.role.toUpperCase()}: ${t.transcript}`)
                                        .join('\n');
                                    this.toolHandler.setConversationHistory(historyString);
                                }

                                const results = await this.toolHandler.handleToolCalls([{
                                    id: `brain-${Date.now()}`,
                                    name: toolName,
                                    args: part.functionCall.args || {}
                                }]);

                                // STORE STRUCTURED HISTORY
                                for (const res of results) {
                                    const systemNote = (res.response as any).system_note || "Success";
                                    console.log(`📥 [DEBUG] Injecting into Memory: ${toolName} -> ${systemNote.substring(0, 100)}...`);
                                    this.toolExecutionHistory.push({
                                        id: res.id,
                                        name: toolName,
                                        timestamp: now,
                                        args: part.functionCall.args || {},
                                        result: systemNote
                                    });
                                }

                                // Keep last 20 tool calls (generous history)
                                if (this.toolExecutionHistory.length > 20) {
                                    this.toolExecutionHistory = this.toolExecutionHistory.slice(-20);
                                }

                                // Track this tool call (for short-term dedup logic)
                                this.recentToolCalls.push({
                                    name: toolName,
                                    timestamp: now,
                                    args: toolArgs
                                });

                                // Keep last 60 seconds of tools
                                this.recentToolCalls = this.recentToolCalls.filter(
                                    t => now - t.timestamp < 60000
                                );
                            }

                            this.lastToolCall = Date.now();
                            break;
                        }
                    }
                }

            } catch (error) {
                console.error('🧠 Brain error:', error);
            }
        } catch (outerError) {
            console.error('🧠 CRITICAL UNCAUGHT BRAIN ERROR:', outerError);
        }
    }

    private getPhaseTools(phase: 'discovery' | 'execution' | 'modification'): FunctionDeclaration[] {
        // ========== ONE-TIME TOOLS FILTER ==========
        // These tools should only be called ONCE per session. If already executed/decided, never include again.
        const oneTimeToolsExecuted: string[] = [];
        if (this.extractBrandIdentityDecided) {
            oneTimeToolsExecuted.push('extract_brand_identity');
        }

        // Filter out one-time tools that have been executed FIRST, before phase logic
        const availableTools = brainToolDeclarations.filter(t => !oneTimeToolsExecuted.includes(t.name || ''));

        switch (phase) {
            case 'discovery':
                // PHASE 1: LISTENER BRAIN - Only the handshake trigger
                return availableTools.filter(t => t.name === 'research_competitors');

            case 'execution':
                // PHASE 2: BUILDER BRAIN - Build tools (and Update tools for safety)
                return availableTools.filter(t => [
                    'generate_brand_colors',
                    'generate_brand_fonts',
                    'finalize_brand_dna'
                ].includes(t.name || ''));

            case 'modification':
                // PHASE 3: MODIFIER BRAIN - Change tools only
                return availableTools.filter(t => [
                    'display_color_suggestions',
                    'display_font_suggestions',
                    'update_live_brand_dna',
                    'general_research',
                    'get_canvas_state',
                    'search_logo_inspiration',
                    'display_logo_structure_options',
                    'display_imagery_suggestions'
                ].includes(t.name || ''));
        }
    }

    private getPhaseSystemInstruction(phase: 'discovery' | 'execution' | 'modification', dnaContext: string, toolHistoryXML: string, historyText: string): string {
        // Parse DNA for context
        let dnaObj: any = {};
        try { dnaObj = JSON.parse(dnaContext); } catch (e) { }

        // Check if Identity is already "Done" (populated in DNA)
        // STRICTER CHECK: Must have colors and fonts to be considered "Done"
        // This prevents research_competitors (which sets name/mission) from tricking the Brain into thinking the build is complete.
        const hasIdentity = dnaObj && dnaObj.name && (dnaObj.mission || dnaObj.industry) &&
            (dnaObj.colors && dnaObj.colors.length > 0) &&
            (dnaObj.typography && dnaObj.typography.length > 0);

        switch (phase) {
            case 'discovery':
                // PHASE 1: LISTENER BRAIN
                console.log(`🧠 Brain Mode: DISCOVERY (Listener)`);
                return [
                    'YOU ARE "THE LISTENER".',
                    'ROLE: Passive observer of a conversation between a User and Gemini Live.',
                    'GOAL: Detect when the User and AI have agreed to "Start Building".',
                    'TOOLS: You have ONE tool: `research_competitors` - the trigger to start building.',
                    '',
                    'PROTOCOL:',
                    '1. LISTEN to the chat.',
                    '2. IGNORE casual mentions of brand names. Just hearing "Nike" is NOT enough.',
                    '3. WAIT for the "HANDSHAKE":',
                    '   - AI asks: "Ready to build?" or "Shall we start?" (Must be an EXPLICIT proposal to move forward)',
                    '   - User responds with CLEAR AGREEMENT ("Yes", "Let\'s go", "Sure", "Do it", "That\'s beautiful", "Perfect")',
                    '   - WARNING: If AI asks "Did I capture that correctly?" and User says "Yes", NO HANDSHAKE YET. Wait for the "Ready to build?" question.',
                    '4. CRITICAL CHECK - Do we have context?',
                    '   - Brand Name? (REQUIRED)',
                    '   - Industry OR Mission/Vibe? (REQUIRED)',
                    '   - If missing, DO NOT CALL TOOL. Wait for more chat.',
                    '5. TRIGGER: When you get the handshake:',
                    '   - YOU MUST CALL `research_competitors` IMMEDIATELY.',
                    '   - DO NOT just say "Starting now". YOU MUST EXECUTE THE TOOL.',
                    '   - If you send a text response like "Starting...", ensure the tool call is ATTACHED.',
                    '',
                    'STRICT RULE: DO NOT CALL ANY OTHER TOOLS. DO NOT CALL PREMATURELY.',
                    '',
                    `DNA: ${dnaContext}`,
                    `History: ${historyText}`
                ].join('\n');

            case 'execution': {
                // PHASE 2: BUILDER BRAIN - Sequential Atomic Tools
                const hasColors = dnaObj.colors && dnaObj.colors.length > 0;
                const hasFonts = dnaObj.typography && dnaObj.typography.length > 0;

                console.log(`🧠 Brain Mode: EXECUTION (Sequential Builder). Colors: ${hasColors}, Fonts: ${hasFonts}`);

                return [
                    'YOU ARE "THE BUILDER".',
                    'PHASE: EXECUTION',
                    'GOAL: Build the brand identity SEQUENTIALLY.',
                    '',
                    'PROTOCOL: EXECUTE THESE TOOLS IN ORDER. DO NOT SKIP STEPS.',
                    '',
                    '1. CHECK: Do we have colors?',
                    hasColors ? '   - ✅ Colors: DONE.' : '   - ❌ Colors: MISSING. 👉 CALL `generate_brand_colors` IMMEDIATELY.',
                    '',
                    '2. CHECK: Do we have fonts?',
                    hasColors
                        ? (hasFonts ? '   - ✅ Fonts: DONE.' : '   - ❌ Fonts: MISSING. 👉 CALL `generate_brand_fonts` IMMEDIATELY.')
                        : '   - ⏳ Wait for colors first.',
                    '',
                    '3. CHECK: Finalize?',
                    (hasColors && hasFonts)
                        ? '   - ✅ ALL PARTS READY. 👉 CALL `finalize_brand_dna` NOW.'
                        : '   - ⏳ Complete previous steps first.',
                    '',
                    `DNA: ${dnaContext}`,
                    toolHistoryXML
                ].join('\n');
            }

            case 'modification':
                // PHASE 3: MODIFIER BRAIN - Post-canvas changes
                // ISOLATED BRAIN: History is filtered to only include turns since this phase started.
                const hasColors = dnaObj.colors && dnaObj.colors.length > 0;
                const hasFonts = dnaObj.typography && dnaObj.typography.length > 0;
                console.log(`🧠 Brain Mode: MODIFICATION (Modifier) - colors:${hasColors}, fonts:${hasFonts} - History filtered to isolate phase.`);
                return [
                    'YOU ARE "THE MODIFIER".',
                    'ROLE: The canvas is COMPLETE. The User is looking at it.',
                    'GOAL: Handle user requests to CHANGE/UPDATE specific fields or styles.',
                    'CONTEXT: You are a FRESH AGENT. Do not care about the previous interview.',
                    '',
                    '⛔ FORBIDDEN (NEVER CALL):',
                    '- `extract_brand_identity` - Identity is EXTRACTED. Calling this will RESET and ANNOY the user.',
                    '- `research_competitors` - Research is DONE',
                    '',
                    '✅ YOUR TOOLS:',
                    '- `update_live_brand_dna` - USE THIS for ANY text change (Name, Mission, Values, Tagline, etc.)',
                    '- `display_color_suggestions` - User wants different colors',
                    '- `display_font_suggestions` - User wants different fonts',
                    '- `general_research` - User asks about design topics',
                    '- `search_logo_inspiration` - User wants logo ideas',
                    '',
                    'SCENARIOS:',
                    '1. "Change name to Nike" → Call `update_live_brand_dna` with { name: "Nike" }. DO NOT ask for mission/values again. You already have them.',
                    '2. "I want warmer colors" → Call `display_color_suggestions`.',
                    '3. "Change mission to..." → Call `update_live_brand_dna`.',
                    '',
                    'CRITICAL CONTEXT:',
                    'You HAVE the full brand identity below. If the user changes ONE thing, the rest remains VALID.',
                    'DO NOT act like you know nothing. DO NOT start the interview over.',
                    '',
                    'CURRENT CANVAS STATE (Visible to User):',
                    `  Name: ${dnaObj.name || 'Unknown'}`,
                    `  Mission: ${dnaObj.mission || 'Unknown'}`,
                    `  Values: ${dnaObj.values ? dnaObj.values.join(', ') : 'Unknown'}`,
                    `  Tagline: ${dnaObj.tagline || 'Unknown'}`,
                    `  Colors: ${hasColors ? dnaObj.colors.slice(0, 4).join(', ') : 'None'}`,
                    `  Fonts: ${hasFonts ? dnaObj.typography.join(', ') : 'None'}`,
                    '',
                    `History (This Phase Only):`,
                    `${historyText}`
                ].join('\n');
        }
    }
    /**
     * Clear conversation history (on session end)
     */
    reset(): void {
        this.conversationHistory = [];
        this.lastToolCall = 0;
        this.recentToolCalls = [];
        this.toolExecutionHistory = [];
    }
}
