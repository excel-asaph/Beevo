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

    constructor(
        sessionId: string,
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void
    ) {
        this.sessionId = sessionId;
        this.sendToClient = sendToClient;
        this.updateState = updateState;
        this.toolHandler = new ToolHandler(sendToClient, updateState);
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
        }

        if (inputTranscription) {
            console.log(`🎤 User says: ${inputTranscription}`);
            this.sendToClient({
                type: 'TRANSCRIPTION',
                role: 'user',
                text: inputTranscription,
                isPartial: false
            });
        }

        // Log turn complete
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);
        }

        // Log interruption
        if (serverContent?.interrupted) {
            console.log(`⚠️ Turn interrupted for session: ${this.sessionId}`);
        }
    }
}
