import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { SessionManager } from './sessions/SessionManager';
import { WS_CONFIG } from '../../shared/constants';
import { MetricsService } from './services/MetricsService';
import { NotificationService } from './services/NotificationService';
import { SystemConfigService } from './services/SystemConfigService.js';
import { DatabaseService } from './services/DatabaseService.js';

// Load environment variables from root .env.local
dotenv.config({ path: '../.env.local' });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session manager handles all client connections
const sessionManager = new SessionManager();
const metricsService = new MetricsService();
const notificationService = NotificationService.getInstance();
notificationService.setSocketServer(wss);

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: sessionManager.getActiveSessionCount()
    });
});

// Tracking Endpoint
app.post('/api/tracking/event', async (req, res) => {
    try {
        const event = req.body;
        await metricsService.trackEvent(event);
        res.json({ status: 'tracked' });
    } catch (error) {
        console.error('Metrics Error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// HITL Endpoints (For Watcher Agents)
app.post('/api/hitl/request', async (req, res) => {
    try {
        const { section, type, message, proposal } = req.body;
        const id = await notificationService.requestApproval(section, type, message, proposal);
        res.json({ id, status: 'PENDING' });
    } catch (error) {
        console.error('HITL Request Error:', error);
        res.status(500).json({ error: 'Failed to request approval' });
    }
});

app.get('/api/hitl/status/:id', (req, res) => {
    const status = notificationService.getRequestStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'Request not found' });
    res.json(status);
});

// HITL Resolution (For Client)
app.post('/api/hitl/resolve', async (req, res) => {
    try {
        const { id, action, feedback } = req.body;
        await notificationService.resolveRequest(id, action, feedback);
        res.json({ status: 'resolved' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resolve request' });
    }
});

// Config Endpoint (For Client)
app.get('/api/config', async (req, res) => {
    try {
        const config = await SystemConfigService.getInstance().getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load config' });
    }
});

app.post('/api/config/lock', async (req, res) => {
    try {
        const { section, isLocked } = req.body;
        const config = await SystemConfigService.getInstance().getConfig();
        (config.locks as any)[section] = isLocked;
        await SystemConfigService.getInstance().updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update lock' });
    }
});

app.post('/api/config/feedback', async (req, res) => {
    try {
        const { directive, value } = req.body;
        console.log(`📝 DIRECTIVE UPDATE: ${directive} = "${value}"`);
        const config = await SystemConfigService.getInstance().getConfig();
        (config.feedback as any)[directive] = value;
        await SystemConfigService.getInstance().updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

app.post('/api/config/update_section', async (req, res) => {
    try {
        const { section, metric, value } = req.body;
        console.log(`📊 METRIC UPDATE: ${section}.${metric} = ${value}`);
        const config = await SystemConfigService.getInstance().getConfig();

        // Dynamic update with type safety workaround
        if ((config.sections as any)[section]) {
            (config.sections as any)[section][metric] = value;
            await SystemConfigService.getInstance().updateConfig(config);
            res.json({ status: 'ok' });
        } else {
            res.status(404).json({ error: 'Section not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to update metric' });
    }
});

// Broadcast Refresh Endpoint (For Agents)
app.post('/api/broadcast/refresh', (req, res) => {
    console.log('📢 BROADCAST: Triggering client refresh for optimization sync...');
    const message = JSON.stringify({ type: 'FULL_STATE_UPDATE', force_refresh: true });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    res.json({ status: 'broadcasted' });
});

// Analytics & State History Endpoints
app.get('/api/analytics/states', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const states = await db.getAllStates();
        // For each state, we could also fetch lead counts
        const leads = await db.getAllLeads();

        const stateAnalytics = states.map((state: any) => ({
            ...state,
            leadCount: leads.filter((l: any) => l.page_state_hash === state.state_hash).length
        }));

        res.json(stateAnalytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

app.post('/api/config/revert', async (req, res) => {
    try {
        const { stateHash } = req.body;
        console.log(`⏪ REVERT REQUEST: State=${stateHash}`);

        const db = DatabaseService.getInstance();
        const state = await db.getState(stateHash) as any;
        if (!state) return res.status(404).json({ error: 'State not found' });

        const snapshot = JSON.parse(state.snapshot);

        // Apply snapshot to challenger files
        for (const [section, config] of Object.entries(snapshot)) {
            const filename = `${section}_block_challenger.json`;
            const filePath = path.resolve(__dirname, '../../client/public/assets', filename);
            await fs.writeFile(filePath, JSON.stringify(config, null, 4));
        }

        // Update current hash in config
        await SystemConfigService.getInstance().updateConfig({ current_state_hash: stateHash } as any);

        res.json({ status: 'ok', message: `Reverted to ${stateHash}` });
    } catch (error) {
        console.error('Revert Error:', error);
        res.status(500).json({ error: 'Failed to revert state' });
    }
});

app.post('/api/leads/submit', async (req, res) => {
    try {
        const { type, formData, stateHash } = req.body;
        console.log(`📩 LEAD SUBMISSION: Type=${type}, State=${stateHash}`);

        const db = DatabaseService.getInstance();
        await db.saveLead(type, formData, stateHash);

        res.json({ status: 'ok', message: 'Lead captured successfully' });
    } catch (error) {
        console.error('Lead Submission Error:', error);
        res.status(500).json({ error: 'Failed to capture lead' });
    }
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
