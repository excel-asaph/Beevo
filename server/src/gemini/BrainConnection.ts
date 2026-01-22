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
import { stateManager } from '../services/StateManager';

// Tool declarations for the Brain (same as before, but ONLY here)
const brainToolDeclarations: FunctionDeclaration[] = [
    {
        name: "start_brand_research",
        description: "START the 5-phase brand research workflow. Triggers the Execution Engine which automates: 1) DNA Extraction 2) Competitor Research 3) Color Generation 4) Typography Selection. Call this when the user says 'start research', 'extract brand', 'build my brand', or after initial discovery discussion.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                summary: {
                    type: Type.STRING,
                    description: "Brief summary of user intent so far"
                }
            }
        }
    },

    {
        name: "display_palette_options",
        description: "Single robust tool to Generate, Modify, or SELECT color palettes. To select, pass the full list back with `isSelected: true` on the chosen one(s). To delete, omit items from the list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                palettes: {
                    type: Type.ARRAY,
                    description: "The INSTRUCTION: Provide the FULL desired state of the palette list. To ADD, append new items. To DELETE, omit items. To SELECT, set isSelected=true. The system will persist this exact state.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "Unique ID (preserve existing IDs)" },
                            name: { type: Type.STRING, description: "Descriptive palette name" },
                            colors: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "Array of hex colors. MAX 5 colors per palette."
                            },
                            vibe: { type: Type.STRING, description: "Mood/feeling of the palette" },
                            isSelected: { type: Type.BOOLEAN, description: "Set to TRUE if this palette is selected by the user." }
                        },
                        required: ["name", "colors", "vibe"]
                    }
                },
                palette_count: {
                    type: Type.INTEGER,
                    description: "Number of NEW palettes to generate. Total palettes cannot exceed 10."
                },
                colors_per_palette: {
                    type: Type.INTEGER,
                    description: "Colors in each palette (Max 5)."
                },
                base_palette: {
                    type: Type.STRING,
                    description: "Name of existing palette to base new ones on"
                },
                operation: {
                    type: Type.STRING,
                    description: "'generate' (create new), 'update' (modify/select/delete existing)"
                },
                mood_filter: { type: Type.STRING },
                query: { type: Type.STRING }
            },
            required: []
        }
    },

    {
        name: "update_brand_name",
        description: "Update the Brand Name. Call when user wants to rename the brand. Sets the name and marks it selected.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "New brand name" }
            },
            required: ["name"]
        }
    },
    {
        name: "update_mission",
        description: "Update the Mission Statement. Call when user wants to change the mission.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                mission: { type: Type.STRING, description: "New mission statement" }
            },
            required: ["mission"]
        }
    },
    {
        name: "update_tagline",
        description: "Update the Tagline/Slogan. Call when user wants to change the tagline.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                tagline: { type: Type.STRING, description: "New tagline" }
            },
            required: ["tagline"]
        }
    },
    {
        name: "update_voice",
        description: "Update the Brand Voice. Call when user wants to change the voice description.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                voice: { type: Type.STRING, description: "New brand voice description" }
            },
            required: ["voice"]
        }
    },
    {
        name: "update_values",
        description: "Update the Core Values. Call when user wants to change the list of values.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                values: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of new values" }
            },
            required: ["values"]
        }
    },
    {
        name: "update_target_audience",
        description: "Update the Target Audience. Call when user wants to change the target audience, customers, demographics, or who the brand serves.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                targetAudience: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of target audience segments" }
            },
            required: ["targetAudience"]
        }
    },
    {
        name: "update_mood",
        description: "Update the Brand Mood/Feeling. Call when user wants to change the mood, tone, feeling, vibe, or emotional attributes of the brand.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of mood/feeling descriptors (e.g., 'modern', 'natural', 'vibrant')" }
            },
            required: ["mood"]
        }
    },
    {
        name: "display_typography_options",
        description: "Single robust tool to Generate, Modify, or SELECT fonts. To select, pass the full list back with `isSelected: true`. To delete, omit items.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fonts: {
                    type: Type.ARRAY,
                    description: "The INSTRUCTION: Provide the FULL desired state of the font list. CRITICAL: If the user says 'SELECT' a font, you MUST set `isSelected: true` for that specific font in this list. To ADD, append new items. To DELETE, omit items. The system will persist this exact state.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "Unique ID (preserve existing)" },
                            name: { type: Type.STRING, description: "Google Font family name" },
                            category: { type: Type.STRING, description: "serif, sans-serif, etc." },
                            reasoning: { type: Type.STRING },
                            pairing: { type: Type.STRING },
                            isSelected: { type: Type.BOOLEAN, description: "Set to TRUE if selected." }
                        },
                        required: ["name", "category", "reasoning"]
                    }
                },
                context_text: {
                    type: Type.STRING,
                    description: "Text to preview fonts with (brand name, tagline, etc.)"
                },
                font_count: { type: Type.INTEGER, description: "Number of NEW fonts to generate. Total fonts cannot exceed 10." },
                operation: {
                    type: Type.STRING,
                    description: "'generate' (create new), 'update' (modify/select/delete existing)"
                },
                style_filter: { type: Type.STRING },
                query: { type: Type.STRING }
            },
            required: []
        }
    },
    {
        name: "display_logo_structure_options",
        description: "Single robust tool to Generate or SELECT logo structures. To select, pass the full list back with `isSelected: true`.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                options: {
                    type: Type.ARRAY,
                    description: "The FULL desired state of the structure options list.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            type: { type: Type.STRING, description: "wordmark, lettermark, emblem, combination" },
                            reasoning: { type: Type.STRING },
                            suitability: { type: Type.STRING },
                            isSelected: { type: Type.BOOLEAN, description: "Set to TRUE if selected." }
                        },
                        required: ["type", "reasoning", "suitability"]
                    }
                },
                structure_count: { type: Type.INTEGER },
                query: { type: Type.STRING }
            },
            required: []
        }
    },
    {
        name: "display_logo_inspirations",
        description: "Single robust tool to SEARCH for or SELECT logo inspirations. To SEARCH, provide a `search_query`. To SELECT/MANAGE, provide the `inspirations` list with `isSelected: true` on chosen items.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                search_query: {
                    type: Type.STRING,
                    description: "If present, the tool will SEARCH the web for logos and APPEND them to the list."
                },
                inspirations: {
                    type: Type.ARRAY,
                    description: "The FULL desired state of the inspiration list. Use this to Delete (remove items), Reorder, or Select (mark `isSelected: true`).",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            displayName: { type: Type.STRING },
                            url: { type: Type.STRING },
                            isSelected: { type: Type.BOOLEAN, description: "Set to TRUE if selected." }
                        },
                        required: ["id", "url"]
                    }
                },
                style_keywords: { type: Type.STRING },
                industry: { type: Type.STRING },
                query: { type: Type.STRING }
            },
            required: []
        }
    },
    {
        name: "display_imagery_suggestions",
        description: "Single robust tool to Generate or SELECT imagery concepts. To select, pass the full list back with `isSelected: true`.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    description: "The FULL desired state of the imagery list.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            concept: { type: Type.STRING },
                            description: { type: Type.STRING },
                            visualStyle: { type: Type.STRING },
                            isSelected: { type: Type.BOOLEAN, description: "Set to TRUE if selected." }
                        },
                        required: ["concept", "description", "visualStyle"]
                    }
                },
                suggestion_count: { type: Type.INTEGER },
                query: { type: Type.STRING }
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

    // Called by ToolHandler when start_brand_research is about to execute
    public markStartResearchDecided() {
        this.extractBrandIdentityDecided = true;
        console.log('🧠 [BrainConnection] start_brand_research marked as DECIDED - removing from future tool lists');
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
                            if (toolName === 'start_brand_research') {
                                this.extractBrandIdentityDecided = true;
                                console.log('🧠 [BrainConnection] start_brand_research EXECUTING - blocking future calls');
                            }

                            this.interruptLive();

                            // Execute the tool
                            if (toolName) {
                                // Pass conversation history for brand extraction
                                if (toolName === 'start_brand_research') {
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
            oneTimeToolsExecuted.push('start_brand_research');
        }

        // Filter out one-time tools that have been executed FIRST, before phase logic
        const availableTools = brainToolDeclarations.filter(t => !oneTimeToolsExecuted.includes(t.name || ''));

        switch (phase) {
            case 'discovery':
                // PHASE 1: LISTENER BRAIN - Only the research start trigger
                return availableTools.filter(t => t.name === 'start_brand_research' || t.name === 'general_research');

            case 'execution':
                // PHASE 2: BUILDER BRAIN - Automated flow running, minimal interference
                return availableTools.filter(t => t.name === 'general_research');

            case 'modification':
                // PHASE 3: MODIFIER BRAIN - Change tools only
                return availableTools.filter(t => [
                    'display_typography_options',
                    'display_palette_options',
                    'display_logo_structure_options',
                    'display_imagery_suggestions',
                    'search_logo_inspiration',
                    'general_research',
                    // Update Tools
                    'update_brand_name',
                    'update_mission',
                    'update_tagline',
                    'update_voice',
                    'update_values',
                    'update_target_audience',
                    'update_mood'
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
                    'TOOLS: You have ONE tool: `start_brand_research` - the trigger to start building.',
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
                    '   - YOU MUST CALL `start_brand_research` IMMEDIATELY.',
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

            case 'modification': {
                // PHASE 3: MODIFIER BRAIN - Post-canvas changes
                // Load full research state for complete context
                const researchState = stateManager.loadLatest();

                // Build complete context from research state
                const researchContext = researchState ? JSON.stringify({
                    brandDNA: researchState.brandDNA,
                    competitors: researchState.competitorResearch?.competitors?.map(c => c.name) || [],
                    differentiationStrategy: researchState.competitorResearch?.differentiationOpportunity?.slice(0, 200) || 'N/A',
                    colorPalettes: researchState.colorPalettes?.palettes?.map(p => ({ name: p.name, colors: p.colors })) || [],
                    typography: researchState.typographyPairings?.fonts?.map(f => ({ name: f.name, pairing: f.pairing })) || [],
                    logoInspirations: researchState.logoInspirations?.inspirations?.map(l => ({ id: l.id, displayName: l.displayName })) || [],
                    imagery: researchState.imagery?.suggestions?.map(i => ({ concept: i.concept })) || [],
                    generalResearch: researchState.generalResearch?.queries?.map(q => q.query) || []
                }, null, 2) : 'No research state available';

                // Detect empty sections for context awareness
                const emptySections: string[] = [];
                if (!researchState?.logoInspirations?.inspirations?.length) emptySections.push('logoInspirations (no logo search done yet)');
                if (!researchState?.imagery?.suggestions?.length) emptySections.push('imagery (no imagery suggestions generated)');
                if (!researchState?.logoStructures?.options?.length) emptySections.push('logoStructures (no logo types generated)');
                if (!researchState?.generalResearch?.queries?.length) emptySections.push('generalResearch (no research queries done)');

                const emptyWarning = emptySections.length > 0
                    ? `\n⚠️ EMPTY SECTIONS (tell user if they reference these): ${emptySections.join(', ')}`
                    : '';

                const hasColors = dnaObj.colors && dnaObj.colors.length > 0;
                const hasFonts = dnaObj.typography && dnaObj.typography.length > 0;

                // Derive "Current Selection" from the Menu (researchState) if possible, as it tracks isSelected source of truth
                const selectedPalette = researchState?.colorPalettes?.palettes?.find(p => p.isSelected);
                const currentColors = selectedPalette ? selectedPalette.colors : (dnaObj.colors?.items || []);
                const colorDisplay = currentColors.length > 0 ? currentColors.slice(0, 4).join(', ') : 'None Selected';

                const selectedFontPair = researchState?.typographyPairings?.fonts?.find(f => f.isSelected);
                const currentFonts = selectedFontPair
                    ? [selectedFontPair.name, selectedFontPair.pairing].filter(Boolean)
                    : (dnaObj.typography?.items || []);
                const fontDisplay = currentFonts.length > 0 ? currentFonts.join(', ') : 'None Selected';

                console.log(`🧠 Brain Mode: MODIFICATION (Modifier) - colors:${currentColors.length}, fonts:${currentFonts.length}`);

                return [
                    'YOU ARE "THE MODIFIER" (Architect).',
                    'ROLE: The canvas is COMPLETE. The User is looking at it.',
                    'GOAL: Handle user requests to CHANGE/UPDATE specific fields.',
                    '',
                    '🎯 FUZZY TOOL MATCHING (CRITICAL):',
                    'User requests may not exactly match tool names. Use ~80% similarity matching:',
                    '- "update voice" OR "change brand voice" OR "modify the tone" → `update_voice`',
                    '- "change values" OR "update brand values" OR "modify core values" → `update_values`',
                    '- "update mood" OR "change feeling" OR "modify vibe" → `update_mood`',
                    '- "change audience" OR "update targets" OR "modify who we serve" → `update_target_audience`',
                    '- "new colors" OR "generate palettes" OR "different color scheme" → `display_palette_options`',
                    '- "new fonts" OR "different typography" OR "change typeface" → `display_typography_options`',
                    'If the user request is ~80% related to a tool you have, USE THAT TOOL.',
                    '',
                    'HANDLING REQUESTS:',
                    '1. SELECT: If user picks an option, call `display_...` with `isSelected: true`.',
                    '2. UPDATE: If user wants to change text, call `update_...`.',
                    '3. GENERATE: If user wants new options, call `display_...` with `count` or `query`.',
                    '',
                    '⚡ EXECUTION RULE: EXECUTE IMMEDIATELY upon clear user request.',
                    '- User: "Change name to Nike" -> Call `update_brand_name` NOW.',
                    '- User: "Generate 3 palettes" -> Call `display_palette_options` NOW.',
                    '- DO NOT wait for permission if the request is direct.',
                    '',
                    '⚠️ CONTEXT AWARENESS:',
                    'If user references something that does NOT EXIST (e.g., "I like logo_3" but no logos),',
                    'respond: "We haven\'t searched for logos yet. Would you like me to find some?"',
                    emptyWarning,
                    '',
                    '📊 COMPLETE RESEARCH STATE (Your Knowledge Base):',
                    researchContext,
                    '',
                    '📌 CURRENT CANVAS STATE (Visible to User):',
                    `  Name: ${dnaObj.name?.value || 'Unknown'}`,
                    `  Mission: ${dnaObj.mission?.value || 'Unknown'}`,
                    `  Values: ${dnaObj.values?.items ? dnaObj.values.items.join(', ') : 'Unknown'}`,
                    `  Tagline: ${dnaObj.tagline?.value || 'Unknown'}`,
                    `  Colors: ${colorDisplay} (${researchState?.colorPalettes?.palettes?.length || 0} Options Available)`,
                    `  Fonts: ${fontDisplay} (${researchState?.typographyPairings?.fonts?.length || 0} Options Available)`,
                    '',
                    `History (This Phase Only):`,
                    `${historyText}`
                ].join('\n');
            }
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
