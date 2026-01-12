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
        description: "Display color palette options on the canvas. Use this whenever discussing colors. IMPORTANT: All colors MUST be hex codes (e.g., #FF5733, #00A8E8).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                palettes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Palette name" },
                            colors: { type: Type.ARRAY, items: { type: Type.STRING, description: "Hex color code (e.g., #FF5733)" } },
                            vibe: { type: Type.STRING, description: "Mood or feeling of the palette" }
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
    },
    {
        name: "search_logo_inspiration",
        description: "Search for logo inspiration images based on brand context. Use when the user asks for logo ideas, inspiration, or wants to see logo examples.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "Search query for logo inspiration (e.g., 'modern minimalist shoe brand logo', 'athletic footwear logo design')"
                },
                style: {
                    type: Type.STRING,
                    description: "Logo style preference: minimalist, modern, vintage, playful, elegant, bold",
                    nullable: true
                },
                industry: {
                    type: Type.STRING,
                    description: "Industry context: footwear, athletic, fashion, streetwear",
                    nullable: true
                }
            },
            required: ["query"]
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
    private isGreetingPhase: boolean = true;

    // Safeguard: Track if tool was actually called this turn
    private toolCalledThisTurn: boolean = false;
    private accumulatedAIOutput: string = '';
    private accumulatedUserInput: string = '';

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
                    generationConfig: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: "Aoede"
                                }
                            }
                        }
                    },
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
            console.log('📢 Triggering AI to start conversation...');
            // Just send turnComplete to prompt the AI to speak first
            // The AI knows to introduce itself from the system instruction
            this.liveSession.sendClientContent({
                turns: [],  // No fake user content
                turnComplete: true  // Prompt AI to start naturally
            });
        } catch (error) {
            console.error('Error triggering initial greeting:', error);
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

        // Handle tool calls - mark that a tool was actually called
        if (toolCall) {
            console.log(`🛠️ Tool call received: ${JSON.stringify(toolCall.functionCalls.map((f: any) => ({ name: f.name, args: f.args })))}`);

            // Mark that a tool was called this turn
            this.toolCalledThisTurn = true;

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
            // Send audio to client
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

            // Accumulate AI output for safeguard checking
            this.accumulatedAIOutput += outputTranscription;

            // After AI's first response, greeting phase is over
            if (this.isGreetingPhase) {
                this.isGreetingPhase = false;
                console.log(`✅ Greeting phase complete`);
            }
        }

        if (inputTranscription) {
            console.log(`🎙️ User says: ${inputTranscription}`);
            this.sendToClient({
                type: 'TRANSCRIPTION',
                role: 'user',
                text: inputTranscription,
                isPartial: false
            });

            // Accumulate user input for context
            this.accumulatedUserInput += inputTranscription + ' ';
        }

        // SAFEGUARD: On turn complete, check if AI claimed to save but didn't call tool
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);

            // Check if AI said "saved/done" but no tool was called
            const aiClaimedAction = this.detectClaimedAction(this.accumulatedAIOutput);

            if (aiClaimedAction && !this.toolCalledThisTurn && !this.isGreetingPhase) {
                console.log(`⚠️ SAFEGUARD TRIGGERED: AI claimed "${aiClaimedAction}" but no tool was called!`);
                console.log(`📝 User context: "${this.accumulatedUserInput.trim().substring(0, 100)}..."`);

                // Send correction message to Gemini
                this.sendCorrectionToGemini(aiClaimedAction, this.accumulatedUserInput.trim());
            }

            // Reset tracking for next turn
            this.toolCalledThisTurn = false;
            this.accumulatedAIOutput = '';
            this.accumulatedUserInput = '';
        }

        // Log interruption and notify client to stop playback
        if (serverContent?.interrupted) {
            console.log(`⚠️ Turn interrupted for session: ${this.sessionId}`);
            // Reset tracking on interrupt
            this.toolCalledThisTurn = false;
            this.accumulatedAIOutput = '';
            this.accumulatedUserInput = '';
            this.sendToClient({ type: 'INTERRUPT' });
        }
    }

    /**
     * Detect if AI claimed to perform an action (saved, displayed, etc.)
     */
    private detectClaimedAction(aiOutput: string): string | null {
        const actionPatterns = [
            // Brand DNA saving patterns
            { pattern: /i('ve| have) saved/i, action: 'saved' },
            { pattern: /it('s| is) saved/i, action: 'saved' },
            { pattern: /saved (it|that|the)/i, action: 'saved' },
            { pattern: /i('ve| have) updated/i, action: 'updated' },
            { pattern: /mission.*saved/i, action: 'saved mission' },
            { pattern: /brand.*saved/i, action: 'saved brand' },
            { pattern: /name.*saved/i, action: 'saved name' },
            { pattern: /voice.*saved/i, action: 'saved voice' },

            // Color display patterns
            { pattern: /here are (some |the )?color/i, action: 'displayed colors' },
            { pattern: /i('ve| have) (displayed|shown|generated|pulled up|created) (some |the )?color/i, action: 'displayed colors' },
            { pattern: /showing (you )?(some |the )?color/i, action: 'displayed colors' },
            { pattern: /palette(s)? (are |is )?on (the |your )?canvas/i, action: 'displayed colors' },

            // Font display patterns
            { pattern: /here are (some |the )?font/i, action: 'displayed fonts' },
            { pattern: /i('ve| have) (displayed|shown|generated|pulled up|created) (some |the )?font/i, action: 'displayed fonts' },
            { pattern: /showing (you )?(some |the )?font/i, action: 'displayed fonts' },
            { pattern: /font(s)? (are |is )?on (the |your )?canvas/i, action: 'displayed fonts' },

            // Logo search patterns
            { pattern: /here are (some |the )?logo/i, action: 'searched logos' },
            { pattern: /i('ve| have) (found|searched|pulled up|displayed) (some |the )?logo/i, action: 'searched logos' },
            { pattern: /logo inspiration/i, action: 'searched logos' },
        ];

        for (const { pattern, action } of actionPatterns) {
            if (pattern.test(aiOutput)) {
                return action;
            }
        }

        return null;
    }

    /**
     * Send correction message to Gemini when it claims to have done something but didn't call a tool
     */
    private sendCorrectionToGemini(claimedAction: string, userContext: string): void {
        if (!this.liveSession || !this.isConnected) {
            return;
        }

        // Map claimed action to the correct tool
        let toolName = 'update_live_brand_dna'; // default for save actions
        if (claimedAction.includes('colors') || claimedAction.includes('palette')) {
            toolName = 'display_color_suggestions';
        } else if (claimedAction.includes('fonts')) {
            toolName = 'display_font_suggestions';
        } else if (claimedAction.includes('logos')) {
            toolName = 'search_logo_inspiration';
        }

        const correctionMessage = `[SYSTEM ERROR: You said "${claimedAction}" but NO TOOL WAS CALLED. You MUST call the ${toolName} tool now. User context: "${userContext.substring(0, 200)}"]`;

        console.log(`🔄 Sending correction to Gemini: Call ${toolName} - ${correctionMessage.substring(0, 80)}...`);

        try {
            this.liveSession.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text: correctionMessage }]
                }],
                turnComplete: true
            });
        } catch (error) {
            console.error('Error sending correction to Gemini:', error);
        }
    }
}
