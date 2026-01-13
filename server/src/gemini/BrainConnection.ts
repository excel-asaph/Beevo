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
        description: "Display visual font options on the canvas. Use when the conversation discusses typography or font choices.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                fonts: {
                    type: Type.ARRAY,
                    description: "Array of font suggestions",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            category: { type: Type.STRING }
                        }
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
        description: "Display color palette options on the canvas. Use when discussing brand colors. All colors MUST be hex codes.",
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
                        }
                    }
                }
            },
            required: ["palettes"]
        }
    },
    {
        name: "update_live_brand_dna",
        description: "Save Brand DNA to memory when user makes a decision or provides new info.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                brandName: { type: Type.STRING, nullable: true },
                industry: { type: Type.STRING, nullable: true },
                mission: { type: Type.STRING, nullable: true },
                selectedFont: { type: Type.STRING, nullable: true },
                voice: { type: Type.STRING, nullable: true }
            },
            required: []
        }
    },
    {
        name: "search_logo_inspiration",
        description: "Search for logo inspiration images. Use when user asks for logo ideas, inspiration, or wants to see logo examples.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "Search query describing the desired logo style"
                },
                industry: {
                    type: Type.STRING,
                    description: "Industry context",
                    nullable: true
                }
            },
            required: ["query"]
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
    private readonly TOOL_COOLDOWN_MS = 8000; // Prevent rapid tool calls (increased)
    private recentToolCalls: { name: string; timestamp: number; args: string }[] = []; // Track what was already done

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
        // Prevent rapid-fire tool calls
        const now = Date.now();
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

        // Keep last 10 turns for context
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        // Build context for Brain
        const brandDNA = this.getBrandDNA();
        const historyText = this.conversationHistory
            .map(t => `${t.role.toUpperCase()}: ${t.transcript}`)
            .join('\n');

        // Build context of recently executed tools
        const recentToolsText = this.recentToolCalls
            .filter(t => now - t.timestamp < 30000) // Last 30 seconds
            .map(t => `- ${t.name} (${Math.round((now - t.timestamp) / 1000)}s ago)`)
            .join('\n') || 'None';

        // Detect if AI is asking a question (waiting for confirmation)
        const aiLower = aiTranscript.toLowerCase();
        const aiIsAskingQuestion =
            aiLower.includes('would you like') ||
            aiLower.includes('should i') ||
            aiLower.includes('do you want') ||
            aiLower.includes('shall i') ||
            aiLower.includes('?');

        // Detect if user is confirming
        const userLower = userTranscript.toLowerCase();
        const userIsConfirming =
            userLower.includes('yes') ||
            userLower.includes('please') ||
            userLower.includes('do it') ||
            userLower.includes('go ahead') ||
            userLower.includes('sure') ||
            userLower.includes('okay') ||
            userLower.includes('ok');

        // If AI is asking and user hasn't confirmed yet, DON'T call tools
        if (aiIsAskingQuestion && !userIsConfirming && userTranscript.trim().length < 3) {
            console.log(`🧠 Brain: AI is asking question, waiting for user confirmation...`);
            return;
        }

        const systemPrompt = `You are a tool orchestrator for a brand design assistant.
Your job is to decide when to call tools based on the conversation.

Current Brand DNA:
${JSON.stringify(brandDNA, null, 2)}

Recent conversation:
${historyText}

TOOLS ALREADY EXECUTED:
${recentToolsText}

CRITICAL RULES:
1. ONLY call a tool when the USER has CONFIRMED ("yes", "please", "do it", "go ahead")
2. If AI asked "Would you like me to..." - WAIT for user to say YES before calling tool
3. Do NOT call tools just because user mentioned something - wait for their confirmation
4. If AI is asking a question, respond with NO_TOOL_NEEDED until user confirms
5. Examples of user confirmation: "Yes please", "Do it", "Go ahead", "Sure", "Yes"
6. If user explicitly requests NEW action: "show me colors", "I want different fonts" → call tool

Respond with JUST the function call or say "NO_TOOL_NEEDED"`;

        try {
            console.log(`🧠 Brain analyzing: User="${userTranscript.slice(0, 50)}..." AI="${aiTranscript.slice(0, 50)}..."`);

            const response = await this.client.models.generateContent({
                model: MODELS.ARCHITECT_TEXT, // Gemini 3 Pro for precise, reliable tool decisions
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
                        const userHasRequest = userTranscript.trim().length > 3; // User said something meaningful

                        // SMART DUPLICATE CHECK: Only skip if:
                        // 1. Same tool was called recently, AND
                        // 2. User did NOT make a new request (just AI repeating)
                        const recentSameTool = this.recentToolCalls.find(
                            t => t.name === toolName && (now - t.timestamp) < 15000
                        );

                        if (recentSameTool && !userHasRequest) {
                            // AI is just repeating itself, skip
                            console.log(`🧠 Skipping duplicate: ${toolName} (AI repeat, no user request)`);
                            return;
                        }

                        // User explicitly requested OR it's a new type of tool call → execute!

                        console.log(`🧠 Brain decided to call: ${toolName}`);

                        // INTERRUPT Live voice stream
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

                            // Cleanup old entries (keep last 30 seconds)
                            this.recentToolCalls = this.recentToolCalls.filter(
                                t => now - t.timestamp < 30000
                            );
                        }

                        this.lastToolCall = Date.now();

                        // Only handle first tool call
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
