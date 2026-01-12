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
    private isProcessingTools: boolean = false; // Flag to pause audio during processing
    private isProcessingToolDecision: boolean = false; // Mutex to prevent overlapping tool decisions
    private isGreetingPhase: boolean = true; // Prevent tool decisions during AI greeting
    private readonly MIN_INPUT_LENGTH = 5; // Minimum chars to consider as real input

    // Confirmation-based Brain trigger (Option C)
    private awaitingConfirmation: boolean = false; // True when AI asked a confirmation question
    private lastAIMessage: string = ''; // Track AI's last message for context
    private accumulatedAIOutput: string = ''; // Accumulate AI output to check confirmation on full message

    // Queue for sequential tool processing (prevents race conditions)
    private inputQueue: string[] = [];
    private isProcessingQueue: boolean = false;

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
    private accumulatedUserInput = ''; // Accumulate user input for tool decision

    async sendAudio(base64Audio: string): Promise<void> {
        if (!this.liveSession || !this.isConnected) {
            if (this.audioChunkCount > 0) {
                console.log(`⚠️ Dropping audio - Gemini not connected (sent ${this.audioChunkCount} chunks before disconnect)`);
                this.audioChunkCount = 0;
            }
            return;
        }

        // PAUSE AUDIO: If we are currently processing tools, drop audio input
        // This prevents the user's "umm" or background noise from triggering new requests while we're thinking
        if (this.isProcessingTools) {
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

            // Reset confirmation state - Gemini is handling this directly
            // This prevents the Brain from triggering redundantly
            if (this.awaitingConfirmation) {
                console.log(`🔄 Gemini handling confirmation directly - resetting awaitingConfirmation`);
                this.awaitingConfirmation = false;
                this.accumulatedUserInput = ''; // Clear any pending user input
            }

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
            // Note: We no longer trigger tools here - using debounced trigger on turnComplete instead
        }

        // Handle text parts from model
        const textPart = serverContent?.modelTurn?.parts?.find((p: any) => p.text);
        if (textPart) {
            console.log(`💬 Model text: ${textPart.text.substring(0, 100)}...`);
            // Note: We no longer trigger tools here - using debounced trigger on turnComplete instead
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

            // Accumulate AI output to check confirmation on full message (not per-chunk)
            this.accumulatedAIOutput += outputTranscription;

            // After AI's first response, greeting phase is over
            if (this.isGreetingPhase) {
                this.isGreetingPhase = false;
                console.log(`✅ Greeting phase complete - tool decisions now enabled`);
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
            // Accumulate user input for tool decision
            this.accumulatedUserInput += inputTranscription + ' ';
        }

        // Log turn complete - Handle both AI turns and User turns
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);

            const hasUserInput = this.accumulatedUserInput.trim().length >= this.MIN_INPUT_LENGTH;
            const hasAIOutput = this.accumulatedAIOutput.trim().length > 0;

            if (this.isGreetingPhase) {
                console.log(`⏸️ Skipping - greeting phase`);
                this.accumulatedUserInput = '';
                this.accumulatedAIOutput = '';
            } else {
                // STEP 1: ALWAYS check AI output for confirmation patterns FIRST
                let aiAskedConfirmation = false;
                if (hasAIOutput) {
                    const fullAIMessage = this.accumulatedAIOutput;
                    this.lastAIMessage = fullAIMessage;

                    const confirmationPatterns = [
                        /would you like/i,
                        /want me to/i,
                        /shall i/i,
                        /should i/i,
                        /do you want/i,
                        /can i show/i,
                        /ready to see/i,
                        /let me show/i,
                        /display.*\?/i,
                        /show.*\?/i,
                        /save.*\?/i,
                        /proceed.*\?/i,
                        /is that (right|correct)/i,
                        /confirm\??$/i,
                        /should i save/i,
                        /is that what you/i,
                        /does that sound/i
                    ];

                    if (confirmationPatterns.some(pattern => pattern.test(fullAIMessage))) {
                        aiAskedConfirmation = true;
                        this.awaitingConfirmation = true;
                        console.log(`❓ AI asked confirmation: "${fullAIMessage.substring(0, 50)}..." - awaiting user response`);
                    }
                }
                this.accumulatedAIOutput = ''; // Reset AI output

                // STEP 2: Handle user input based on confirmation state
                if (aiAskedConfirmation) {
                    // AI just asked a confirmation question
                    // Any user input in this turn was BEFORE the question - discard it
                    if (hasUserInput) {
                        console.log(`📝 Discarding pre-confirmation input: "${this.accumulatedUserInput.trim().substring(0, 30)}..."`);
                    }
                    this.accumulatedUserInput = '';
                    console.log(`⏸️ AI asked confirmation - waiting for user's response`);
                } else if (!hasUserInput) {
                    // No user input and no confirmation - just AI speaking
                    console.log(`⏸️ AI turn ending - waiting for user response`);
                } else {
                    // User spoke and AI did NOT ask confirmation
                    const userInput = this.accumulatedUserInput.trim();
                    this.accumulatedUserInput = '';

                    // Trigger Brain if:
                    // 1. AI was awaiting confirmation (from PREVIOUS turn)
                    // 2. User's input appears to be a direct action request
                    const shouldTriggerBrain = this.shouldAnalyzeInput(userInput);

                    if (shouldTriggerBrain) {
                        console.log(`🧠 Brain triggered - ${this.awaitingConfirmation ? 'confirmation response' : 'action request'}`);
                        this.awaitingConfirmation = false; // Reset after processing
                        this.queueToolDecision(userInput);
                    } else {
                        console.log(`💬 Conversational input - letting AI respond naturally`);
                        this.awaitingConfirmation = false;
                        // No Brain, AI will continue naturally
                    }
                }
            }
        }

        // Log interruption and notify client to stop playback
        if (serverContent?.interrupted) {
            console.log(`⚠️ Turn interrupted for session: ${this.sessionId}`);
            this.accumulatedUserInput = '';
            this.accumulatedAIOutput = ''; // Reset AI output too
            this.inputQueue = []; // Clear queue on interruption
            this.awaitingConfirmation = false; // Reset confirmation state on interrupt
            this.sendToClient({ type: 'INTERRUPT' });
        }
    }

    /**
     * Determine if user input should trigger Brain analysis.
     * Uses semantic intent detection, not simple keyword matching.
     * 
     * Returns true if:
     * 1. AI is awaiting confirmation (asked a confirmation question)
     * 2. User input appears to be a direct action request
     */
    private shouldAnalyzeInput(userInput: string): boolean {
        const input = userInput.toLowerCase();

        // Case 1: AI asked a confirmation question - any response should be analyzed
        if (this.awaitingConfirmation) {
            console.log(`✅ Awaiting confirmation - analyzing response`);
            return true;
        }

        // Case 2: Check if input appears to be a direct action request
        // These patterns capture intent semantically, not exact keywords
        const actionPatterns = [
            // Explicit action requests
            /\b(show|display|give|generate|create|make)\b.*\b(font|color|palette|logo|option|design)/i,
            /\b(font|color|palette|logo|option)\b.*\b(please|now|for me)/i,

            // Logo-specific patterns (must be combined with action words)
            /\b(logo|logos|brandmark|icon)\s*(design|style|inspiration|option)/i,
            /\b(minimalist|modern|classic|bold|playful)\b.*\b(logo|design|style)/i,
            /\b(shoe|tech|fashion|startup|business)\b.*\blog\b/i,
            /\b(search|find|look\s*for)\b.*\b(logo|inspiration)/i,

            // Save/update actions  
            /\b(save|store|update|set|use|apply|keep)\b.*\b(brand|dna|this|that|these|it)/i,
            /\b(that|this|these)\b.*\b(one|look|works|perfect|great)/i,

            // Quantity requests
            /\b(more|another|different|new|other)\b.*\b(font|color|option|palette|logo)/i,
            /\b\d+\b.*\b(font|color|option|palette|logo)/i,

            // Direct commands
            /^(show|display|give|generate|save|update|create)\b/i,

            // Simple affirmations (respond to AI's questions)
            /^(yes|yeah|yep|sure|ok|okay|please|go\s*ahead|do\s*it)\b/i,
            /\b(sounds?\s*good|let'?s?\s*(do|go)|perfect|exactly|that'?s?\s*(fine|good|great))\b/i
        ];

        const isActionRequest = actionPatterns.some(pattern => pattern.test(input));

        if (isActionRequest) {
            console.log(`🎯 Direct action request detected in input`);
            return true;
        }

        // Default: conversational input, no Brain needed
        console.log(`💭 Conversational input - no Brain trigger`);
        return false;
    }

    /**
     * Queue an input for tool decision processing.
     * Inputs are processed sequentially to prevent race conditions.
     */
    private queueToolDecision(input: string): void {
        console.log(`📥 Queuing input: "${input.substring(0, 40)}..."`);
        this.inputQueue.push(input);

        // Start processing if not already running
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    /**
     * Process queued inputs sequentially.
     * Only one tool decision runs at a time.
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return; // Already processing
        this.isProcessingQueue = true;

        while (this.inputQueue.length > 0) {
            const input = this.inputQueue.shift()!;
            console.log(`🚀 Processing from queue: "${input.substring(0, 40)}..."`);
            await this.processUserInputForTools(input);
        }

        this.isProcessingQueue = false;
        console.log(`✅ Queue empty - ready for next input`);
    }

    /**
     * Process user input through ToolDecisionAgent for reliable tool calling
     */
    private async processUserInputForTools(userInput: string): Promise<void> {
        const startTime = Date.now();
        const collectedThoughts: string[] = [];
        let toolDecided: string | null = null;

        try {
            const dna = this.getDNA() as BrandDNA;
            const fonts = this.getFonts();
            const palettes = this.getPalettes();
            const canvasMode = this.getCanvasMode();

            console.log(`🧠 Processing user input for tools: "${userInput.substring(0, 50)}..."`);

            // START PROCESSING: Prevent overlapping calls
            this.isProcessingToolDecision = true;
            this.isProcessingTools = true;

            // 🛑 HOLD - Tell the Live API to wait while Brain thinks
            // This prevents the AI from speaking before we know what action to take
            if (this.liveSession && this.isConnected) {
                this.liveSession.sendClientContent({
                    turns: [{
                        role: 'user',
                        parts: [{ text: '[SYSTEM: THINKING IN PROGRESS - Do NOT speak yet. Wait for the Brain to finish analyzing and provide results. Stay silent until you receive the next SYSTEM UPDATE.]' }]
                    }],
                    turnComplete: false // Don't trigger response yet
                });
            }

            // 🧠 THINKING_START - Tell client we're thinking
            this.sendToClient({
                type: 'THINKING_START',
                timestamp: startTime
            });

            const toolCalls = await this.toolDecisionAgent.analyzeAndDecideTools(
                userInput,
                dna,
                canvasMode,
                fonts,
                palettes,
                // Streaming thought callback - now sends to client!
                (thought) => {
                    console.log(`💭 Brain thinking: ${thought}`);
                    collectedThoughts.push(thought);

                    // Determine phase based on thought content
                    let phase: 'classify' | 'analyze' | 'decide' | 'execute' = 'analyze';
                    if (thought.toLowerCase().includes('classif') || thought.toLowerCase().includes('intent')) {
                        phase = 'classify';
                    } else if (thought.toLowerCase().includes('tool') || thought.toLowerCase().includes('call')) {
                        phase = 'decide';
                    } else if (thought.toLowerCase().includes('execut')) {
                        phase = 'execute';
                    }

                    // 🧠 THINKING_STREAM - Real-time thought to client
                    this.sendToClient({
                        type: 'THINKING_STREAM',
                        thought: thought,
                        phase: phase
                    });
                }
            );

            // Execute any tool calls the agent decided on
            if (toolCalls.length > 0) {
                toolDecided = toolCalls[0]?.name || null;
                console.log(`🔧 ToolDecisionAgent executing ${toolCalls.length} tool(s)`);
                await this.toolHandler.handleToolCalls(toolCalls as any);

                // FEEDBACK LOOP: Tell the Live API what just happened
                const toolSummary = toolCalls.map(tc => {
                    const argsString = JSON.stringify(tc.args).substring(0, 500);
                    return `${tc.name} with details: ${argsString}`;
                }).join('; ');

                const feedbackMsg = `[SYSTEM UPDATE: Tool(s) executed: ${toolSummary}. The results are now visible on the canvas. PLEASE ANNOUNCE THIS TO THE USER NOW by describing what was shown/updated.]`;

                console.log(`🔄 Sending feedback to Live API: ${feedbackMsg}`);

                if (this.liveSession && this.isConnected) {
                    this.liveSession.sendClientContent({
                        turns: [{
                            role: 'user',
                            parts: [{ text: feedbackMsg }]
                        }],
                        turnComplete: true // NOW trigger AI to speak about results
                    });
                }
            } else {
                // No tools needed - release the AI to continue conversation naturally
                console.log(`💬 No tools needed - releasing AI to continue conversation`);
                if (this.liveSession && this.isConnected) {
                    this.liveSession.sendClientContent({
                        turns: [{
                            role: 'user',
                            parts: [{ text: '[SYSTEM RELEASE: Brain analysis complete. No visual actions needed. You may now respond naturally to the user.]' }]
                        }],
                        turnComplete: true // Trigger AI to speak
                    });
                }
            }
        } catch (error) {
            console.error('Error in processUserInputForTools:', error);
        } finally {
            // 🧠 THINKING_END - Tell client we're done thinking
            const duration = Date.now() - startTime;
            this.sendToClient({
                type: 'THINKING_END',
                duration: duration,
                toolDecided: toolDecided,
                thoughtSummary: collectedThoughts
            });

            // END PROCESSING: Release mutex
            this.isProcessingToolDecision = false;
            this.isProcessingTools = false;
        }
    }
}
