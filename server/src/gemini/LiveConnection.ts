import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Tool } from '@google/genai';
import { MODELS, SYSTEM_INSTRUCTIONS, AUDIO_CONFIG } from '../../../shared/constants';
import {
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage,
    DNAUpdateMessage
} from '../../../shared/messages';
import { BrandDNA, FontSuggestion, ColorPalette } from '../../../shared/types';
import { ToolHandler } from './ToolHandler';
import { ToolDecisionAgent } from './ToolDecisionAgent';

// Tool declarations for Gemini Live
const toolDeclarations: FunctionDeclaration[] = [
    {
        name: "display_font_suggestions",
        description: "Display visual font options on the canvas. Use this whenever discussing typography choices.",
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
        description: "Display color palette options on the canvas. Use this whenever discussing colors.",
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
            required: [] // Explicitly state no fields are required
        }
    }
];

const tools: Tool[] = [{ functionDeclarations: toolDeclarations }];

export class GeminiLiveConnection {
    private sessionId: string;
    private liveSession: any = null;
    private isConnected: boolean = false;
    private sendToClient: (message: ServerMessage) => void;
    private updateState: (field: string, value: any) => void;
    private toolHandler: ToolHandler;
    private toolDecisionAgent: ToolDecisionAgent;

    // State getters for the ToolDecisionAgent
    private getDNA: () => BrandDNA;
    private getFonts: () => Array<{ name: string; category: string }>;
    private getPalettes: () => Array<{ name: string; colors: string[]; vibe: string }>;
    private getCanvasMode: () => 'none' | 'fonts' | 'colors';

    constructor(
        sessionId: string,
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void,
        storePalettes: (palettes: any[]) => void = () => { },
        storeFonts: (fonts: any[]) => void = () => { },
        setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void = () => { },
        getDNA: () => any = () => ({}),
        getFonts: () => Array<{ name: string; category: string }> = () => [],
        getPalettes: () => Array<{ name: string; colors: string[]; vibe: string }> = () => [],
        getCanvasMode: () => 'none' | 'fonts' | 'colors' = () => 'none'
    ) {
        this.sessionId = sessionId;
        this.sendToClient = sendToClient;
        this.updateState = updateState;
        this.toolHandler = new ToolHandler(sendToClient, updateState, storePalettes, storeFonts, setCanvasMode, getDNA);
        this.toolDecisionAgent = new ToolDecisionAgent();

        // Store state getters
        this.getDNA = getDNA;
        this.getFonts = getFonts;
        this.getPalettes = getPalettes;
        this.getCanvasMode = getCanvasMode;
    }

    async connect(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        console.log(`🔗 Connecting to Gemini Live API for session: ${this.sessionId}`);

        const ai = new GoogleGenAI({ apiKey });

        try {
            this.liveSession = await ai.live.connect({
                model: MODELS.ARCHITECT_LIVE,
                callbacks: {
                    onopen: () => {
                        console.log(`✅ Gemini Live connected for session: ${this.sessionId}`);
                        this.isConnected = true;

                        // Send initial greeting to kickstart the conversation
                        setTimeout(() => {
                            this.sendInitialGreeting();
                        }, 1000);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        await this.handleGeminiMessage(msg);
                    },
                    onclose: (event: any) => {
                        console.log(`🔌 Gemini Live closed for session: ${this.sessionId}`, event);
                        this.isConnected = false;
                    },
                    onerror: (error: any) => {
                        console.error(`❌ Gemini Live error for session: ${this.sessionId}`, error);
                        this.sendToClient({
                            type: 'ERROR',
                            message: 'Gemini connection error',
                            code: 'GEMINI_ERROR'
                        });
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    tools: tools,
                    systemInstruction: SYSTEM_INSTRUCTIONS.ARCHITECT,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                }
            });

        } catch (error) {
            console.error('Failed to connect to Gemini Live:', error);
            throw error;
        }
    }

    private sendInitialGreeting(): void {
        if (!this.liveSession || !this.isConnected) {
            return;
        }

        try {
            console.log('📢 Sending initial greeting prompt...');
            // Use sendClientContent for initial context
            this.liveSession.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text: "Hello! I'm here to create my brand identity." }]
                }],
                turnComplete: true
            });
        } catch (error) {
            console.error('Error sending initial greeting:', error);
        }
    }

    disconnect(): void {
        if (this.liveSession) {
            try {
                this.liveSession.close();
            } catch (e) {
                // Ignore close errors
            }
            this.liveSession = null;
        }
        this.isConnected = false;
    }

    private audioChunkCount = 0;
    private lastAudioLogTime = 0;
    private accumulatedUserInput = ''; // Accumulate user input for tool decision

    async sendAudio(base64Audio: string): Promise<void> {
        if (!this.liveSession || !this.isConnected) {
            if (this.audioChunkCount > 0) {
                console.log(`⚠️ Dropping audio - Gemini not connected (sent ${this.audioChunkCount} chunks before disconnect)`);
                this.audioChunkCount = 0;
            }
            return;
        }

        try {
            this.liveSession.sendRealtimeInput({
                media: {
                    mimeType: `audio/pcm;rate=${AUDIO_CONFIG.INPUT_SAMPLE_RATE}`,
                    data: base64Audio
                }
            });

            this.audioChunkCount++;
            const now = Date.now();
            // Log every 5 seconds to show audio is still flowing
            if (now - this.lastAudioLogTime > 5000) {
                console.log(`🎙️ Audio flowing: ${this.audioChunkCount} chunks sent to Gemini`);
                this.lastAudioLogTime = now;
            }
        } catch (error) {
            console.error('❌ Error sending audio to Gemini:', error);
            this.isConnected = false;
        }
    }

    async sendText(text: string): Promise<void> {
        if (!this.liveSession || !this.isConnected) {
            return;
        }

        try {
            // Use sendClientContent to inject user text
            this.liveSession.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text }]
                }],
                turnComplete: true
            });
        } catch (error) {
            console.error('Error sending text to Gemini:', error);
        }
    }

    private async handleGeminiMessage(msg: LiveServerMessage): Promise<void> {
        const { serverContent, toolCall, setupComplete } = msg as any;

        // Log all incoming messages for debugging
        if (setupComplete) {
            console.log(`🎯 Gemini setup complete for session: ${this.sessionId}`);
            return;
        }

        // Handle tool calls
        if (toolCall) {
            console.log(`🛠️ Tool call received: ${JSON.stringify(toolCall.functionCalls.map((f: any) => ({ name: f.name, args: f.args })))}`);

            const functionResponses = await this.toolHandler.handleToolCalls(toolCall.functionCalls);

            // Send tool responses back to Gemini
            try {
                const responsePayload = { functionResponses };
                console.log('📤 Sending tool response:', JSON.stringify(responsePayload, null, 2));
                await this.liveSession.sendToolResponse(responsePayload);
                console.log('✅ Tool response sent');
            } catch (error) {
                console.error('Error sending tool response:', error);
            }

            return;
        }

        // Handle audio output
        const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            // Log first time only to avoid spam
            this.sendToClient({
                type: 'AUDIO_CHUNK',
                data: audioData
            });
        }

        // Handle text parts from model
        const textPart = serverContent?.modelTurn?.parts?.find((p: any) => p.text);
        if (textPart) {
            console.log(`💬 Model text: ${textPart.text.substring(0, 100)}...`);
        }

        // Handle transcription
        const outputTranscription = serverContent?.outputTranscription?.text;
        const inputTranscription = serverContent?.inputTranscription?.text;

        if (outputTranscription) {
            console.log(`🤖 AI says: ${outputTranscription}`);
            this.sendToClient({
                type: 'TRANSCRIPTION',
                role: 'model',
                text: outputTranscription,
                isPartial: false
            });
            // Track model responses for context
            this.toolDecisionAgent.addModelResponse(outputTranscription);
        }

        if (inputTranscription) {
            console.log(`🎤 User says: ${inputTranscription}`);
            this.sendToClient({
                type: 'TRANSCRIPTION',
                role: 'user',
                text: inputTranscription,
                isPartial: false
            });
            // Accumulate user input for tool decision
            this.accumulatedUserInput += inputTranscription + ' ';
        }

        // Log turn complete and process accumulated user input for tool decisions
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);

            // Process accumulated user input through ToolDecisionAgent
            if (this.accumulatedUserInput.trim()) {
                this.processUserInputForTools(this.accumulatedUserInput.trim());
                this.accumulatedUserInput = ''; // Reset accumulator
            }
        }

        // Log interruption
        if (serverContent?.interrupted) {
            console.log(`⚠️ Turn interrupted for session: ${this.sessionId}`);
            this.accumulatedUserInput = ''; // Reset on interruption
        }
    }

    /**
     * Process user input through ToolDecisionAgent for reliable tool calling
     */
    private async processUserInputForTools(userInput: string): Promise<void> {
        try {
            const dna = this.getDNA() as BrandDNA;
            const fonts = this.getFonts();
            const palettes = this.getPalettes();
            const canvasMode = this.getCanvasMode();

            console.log(`🧠 Processing user input for tools: "${userInput.substring(0, 50)}..."`);

            const toolCalls = await this.toolDecisionAgent.analyzeAndDecideTools(
                userInput,
                dna,
                canvasMode,
                fonts,
                palettes
            );

            // Execute any tool calls the agent decided on
            if (toolCalls.length > 0) {
                console.log(`🔧 ToolDecisionAgent executing ${toolCalls.length} tool(s)`);
                await this.toolHandler.handleToolCalls(toolCalls as any);

                // FEEDBACK LOOP: Tell the Live API what just happened
                // This fixes the "correlation loss" by grounding the conversation model
                // Create a clear summary of what happened for the Live API
                const toolSummary = toolCalls.map(tc => {
                    // Format args responsibly (avoid massive dumps, focus on names/values)
                    const argsString = JSON.stringify(tc.args).substring(0, 500); // Audit limit
                    return `${tc.name} with details: ${argsString}`;
                }).join('; ');

                const feedbackMsg = `[SYSTEM UPDATE: Tool(s) executed: ${toolSummary}. The results are now visible on the canvas. PLEASE ANNOUNCE THIS TO THE USER NOW by describing what was shown/updated.]`;

                console.log(`🔄 Sending feedback to Live API: ${feedbackMsg}`);

                // We send this as a user message to inject it into the context
                // We DON'T force a turn complete so it doesn't interrupt, but it's there for the next turn
                if (this.liveSession && this.isConnected) {
                    this.liveSession.sendClientContent({
                        turns: [{
                            role: 'user',
                            parts: [{ text: feedbackMsg }]
                        }],
                        turnComplete: true // Force the AI to speak the confirmation now
                    });
                }
            } else {
                // Pulse Check: No tools executed
                // If the Live AI promised an action ("I'm checking..."), it needs a signal to unblock.
                // If it was just chatting ("Hello"), it should ignore this.
                const pulseMsg = `[SYSTEM UPDATE: Tool Decision Agent analyzed the request and determined NO TOOLS were needed (0 tools executed). 
INSTRUCTION: If you had promised an action (e.g. "Updating...", "Checking..."), please apologize and explain why you can't do it (e.g. "I need more information").
INSTRUCTION: If you were just chatting or asking a question, IGNORE this message and wait for user input.]`;

                console.log(`💓 Sending Pulse Check: ${pulseMsg}`);

                if (this.liveSession && this.isConnected) {
                    this.liveSession.sendClientContent({
                        turns: [{
                            role: 'user',
                            parts: [{ text: pulseMsg }]
                        }],
                        turnComplete: true // Force a turn to wake up the AI if it was hanging
                    });
                }
            }
        } catch (error) {
            console.error('Error in processUserInputForTools:', error);
        }
    }
}
