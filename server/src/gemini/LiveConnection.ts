import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { BrainConnection } from './BrainConnection';
import { MODELS, SYSTEM_INSTRUCTIONS, AUDIO_CONFIG } from '../../../shared/constants';
import {
    ServerMessage
} from '../../../shared/messages';
import { FontSuggestion, ColorPalette } from '../../../shared/types';
import { ToolHandler } from './ToolHandler';
// Bridge Architecture: Tool declarations have been MOVED to BrainConnection.ts
// Gemini Live is now VOICE-ONLY - no tools, no hallucinations
// The Brain (Gemini 3 Pro) handles all tool calls reliably
import { DatabaseService } from '../services/DatabaseService';

/**
 * Gemini Live Connection Handler.
 * 
 * Manages the WebSocket connection to Gemini Live (Audio/Voice).
 * Acts as the "Voice" in the Bridge architecture, while delegating tool logic to BrainConnection.
 */
export class GeminiLiveConnection {
    private sessionId: string;
    private liveSession: any = null;
    private isConnected: boolean = false;
    private sendToClient: (message: ServerMessage) => void;
    private updateState: (field: string, value: any) => void;
    private toolHandler: ToolHandler;
    public getToolHandler(): ToolHandler { return this.toolHandler; }
    private isGreetingPhase: boolean = true;
    private abortConnection: boolean = false;


    // Bridge Architecture: Brain connection for reliable tool calls
    private brain: BrainConnection | null = null;
    private audioBuffer: string[] = [];
    private transcriptBuffer: { user: string; ai: string } = { user: '', ai: '' };
    private lastBufferFlush: number = 0;
    private readonly BUFFER_WINDOW_MS = 3000; // Send to Brain every 3 seconds

    // Pause state: stops audio processing during research
    private isPaused: boolean = false;

    /** Pause audio processing (during research/tool execution) */
    public pause(): void {
        this.isPaused = true;
        console.log('⏸️ Gemini Live PAUSED (research in progress)');
    }

    /** Resume audio processing (after research completes) */
    public resume(): void {
        this.isPaused = false;
        console.log('▶️ Gemini Live RESUMED');
    }

    /** Check if currently paused */
    public isPausedState(): boolean {
        return this.isPaused;
    }

    /** Set the current phase and update Live's context accordingly */
    public async setPhase(phase: 'discovery' | 'execution' | 'modification'): Promise<void> {
        // ALWAYS update Brain phase to keep them in sync
        if (this.brain) {
            await this.brain.setPhase(phase);
        }

        if (phase === 'modification' && this.liveSession && this.isConnected) {
            console.log('🔄 Switching Live to MODIFICATION phase context');

            try {
                // Send as a system message that triggers a response
                this.liveSession.sendClientContent({
                    turns: [
                        {
                            role: 'user',
                            parts: [{
                                text: `[SYSTEM OVERRIDE - CRITICAL PHASE CHANGE]
                                
Your role has COMPLETELY CHANGED. You are NO LONGER doing brand discovery.
The research is COMPLETE. The canvas is now visible.
You are now THE MODIFIER.

NEW BEHAVIOR - YOU MUST FOLLOW THIS EXACTLY:
1. When user requests ANY change, ask: "Would you like me to [action]?"
2. WAIT for user to say "yes" / "sure" / "do it"
3. ONLY after confirmation, say "Updating now..."
4. NEVER say "updating" before user confirms

WRONG (DO NOT DO): "Let's update the brand name to Nike now."
RIGHT (ALWAYS DO): "Would you like me to update your brand name to Nike?"

Acknowledge this change by greeting the user and asking how you can help refine their brand.`
                            }]
                        }
                    ],
                    turnComplete: true  // Trigger a response
                });
                console.log('✅ Live context updated for modification phase');
            } catch (error) {
                console.error('❌ Failed to update Live phase context:', error);
            }
        }
    }


    // Hybrid approach: ToolDecisionAgent for reliable tool execution
    private getDNA: () => any;
    private getFonts: () => Array<{ name: string; category: string }>;
    private getPalettes: () => Array<{ name: string; colors: string[]; vibe: string }>;
    private getCanvasMode: () => 'none' | 'fonts' | 'colors';

    /**
     * Initializes the Gemini Live Connection.
     * 
     * @param {string} sessionId - The session identifier.
     * @param {(message: ServerMessage) => void} sendToClient - Callback to send messages to the client.
     * @param {(field: string, value: any) => void} updateState - Callback to update application state.
     * @param {(palettes: any[]) => void} [storePalettes] - Callback to store color palettes.
     * @param {(fonts: any[]) => void} [storeFonts] - Callback to store fonts.
     * @param {(mode: 'none' | 'fonts' | 'colors') => void} [setCanvasMode] - Callback to set canvas mode.
     * @param {() => any} [getDNA] - Callback to get Brand DNA.
     * @param {() => FontSuggestion[]} [getFonts] - Callback to get fonts.
     * @param {() => ColorPalette[]} [getPalettes] - Callback to get palettes.
     * @param {() => 'none' | 'fonts' | 'colors'} [getCanvasMode] - Callback to get canvas mode.
     * @param {(updates: Record<string, any>) => void} [updateStateBatch] - Callback for batch state updates.
     * @param {string} [workspaceId='default'] - Workspace identifier.
     */
    constructor(
        sessionId: string,
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void,
        storePalettes: (palettes: any[]) => void = () => { },
        storeFonts: (fonts: any[]) => void = () => { },
        setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void = () => { },
        getDNA: () => any = () => ({}),
        getFonts: () => FontSuggestion[],
        getPalettes: () => ColorPalette[],
        getCanvasMode: () => 'none' | 'fonts' | 'colors',
        updateStateBatch: (updates: Record<string, any>) => void = () => { },
        private workspaceId: string = 'default'
    ) {
        this.sessionId = sessionId;
        this.sendToClient = sendToClient;
        this.updateState = updateState;

        // Initialize ToolHandler with batch update support and voice control
        this.toolHandler = new ToolHandler(
            sendToClient,
            updateState,
            storePalettes,
            storeFonts,
            setCanvasMode,
            getDNA,
            updateStateBatch,
            () => this.pause(),  // onPauseVoice - pause audio during research
            () => this.resume(), // onResumeVoice - resume after research
            // ON PHASE CHANGE: Trigger Brain Switch AND update Live context
            (phase) => {
                if (this.brain) {
                    this.brain.setPhase(phase);
                }
                // Also update Live's context for modification phase
                this.setPhase(phase);
            },
            workspaceId
        );
        // Store references for ToolDecisionAgent
        this.getDNA = getDNA;
        this.getFonts = getFonts;
        this.getPalettes = getPalettes;
        this.getCanvasMode = getCanvasMode;



        // Bridge Architecture: Initialize Brain (Gemini 3 Pro) for reliable tool calls
        this.brain = new BrainConnection(
            sessionId,
            sendToClient,
            this.toolHandler,
            () => this.interruptLive(),
            getDNA,
            workspaceId
        );
        console.log(`🧠 Bridge Architecture: Brain initialized for session ${sessionId}`);

        // --- CRITICAL SAFEGUARD: NEW 3-STATE LOGIC ---
        // If Brain detected a missing workspace folder, abort immediately.
        if ((this.brain as any).phase === 'missing_workspace') { // Accessing private prop via any for check
            console.error(`⛔ [LiveConnection] Aborting connection for invalid workspace: ${workspaceId}`);
            this.sendToClient({
                type: 'ERROR',
                message: 'Workspace not found. Redirecting...',
                redirect: true
            } as any);
            this.abortConnection = true;
            return; // Stop initialization
        }
    }

    /**
     * Establishes the connection to Gemini Live API.
     * Sets up event listeners for open, message, close, and error.
     */
    async connect(): Promise<void> {
        if (this.abortConnection) {
            console.warn(`🚧 [LiveConnection] Connection aborted for invalid workspace: ${this.workspaceId}`);
            return;
        }

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
                    // NO TOOLS - Bridge Architecture: Voice only for Gemini Live
                    // Tools are handled by BrainConnection (Gemini 3 Pro)
                    systemInstruction: SYSTEM_INSTRUCTIONS.ARCHITECT_AUDIO_ONLY,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    // VAD: Disable automatic activity detection - client controls when speech ends
                    realtimeInputConfig: {
                        automaticActivityDetection: {
                            disabled: true
                        }
                    }
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
                turns: [{ role: 'user', parts: [{ text: "" }] }],
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

    /**
     * Sends audio data to Gemini Live.
     * Also flushes audio to the Brain buffer for analysis.
     * 
     * @param {string} base64Audio - Base64 encoded audio data (PCM).
     */
    async sendAudio(base64Audio: string): Promise<void> {
        // Drop audio if paused (during research)
        if (this.isPaused) {
            return;
        }

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

            // Bridge: Flush buffer to Brain every BUFFER_WINDOW_MS
            if (now - this.lastBufferFlush > this.BUFFER_WINDOW_MS) {
                await this.flushBufferToBrain();
            }
        } catch (error) {
            console.error('❌ Error sending audio to Gemini:', error);
            this.isConnected = false;
        }
    }

    /**
     * Bridge: Send accumulated conversation to Brain for tool decisions
     */
    private async flushBufferToBrain(): Promise<void> {
        if (!this.brain) return;

        // Only analyze if we have accumulated content
        if (!this.transcriptBuffer.user && !this.transcriptBuffer.ai) {
            this.lastBufferFlush = Date.now();
            return;
        }

        const userTranscript = this.transcriptBuffer.user;
        const aiTranscript = this.transcriptBuffer.ai;

        // Reset buffers
        this.transcriptBuffer = { user: '', ai: '' };
        this.lastBufferFlush = Date.now();

        // Send to Brain for analysis
        await this.brain.analyzeConversation(userTranscript, aiTranscript);
    }

    /**
     * Bridge: Interrupt Live session when Brain issues a tool call
     */
    public interruptLive(): void {
        if (!this.liveSession || !this.isConnected) return;

        try {
            // Send interrupt signal to stop Live audio output
            this.liveSession.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: '[SYSTEM: Canvas updating...]' }] }],
                turnComplete: true
            });
            console.log('🛑 Live session interrupted by Brain tool call');
        } catch (error) {
            console.error('Error interrupting Live session:', error);
        }
    }

    // VAD: Track if we've signaled activity start
    private activityStarted: boolean = false;

    /**
     * VAD: Signal that user has started speaking
     */
    public signalActivityStart(): void {
        if (!this.liveSession || !this.isConnected) {
            console.warn('⚠️ Cannot signal activity start - not connected');
            return;
        }

        if (this.activityStarted) {
            return; // Already signaled
        }

        try {
            this.liveSession.sendRealtimeInput({
                activityStart: {}
            });
            this.activityStarted = true;
            console.log('🎙️ Activity start signaled - Gemini knows user is speaking');
        } catch (error) {
            console.error('Error signaling activity start:', error);
        }
    }

    /**
     * VAD: Signal that user has finished speaking
     * This triggers Gemini to process the buffered audio and respond
     */
    public signalActivityEnd(): void {
        if (!this.liveSession || !this.isConnected) {
            console.warn('⚠️ Cannot signal activity end - not connected');
            return;
        }

        if (!this.activityStarted) {
            console.warn('⚠️ Cannot signal activity end - activity not started');
            return;
        }

        try {
            // Send activityEnd to trigger processing
            this.liveSession.sendRealtimeInput({
                activityEnd: {}
            });
            this.activityStarted = false; // Reset for next utterance
            console.log('🎤 Activity end signaled - Gemini will now process audio');

            // Also flush to Brain for tool analysis
            this.flushBufferToBrain();
        } catch (error) {
            console.error('Error signaling activity end:', error);
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

    /**
     * Sends a file to Gemini Live for multimodal analysis.
     * 
     * @param {string} base64Data - Base64 encoded file data.
     * @param {string} mimeType - Mime type of the file.
     */
    async sendFile(base64Data: string, mimeType: string): Promise<void> {
        if (!this.liveSession || !this.isConnected) {
            console.warn('⚠️ Cannot send file - Gemini not connected');
            return;
        }

        console.log(`📤 Sending file to Gemini (${mimeType}, ${base64Data.length} bytes)...`);

        try {
            // Send media via RealtimeInput
            await this.liveSession.sendRealtimeInput({
                media: {
                    mimeType,
                    data: base64Data
                }
            });

            // Send a follow-up text prompt to ensure the model attends to it
            // This is crucial for "wake up" effect on static content
            await this.liveSession.sendClientContent({
                turns: [{
                    role: 'user',
                    parts: [{ text: "I've just uploaded a file. Please analyze it and validly extract the FULL brand identity (Name, Mission, Colors, Fonts, Voice) immediately using the 'extract_brand_identity' tool. Do not ask me for permission, just do it." }]
                }],
                turnComplete: true
            });

            console.log('✅ File sent successfully');
        } catch (error) {
            console.error('❌ Error sending file to Gemini:', error);
        }
    }

    private async handleGeminiMessage(msg: LiveServerMessage): Promise<void> {
        const { serverContent, toolCall, setupComplete } = msg as any;

        // Log all incoming messages for debugging
        if (setupComplete) {
            console.log(`🎯 Gemini setup complete for session: ${this.sessionId}`);
            return;
        }

        if (toolCall) {
            // Handle tool calls - mark that a tool was actually called
            console.log(`🛠️ Tool call received: ${JSON.stringify(toolCall.functionCalls.map((f: any) => ({ name: f.name, args: f.args })))}`);

            const functionResponses = await this.toolHandler.handleToolCalls(toolCall.functionCalls);

            // Send tool responses back to Gemini
            try {
                const responsePayload = { functionResponses };
                console.log('📤 Sending tool response:', JSON.stringify(responsePayload, null, 2));
                await this.liveSession.sendToolResponse(responsePayload);
                console.log('✅ Tool response sent');

                // FORCE CONTINUATION: Send a system note to ensure the model speaks
                // Sometimes the model treats a tool response as "task done" and stays silent
                this.liveSession.sendClientContent({
                    turns: [{
                        role: 'user',
                        parts: [{ text: "[System: Action completed. Briefly confirm to user.]" }]
                    }],
                    turnComplete: true
                });
            } catch (error) {
                console.error('Error sending tool response:', error);
            }
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

            // Bridge: Also accumulate for Brain analysis
            this.transcriptBuffer.ai += outputTranscription + ' ';

            // Persistence: Save to session history
            DatabaseService.getInstance(this.workspaceId).saveHistory('model', outputTranscription).catch(e => console.error('Failed to save history:', e));

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

            // Bridge: Also accumulate for Brain analysis
            this.transcriptBuffer.user += inputTranscription + ' ';

            // Persistence: Save to session history
            DatabaseService.getInstance(this.workspaceId).saveHistory('user', inputTranscription).catch(e => console.error('Failed to save history:', e));
        }

        // TURN COMPLETE
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);
            // Pure Brain mode: No safeguards here. Logic is in flushBufferToBrain via BrainConnection.
        }

        // Log interruption and notify client to stop playback
        if (serverContent?.interrupted) {
            console.log(`⚠️ Turn interrupted for session: ${this.sessionId}`);
            // Reset tracking on interrupt
            this.sendToClient({ type: 'INTERRUPT' });
        }
    }
}
