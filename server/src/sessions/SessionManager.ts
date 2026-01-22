import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { GeminiLiveConnection } from '../gemini/LiveConnection';
import { BrandStateManager } from '../state/BrandStateManager';
import { stateManager } from '../services/StateManager';
import {
    ClientMessage,
    ServerMessage,
    SessionStartedMessage,
    SessionEndedMessage
} from '../../../shared/messages';
import { ArchitectSession, FontSuggestion, ColorPalette } from '../../../shared/types';

interface Session {
    id: string;
    ws: WebSocket;
    geminiConnection: GeminiLiveConnection | null;
    stateManager: BrandStateManager;
    isActive: boolean;
    currentPalettes: ColorPalette[];
    currentFonts: FontSuggestion[];
    canvasMode: 'none' | 'fonts' | 'colors';
    // Phase 3: Brand Vault
    vaultContext: string;
    vaultStats: {
        fileCount: number;
        totalTokens: number;
        isIngesting: boolean;
    };
}

export class SessionManager {
    private sessions: Map<string, Session> = new Map();

    constructor() {
        // REACTIVE SYNC: Listen for global state updates
        stateManager.on('stateUpdated', (newState: any) => {
            console.log('🔄 [SessionManager] Detected global state update. Broadcasting to all sessions...');
            // Broadcast to all active sessions
            for (const [id, session] of this.sessions.entries()) {
                if (session.isActive && session.ws.readyState === 1) { // 1 = OPEN
                    // Sync session memory
                    // Use updateBatch to ensure internal state matches disk
                    session.stateManager.updateBatch(newState.brandDNA);

                    // Send FULL state update (Single Source of Truth)
                    console.log(`📦 [SessionManager] Broadcasting FULL state (v${newState.stateVersion}) to ${id}`);
                    this.sendToClient(id, {
                        type: 'FULL_STATE_UPDATE',
                        state: newState
                    });


                }
            }
        });
    }

    createSession(ws: WebSocket): string {
        const sessionId = uuidv4();

        const session: Session = {
            id: sessionId,
            ws,
            geminiConnection: null,
            stateManager: new BrandStateManager(sessionId),
            isActive: false,
            currentPalettes: [],
            currentFonts: [],
            canvasMode: 'none',
            vaultContext: '',
            vaultStats: { fileCount: 0, totalTokens: 0, isIngesting: false }
        };

        this.sessions.set(sessionId, session);

        this.sessions.set(sessionId, session);

        // Send session ID to client
        this.sendToClient(sessionId, {
            type: 'CONNECTION_STATUS',
            status: 'connected',
            geminiConnected: false
        });

        // ==========================================
        // INITIAL STATE HYDRATION (Fix for State Loss)
        // ==========================================
        const existingState = stateManager.loadLatest();
        if (existingState && existingState.brandDNA) {
            console.log(`💧 Hydrating session ${sessionId} with existing state (v${existingState.stateVersion || '?'})`);

            // 1. Populate Session State Manager
            // (Using updateBatch to ensure all fields are correctly structured)
            session.stateManager.updateBatch(existingState.brandDNA as any);

            // 2. Send DNA Updates to Client


            // 3. Send Colors/Fonts/etc if they exist
            // 3. Send FULL State (Hydration)
            console.log(`💧 Broadcasting FULL hydrated state (v${existingState.stateVersion || '?'})`);
            this.sendToClient(sessionId, {
                type: 'FULL_STATE_UPDATE',
                state: existingState
            });

            // Hydrate internal session memory
            if (existingState.colorPalettes?.palettes) session.currentPalettes = existingState.colorPalettes.palettes;
            if (existingState.typographyPairings?.fonts) session.currentFonts = existingState.typographyPairings.fonts;

            if (existingState.logoInspirations?.inspirations) {
                // Send logo inspirations if we had a message type for it (we might need to check messages.ts)
                // For now, we rely on DNA update which might include them if structure matches
            }
        }

        return sessionId;
    }

    destroySession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.geminiConnection) {
                session.geminiConnection.disconnect();
            }
            this.sessions.delete(sessionId);
            console.log(`🗑️ Destroyed session: ${sessionId}`);
        }
    }

    getActiveSessionCount(): number {
        return this.sessions.size;
    }

    async handleMessage(sessionId: string, message: ClientMessage): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.error(`Session not found: ${sessionId}`);
            return;
        }

        console.log(`📨 Received message type: ${message.type} for session: ${sessionId}`);

        switch (message.type) {
            case 'START_SESSION':
                await this.handleStartSession(session);
                break;

            case 'END_SESSION':
                await this.handleEndSession(session);
                break;

            case 'AUDIO_CHUNK':
                await this.handleAudioChunk(session, message.data);
                break;

            case 'TEXT_INPUT':
                await this.handleTextInput(session, message.text);
                break;

            case 'SELECTION_EVENT':
                await this.handleUserSelection(session, message.selectionType, message.value, message.context);
                break;

            case 'UPDATE_DNA':
                await this.handleUpdateDNA(session, message.field, message.value);
                break;

            case 'INTERRUPT':
                await this.handleInterrupt(session);
                break;

            case 'FILE_UPLOAD':
                this.handleFileUpload(session, message);
                break;

            default:
                console.warn(`Unknown message type: ${(message as any).type}`);
        }
    }

    private async handleStartSession(session: Session): Promise<void> {
        try {
            console.log(`🚀 Starting Gemini Live session for: ${session.id}`);

            // Create Gemini Live connection
            session.geminiConnection = new GeminiLiveConnection(
                session.id,
                // Callback for sending messages to client
                (message: ServerMessage) => this.sendToClient(session.id, message),
                // Callback for updating state
                (field: string, value: any) => {
                    session.stateManager.update(field, value);
                    // Broadcast removed: StateManager listener handles it
                },
                // Callback for storing color palettes (for click selection lookup)
                (palettes: any[]) => { session.currentPalettes = palettes; },
                // Callback for storing fonts
                (fonts: any[]) => { session.currentFonts = fonts; },
                // Callback for setting canvas mode
                (mode: 'none' | 'fonts' | 'colors') => { session.canvasMode = mode; },
                // Callback for getting current DNA state
                () => session.stateManager.getDNA(),
                // Callback for getting current fonts
                () => session.currentFonts || [],
                // Callback for getting current palettes
                () => session.currentPalettes,
                // Callback for getting current canvas mode
                // Callback for getting current canvas mode
                () => session.canvasMode,
                // Callback for batch updating state (single broadcast)
                (updates: Record<string, any>) => {
                    session.stateManager.updateBatch(updates);
                    // Broadcast removed: StateManager listener handles it
                }
            );

            await session.geminiConnection.connect();
            session.isActive = true;

            this.sendToClient(session.id, {
                type: 'SESSION_STARTED',
                sessionId: session.id
            });

            this.sendToClient(session.id, {
                type: 'CONNECTION_STATUS',
                status: 'connected',
                geminiConnected: true
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            this.sendToClient(session.id, {
                type: 'ERROR',
                message: 'Failed to start Gemini session',
                code: 'GEMINI_CONNECTION_FAILED'
            });
        }
    }

    private async handleEndSession(session: Session): Promise<void> {
        console.log(`🛑 Ending session: ${session.id}`);

        if (session.geminiConnection) {
            session.geminiConnection.disconnect();
            session.geminiConnection = null;
        }

        session.isActive = false;

        this.sendToClient(session.id, {
            type: 'SESSION_ENDED'
        });

        this.sendToClient(session.id, {
            type: 'CONNECTION_STATUS',
            status: 'connected',
            geminiConnected: false
        });
    }

    // Build state context for AI awareness
    private buildStateContext(session: Session): string {
        const dna = session.stateManager.getDNA();

        let canvasInfo = 'Canvas: empty';
        if (session.canvasMode === 'fonts' && session.currentFonts.length > 0) {
            const fontNames = session.currentFonts.map(f => f.name).join(', ');
            canvasInfo = `Canvas: showing fonts (${fontNames})`;
        } else if (session.canvasMode === 'colors' && session.currentPalettes.length > 0) {
            const paletteNames = session.currentPalettes.map(p => p.name).join(', ');
            canvasInfo = `Canvas: showing palettes (${paletteNames})`;
        }

        return `[CURRENT STATE]
Brand DNA: name="${dna.name || ''}", mission="${dna.mission || ''}", typography=${JSON.stringify(dna.typography || [])}, colors=${JSON.stringify(dna.colors || [])}, voice="${dna.voice || ''}"
${canvasInfo}
[END STATE]`;
    }

    private async handleAudioChunk(session: Session, audioData: string): Promise<void> {
        if (!session.geminiConnection || !session.isActive) {
            return;
        }

        await session.geminiConnection.sendAudio(audioData);
    }

    private async handleTextInput(session: Session, text: string): Promise<void> {
        if (!session.geminiConnection || !session.isActive) {
            return;
        }

        // Inject state context before user text
        const context = this.buildStateContext(session);
        const contextualMessage = `${context}\n\nUser: ${text}`;

        await session.geminiConnection.sendText(contextualMessage);
    }

    private async handleUserSelection(
        session: Session,
        selectionType: 'font' | 'color' | 'logo' | 'structure' | 'imagery',
        value: string,
        context?: any
    ): Promise<void> {
        if (!session.geminiConnection || !session.isActive) {
            return;
        }

        console.log(`🎯 User clicked to select ${selectionType}: "${value}"`);

        // Directly update the DNA based on selection type
        if (selectionType === 'font') {
            session.stateManager.update('typography', [value]);

            // Persist to disk immediately (Listener will handle broadcast)
            await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());
        } else if (selectionType === 'color') {
            // Look up the palette by name to get actual colors
            const palette = session.currentPalettes.find(p => p.name === value);
            if (palette) {
                session.stateManager.update('colors', palette.colors);

                // Persist to disk immediately (Listener will handle broadcast)
                await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());
            } else {
                console.warn(`⚠️ Palette "${value}" not found in currentPalettes`);
            }
        } else if (selectionType === 'structure') {
            session.stateManager.update('logoType', value);
            await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());

        } else if (selectionType === 'imagery') {
            session.stateManager.update('imagery', value);
            await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());
        }

        // Also notify the AI about the selection so it can continue the conversation
        // Also notify the AI about the selection so it can continue the conversation
        const stateContext = this.buildStateContext(session);
        let systemMsg = "";

        switch (selectionType) {
            case 'font':
                systemMsg = `[SYSTEM: User manually selected the "${value}" font. It is already saved. PLEASE ACKNOWLEDGE THIS SELECTION BRIEFLY (e.g. "Great choice").]`;
                break;
            case 'color':
                systemMsg = `[SYSTEM: User manually selected the "${value}" palette. It is already saved. PLEASE ACKNOWLEDGE THIS SELECTION BRIEFLY (e.g. "That looks good").]`;
                break;
            case 'logo':
                systemMsg = `[SYSTEM: User clicked a logo with style/name "${value}". They might like this style. Ask if they want to save it or use it as inspiration.]`;
                break;
            case 'structure':
                systemMsg = `[SYSTEM: User selected the "${value}" logo structure (e.g. Wordmark/Emblem). It is saved to DNA. Confirm this choice.]`;
                break;
            case 'imagery':
                systemMsg = `[SYSTEM: User selected the "${value}" imagery concept. It is saved to DNA. Confirm this choice.]`;
                break;
        }

        await session.geminiConnection.sendText(`${stateContext}\n\n${systemMsg}`);
    }

    private async handleInterrupt(session: Session): Promise<void> {
        console.log(`🛑 User requested interrupt for session: ${session.id}`);

        if (session.geminiConnection) {
            session.geminiConnection.interruptLive();
        }

        // Send interrupt acknowledgement to client
        this.sendToClient(session.id, { type: 'INTERRUPT' });
    }

    private async handleFileUpload(session: Session, message: any): Promise<void> {
        console.log(`📁 Processing file upload for session: ${session.id} (Target: ${message.target || 'extraction'})`);

        if (message.target === 'vault') {
            // PHASE 3: VAULT INGESTION (Full Context)
            session.vaultStats.isIngesting = true; // Set ingesting status
            this.sendToClient(session.id, { type: 'VAULT_UPDATE', stats: session.vaultStats });
            this.ingestVaultFile(session, message.base64, message.mimeType, message.fileName);
            return;
        }

        if (session.geminiConnection) {
            // 2. Analyze for Brand Extraction (Reliable JSON via Gemini 3 Flash)
            this.analyzeFileAndExtractIdentity(session, message.base64, message.mimeType).catch(err => {
                console.error('❌ Background extraction failed:', err);
                if (session.geminiConnection) {
                    session.geminiConnection.sendText(`[SYSTEM EVENT: Critical error during file extraction. Please gently ask the user to verbally provide their brand details instead.]`);
                }
            });

        } else {
            console.error(`❌ Cannot handle file upload - No Gemini connection for session ${session.id}`);
        }
    }

    private async ingestVaultFile(session: Session, base64: string, mimeType: string, fileName: string): Promise<void> {
        console.log(`🏦 Ingesting file "${fileName}" into Brand Vault...`);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        // Use the large-context model for ingestion/storage
        const model = 'gemini-1.5-pro-latest'; // Changed to latest pro model for better context handling
        const ai = new GoogleGenAI({ apiKey });

        try {
            // 1. Extract Full Text
            const prompt = `Extract all text content from this document verbatim. Preserve structure where possible. Do not summarize.`;
            const response = await ai.models.generateContent({
                model,
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { data: base64, mimeType } }
                    ]
                }]
            });

            const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("No text extracted");

            // 2. Estimate Tokens & Update Stats
            const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
            session.vaultStats.fileCount++;
            session.vaultStats.totalTokens += estimatedTokens;
            session.vaultStats.isIngesting = false;

            // 3. Append to Session Vault Context
            session.vaultContext += `\n\n=== VAULT ASSET: ${fileName} ===\n${text}\n=== END ASSET ===\n`;

            console.log(`✅ Ingested ${fileName}: ~${estimatedTokens} tokens added.`);

            // 4. Notify Client (Vault Update)
            this.sendToClient(session.id, {
                type: 'VAULT_UPDATE',
                stats: session.vaultStats
            });

            // 5. Inject Knowledge into Agent immediately
            // This makes the agent "aware" of the new knowledge
            if (session.geminiConnection) {
                session.geminiConnection.sendText(`[SYSTEM: I have just memorized the document "${fileName}" (${estimatedTokens} tokens). It is now part of my specific knowledge base. I should use this information to answer detailed questions.]`);
            }

        } catch (error) {
            console.error('❌ Vault Ingestion Failed:', error);
            session.vaultStats.isIngesting = false;
            this.sendToClient(session.id, {
                type: 'VAULT_UPDATE',
                stats: session.vaultStats
            });
        }
    }

    private async analyzeFileAndExtractIdentity(session: Session, base64: string, mimeType: string): Promise<void> {
        console.log('🔍 Starting background file analysis for extraction...');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        const ai = new GoogleGenAI({ apiKey });
        // Use Gemini 3 Flash for fast, high-quality extraction
        const model = 'gemini-3-flash-preview';

        try {
            // STAGE 1: Fast Core DNA Extraction (Name, Mission, Voice)
            // Goal: Get the canvas OPEN immediately.
            console.log('⚡ STAGE 1: Extracting Core DNA...');
            const corePrompt = `
            Analyze this brand document (image/PDF) and extract ONLY the vital Core Identity fields.
            Return a JSON object with this EXACT structure:
            {
                "brandName": "Name of the brand",
                "mission": "Mission statement or tagline",
                "voice": "Description of the brand voice/vibe (e.g. 'Professional, Witty, Calm')"
            }
            Do not extract colors or fonts yet. Focus on text content.
            `;

            const coreResponse = await ai.models.generateContent({
                model,
                contents: [{
                    parts: [
                        { text: corePrompt },
                        { inlineData: { data: base64, mimeType } }
                    ]
                }]
            });

            const coreText = coreResponse?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (coreText) {
                const jsonMatch = coreText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const coreData = JSON.parse(jsonMatch[0]);
                    console.log('✅ STAGE 1 COMPLETE: Core DNA Extracted', coreData);

                    // Update state directly with extracted core data
                    if (coreData.brandName) session.stateManager.update('name', coreData.brandName);
                    if (coreData.mission) session.stateManager.update('mission', coreData.mission);
                    if (coreData.voice) session.stateManager.update('voice', coreData.voice);

                    // Persist to disk immediately (Listener will handle broadcast)
                    await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());

                    // Notify Voice AI to narrate progress
                    if (session.geminiConnection) {
                        session.geminiConnection.sendText(`[SYSTEM EVENT: Core Brand Identity (Name: ${coreData.brandName}) has been extracted and the Canvas is now visible to the user. Briefly confirm this and mention you are now analyzing the visual style.]`);
                    }
                } else {
                    console.error('❌ STAGE 1 FAILED: No JSON found in response');
                    if (session.geminiConnection) {
                        session.geminiConnection.sendText(`[SYSTEM EVENT: Failed to extract brand identity from the file. Please ask the user to provide their brand name and mission manually.]`);
                    }
                }
            } else {
                console.error('❌ STAGE 1 FAILED: Empty response from model');
                if (session.geminiConnection) {
                    session.geminiConnection.sendText(`[SYSTEM EVENT: Failed to analyze the file. Please ask the user to provide their details verbally.]`);
                }
            }

            // STAGE 2: Deep Visual Extraction (Colors, Typography, Imagery)
            // Goal: Populate the canvas cards progressively.
            console.log('🎨 STAGE 2: Extracting Visual Assets...');
            const visualPrompt = `
            Now analyze the VISUAL STYLE of this brand document.
            Return a JSON object with this EXACT structure:
            {
                "colors": {
                    "palettes": [{
                        "name": "Derived Palette",
                        "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
                        "vibe": "Mood of these colors"
                    }]
                },
                "typography": {
                    "fonts": [{
                        "name": "Font Family Name",
                        "category": "serif/sans-serif/display/handwritten",
                        "reasoning": "Why this font fits the brand"
                    }],
                    "context_text": "Sample text from the document"
                },
                "logoType": "wordmark/emblem/abstract/combination",
                "imagery": "Description of the photography or illustration style used"
            }
            Extract as much as you can. If exact hex codes are missing, sample 5 distinct harmonious colors from the image itself.
            `;

            const visualResponse = await ai.models.generateContent({
                model,
                contents: [{
                    parts: [
                        { text: visualPrompt },
                        { inlineData: { data: base64, mimeType } }
                    ]
                }]
            });

            const visualText = visualResponse?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (visualText) {
                const jsonMatch = visualText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const visualData = JSON.parse(jsonMatch[0]);
                    console.log('✅ STAGE 2 COMPLETE: Visuals Extracted', visualData);

                    // Update state with extracted visual data
                    if (visualData.colors?.palettes?.[0]?.colors) {
                        session.stateManager.update('colors', visualData.colors.palettes[0].colors);
                        session.currentPalettes = visualData.colors.palettes;
                    }
                    if (visualData.typography?.fonts) {
                        session.stateManager.update('typography', visualData.typography.fonts.map((f: any) => f.name));
                        session.currentFonts = visualData.typography.fonts;
                    }
                    if (visualData.logoType) session.stateManager.update('logoType', visualData.logoType);
                    if (visualData.imagery) session.stateManager.update('imagery', visualData.imagery);

                    // Persist to disk immediately (Listener will handle broadcast)
                    await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());

                    // Notify Voice AI to narrate completion
                    if (session.geminiConnection) {
                        session.geminiConnection.sendText(`[SYSTEM EVENT: Visual assets (Colors, Fonts, Logo Style) have now been extracted and added to the canvas. The brand analysis is complete. Ask the user what they think of the extracted style.]`);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error during background file analysis:', error);
        }
    }

    private async handleUpdateDNA(session: Session, field: string, value: any): Promise<void> {
        session.stateManager.update(field, value);

        // Persist to disk immediately (Listener will handle broadcast)
        await stateManager.saveWithHistory('brandDNA', session.stateManager.getDNA());
    }

    private sendToClient(sessionId: string, message: ServerMessage): void {
        const session = this.sessions.get(sessionId);
        if (session && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify(message));
        }
    }


}
