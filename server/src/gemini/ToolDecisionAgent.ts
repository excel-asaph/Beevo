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
        description: "Save or update Brand DNA fields. Saves ALL data exactly as provided - if user selects 7 colors, save all 7. If user provides full mission statement, save the complete text.",
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
    }
    // end_session tool REMOVED - was causing false terminations
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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }
        this.ai = new GoogleGenAI({ apiKey });
    }

    /**
     * Analyze user input and decide which tools to call
     * Returns an array of tool calls to execute
     */
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

2. CONSERVATIVE CALLING:
   - If canvas already shows what user wants → NO TOOLS
   - If user just says "okay" → NO TOOLS
   - Don't call tools for greetings

3. OUTPUT FORMAT:
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
            const result = await this.ai.models.generateContentStream({
                model: MODELS.ARCHITECT_TEXT,
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    ...this.conversationHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.text }]
                    }))
                ],
                config: {
                    tools: [{ functionDeclarations: toolDefinitions }],
                    toolConfig: {
                        functionCallingConfig: {
                            mode: FunctionCallingConfigMode.AUTO
                        }
                    }
                }
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
}
