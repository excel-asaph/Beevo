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
import { WorkspaceManager } from '../services/StateManager';

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
    // --- BRAND DNA UPDATES ---
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

    // --- COLOR PALETTE TOOLS ---
    {
        name: "create_color_palette",
        description: "Create new color palette(s). AI generates options.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Description of the palette to create." },
                count: { type: Type.INTEGER, description: "Number of palettes to create. Default is 1." }
            },
            required: ["query"]
        }
    },
    {
        name: "delete_color_palette",
        description: "Delete color palette(s). Use 'instruction' to describe which to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which palettes to delete (e.g. 'delete the neon one')." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "select_color_palettes",
        description: "Select color palette(s). Use 'instruction' to describe which to select.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which palettes to select (e.g. 'choose the dark blue one')." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "unselect_color_palettes",
        description: "Unselect color palette(s). Use 'instruction' to describe which to unselect.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which palettes to unselect." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "update_colors_in_palette",
        description: "Update existing colors in a palette. Use 'instruction' to describe the change.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                paletteName: { type: Type.STRING, description: "Name of the palette to modify (optional if obvious)." },
                instruction: { type: Type.STRING, description: "Instruction for the update (e.g., 'replace blue with red', 'make it darker')." }
            },
            required: ["instruction"]
        }
    },
    // --- FONT TOOLS ---
    {
        name: "create_fonts",
        description: "Create new font pairing(s).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Description of the font style." },
                count: { type: Type.INTEGER, description: "Number of pairings to create. Default is 1." }
            },
            required: ["query"]
        }
    },
    {
        name: "delete_fonts",
        description: "Delete font pairing(s). Use 'instruction' to describe which to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which fonts to delete." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "select_fonts",
        description: "Select font pairing(s). Use 'instruction' to describe which to select.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which fonts to select." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "unselect_fonts",
        description: "Unselect font pairing(s). Use 'instruction' to describe which to unselect.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which fonts to unselect." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "create_logo_structures",
        description: "Create/Recommend new Logo Structure options (e.g. Wordmark, Emblem).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Description of the structure request (e.g. 'simple wordmarks')." },
                count: { type: Type.INTEGER, description: "Number of options to create. Default is 3." }
            },
            required: ["query"]
        }
    },
    {
        name: "select_logo_structures",
        description: "Select logo structure(s). Use 'instruction' to describe which to select.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which structures to select." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "unselect_logo_structures",
        description: "Unselect logo structure(s). Use 'instruction' to describe which to unselect.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which structures to unselect." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "delete_logo_structures",
        description: "Delete logo structure(s). Use 'instruction' to describe which to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which structures to delete." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "create_logo_inspirations",
        description: "Search for Logo Inspirations from the web.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Search query for logo styles (e.g. 'minimalist tech logos')." },
                count: { type: Type.INTEGER, description: "Number of results to fetch." }
            },
            required: ["query"]
        }
    },
    {
        name: "select_logo_inspirations",
        description: "Select logo inspiration(s). Use 'instruction' to describe which to select.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which inspirations to select." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "unselect_logo_inspirations",
        description: "Unselect logo inspiration(s). Use 'instruction' to describe which to unselect.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which inspirations to unselect." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "delete_logo_inspirations",
        description: "Delete logo inspiration(s). Use 'instruction' to describe which to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which inspirations to delete." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "create_imagery_suggestions",
        description: "Generate Imagery/Photography suggestions.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "Description of the imagery style." },
                count: { type: Type.INTEGER, description: "Number of suggestions to create." }
            },
            required: ["query"]
        }
    },
    {
        name: "select_imagery_suggestions",
        description: "Select imagery suggestion(s). Use 'instruction' to describe which to select.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which suggestions to select." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "unselect_imagery_suggestions",
        description: "Unselect imagery suggestion(s). Use 'instruction' to describe which to unselect.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which suggestions to unselect." }
            },
            required: ["instruction"]
        }
    },
    {
        name: "delete_imagery_suggestions",
        description: "Delete imagery suggestion(s). Use 'instruction' to describe which to delete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                instruction: { type: Type.STRING, description: "Instruction describing which suggestions to delete." }
            },
            required: ["instruction"]
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
        private getBrandDNA: () => Partial<BrandDNA>,
        private workspaceId: string = 'default'
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

            // 1. Add AI Transcript if present (provides context for user's reply)
            if (aiTranscript && aiTranscript.trim()) {
                this.conversationHistory.push({
                    role: 'assistant',
                    transcript: aiTranscript,
                    timestamp: now
                });
            }

            // 2. Add User Transcript if present
            if (userTranscript && userTranscript.trim()) {
                this.conversationHistory.push({
                    role: 'user',
                    transcript: userTranscript,
                    timestamp: now
                });
            }

            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            // Check cache for identical requests
            if (userTranscript === this.cachedTranscript && (now - this.lastAnalysisTime) < 2000) {
                return;
            }
            this.cachedTranscript = userTranscript;
            this.lastAnalysisTime = now;

            const dnaObj = this.getBrandDNA();
            const dnaContext = JSON.stringify(dnaObj, null, 2);

            // Filter history by PHASE (Critical for separation of concerns)
            const phaseHistory = this.conversationHistory
                .filter(t => t.timestamp >= this.phaseStartTime)
                .map(t => `${t.role}: ${t.transcript}`)
                .join('\n');

            // If history is too short in this phase, maybe include a bit of previous?
            // No, strict separation is safer to prevent old context from confusing new tools.
            const historyText = phaseHistory || "No conversation yet in this phase.";

            // ---------------------------------------------------------
            // SELECT SYSTEM PROMPT BASED ON PHASE
            // ---------------------------------------------------------
            let systemPrompt = '';

            // Build tool history string
            const toolHistoryXML = this.recentToolCalls.length > 0
                ? `<tool_history>${this.recentToolCalls.map(tc =>
                    `<call name="${tc.name}" timestamp="${tc.timestamp}">${tc.args}</call>`
                ).join('')}</tool_history>`
                : '';

            switch (this.phase) {
                case 'discovery':
                    // PHASE 1: LISTENER BRAIN - Discovery Mode
                    if (this.extractBrandIdentityDecided) {
                        console.log('🧠 [BrainConnection] Research already DECIDED. Skipping analysis.');
                        return;
                    }
                    console.log('🧠 Brain Mode: DISCOVERY (Listener)');
                    systemPrompt = [
                        'YOU ARE "THE LISTENER".',
                        'PHASE: DISCOVERY',
                        'GOAL: Listen to the conversation and decide when to START RESEARCH.',
                        '',
                        'PROTOCOL:',
                        '1. Listen to the User talking to Gemini Live.',
                        '2. Context: They are discussing brand ideas (name, mission, vibe).',
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
                        '   - ARGUMENT `summary`: You MUST populate this with a detailed summary including Brand Name, Mission, Vibe, and any specific requests (e.g. "Nike" or "Minimalist").',
                        '   - DO NOT just say "Starting now". YOU MUST EXECUTE THE TOOL.',
                        '   - If you send a text response like "Starting...", ensure the tool call is ATTACHED.',
                        '',
                        'STRICT RULE: DO NOT CALL ANY OTHER TOOLS. DO NOT CALL PREMATURELY.',
                        '',
                        `DNA: ${dnaContext}`,
                        `History: ${historyText}`
                    ].join('\n');
                    break;

                case 'execution':
                    // PHASE 2: BUILDER BRAIN - Sequential Atomic Tools
                    const manager = WorkspaceManager.getStateManager(this.workspaceId);
                    const fullState = manager.loadLatest();
                    const hasColors = fullState?.colorPalettes?.palettes && fullState.colorPalettes.palettes.length > 0;
                    const hasFonts = fullState?.typographyPairings?.fonts && fullState.typographyPairings.fonts.length > 0;

                    console.log(`🧠 Brain Mode: EXECUTION (Sequential Builder). Colors: ${hasColors}, Fonts: ${hasFonts}`);

                    systemPrompt = [
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
                    break;

                case 'modification':
                    // PHASE 3: MODIFIER BRAIN - Post-canvas changes
                    // Load full research state for complete context
                    const modifierManager = WorkspaceManager.getStateManager(this.workspaceId);
                    const researchState = modifierManager.loadLatest();

                    // Build complete context from research state
                    const researchContext = researchState ? JSON.stringify({
                        brandDNA: researchState.brandDNA,
                        competitors: researchState.competitorResearch?.competitors?.map(c => c.name) || [],
                        differentiationStrategy: researchState.competitorResearch?.differentiationOpportunity?.slice(0, 200) || 'N/A',
                        colorPalettes: researchState.colorPalettes?.palettes?.map(p => ({ name: p.name, colors: p.colors })) || [],
                        typography: researchState.typographyPairings?.fonts?.map(f => ({ name: f.name, pairing: f.pairing })) || [],
                        logoInspirations: researchState.logoInspirations?.inspirations?.map(l => ({ id: l.id, displayName: l.displayName })) || [],
                        imagery: researchState.imagery?.suggestions?.map(i => ({ concept: i.concept })) || [],
                        logoStructures: researchState.logoStructures?.options?.map(s => ({ type: s.type, isSelected: s.isSelected })) || [],
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

                    // Derive "Current Selection" from the Menu (researchState) if possible, as it tracks isSelected source of truth
                    const selectedPalette = researchState?.colorPalettes?.palettes?.find(p => p.isSelected);
                    const currentColors = selectedPalette ? selectedPalette.colors : [];
                    const colorDisplay = currentColors.length > 0 ? currentColors.slice(0, 4).join(', ') : 'None Selected';

                    const selectedFontPair = researchState?.typographyPairings?.fonts?.find(f => f.isSelected);
                    const currentFonts = selectedFontPair
                        ? [selectedFontPair.name, selectedFontPair.pairing].filter(Boolean)
                        : [];
                    const fontDisplay = currentFonts.length > 0 ? currentFonts.join(', ') : 'None Selected';

                    const selectedStructure = researchState?.logoStructures?.options?.find(s => s.isSelected);
                    const structureDisplay = selectedStructure ? selectedStructure.type : 'None Selected';

                    console.log(`🧠 Brain Mode: MODIFICATION (Modifier) - colors:${currentColors.length}, fonts:${currentFonts.length}, struct:${structureDisplay}`);

                    systemPrompt = [
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
                        '- "new colors" OR "generate palettes" OR "different color scheme" → `create_color_palette`',
                        '- "new fonts" OR "different typography" OR "change typeface" → `create_fonts`',
                        'If the user request is ~80% related to a tool you have, USE THAT TOOL.',
                        '',
                        'HANDLING REQUESTS:',
                        '1. SELECT: If user picks an option, call `select_...` (e.g. `select_fonts`).',
                        '2. UNSELECT: If user wants to remove/deselect an option, call `unselect_...` (e.g. `unselect_fonts`).',
                        '3. UPDATE: If user wants to change text, call `update_...` or `update_colors_in_palette`.',
                        '4. GENERATE: If user wants new options, call `create_...` (for palettes/fonts) or `create_logo_...`.',
                        '5. DELETE: If user wants to permanently delete/remove an option, call `delete_...`.',
                        '6. RESEARCH: If user asks for information/facts, call `general_research`.',
                        '',
                        '⚡ EXECUTION RULE: PREFER CONFIRMATION for significant changes.',
                        '- User: "Change name to Nike" -> Respond: "Shall I update the name to Nike?"',
                        '- User: "Generate 3 palettes" -> Respond: "I can generate new palettes. Ready?"',
                        '- ONLY execute immediately if the user explicitly confirms (e.g. "Yes", "Do it", "Go ahead").',
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
                        `  Logo Structure: ${structureDisplay} (${researchState?.logoStructures?.options?.length || 0} Options Available)`,
                        '',
                        `History (This Phase Only):`,
                        `${historyText}`,
                        '',
                        '🧩 TOOL EXECUTION HISTORY (What you have already done):',
                        toolHistoryXML
                    ].join('\n');
                    break;
            }

            // ---------------------------------------------------------
            // CALL GEMINI WITH TOOLS
            // ---------------------------------------------------------
            // UPDATED: Using correct @google/genai syntax
            const response = await this.client.models.generateContent({
                model: MODELS.ARCHITECT_TEXT, // User requested Gemini 3 Flash Preview for Brain
                contents: [{ role: 'user', parts: [{ text: `SYSTEM_PROMPT:\n${systemPrompt}\n\nUSER_TRANSCRIPT (Last 30s):\n${userTranscript}` }] }],
                config: {
                    tools: brainTools
                }
            });

            // Parse function calls manually from the new SDK structure
            const candidate = response.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            // Helper to normalize function calls from different SDK response shapes
            let functionCalls: any[] = [];

            if (part && 'functionCall' in part) {
                // Single function call in part
                functionCalls = [part.functionCall];
            } else if (candidate?.content?.parts) {
                // Check all parts for function calls
                functionCalls = candidate.content.parts
                    .filter((p: any) => 'functionCall' in p)
                    .map((p: any) => p.functionCall);
            }

            if (functionCalls && functionCalls.length > 0) {
                console.log(`⚡ Brain Decided: Calls ${functionCalls.length} tools: ${functionCalls.map(fc => fc.name).join(', ')}`);
                console.log('ARGS:', JSON.stringify(functionCalls[0].args));

                // STOP Live session to prevent hallucination overlapping
                this.interruptLive();

                // Track tool usage
                this.lastToolCall = Date.now();
                this.recentToolCalls.push({
                    name: functionCalls[0].name,
                    timestamp: Date.now(),
                    args: JSON.stringify(functionCalls[0].args)
                });

                // --- MARK RESEARCH AS DECIDED ---
                if (functionCalls.some(fc => fc.name === 'start_brand_research')) {
                    this.markStartResearchDecided();
                }

                // Execute tools via Handler (Batch)
                const toolCallsPayload = functionCalls.map(fc => ({
                    id: 'call_' + Math.random().toString(36).substr(2, 9),
                    name: fc.name,
                    args: fc.args
                }));

                try {
                    const toolResults = await this.toolHandler.handleToolCalls(toolCallsPayload);

                    // Log and track results
                    toolResults.forEach(tr => {
                        console.log(`✅ Tool Executed: ${tr.name} -> ${tr.response.result}`);
                        this.toolExecutionHistory.push({
                            id: tr.id,
                            name: tr.name,
                            timestamp: Date.now(),
                            args: JSON.stringify(tr.name === 'start_brand_research' ? { summary: '...' } : {}), // Simplified for history to avoid huge logs
                            result: tr.response.result
                        });
                    });
                } catch (err) {
                    console.error('❌ Tool Execution Error:', err);
                }
            }



        } catch (error) {
            console.error('❌ Brain Analysis Error:', error);
        }
    }
}
