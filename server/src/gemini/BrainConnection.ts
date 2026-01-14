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
        name: "display_color_suggestions",
        description: "Generate and display color palettes. Supports ANY color count (3-20), palette variations, expanding palettes, modifying colors, mood filtering, and color operations. Call this for ANY color-related request.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                palettes: {
                    type: Type.ARRAY,
                    description: "Array of palettes to display. Each can have ANY number of colors.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Descriptive palette name" },
                            colors: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "Array of hex colors. Can be ANY length: 3, 5, 7, 10, 15, 20 colors."
                            },
                            vibe: { type: Type.STRING, description: "Mood/feeling of the palette" }
                        },
                        required: ["name", "colors", "vibe"]
                    }
                },
                palette_count: {
                    type: Type.INTEGER,
                    description: "Number of palettes to generate. Default 3, can be 1-10."
                },
                colors_per_palette: {
                    type: Type.INTEGER,
                    description: "Colors in each palette. Default 5, can be 3-20. HONOR USER'S EXACT REQUEST."
                },
                base_palette: {
                    type: Type.STRING,
                    description: "Name of existing palette to base new ones on (for variations/expansions)"
                },
                operation: {
                    type: Type.STRING,
                    description: "Operation to perform: 'generate' (new), 'expand' (add colors), 'vary' (create variations), 'modify' (change colors), 'combine' (merge palettes)"
                },
                expand_to_count: {
                    type: Type.INTEGER,
                    description: "When expanding a palette, the target total color count"
                },
                variation_count: {
                    type: Type.INTEGER,
                    description: "Number of variations to generate from base palette"
                },
                mood_filter: {
                    type: Type.STRING,
                    description: "Filter by mood: sophisticated, playful, warm, cool, energetic, calm, professional, creative, natural, bold"
                },
                color_temperature: {
                    type: Type.STRING,
                    description: "Temperature: warm, cool, neutral, mixed"
                },
                brightness: {
                    type: Type.STRING,
                    description: "Brightness: light, medium, dark, vibrant, pastel, muted"
                },
                include_neutrals: {
                    type: Type.BOOLEAN,
                    description: "Whether to include neutral colors (white, black, gray)"
                },
                primary_color: {
                    type: Type.STRING,
                    description: "Base color to build palette around (hex code)"
                },
                exclude_colors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Colors to exclude (hex codes or color names)"
                },
                replace_colors: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            old_color: { type: Type.STRING },
                            new_color: { type: Type.STRING }
                        }
                    },
                    description: "Replace specific colors in a palette"
                },
                remove_colors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Remove specific colors from palette (by hex or position like 'last 3')"
                },
                query: {
                    type: Type.STRING,
                    description: "The original user intent/query that triggered this tool"
                }
            },
            required: ["palettes"]
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
                query: {
                    type: Type.STRING,
                    description: "The original user intent/query that triggered this tool"
                }
            },
            required: []
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
    }
];

const brainTools: Tool[] = [{ functionDeclarations: brainToolDeclarations }];

interface ConversationTurn {
    role: 'user' | 'assistant';
    timestamp: number;
    transcript: string;
    audioBase64?: string;
}

export class BrainConnection {
    private client: GoogleGenAI;
    private conversationHistory: ConversationTurn[] = [];
    private lastToolCall: number = 0;
    private readonly TOOL_COOLDOWN_MS = 8000;
    private recentToolCalls: { name: string; timestamp: number; args: string }[] = [];

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
    }

    /**
     * Analyze a conversation window and decide if tools are needed
     * Called every 3 seconds with accumulated audio/transcript
     */
    async analyzeConversation(
        userTranscript: string,
        aiTranscript: string
    ): Promise<void> {
        const now = Date.now();

        // Prevent rapid-fire tool calls
        if (now - this.lastToolCall < this.TOOL_COOLDOWN_MS) {
            return;
        }

        // Skip if no meaningful content
        if (!userTranscript.trim() && !aiTranscript.trim()) {
            return;
        }

        // Add to history
        if (userTranscript.trim()) {
            this.conversationHistory.push({
                role: 'user',
                timestamp: now,
                transcript: userTranscript
            });
        }
        if (aiTranscript.trim()) {
            this.conversationHistory.push({
                role: 'assistant',
                timestamp: now,
                transcript: aiTranscript
            });
        }

        // Keep last 30 turns for deeper context (Negotiation Awareness)
        if (this.conversationHistory.length > 30) {
            this.conversationHistory = this.conversationHistory.slice(-30);
        }

        // Format history with TIMESTAMPS (Temporal Context)
        // usage: [5s ago] USER: hello
        const historyText = this.conversationHistory
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

        // Detect if AI previously asked a question (deep history check)
        // We look at the last assistant message
        const lastAiTurn = [...this.conversationHistory].reverse().find(t => t.role === 'assistant');
        const aiIsWaitingForAnswer = lastAiTurn ? (
            lastAiTurn.transcript.toLowerCase().includes('?') ||
            lastAiTurn.transcript.toLowerCase().includes('brand name') ||
            lastAiTurn.transcript.toLowerCase().includes('mission') ||
            lastAiTurn.transcript.toLowerCase().includes('color')
        ) : false;

        const systemPrompt = `You are a tool orchestrator for a brand design assistant.
Your job is to decide when to call tools based on the conversation history.

Current Brand DNA:
${JSON.stringify(this.getBrandDNA(), null, 2)}

TOOLS ALREADY EXECUTED (Last 60s):
${recentToolsText}

CONVERSATION HISTORY (With timing context):
${historyText}

CRITICAL DECISION RATIONALE:
1. **TIMING MATTERS**: If the USER responded "[JUST NOW]" or "[1s ago]" after a question, they are likely confirming efficiently. If there's a delay, or multiple short bursts, wait for the full thought.
2. **NEGOTIATION MODE**: The user is "Bargaining". Do not execute tools during brainstorming. Only execute when the deal is "Sealed".
   - "I want blue" = Brainstorming. (NO TOOL)
   - "Show me blue" = Command. (TOOL: display_color_suggestions)
   - "Make it pop" = Brainstorming. (NO TOOL)
   - "Save that" = Sealed. (TOOL: update_live_brand_dna)
3. **AMBIGUITY**: If the user says "Different variations" but doesn't specify params, DO NOT GUESS. The Voice Agent will ask for clarification. You stay silent.
4. **FINAL SAY**: You are the "Contract Signer". You only sign (call tool) when the User says "Yes" to a specific terms proposed by the Voice Agent.

INSTRUCTIONS:
- If a tool is needed based on specific user confirmation rules: Output the Function Call.
- If the user is still thinking, discussing, or the request is vague: Output "NO_TOOL_NEEDED".
- If the Voice Agent (Assistant) just asked a clarifying question, Output "NO_TOOL_NEEDED" (Let user answer).

Respond with JUST the function call or say "NO_TOOL_NEEDED"`;

        try {
            console.log(`🧠 Brain: Analyzing ${this.conversationHistory.length} turns of history...`);

            const response = await this.client.models.generateContent({
                model: MODELS.ARCHITECT_TEXT,
                contents: [{
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                }],
                config: {
                    tools: brainTools
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

                        console.log(`🧠 Brain decided to call: ${toolName}`);
                        this.interruptLive();

                        // Execute the tool
                        if (toolName) {
                            await this.toolHandler.handleToolCalls([{
                                id: `brain-${Date.now()}`,
                                name: toolName,
                                args: part.functionCall.args || {}
                            }]);

                            // Track this tool call
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
    }

    /**
     * Clear conversation history (on session end)
     */
    reset(): void {
        this.conversationHistory = [];
        this.lastToolCall = 0;
        this.recentToolCalls = [];
    }
}
