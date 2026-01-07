import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GeminiLiveConnection } from '../gemini/LiveConnection';
import { BrandStateManager } from '../state/BrandStateManager';
import {
    ClientMessage,
    ServerMessage,
    SessionStartedMessage,
    SessionEndedMessage
} from '../../../shared/messages';
import { ArchitectSession } from '../../../shared/types';

interface Session {
    id: string;
    ws: WebSocket;
    geminiConnection: GeminiLiveConnection | null;
    stateManager: BrandStateManager;
    isActive: boolean;
    currentPalettes: Array<{ name: string; colors: string[]; vibe: string }>;
    currentFonts: Array<{ name: string; category: string }>;
    canvasMode: 'none' | 'fonts' | 'colors';
}

export class SessionManager {
    private sessions: Map<string, Session> = new Map();

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
            canvasMode: 'none'
        };

        this.sessions.set(sessionId, session);

        // Send session ID to client
        this.sendToClient(sessionId, {
            type: 'CONNECTION_STATUS',
            status: 'connected',
            geminiConnected: false
        });

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

            case 'USER_SELECTION':
                await this.handleUserSelection(session, message.selectionType, message.value);
                break;

            case 'UPDATE_DNA':
                await this.handleUpdateDNA(session, message.field, message.value);
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
                (field: string, value: any) => session.stateManager.update(field, value),
                // Callback for storing color palettes (for click selection lookup)
                (palettes: any[]) => { session.currentPalettes = palettes; },
                // Callback for storing fonts
                (fonts: any[]) => { session.currentFonts = fonts; },
                // Callback for setting canvas mode
                (mode: 'none' | 'fonts' | 'colors') => { session.canvasMode = mode; },
                // Callback for getting current DNA state
                () => session.stateManager.getDNA(),
                // Callback for getting current fonts
                () => session.currentFonts,
                // Callback for getting current palettes
                () => session.currentPalettes,
                // Callback for getting current canvas mode
                () => session.canvasMode
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
        selectionType: 'font' | 'color',
        value: string
    ): Promise<void> {
        if (!session.geminiConnection || !session.isActive) {
            return;
        }

        console.log(`🎯 User clicked to select ${selectionType}: "${value}"`);

        // Directly update the DNA based on selection type
        if (selectionType === 'font') {
            session.stateManager.update('typography', [value]);

            // Send DNA_UPDATE to client immediately
            this.sendToClient(session.id, {
                type: 'DNA_UPDATE',
                dna: session.stateManager.getDNA(),
                updatedField: 'typography'
            });
        } else if (selectionType === 'color') {
            // Look up the palette by name to get actual colors
            const palette = session.currentPalettes.find(p => p.name === value);
            if (palette) {
                session.stateManager.update('colors', palette.colors);

                // Send DNA_UPDATE to client immediately
                this.sendToClient(session.id, {
                    type: 'DNA_UPDATE',
                    dna: session.stateManager.getDNA(),
                    updatedField: 'colors'
                });
            } else {
                console.warn(`⚠️ Palette "${value}" not found in currentPalettes`);
            }
        }

        // Also notify the AI about the selection so it can continue the conversation
        const context = this.buildStateContext(session);
        const message = selectionType === 'font'
            ? `${context}\n\n[SYSTEM: User manually selected the "${value}" font. It is already saved. PLEASE ACKNOWLEDGE THIS SELECTION BRIEFLY (e.g. "Great choice").]`
            : `${context}\n\n[SYSTEM: User manually selected the "${value}" palette. It is already saved. PLEASE ACKNOWLEDGE THIS SELECTION BRIEFLY (e.g. "That looks good").]`;

        await session.geminiConnection.sendText(message);
    }

    private async handleUpdateDNA(session: Session, field: string, value: any): Promise<void> {
        session.stateManager.update(field, value);

        this.sendToClient(session.id, {
            type: 'DNA_UPDATE',
            dna: session.stateManager.getDNA(),
            updatedField: field as any
        });
    }

    private sendToClient(sessionId: string, message: ServerMessage): void {
        const session = this.sessions.get(sessionId);
        if (session && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify(message));
        }
    }
}
