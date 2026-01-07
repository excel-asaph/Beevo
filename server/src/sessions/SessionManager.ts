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
            isActive: false
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
                (field: string, value: any) => session.stateManager.update(field, value)
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

        await session.geminiConnection.sendText(text);
    }

    private async handleUserSelection(
        session: Session,
        selectionType: 'font' | 'color',
        value: string
    ): Promise<void> {
        if (!session.geminiConnection || !session.isActive) {
            return;
        }

        // Notify the AI about the user's selection
        const message = selectionType === 'font'
            ? `The user clicked and selected the "${value}" font.`
            : `The user clicked and selected the "${value}" color palette.`;

        await session.geminiConnection.sendText(message);

        // Also update the state
        if (selectionType === 'font') {
            session.stateManager.update('typography', [value]);
        } else if (selectionType === 'color') {
            // The AI should handle extracting colors from the palette name
        }

        // Send progress update
        this.sendToClient(session.id, {
            type: 'PROGRESS_UPDATE',
            field: selectionType === 'font' ? 'typography' : 'colors',
            value: value,
            finalized: false
        });
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
