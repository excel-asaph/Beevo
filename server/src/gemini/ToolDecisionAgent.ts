import { GoogleGenAI, FunctionCallingConfigMode, FunctionCall, Type, FunctionDeclaration } from '@google/genai';
import { MODELS, SYSTEM_INSTRUCTIONS } from '../../../shared/constants';
import { BrandDNA } from '../../../shared/types';

// Tool definitions for the regular API using proper Type enum
const toolDefinitions: FunctionDeclaration[] = [
    {
        name: "display_font_suggestions",
        description: "Display visual font options on the canvas. ALWAYS call this before describing fonts.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fonts: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Font family name" },
                            category: { type: Type.STRING, description: "serif, sans-serif, display, handwriting, monospace" },
                            reasoning: { type: Type.STRING, description: "Brief reason" }
                        },
                        required: ["name", "category", "reasoning"]
                    }
                },
                context_text: {
                    type: Type.STRING,
                    description: "The text to preview"
                }
            },
            required: ["fonts", "context_text"]
        }
    },
    {
        name: "display_color_suggestions",
        description: "Display color palette options on the canvas. ALWAYS call this before describing colors.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                palettes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            vibe: { type: Type.STRING }
                        },
                        required: ["name", "colors", "vibe"]
                    }
                }
            },
            required: ["palettes"]
        }
    },
    {
        name: "update_live_brand_dna",
        description: "Save the Brand DNA to memory. Call this when the user makes a decision or provides new info.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                brandName: { type: Type.STRING, nullable: true },
                mission: { type: Type.STRING, nullable: true },
                selectedColors: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                selectedFont: { type: Type.STRING, nullable: true },
                voice: { type: Type.STRING, nullable: true }
            },
            required: []
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
    private maxHistoryLength = 20; // Keep last 20 messages for context

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
    async analyzeAndDecideTools(
        userInput: string,
        currentDNA: BrandDNA,
        canvasMode: 'none' | 'fonts' | 'colors',
        currentFonts: Array<{ name: string; category: string }>,
        currentPalettes: Array<{ name: string; colors: string[]; vibe: string }>
    ): Promise<FunctionCall[]> {
        // Build context
        const stateContext = this.buildStateContext(currentDNA, canvasMode, currentFonts, currentPalettes);

        // Add user message to history
        this.conversationHistory.push({ role: 'user', text: userInput });
        this.trimHistory();

        // Build the prompt for tool decision
        const systemPrompt = `You are a Brand DNA creation assistant. Your job is to decide which tools to call based on user input.

CURRENT STATE:
${stateContext}

TOOLS AVAILABLE:
- display_font_suggestions: Show fonts on canvas. Call when discussing/showing typography.
- display_color_suggestions: Show color palettes on canvas. Call when discussing/showing colors.
- update_live_brand_dna: Save user decisions (brandName, mission, selectedFont, selectedColors, voice).

=== INTENT CLASSIFICATION (DO THIS FIRST) ===
Before deciding on tools, classify the user's intent:

1. ACTION: User explicitly requests something new.
   Examples: "Show me fonts", "Give me 5 palettes", "Change the colors"
   → Proceed to tool selection

2. CONFIRMATION: User accepts/approves current state.
   Examples: "Okay", "That's fine", "Yes", "I like it", "Perfect", "Great"
   → Return NO TOOLS. The user is happy with what's shown.

3. SELECTION: User picks from displayed options.
   Examples: "I'll take Pacifico", "The second one", "Use the blue palette"
   → Call update_live_brand_dna to save their choice. Do NOT refresh display tools.

4. NEGATION: User rejects something.
   Examples: "No", "Not that one", "I don't like these"
   → Only call display tools if user wants NEW options. Ask for clarification if unclear.

5. QUESTION: User asks about something.
   Examples: "What is this?", "Why did you choose that?", "Can you explain?"
   → Return NO TOOLS. Just answer the question.

6. REFINEMENT: User wants to modify displayed options.
   Examples: "Make it bolder", "More playful", "Add warmer colors"
   → Call the appropriate display tool with MODIFIED options.

=== CONSERVATIVE CALL PROTOCOL ===
1. If canvas is ALREADY showing fonts and user says "okay/fine/yes" → NO TOOLS (they're confirming)
2. If canvas is ALREADY showing palettes and user says "okay/fine/yes" → NO TOOLS (they're confirming)
3. If you just called a display tool in the last turn, DO NOT call it again unless user explicitly says "new/different/more/refresh"
4. DO NOT call tools for casual conversation, greetings, or small talk

=== TOOL CALLING RULES ===
1. When user asks to see fonts/typography → call display_font_suggestions. Default to 3 options unless user specifies otherwise.
2. When user asks to see colors/palettes → call display_color_suggestions. Default to 3 options unless user specifies otherwise.
3. When user picks a font → call update_live_brand_dna with selectedFont
4. When user picks colors → call update_live_brand_dna with selectedColors
5. When user gives brand name/mission → call update_live_brand_dna
6. If user wants different options → call the appropriate display_* tool with NEW options
7. STRICTLY FOLLOW user constraints. If user says "only one", "just that one", or "filter to X", respect the quantity and content restrictions.
8. CONTENT ADHERENCE: If user specifies attributes (e.g. "bold", "pastel", "retro", "no serif"), the generated tool arguments MUST strictly match.

=== VISIBILITY FIXES ===
If user says "I can't see", "it's blank", "nothing showing", or "display it again" → CALL THE DISPLAY TOOL AGAIN immediately.
   - If context was fonts: call display_font_suggestions
   - If context was colors: call display_color_suggestions
   - If unsure: call display_font_suggestions (default)

Based on the conversation and intent classification, decide which tools (if any) should be called.`;

        try {
            const response = await this.ai.models.generateContent({
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

            // Extract function calls from response
            const functionCalls: FunctionCall[] = [];

            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.functionCall) {
                        functionCalls.push(part.functionCall);
                    }
                }
            }

            // Add model response to history (just note that tools were called)
            if (functionCalls.length > 0) {
                this.conversationHistory.push({
                    role: 'model',
                    text: `[Called tools: ${functionCalls.map(fc => fc.name).join(', ')}]`
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
