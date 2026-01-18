import { GoogleGenAI, FunctionCallingConfigMode, FunctionCall, Type, FunctionDeclaration } from '@google/genai';
import { MODELS, SYSTEM_INSTRUCTIONS } from '../../../shared/constants';
import { BrandDNA } from '../../../shared/types';

// Tool definitions for the regular API using proper Type enum
// COMPREHENSIVE definitions - covers ALL possible user requests
const toolDefinitions: FunctionDeclaration[] = [
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
                // Extended fields for richer DNA
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
    },
    {
        name: "general_research",
        description: "Perform generic research on any topic (trends, history, meanings, facts) to gather context for design decisions. Use this when user asks to 'research X' or when you need external info to make better design choices. NOT for specific competitor analysis (use research_competitors for that).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "The research topic or question"
                },
                depth: {
                    type: Type.STRING,
                    description: "Depth of research: 'quick' (summary) or 'detailed' (comprehensive)"
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

interface ConversationMessage {
    role: 'user' | 'model';
    text: string;
}

/**
 * ToolDecisionAgent uses the regular Gemini API (not Live) for reliable tool calling.
 * It analyzes user input and current state to decide which tools to call.
 */
export class ToolDecisionAgent {
    private ai: GoogleGenAI;
    private conversationHistory: ConversationMessage[] = [];
    private maxHistoryLength = 50; // Keep last 50 messages for full context

    constructor() {
        // Use Gemini 1.5 Flash for speed/cost or Pro for reasoning
        // Using Pro for Brain to ensure complex reasoning
        this.ai = new GoogleGenAI(process.env.GEMINI_API_KEY || '');
    }

    private phase: 'discovery' | 'execution' = 'discovery';

    public setPhase(phase: 'discovery' | 'execution') {
        this.phase = phase;
        console.log(`🧠 [ToolDecisionAgent] Phase Switched to: ${phase.toUpperCase()}`);
    }

    /**
     * Analyze user input and decide which tools to call
     * Returns an array of tool calls to execute
     */
    async analyzeAndDecideTools(
        userInput: string,
        currentDNA: BrandDNA,
        canvasMode: 'none' | 'fonts' | 'colors',
        currentFonts: Array<{ name: string; category: string }>,
        currentPalettes: Array<{ name: string; colors: string[]; vibe: string }>,
        onThought?: (thought: string, toolType?: 'display_fonts' | 'display_colors' | 'update_dna', targetField?: string) => void
    ): Promise<FunctionCall[]> {
        // Build context
        const stateContext = this.buildStateContext(currentDNA, canvasMode, currentFonts, currentPalettes);

        // Add user message to history
        this.conversationHistory.push({ role: 'user', text: userInput });
        this.trimHistory();

        // Build the prompt for tool decision
        // Build recent conversation summary for better context
        const recentConvo = this.conversationHistory.slice(-10).map(m =>
            `${m.role === 'user' ? 'USER' : 'AI'}: ${m.text.substring(0, 150)}`
        ).join('\n');

        const systemPrompt = `You are a Brand DNA Tool Decision Agent. Analyze user input, decide intent, and call tools.

<system_instructions>
1. CLASSIFY INTENT:
   - ACTION → User wants something new/change → Call appropriate tool with 'query' param
   - SELECTION → User picks option → update_live_brand_dna with 'query' param
   - CONFIRMATION → "okay", "yes" → NO TOOLS
   - REJECTION → "no", "different" → Call display tool with NEW options
   - QUESTION → "what is" → NO TOOLS

2. WORKFLOW STAGES AND PROTOCOLS (STRICT):

   PHASE 1: DISCOVERY & CONTEXT GATHERING (No Tools)
   - Goal: Discuss with user to understand Brand Name, Industry, Mission, and Vibe.
   - Action: Ask questions, refine ideas, propose concepts.
   - RULE: DO NOT CALL ANY TOOLS. Zero. None.
   - SPECIFICALLY FORBIDDEN: Do NOT call 'update_live_brand_dna'. It is disabled Use internal memory only.
   - NEGATIVE CONSTRAINTS (IGNORE THESE):
     - Do NOT trigger if Gemini Live says "Got it", "Locked in", "Understood".
     - Do NOT trigger if User says "That's right", "Correct", "Cool".
     - These are just conversation. KEEP LISTENING.

   - EXIT CRITERIA (THE "HANDSHAKE"):
     1. Gemini Live asks SPECIFICALLY: "Are you ready to build this?" (or similar explicit closing).
     2. User responds SPECIFICALLY: "Yes", "Let's do it", "Start".
     3. ONLY THEN -> Call 'research_competitors'.
     
   - BEHAVIOR:
     - If in doubt -> DO NOTHING. Return null.
     - If partial data -> KEEP TALKING.
     - If "locked in" -> KEEP TALKING.

   PHASE 2: EXECUTION & BUILD (Triggered by Handshake)
   - Trigger: The explicit "Ready" -> "Yes" handshake.
   - ACTION: Call 'research_competitors'.
   - ARGS: Pass ALL gathered info (name, mission, vibe, values) into the tool arguments.
   - Result: This single call triggers the pipeline and UI switch.

   PHASE 3: REFINEMENT (Canvas Active)
   - Trigger: Canvas is visible (check <canvas_state>).
   - Behavior: User asks for tweaks ("make it blue", "try serif").
   - Action: Call specific display tools ('display_color_suggestions', etc.).

3. TIMING & COMPLETION CHECK (CRITICAL):
   - Wait for the user to FINISH their thought.
   - If the input is short (e.g. "I want...", "Um..."), interrupted, or incomplete: NO TOOLS.
   - Do NOT trigger research on partial sentences.
   - Only call tools when you have a clear, complete intent (e.g., "Create a brand for a coffee shop").

4. CONSERVATIVE CALLING:
   - If canvas already shows what user wants → NO TOOLS
   - If user just says "okay" → NO TOOLS
   - Don't call tools for greetings

5. OUTPUT FORMAT:
   - Stream "THOUGHT: <Explanation>. Target: <component>"
   - Then call tool if needed.
</system_instructions>

<brand_dna>
${JSON.stringify(currentDNA, null, 2)}
</brand_dna>

<canvas_state>
${canvasMode === 'fonts' ? `Showing Fonts: ${currentFonts.map(f => f.name).join(', ')}` :
                canvasMode === 'colors' ? `Showing Palettes: ${currentPalettes.map(p => p.name).join(', ')}` :
                    'Empty'}
</canvas_state>

<recent_conversation>
${this.conversationHistory.slice(-10).map(m => `<turn role="${m.role}">${m.text}</turn>`).join('\n')}
</recent_conversation>

<current_input>
${userInput}
</current_input>

Analyze the <current_input> in context of <recent_conversation> and <brand_dna>. Call tools if necessary.`;

        try {
            const model = this.ai.getGenerativeModel({
                model: MODELS.ARCHITECT_TEXT, // Use the smart model (Gemini 1.5 Pro)
                systemInstruction: this.getPhaseSystemInstruction(this.phase), // Dynamic Prompt
                tools: [
                    {
                        functionDeclarations: this.getPhaseTools(this.phase) // Dynamic Tools
                    }
                ],
                toolConfig: {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.AUTO,
                    },
                },
            });

            const result = await model.generateContentStream({
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    ...this.conversationHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.text }]
                    }))
                ],
            });

            // Extract function calls and handle stream
            const functionCalls: FunctionCall[] = [];
            let fullText = '';
            let hasFiredThought = false;

            for await (const chunk of result) {
                const parts = chunk.candidates?.[0]?.content?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.text) {
                            fullText += part.text;
                            // Check for THOUGHT line
                            if (fullText.includes('THOUGHT:') && onThought) {
                                const thoughtMatch = fullText.match(/THOUGHT:.*?(?=\n|$)/);
                                if (thoughtMatch) {
                                    const thoughtText = thoughtMatch[0];
                                    const lowerThought = thoughtText.toLowerCase();

                                    // Parse tool type and target from thought
                                    let toolType: 'display_fonts' | 'display_colors' | 'update_dna' | undefined;
                                    let targetField: string | undefined;

                                    if (lowerThought.includes('font')) toolType = 'display_fonts';
                                    else if (lowerThought.includes('color')) toolType = 'display_colors';
                                    else if (lowerThought.includes('name') || lowerThought.includes('mission') || lowerThought.includes('voice')) toolType = 'update_dna';

                                    if (lowerThought.includes('target: name')) targetField = 'name';
                                    else if (lowerThought.includes('target: mission')) targetField = 'mission';
                                    else if (lowerThought.includes('target: voice')) targetField = 'voice';
                                    else if (lowerThought.includes('target: font')) targetField = 'typography';
                                    else if (lowerThought.includes('target: color')) targetField = 'colors';

                                    // Only fire once per stream (crude check: if we haven't fired yet? 
                                    // simpler: fire every time we find a valid thought, client updates idempotent)
                                    onThought(thoughtText, toolType, targetField);
                                }
                            }
                        }
                        if (part.functionCall) {
                            functionCalls.push(part.functionCall);
                        }
                    }
                }
            }

            // Add model response to history (just note that tools were called)
            if (functionCalls.length > 0) {
                this.conversationHistory.push({
                    role: 'model',
                    text: `[Called tools: ${functionCalls.map(fc => fc.name).join(', ')}]`
                });
            } else if (fullText) {
                this.conversationHistory.push({
                    role: 'model',
                    text: fullText
                });
            }

            console.log(`🧠 ToolDecisionAgent decided: ${functionCalls.length > 0 ? functionCalls.map(fc => fc.name).join(', ') : 'no tools'}`);

            return functionCalls;
        } catch (error) {
            console.error('ToolDecisionAgent error:', error);
            return [];
        }
    }

    private buildStateContext(
        dna: BrandDNA,
        canvasMode: string,
        fonts: Array<{ name: string; category: string }>,
        palettes: Array<{ name: string; colors: string[]; vibe: string }>
    ): string {
        let canvas = 'Canvas: empty';
        if (canvasMode === 'fonts' && fonts.length > 0) {
            canvas = `Canvas: showing fonts (${fonts.map(f => f.name).join(', ')})`;
        } else if (canvasMode === 'colors' && palettes.length > 0) {
            canvas = `Canvas: showing palettes (${palettes.map(p => p.name).join(', ')})`;
        }

        return `Brand DNA: name="${dna.name || ''}", mission="${dna.mission || ''}", typography=${JSON.stringify(dna.typography || [])}, colors=${JSON.stringify(dna.colors || [])}, voice="${dna.voice || ''}"
${canvas}`;
    }

    private trimHistory(): void {
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }
    }

    addModelResponse(text: string): void {
        this.conversationHistory.push({ role: 'model', text });
        this.trimHistory();
    }

    clearHistory(): void {
        this.conversationHistory = [];
    }

    private getPhaseTools(phase: 'discovery' | 'execution'): FunctionDeclaration[] {
        if (phase === 'discovery') {
            // PHASE 1: LISTENER BRAIN
            // Only allow the "Handshake" tool (research_competitors) and general lookup
            return toolDefinitions.filter(t =>
                t.name === 'research_competitors' ||
                t.name === 'general_research'
            );
        } else {
            // PHASE 2: EXECUTOR BRAIN
            // Allow EVERYTHING (Design tools, Updates, Research)
            return toolDefinitions;
        }
    }

    private getPhaseSystemInstruction(phase: 'discovery' | 'execution'): string {
        if (phase === 'discovery') {
            return `
YOU ARE "THE LISTENER".
ROLE: Passive observer of a conversation between a User and Gemini Live.
GOAL: Detect when the User and AI have agreed to "Start Building".
TOOLS: You have ONE primary tool: 'research_competitors'. This is the trigger.

PROTOCOL:
1. LISTEN to the chat.
2. IGNORE affirmations ("Yes", "Cool", "Locked in").
3. WAIT for the "HANDSHAKE":
   - AI asks: "Ready to build?"
   - User says: "Yes".
4. TRIGGER: Call 'research_competitors' with all gathered context.

STRICT RULE: DO NOT CALL ANY OTHER TOOLS. DO NOT UPDATE DNA.
`;
        } else {
            return `
YOU ARE "THE EXECUTOR".
ROLE: Active Builder. You have been triggered to execute the design.
GOAL: Build the Brand.
TOOLS: You have ALL tools (fonts, colors, DNA updates, etc.).

PROTOCOL:
1. REVIEW the current state (Context).
2. EXECUTE the necessary steps to visualize the brand.
3. Call tools sequentially or in parallel as needed.
4. NO NEED TO WAIT for permission. You have the green light.
`;
        }
    }
}
