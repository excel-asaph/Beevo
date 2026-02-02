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
import { InitialLogoGenerator } from './agents/InitialLogoGenerator';
import { bakeTransparency } from './scripts/transparency_baker';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.get('/api/hitl/pending', (req, res) => {
    const requests = notificationService.getPendingRequests();
    res.json(requests);
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

// Debug/Bypass Endpoint: Fetch latest research for hydration
app.get('/api/debug/research', async (req, res) => {
    try {
        const researchPath = path.resolve(__dirname, '../brain/research_artifacts/complete_research_latest.json');
        const data = await fs.readFile(researchPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Failed to load research artifact:', error);
        res.status(404).json({ error: 'Research artifact not found' });
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
app.post('/api/logos/generate', async (req, res) => {
    try {
        const { context } = req.body;
        console.log(`🎨 LOGO REQUEST: Context="${context || 'None'}"`);

        const generator = new InitialLogoGenerator();
        await generator.generate(context);

        res.json({ status: 'ok', message: 'Logo generation complete' });
    } catch (error) {
        console.error('Logo Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate logos' });
    }
});

app.post('/api/logos/finalize', async (req, res) => {
    try {
        console.log(`🧼 LOGO FINALIZE REQUEST: Baking transparency...`);

        const result = await bakeTransparency();

        res.json({ status: 'ok', kit: result });
    } catch (error) {
        console.error('Logo Finalization Error:', error);
        res.status(500).json({ error: 'Failed to bake transparency' });
    }
});
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
        const states = await db.getAllStates() || [];
        const leads = await db.getAllLeads() || [];

        const stateAnalytics = states.map((state: any) => ({
            ...state,
            leadCount: leads.filter((l: any) => l.page_state_hash === state.state_hash).length
        }));

        res.json(stateAnalytics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

app.get('/api/analytics/current', async (req, res) => {
    try {
        const config = await SystemConfigService.getInstance().getConfig();
        const currentStateHash = config.current_state_hash || '';

        // Source of Truth: Database (State-Isolated Metrics)
        const db = DatabaseService.getInstance();

        // 1. Get State Metrics (Views, Clicks)
        const state = await db.getState(currentStateHash) as any;
        const stateMetrics = state?.metrics ? JSON.parse(state.metrics) : { views: 0 };
        const breakdown = stateMetrics.component_breakdown || {};

        // 2. Get Leads/Sales (Business Outcomes)
        const leads = await db.getLeadsForState(currentStateHash) || [];
        const salesCount = leads.filter((l: any) => l.type === 'OFFER').length;
        const leadsCount = leads.filter((l: any) => l.type === 'CONTACT' || l.type === 'INTENT').length;

        // 3. Calculate CR (Sales / State Views)
        const totalViews = stateMetrics.views || 0;
        const cr = totalViews > 0 ? ((salesCount / totalViews) * 100).toFixed(1) : "0.0";

        // 4. Map Component IDs to Human Readable Labels (Best Effort)
        // We look for any key in the breakdown that *looks* like a hero/proof/offer ID
        const getComponentMetric = (pattern: string) => {
            const key = Object.keys(breakdown).find(k => k.includes(pattern));
            return key ? (breakdown[key].views || 0) : 0;
        };

        res.json({
            stateHash: currentStateHash,
            metrics: {
                views: totalViews,
                clicks: stateMetrics.clicks || 0,
                // Drilldown from DB Context
                hero_views: getComponentMetric('hero'),
                proof_views: getComponentMetric('proof'),
                offer_views: getComponentMetric('offer'),
            },
            business: {
                leads: leadsCount,
                sales: salesCount,
                cr: cr
            }
        });

    } catch (error) {
        console.error('Current Analytics Error:', error);
        res.status(500).json({ error: 'Failed to load current analytics' });
    }
});

app.get('/api/analytics/leaderboard', async (req, res) => {
    try {
        const db = DatabaseService.getInstance();
        const leads = await db.getAllLeads() || [];
        const states = await db.getAllStates() || [];

        const leaderboard = states.map((state: any) => {
            const metrics = state.metrics ? JSON.parse(state.metrics) : { views: 0, clicks: 0, leads: 0 };
            const snapshot = JSON.parse(state.snapshot);

            // Calculate precise metrics from raw leads table for this state
            const stateLeads = leads.filter((l: any) => l.page_state_hash === state.state_hash);
            const salesCount = stateLeads.filter((l: any) => l.type === 'OFFER').length;
            const leadsCount = stateLeads.filter((l: any) => l.type === 'CONTACT' || l.type === 'INTENT').length;

            // Extract variant IDs for display
            const variants = Object.entries(snapshot.active_blocks || {}).map(([key, block]: [string, any]) => ({
                block: key,
                variant: block.variant_id
            }));

            // CR is strictly Sales / Views (High intent conversion)
            const cr = metrics.views > 0 ? ((salesCount / metrics.views) * 100).toFixed(1) : "0.0";

            return {
                stateHash: state.state_hash,
                timestamp: state.timestamp,
                views: metrics.views || 0,
                clicks: metrics.clicks || 0,
                leads: leadsCount, // Intent + Contact
                sales: salesCount, // Offer
                cr,
                variants
            };
        });

        // Sort by Sales desc, then Leads desc
        leaderboard.sort((a: any, b: any) => (b.sales - a.sales) || (b.leads - a.leads));

        res.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard Error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// Watcher Configuration Endpoints
app.get('/api/config/watcher', async (req, res) => {
    try {
        const configPath = path.resolve(__dirname, '../brain/watcher_config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({ bufferMinutes: 5, intervalMinutes: 5 }); // Default
    }
});

app.post('/api/config/watcher', async (req, res) => {
    try {
        const { bufferMinutes, intervalMinutes } = req.body;
        const configPath = path.resolve(__dirname, '../brain/watcher_config.json');

        // Enforce Minimum 5 Minutes
        const safeConfig = {
            bufferMinutes: Math.max(5, Number(bufferMinutes) || 5),
            intervalMinutes: Math.max(5, Number(intervalMinutes) || 5)
        };

        await fs.writeFile(configPath, JSON.stringify(safeConfig, null, 4));
        console.log(`⚙️ Watcher Config Updated:`, safeConfig);
        res.json({ status: 'ok', config: safeConfig });
    } catch (e) {
        console.error("Config Save Error:", e);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// Status Check: Are logos ready?
app.get('/api/status/logos', async (req, res) => {
    try {
        const generatedDir = path.resolve(__dirname, '../../client/public/assets/generated_logos');
        const transparentDir = path.resolve(__dirname, '../../client/public/assets/transparent_logos');

        let hasGenerated = false;
        let hasTransparent = false;

        try {
            const genFiles = await fs.readdir(generatedDir);
            hasGenerated = genFiles.length > 0;
        } catch (e) { }

        try {
            const transFiles = await fs.readdir(transparentDir);
            hasTransparent = transFiles.length > 0;
        } catch (e) { }

        res.json({ hasGenerated, hasTransparent, ready: hasGenerated || hasTransparent });
    } catch (e) {
        res.json({ ready: false });
    }
});

// Action: Run Initializer Flow (Init -> Watcher)
app.post('/api/action/run-initializers', (req, res) => {
    console.log("🚀 TRIGGER: Starting Full System Initialization...");

    const orchestratorPath = path.resolve(__dirname, 'run_watchers.ts');

    // Spawn detached process so it keeps running
    const child = spawn('npx', ['tsx', `"${orchestratorPath}"`, '--init'], {
        detached: true,
        stdio: 'ignore',
        shell: true
    });

    child.unref(); // Allow parent to not wait

    res.json({ status: 'ok', message: 'Initialization background process started' });
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
