import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { MODELS } from '../../../shared/constants.js';
import { GeminiLiveConnection } from '../gemini/LiveConnection';
import { BrandStateManager } from '../state/BrandStateManager';
import { WorkspaceManager } from '../services/StateManager';
import {
    ClientMessage,
    ServerMessage
} from '../../../shared/messages';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FontSuggestion, ColorPalette } from '../../../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Session {
    id: string;
    ws: WebSocket;
    geminiConnection: GeminiLiveConnection | null;
    stateManager: BrandStateManager;
    isActive: boolean;
    currentPalettes: ColorPalette[];
    currentFonts: FontSuggestion[];
    canvasMode: 'none' | 'fonts' | 'colors';
    workspaceId: string;
    // Phase 3: Brand Vault
    vaultContext: string;
    vaultStats: {
        fileCount: number;
        totalTokens: number;
        isIngesting: boolean;
    };
}

/**
 * Manages WebSocket sessions and Gemini Live connections.
 * Handles session creation, lifecycle, message routing, and state synchronization.
 */
export class SessionManager {
    private sessions: Map<string, Session> = new Map();
    private workspaceListeners: Set<string> = new Set();

    constructor() {
        // No global listener anymore - handled per workspace in createSession
    }

    private broadcastToWorkspace(workspaceId: string, newState: any) {
        console.log(`🔄 [SessionManager] Broadcasting update to workspace: ${workspaceId}`);
        for (const [id, session] of this.sessions.entries()) {
            if (session.workspaceId === workspaceId && session.isActive && session.ws.readyState === 1) {
                // Sync session memory
                session.stateManager.updateBatch(newState.brandDNA);

                // Fetch current thoughts (Unified Log)
                const thoughts = WorkspaceManager.getStateManager(workspaceId).getThoughts();

                // Send FULL state update with thoughts injected
                console.log(`📦 [SessionManager] Broadcasting FULL state (v${newState.stateVersion}) with ${thoughts.length} thoughts to session ${id}`);
                this.sendToClient(id, {
                    type: 'FULL_STATE_UPDATE',
                    state: { ...newState, thoughts } as any
                });
            }
        }
    }

    /**
     * Creates a new session for a WebSocket connection.
     * Initializes the BrandStateManager, sets up workspace listeners, and attempts hydration.
     * 
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {string} [workspaceId='default'] - The workspace identifier.
     * @returns {string} The unique session ID.
     */
    createSession(ws: WebSocket, workspaceId: string = 'default'): string {
        const sessionId = uuidv4();

        const session: Session = {
            id: sessionId,
            ws,
            workspaceId,
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

        // Fix for Ghost Workspaces: Check if workspace folder exists BEFORE initializing persistence
        // If it doesn't exist, we skip persistence logic (listeners, hydration) and let BrainConnection handle the error.
        const workspaceDir = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const workspaceExists = workspaceId === 'default' || fs.existsSync(workspaceDir);

        if (!workspaceExists) {
            console.warn(`🚧 [SessionManager] Workspace folder missing: ${workspaceId} -> Skipping persistence setup.`);
        }

        // Ensure we are listening to this workspace (ONLY IF EXISTS)
        if (workspaceExists && !this.workspaceListeners.has(workspaceId)) {
            const manager = WorkspaceManager.getStateManager(workspaceId);
            manager.on('stateUpdated', (newState: any) => {
                this.broadcastToWorkspace(workspaceId, newState);
            });
            this.workspaceListeners.add(workspaceId);
        }

        // Send session ID to client
        this.sendToClient(sessionId, {
            type: 'CONNECTION_STATUS',
            status: 'connected',
            geminiConnected: false
        });

        // ==========================================
        // INITIAL STATE HYDRATION (Fix for State Loss)
        // ==========================================
        if (workspaceExists) {
            const manager = WorkspaceManager.getStateManager(workspaceId);
            const existingState = manager.loadLatest();
            if (existingState && existingState.brandDNA) {
                console.log(`💧 Hydrating session ${sessionId} with existing state (v${existingState.stateVersion || '?'})`);

                // 1. Populate Session State Manager
                // (Using updateBatch to ensure all fields are correctly structured)
                session.stateManager.updateBatch(existingState.brandDNA as any);

                // 2. Send DNA Updates to Client

                // 3. Send Colors/Fonts/etc if they exist
                // 3. Send FULL State (Hydration with Thoughts)
                const thoughts = WorkspaceManager.getStateManager(workspaceId).getThoughts();
                console.log(`💧 Broadcasting FULL hydrated state (v${existingState.stateVersion || '?'}) with ${thoughts.length} thoughts to session ${sessionId}`);

                this.sendToClient(sessionId, {
                    type: 'FULL_STATE_UPDATE',
                    state: { ...existingState, thoughts } as any
                });

                // Hydrate internal session memory
                if (existingState.colorPalettes?.palettes) session.currentPalettes = existingState.colorPalettes.palettes;
                if (existingState.typographyPairings?.fonts) session.currentFonts = existingState.typographyPairings.fonts;

                if (existingState.logoInspirations?.inspirations) {
                    // Send logo inspirations if we had a message type for it (we might need to check messages.ts)
                    // For now, we rely on DNA update which might include them if structure matches
                }
            }
        }

        return sessionId;
    }

    /**
     * Destroys a session, disconnecting Gemini (if active) and cleaning up resources.
     * 
     * @param {string} sessionId - The ID of the session to destroy.
     */
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

    /**
     * Terminate all sessions and listeners for a specific workspace
     */
    public disconnectWorkspace(workspaceId: string): void {
        console.log(`🔌 [SessionManager] Disconnecting all sessions for workspace: ${workspaceId}`);

        for (const [id, session] of this.sessions.entries()) {
            if (session.workspaceId === workspaceId) {
                this.destroySession(id);
            }
        }

        this.workspaceListeners.delete(workspaceId);
    }

    /**
     * Handles incoming messages from the client.
     * Routes messages to specific handlers based on type (e.g., START_SESSION, TEXT_INPUT).
     * 
     * @param {string} sessionId - The session ID.
     * @param {ClientMessage} message - The message object.
     */
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

            case 'ACTIVITY_END':
                await this.handleActivityEnd(session);
                break;

            case 'ACTIVITY_START':
                await this.handleActivityStart(session);
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
                () => session.canvasMode,
                // Callback for batch updating state (single broadcast)
                (updates: Record<string, any>) => {
                    session.stateManager.updateBatch(updates);
                    // Broadcast removed: StateManager listener handles it
                },
                session.workspaceId
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

            // CHECK FOR EXISTING RESEARCH & SET MODIFICATION PHASE
            const dna = session.stateManager.getDNA();
            const hasName = !!dna.name?.value;
            // RELAXED CHECK: If we have at least a Name, we are past Discovery.
            // This handles both fully restored sessions (from JSON) and in-progress execution.
            if (hasName) {
                console.log(`🔄 Existing research detected (Name: ${dna.name?.value}). Switching to MODIFICATION phase.`);
                await session.geminiConnection.setPhase('modification');
            }

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
Brand DNA: name="${dna.name?.value || ''}", mission="${dna.mission?.value || ''}", voice="${dna.voice?.value || ''}"
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
            await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());
        } else if (selectionType === 'color') {
            // Look up the palette by name to get actual colors
            const palette = session.currentPalettes.find(p => p.name === value);
            if (palette) {
                session.stateManager.update('colors', palette.colors);

                // Persist to disk immediately (Listener will handle broadcast)
                await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());
            } else {
                console.warn(`⚠️ Palette "${value}" not found in currentPalettes`);
            }
        } else if (selectionType === 'structure') {
            // Updated to handle array-based LogoStructureOption selection
            const manager = WorkspaceManager.getStateManager(session.workspaceId);
            const currentState = manager.loadLatest();
            const currentOptions = currentState?.logoStructures?.options || [];

            if (currentOptions.length > 0) {
                // Toggle isSelected based on ID match
                const updatedOptions = currentOptions.map(opt => ({
                    ...opt,
                    isSelected: opt.id === value
                }));

                await manager.saveWithHistory('logoStructures', {
                    options: updatedOptions,
                    rationale: `User manually selected logo structure: ${value}`
                });
            } else {
                console.warn('⚠️ No logo structures found to select from.');
            }

        } else if (selectionType === 'imagery') {
            session.stateManager.update('imagery', value);
            await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());
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

    private async handleActivityEnd(session: Session): Promise<void> {
        console.log(`🎤 Activity end received for session: ${session.id}`);

        if (session.geminiConnection) {
            session.geminiConnection.signalActivityEnd();
        }
    }

    private async handleActivityStart(session: Session): Promise<void> {
        console.log(`🎙️ Activity start received for session: ${session.id}`);

        if (session.geminiConnection) {
            session.geminiConnection.signalActivityStart();
        }
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

    /**
     * Ingests a file into the "Brand Vault" (Knowledge Base) for the session.
     * Uses a large-context model to extract text and update session stats.
     * 
     * @param {Session} session - The session object.
     * @param {string} base64 - The file content in base64.
     * @param {string} mimeType - The file MIME type.
     * @param {string} fileName - The name of the file.
     */
    private async ingestVaultFile(session: Session, base64: string, mimeType: string, fileName: string): Promise<void> {
        console.log(`🏦 Ingesting file "${fileName}" into Brand Vault...`);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        // Use the large-context model for ingestion/storage
        const model = MODELS.STRATEGIST;
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

    /**
     * Analyzes an uploaded file to extract Brand Identity (Name, Mission, Voice) and Visual Style.
     * Updates the session state and notifies the client via Gemini.
     * 
     * @param {Session} session - The session object.
     * @param {string} base64 - The file content in base64.
     * @param {string} mimeType - The file MIME type.
     */
    private async analyzeFileAndExtractIdentity(session: Session, base64: string, mimeType: string): Promise<void> {
        console.log('🔍 Starting background file analysis for extraction...');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;

        const ai = new GoogleGenAI({ apiKey });
        // Use Gemini 3 Flash for fast, high-quality extraction
        const model = MODELS.ARCHITECT_TEXT;

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
                    await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());

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
                    await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());

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
        await WorkspaceManager.getStateManager(session.workspaceId).saveWithHistory('brandDNA', session.stateManager.getDNA());
    }

    private sendToClient(sessionId: string, message: ServerMessage): void {
        const session = this.sessions.get(sessionId);
        if (session && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify(message));
        }
    }


}
