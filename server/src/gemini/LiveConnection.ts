import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { BrainConnection } from './BrainConnection';
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

// Bridge Architecture: Tool declarations have been MOVED to BrainConnection.ts
// Gemini Live is now VOICE-ONLY - no tools, no hallucinations
// The Brain (Gemini 3 Pro) handles all tool calls reliably

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

    // History tracking for context-aware safeguards
    private previousUserTurn: string = '';
    private previousAITurn: string = '';

    // Bridge Architecture: Brain connection for reliable tool calls
    private brain: BrainConnection | null = null;
    private audioBuffer: string[] = [];
    private transcriptBuffer: { user: string; ai: string } = { user: '', ai: '' };
    private lastBufferFlush: number = 0;
    private readonly BUFFER_WINDOW_MS = 3000; // Send to Brain every 3 seconds

    // Hybrid approach: ToolDecisionAgent for reliable tool execution
    private toolDecisionAgent: ToolDecisionAgent;
    private getDNA: () => any;
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

        // Store references for ToolDecisionAgent
        this.getDNA = getDNA;
        this.getFonts = getFonts;
        this.getPalettes = getPalettes;
        this.getCanvasMode = getCanvasMode;

        // Initialize ToolDecisionAgent for reliable fallback
        this.toolDecisionAgent = new ToolDecisionAgent();

        // Bridge Architecture: Initialize Brain (Gemini 3 Pro) for reliable tool calls
        this.brain = new BrainConnection(
            sessionId,
            sendToClient,
            this.toolHandler,
            () => this.interruptLive(),
            getDNA
        );
        console.log(`🧠 Bridge Architecture: Brain initialized for session ${sessionId}`);
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
                    // NO TOOLS - Bridge Architecture: Voice only for Gemini Live
                    // Tools are handled by BrainConnection (Gemini 3 Pro)
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
    private interruptLive(): void {
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

                // FORCE CONTINUATION: Send a system note to ensure the model speaks
                // Sometimes the model treats a tool response as "task done" and stays silent
                this.liveSession.sendClientContent({
                    turns: [{
                        role: 'user',
                        parts: [{ text: "[System: Tool execution complete. Please confirm to the user and continue.]" }]
                    }],
                    turnComplete: true
                });
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

            // Bridge: Also accumulate for Brain analysis
            this.transcriptBuffer.ai += outputTranscription + ' ';

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

            // Bridge: Also accumulate for Brain analysis
            this.transcriptBuffer.user += inputTranscription + ' ';
        }

        // TURN COMPLETE: Check if tool should have been called
        if (serverContent?.turnComplete) {
            console.log(`🔄 Turn complete for session: ${this.sessionId}`);

            // HYBRID SAFEGUARD: If AI claimed action but no tool was called, execute directly
            if (!this.toolCalledThisTurn && !this.isGreetingPhase && this.accumulatedAIOutput.length > 0) {
                const claimedAction = this.detectClaimedAction(this.accumulatedAIOutput);

                if (claimedAction) {
                    console.log(`⚠️ AI claimed "${claimedAction}" but no tool called. Executing safeguard...`);

                    // Pass both user context AND AI output so we can find palette names
                    this.executeSafeguard(claimedAction, this.accumulatedUserInput.trim(), this.accumulatedAIOutput);
                }
            }

            // Save history for context in next turn (useful for safeguards)
            if (this.accumulatedUserInput.trim()) this.previousUserTurn = this.accumulatedUserInput;
            if (this.accumulatedAIOutput.trim()) this.previousAITurn = this.accumulatedAIOutput;

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
     * Analyzes the SENTENCE containing the claim, not the whole output
     */
    private detectClaimedAction(aiOutput: string): string | null {
        const lowerOutput = aiOutput.toLowerCase();

        // Find the sentence containing "saved", "done", etc.
        const sentences = lowerOutput.split(/[.!?]+/);

        for (const sentence of sentences) {
            const isSaveClaim = sentence.includes('saved') || sentence.includes('done') ||
                sentence.includes('updated') || sentence.includes('recorded');

            if (isSaveClaim) {
                // Check what was saved IN THIS SENTENCE
                // Order matters - more specific first (voice before colors)
                if (sentence.includes('voice')) return 'save_voice';
                if (sentence.includes('mission')) return 'save_mission';
                if (sentence.includes('color') || sentence.includes('palette')) return 'save_colors';
                if (sentence.includes('font') || sentence.includes('typography')) return 'save_font';
                if (sentence.includes('name') || sentence.includes('brand name')) return 'save_name';

                // If we see "done" or "saved" but can't determine what, skip
                // Don't return save_unknown anymore - too many false positives
            }

            // Check for display claims in this sentence
            const isDisplayClaim = sentence.includes('here are') || sentence.includes('displayed') ||
                sentence.includes('showing');

            if (isDisplayClaim) {
                if (sentence.includes('color') || sentence.includes('palette')) return 'display_colors';
                if (sentence.includes('font')) return 'display_fonts';
                if (sentence.includes('logo')) return 'display_logos';
            }
        }

        return null;
    }

    /**
     * Execute tool directly when Gemini Live fails to call tools
     * This bypasses ToolDecisionAgent and constructs the call directly with available data
     */
    private async executeSafeguard(claimedAction: string, userContext: string, aiOutput: string): Promise<void> {
        try {
            console.log(`\n🧠 Safeguard executing for: ${claimedAction}`);
            console.log(`📝 Context: "${userContext.substring(0, 100)}..."`);

            const palettes = this.getPalettes();
            const fonts = this.getFonts();
            const dna = this.getDNA();

            // Determine what to save based on claimed action
            if (claimedAction === 'save_colors' && palettes.length > 0) {
                // Find which palette the user selected (check user context for palette name)
                const lowerContext = userContext.toLowerCase();
                let selectedPalette = palettes[0]; // Default to first

                for (const p of palettes) {
                    if (lowerContext.includes(p.name.toLowerCase())) {
                        selectedPalette = p;
                        break;
                    }
                }

                // Also check AI output for palette name mentioned
                const lowerAI = aiOutput.toLowerCase();
                for (const p of palettes) {
                    if (lowerAI.includes(p.name.toLowerCase())) {
                        selectedPalette = p;
                        break;
                    }
                }

                console.log(`🎨 Saving palette "${selectedPalette.name}"`);

                // If explicit colors aren't found in current palette, we might need to look deeper
                // But for now, using the matched palette is safe
                await this.toolHandler.handleToolCalls([{
                    name: 'update_live_brand_dna',
                    id: `fallback-${Date.now()}`,
                    args: {
                        selectedColors: selectedPalette.colors
                    }
                }]);

            } else if (claimedAction === 'save_font' && fonts.length > 0) {
                // Find which font the user selected
                const lowerContext = userContext.toLowerCase();
                let selectedFont = fonts[0]; // Default to first

                for (const f of fonts) {
                    if (lowerContext.includes(f.name.toLowerCase())) {
                        selectedFont = f;
                        break;
                    }
                }

                console.log(`🔤 Saving font "${selectedFont.name}"`);

                await this.toolHandler.handleToolCalls([{
                    name: 'update_live_brand_dna',
                    id: `fallback-${Date.now()}`,
                    args: {
                        selectedFont: selectedFont.name
                    }
                }]);

            } else if (claimedAction === 'save_name') {
                // Extract brand name from context
                const nameMatch = userContext.match(/called?\s+['"]?(\w+)['"]?/i) ||
                    userContext.match(/name\s+(?:is\s+)?['"]?(\w+)['"]?/i);

                // Fallback: Check DNA or previous turns if current context failed (e.g. user just said "Yes")
                let brandName = nameMatch ? nameMatch[1] : null;
                if (!brandName && dna.brandName) brandName = dna.brandName;
                if (!brandName && this.previousUserTurn) {
                    const prevNameMatch = this.previousUserTurn.match(/called?\s+['"]?(\w+)['"]?/i) ||
                        this.previousUserTurn.match(/name\s+(?:is\s+)?['"]?(\w+)['"]?/i);
                    if (prevNameMatch) brandName = prevNameMatch[1];
                }

                if (brandName) {
                    console.log(`📛 Saving brand name "${brandName}"`);
                    await this.toolHandler.handleToolCalls([{
                        name: 'update_live_brand_dna',
                        id: `fallback-${Date.now()}`,
                        args: { brandName: brandName }
                    }]);
                }

            } else if (claimedAction === 'save_mission') {
                // MISSION EXTRACTION STRATEGY
                // 1. Check if we already have a tentative mission in DNA (optimistic update) - skipped to be safe
                // 2. Check current AI output for "saving 'X' as mission"
                // 3. Check PREVIOUS AI output for "Would you like to save 'X'?"
                // 4. Check PREVIOUS User input for declaration

                let missionText = null;
                const badPhrases = ['is now saved', 'is saved', 'saved', 'done'];

                // Helper to clean mission reference
                const extract = (text: string, patterns: RegExp[]) => {
                    for (const pattern of patterns) {
                        const match = text.match(pattern);
                        if (match && match[1] && match[1].length > 10) {
                            const trimmed = match[1].trim();
                            if (!badPhrases.includes(trimmed.toLowerCase())) return trimmed;
                        }
                    }
                    return null;
                };

                const missionPatterns = [
                    /mission\s+is\s+(?:to\s+)?(.+?)(?:\.|Would you|$)/i,
                    /mission\s+statement[:\s]+(.+?)(?:\.|Would you|$)/i,
                    /saving[:\s]+['""]?(.+?)['""]?\s+as\s+(?:the\s+)?mission/i
                ];

                // 2. Check current AI output
                missionText = extract(aiOutput, missionPatterns);

                // 3. Fallback: Check PREVIOUS AI output (history check)
                if (!missionText && this.previousAITurn) {
                    // Check if AI asked confirmation previously
                    missionText = extract(this.previousAITurn, missionPatterns);
                    // Also check specifically for quoted mission in questions
                    if (!missionText) {
                        const quoteMatch = this.previousAITurn.match(/['"](.+?)['"]\s+as\s+(?:your|the)\s+mission/i);
                        if (quoteMatch && quoteMatch[1].length > 10) missionText = quoteMatch[1];
                    }
                }

                // 4. Fallback: Check PREVIOUS User input
                if (!missionText && this.previousUserTurn) {
                    // Start simple: If previous user turn was long, it's likely the mission itself
                    if (this.previousUserTurn.length > 20) {
                        missionText = this.previousUserTurn;
                    }
                }

                if (missionText) {
                    console.log(`📜 Saving mission: "${missionText}"`);
                    await this.toolHandler.handleToolCalls([{
                        name: 'update_live_brand_dna',
                        id: `fallback-${Date.now()}`,
                        args: { mission: missionText }
                    }]);
                } else {
                    console.log(`⚠️ Could not extract mission from AI output`);
                }

            } else if (claimedAction === 'save_voice') {
                let voiceText = null;
                const voicePatterns = [
                    /saved\s+(?:as\s+)?['""]?(\w+)['""]?\s*(?:\.|Now|$)/i,
                    /voice\s+(?:is\s+)?['""]?(\w+)['""]?\s*(?:\.|Now|Would|$)/i,
                    /['""](\w+)['""].*?as\s+(?:the\s+)?(?:brand\s+)?voice/i
                ];

                const extractVoice = (text: string) => {
                    for (const pattern of voicePatterns) {
                        const match = text.match(pattern);
                        if (match && match[1] && match[1].length >= 3) {
                            const skip = ['done', 'your', 'the', 'now', 'brand', 'saved'];
                            if (!skip.includes(match[1].toLowerCase())) return match[1].trim();
                        }
                    }
                    return null;
                };

                // Try current AI output
                voiceText = extractVoice(aiOutput);

                // Try previous AI output (e.g. "Save 'Energetic' as voice?")
                if (!voiceText && this.previousAITurn) {
                    voiceText = extractVoice(this.previousAITurn);
                }

                // Try previous User input (e.g. "Energetic.")
                if (!voiceText && this.previousUserTurn) {
                    // If user input is short (word or two), it's likely the voice
                    if (this.previousUserTurn.length < 20 && this.previousUserTurn.length > 3) {
                        voiceText = this.previousUserTurn.replace(/[^\w\s]/g, '').trim();
                    }
                }

                if (voiceText) {
                    console.log(`🎤 Saving voice: "${voiceText}"`);
                    await this.toolHandler.handleToolCalls([{
                        name: 'update_live_brand_dna',
                        id: `fallback-${Date.now()}`,
                        args: { voice: voiceText }
                    }]);
                } else {
                    console.log(`⚠️ Could not extract voice from AI output`);
                }

            } else if (claimedAction === 'display_colors') {
                // AI claimed to display colors but didn't call the tool
                // Generate and display default palettes based on brand voice/vibe
                console.log(`🎨 Generating palettes since AI failed to call display_color_suggestions`);

                const dna = this.getDNA();
                const voice = dna.voice || 'energetic';

                // Generate palettes based on brand voice (simple predefined sets)
                const defaultPalettes = this.generatePalettesForVoice(voice);

                await this.toolHandler.handleToolCalls([{
                    name: 'display_color_suggestions',
                    id: `fallback-${Date.now()}`,
                    args: { palettes: defaultPalettes }
                }]);

                console.log(`✅ Displayed ${defaultPalettes.length} fallback palettes`);

            } else if (claimedAction === 'display_fonts') {
                // AI claimed to display fonts but didn't call the tool
                console.log(`🔤 Generating fonts since AI failed to call display_font_suggestions`);

                const defaultFonts = [
                    { name: 'Poppins', category: 'sans-serif', reasoning: 'Modern and friendly' },
                    { name: 'Playfair Display', category: 'serif', reasoning: 'Elegant and sophisticated' },
                    { name: 'Roboto', category: 'sans-serif', reasoning: 'Clean and professional' }
                ];

                await this.toolHandler.handleToolCalls([{
                    name: 'display_font_suggestions',
                    id: `fallback-${Date.now()}`,
                    args: { fonts: defaultFonts, context_text: dna.name || 'Brand Name' }
                }]);

                console.log(`✅ Displayed ${defaultFonts.length} fallback fonts`);

            } else {
                console.log(`⚠️ Safeguard: No matching action for "${claimedAction}" or no data available`);
                console.log(`   Palettes: ${palettes.length}, Fonts: ${fonts.length}`);
            }
        } catch (error) {
            console.error('❌ Safeguard execution failed:', error);
        }
    }

    /**
     * Generate color palettes based on brand voice
     */
    private generatePalettesForVoice(voice: string): ColorPalette[] {
        const lowerVoice = voice.toLowerCase();

        // Energetic/Bold palettes
        if (lowerVoice.includes('energetic') || lowerVoice.includes('bold') || lowerVoice.includes('dynamic')) {
            return [
                { name: 'Action Rush', colors: ['#FF4136', '#FF851B', '#FFDC00'], vibe: 'Vibrant and bold' },
                { name: 'Electric Pulse', colors: ['#7FDBFF', '#0074D9', '#001f3f'], vibe: 'High energy' },
                { name: 'Neon Burst', colors: ['#39CCCC', '#01FF70', '#2ECC40'], vibe: 'Fresh and dynamic' }
            ];
        }

        // Calm/Professional palettes
        if (lowerVoice.includes('calm') || lowerVoice.includes('professional') || lowerVoice.includes('serious')) {
            return [
                { name: 'Corporate Blue', colors: ['#0074D9', '#7FDBFF', '#001f3f'], vibe: 'Professional and trustworthy' },
                { name: 'Slate Gray', colors: ['#AAAAAA', '#DDDDDD', '#111111'], vibe: 'Clean and minimal' },
                { name: 'Ocean Depth', colors: ['#001f3f', '#0074D9', '#B10DC9'], vibe: 'Calm and sophisticated' }
            ];
        }

        // Playful/Friendly palettes
        if (lowerVoice.includes('playful') || lowerVoice.includes('friendly') || lowerVoice.includes('fun')) {
            return [
                { name: 'Candy Pop', colors: ['#F012BE', '#FF4136', '#FFDC00'], vibe: 'Fun and playful' },
                { name: 'Sunset Fun', colors: ['#FF851B', '#FF4136', '#85144b'], vibe: 'Warm and inviting' },
                { name: 'Rainbow Joy', colors: ['#2ECC40', '#FFDC00', '#FF4136'], vibe: 'Cheerful and vibrant' }
            ];
        }

        // Default/Neutral palettes
        return [
            { name: 'Modern Classic', colors: ['#0074D9', '#2ECC40', '#FF851B'], vibe: 'Versatile and modern' },
            { name: 'Earth Tones', colors: ['#85144b', '#3D9970', '#AAAAAA'], vibe: 'Natural and grounded' },
            { name: 'Twilight', colors: ['#B10DC9', '#0074D9', '#001f3f'], vibe: 'Creative and unique' }
        ];
    }
}
