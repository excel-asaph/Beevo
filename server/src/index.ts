import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { SessionManager } from './sessions/SessionManager';
import { WS_CONFIG } from '../../shared/constants';

// Load environment variables from root .env.local
dotenv.config({ path: '../.env.local' });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session manager handles all client connections
const sessionManager = new SessionManager();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: sessionManager.getActiveSessionCount()
    });
});

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 New WebSocket connection');

    // Create a new session for this connection
    const sessionId = sessionManager.createSession(ws);
    console.log(`📋 Created session: ${sessionId}`);

    ws.on('message', async (data: Buffer) => {
        try {
            const message = JSON.parse(data.toString());
            await sessionManager.handleMessage(sessionId, message);
        } catch (error) {
            console.error('❌ Error handling message:', error);
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    });

    ws.on('close', () => {
        console.log(`🔌 WebSocket closed for session: ${sessionId}`);
        sessionManager.destroySession(sessionId);
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket error for session ${sessionId}:`, error);
        sessionManager.destroySession(sessionId);
    });
});

const PORT = WS_CONFIG.SERVER_PORT;

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🐝 BEEVO Backend Server                             ║
║   ────────────────────────────────────────────       ║
║   WebSocket: ws://localhost:${PORT}                    ║
║   Health:    http://localhost:${PORT}/health           ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
