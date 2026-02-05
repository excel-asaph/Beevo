import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { SessionManager } from './sessions/SessionManager';
import { WS_CONFIG } from '../../shared/constants';
import { MetricsService } from './services/MetricsService';
import { NotificationService } from './services/NotificationService';
import { SystemConfigFactory } from './services/SystemConfigService.js';
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
// MetricsService is requested via getInstance(workspaceId)
const notificationService = NotificationService.getInstance();
notificationService.setSocketServer(wss);

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-workspace-id');
    next();
});

// Middleware to extract workspace ID
const workspaceMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = req.headers['x-workspace-id'] as string || req.query.workspaceId as string || 'default';
    (req as any).workspaceId = workspaceId;
    console.log(`🔒 Request for Workspace: ${workspaceId} [${req.method} ${req.url}]`);
    next();
};

app.use(workspaceMiddleware);

// Helper to get workspaceId
const getWorkspaceId = (req: Request): string => (req as any).workspaceId;


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: sessionManager.getActiveSessionCount(),
        workspace: getWorkspaceId(req)
    });
});

// List all workspaces
app.get('/api/workspaces', async (req, res) => {
    try {
        const workspacesDir = path.resolve(__dirname, '../../brain/workspaces');
        await fs.mkdir(workspacesDir, { recursive: true });
        const dirs = await fs.readdir(workspacesDir);

        const workspaces = await Promise.all(dirs.map(async (id) => {
            // Check if it's a directory
            const stats = await fs.stat(path.join(workspacesDir, id));
            if (!stats.isDirectory()) return null;

            // Try to read metadata if it exists, otherwise use ID
            return {
                id,
                name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Prettier name default
                lastActive: stats.mtime
            };
        }));

        res.json(workspaces.filter(Boolean));
    } catch (error) {
        console.error('Failed to list workspaces:', error);
        res.status(500).json({ error: 'Failed to list workspaces' });
    }
});

// Check if a workspace exists
app.get('/api/workspaces/check/:id', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspacePath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);

        try {
            const stats = await fs.stat(workspacePath);
            if (stats.isDirectory()) {
                return res.json({ exists: true });
            }
        } catch {
            return res.json({ exists: false });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to check workspace' });
    }
});

// Tracking Endpoint
app.post('/api/tracking/event', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const event = req.body;
        await MetricsService.getInstance(workspaceId).trackEvent(event);
        res.json({ status: 'tracked' });
    } catch (error) {
        console.error('Metrics Error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// HITL Endpoints (For Watcher Agents)
app.post('/api/hitl/request', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { section, type, message, proposal } = req.body;
        const id = await notificationService.requestApproval(section, type, message, proposal, workspaceId);
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
        const workspaceId = getWorkspaceId(req);
        const config = await SystemConfigFactory.getInstance(workspaceId).getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load config' });
    }
});

// Debug/Bypass Endpoint: Fetch latest research for hydration
app.get('/api/debug/research', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        // Updated to use workspace path
        const researchPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}/research_artifacts/complete_research_latest.json`);
        const data = await fs.readFile(researchPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error(`Failed to load research artifact for ${getWorkspaceId(req)}:`, error);
        res.status(404).json({ error: 'Research artifact not found' });
    }
});

app.post('/api/config/lock', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { section, isLocked } = req.body;
        const service = SystemConfigFactory.getInstance(workspaceId);
        const config = await service.getConfig();
        (config.locks as any)[section] = isLocked;
        await service.updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update lock' });
    }
});

app.post('/api/config/feedback', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { directive, value } = req.body;
        console.log(`📝 DIRECTIVE UPDATE [${workspaceId}]: ${directive} = "${value}"`);
        const service = SystemConfigFactory.getInstance(workspaceId);
        const config = await service.getConfig();
        (config.feedback as any)[directive] = value;
        await service.updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

app.post('/api/config/update_section', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { section, metric, value } = req.body;
        console.log(`📊 METRIC UPDATE [${workspaceId}]: ${section}.${metric} = ${value}`);
        const service = SystemConfigFactory.getInstance(workspaceId);
        const config = await service.getConfig();

        // Dynamic update with type safety workaround
        if ((config.sections as any)[section]) {
            (config.sections as any)[section][metric] = value;
            await service.updateConfig(config);
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
        const workspaceId = getWorkspaceId(req);
        const { context, research } = req.body;
        console.log(`🎨 LOGO REQUEST [${workspaceId}]: Context="${context || 'None'}"`);

        const generator = new InitialLogoGenerator(workspaceId);
        await generator.generate(context);

        res.json({ status: 'ok', message: 'Logo generation complete' });
    } catch (error) {
        console.error('Logo Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate logos' });
    }
});

app.post('/api/logos/finalize', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        console.log(`🧼 LOGO FINALIZE REQUEST [${workspaceId}]: Baking transparency...`);
        const result = await bakeTransparency(workspaceId);

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
        const workspaceId = getWorkspaceId(req);
        const config = await SystemConfigFactory.getInstance(workspaceId).getConfig();
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
        const workspaceId = getWorkspaceId(req);
        // Updated to use workspace path
        const configPath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}/watcher_config.json`);
        const data = await fs.readFile(configPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({ bufferMinutes: 5, intervalMinutes: 5 }); // Default
    }
});

app.post('/api/config/watcher', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { bufferMinutes, intervalMinutes } = req.body;
        // Updated to use workspace path
        const configPath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}/watcher_config.json`);

        // Enforce Minimum 5 Minutes
        const safeConfig = {
            bufferMinutes: Math.max(5, Number(bufferMinutes) || 5),
            intervalMinutes: Math.max(5, Number(intervalMinutes) || 5)
        };

        // Ensure dir exists
        await fs.mkdir(path.dirname(configPath), { recursive: true });

        await fs.writeFile(configPath, JSON.stringify(safeConfig, null, 4));
        console.log(`⚙️ Watcher Config Updated [${workspaceId}]:`, safeConfig);
        res.json({ status: 'ok', config: safeConfig });
    } catch (e) {
        console.error("Config Save Error:", e);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// Status Check: Are logos ready?
app.get('/api/status/logos', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        // Updated to use workspace path
        const generatedDir = path.resolve(__dirname, `../../client/public/workspaces/${workspaceId}/assets/generated_logos`);
        const transparentDir = path.resolve(__dirname, `../../client/public/workspaces/${workspaceId}/assets/transparent_logos`);

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
    const workspaceId = getWorkspaceId(req);
    console.log(`🚀 TRIGGER: Starting Full System Initialization for Workspace: ${workspaceId}...`);

    const orchestratorPath = path.resolve(__dirname, 'run_watchers.ts');

    // DEBUGGING MODE: Non-detached so output appears in console
    // WINDOWS FIX: Use node with tsx/register instead of npx
    // Remove quotes from path - Windows handles them differently
    const child = spawn('node', [
        '--import', 'tsx',
        orchestratorPath,
        '--init',
        `--workspace=${workspaceId}`
    ], {
        detached: false, // TEMP: Make it attached for debugging
        stdio: 'inherit', // Output shows in server console
        cwd: path.resolve(__dirname, '..')
    });

    child.on('error', (error) => {
        console.error(`❌ Spawn Error:`, error);
    });

    // Don't unref() when not detached
    // child.unref(); // Allow parent to not wait

    res.json({ status: 'ok', message: 'Initialization process started (attached for debugging)' });
});

app.post('/api/config/revert', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { stateHash } = req.body;
        console.log(`⏪ REVERT REQUEST [${workspaceId}]: State=${stateHash}`);

        const db = DatabaseService.getInstance();
        const state = await db.getState(stateHash) as any;
        if (!state) return res.status(404).json({ error: 'State not found' });

        const snapshot = JSON.parse(state.snapshot);

        // Apply snapshot to challenger files
        for (const [section, config] of Object.entries(snapshot)) {
            const filename = `${section}_block_challenger.json`;
            // Updated path
            const filePath = path.resolve(__dirname, `../../client/public/workspaces/${workspaceId}/assets`, filename);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(config, null, 4));
        }

        // Update current hash in config
        const service = SystemConfigFactory.getInstance(workspaceId);
        await service.updateConfig({ current_state_hash: stateHash } as any);

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
wss.on('connection', (ws: WebSocket, req) => {
    console.log('🔌 New WebSocket connection');

    // Parse workspaceId from URL query params
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const workspaceId = params.get('workspaceId') || 'default';
    console.log(`   Workspace: ${workspaceId}`);

    // Create a new session for this connection
    // TODO: Update SessionManager to accept workspaceId
    const sessionId = sessionManager.createSession(ws, workspaceId);
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
