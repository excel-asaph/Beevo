/**
 * Main Server Entry Point
 * 
 * Sets up the Express server, WebSocket server, and API endpoints.
 * Handles workspace management, session management, and routing for various services.
 */
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
import { ProcessRegistry } from './utils/ProcessRegistry';
import { WorkspaceManager } from './services/StateManager';

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

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE');
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

// Helper to ensure workspace exists (prevents implicit creation)
const ensureWorkspaceExists = async (workspaceId: string) => {
    // Default workspace is always allowed/created by system if needed, 
    // but for specific IDs we want to be strict.
    if (workspaceId === 'default') return;

    const workspacePath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);
    console.log(`🔍 [Check] Ensuring workspace exists: ${workspaceId} (${workspacePath})`);
    try {
        await fs.access(workspacePath);
        console.log(`✅ [Check] Workspace found: ${workspaceId}`);
    } catch {
        console.error(`❌ [Check] Workspace NOT FOUND: ${workspaceId}`);
        throw new Error('WORKSPACE_NOT_FOUND');
    }
};


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
        const workspacesDir = path.resolve(__dirname, '../brain/workspaces');
        await fs.mkdir(workspacesDir, { recursive: true });
        const dirs = await fs.readdir(workspacesDir);

        const workspaces = await Promise.all(dirs.map(async (id) => {
            // Check if it's a directory
            const workspacePath = path.join(workspacesDir, id);
            const stats = await fs.stat(workspacePath);
            if (!stats.isDirectory()) return null;

            // Check for thumbnail
            let thumbnailUrl = null;
            try {
                await fs.access(path.join(workspacePath, 'thumbnail.png'));
                thumbnailUrl = `/api/workspaces/${id}/thumbnail?t=${stats.mtimeMs}`;
            } catch (e) {
                // No thumbnail
            }

            // Try to read metadata if it exists, otherwise use ID
            return {
                id,
                name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Prettier name default
                lastActive: stats.mtime,
                thumbnailUrl
            };
        }));

        res.json(workspaces.filter(Boolean));
    } catch (error) {
        console.error('Failed to list workspaces:', error);
        res.status(500).json({ error: 'Failed to list workspaces', details: String(error) });
    }
});

// --- Production: Serve Static Client Files ---
if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    console.log(`🚀 Production Mode: Serving static files from ${clientDistPath}`);

    app.use(express.static(clientDistPath));

    // Handle SPA routing (catch-all for frontend routes)
    app.get('*', (req, res, next) => {
        // Skip API and WS routes
        if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path === '/health') {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// Check if a workspace exists
app.get('/api/workspaces/check/:id', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspacePath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);

        try {
            const stats = await fs.stat(workspacePath);
            if (stats.isDirectory()) {
                // Check if state exists (to determine phase)
                const stateManager = WorkspaceManager.getStateManager(workspaceId);
                const latestState = stateManager.loadLatest();
                return res.json({ exists: true, hasState: !!latestState });
            }
        } catch {
            return res.json({ exists: false, hasState: false });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to check workspace' });
    }
});

// Create a new workspace folder explicitly
app.post('/api/workspaces', async (req, res) => {
    try {
        const { workspaceId } = req.body;
        console.log(`🛠️ [API] POST /api/workspaces request for: ${workspaceId}`);
        if (!workspaceId) {
            return res.status(400).json({ error: 'Workspace ID required' });
        }

        const workspacePath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);
        // Use fsSync for synchronous check
        if (!fsSync.existsSync(workspacePath)) {
            await fs.mkdir(workspacePath, { recursive: true });
            console.log(`📂 [API] Created new workspace folder: ${workspaceId}`);
        } else {
            console.log(`📂 [API] Workspace folder already exists: ${workspaceId}`);
        }

        res.json({ success: true, workspaceId });
    } catch (error) {
        console.error('Failed to create workspace:', error);
        res.status(500).json({ error: 'Failed to create workspace' });
    }
});

// Upload thumbnail
app.post('/api/workspaces/:id/thumbnail', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { image } = req.body; // Base64 string
        if (!image) return res.status(400).json({ error: 'Image data required' });

        const workspacePath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);
        await ensureWorkspaceExists(workspaceId);

        // Remove header if present (e.g., "data:image/png;base64,")
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        await fs.writeFile(path.join(workspacePath, 'thumbnail.png'), buffer);
        console.log(`📸 Thumbnail saved for workspace: ${workspaceId}`);
        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Thumbnail Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload thumbnail' });
    }
});

// Serve thumbnail
app.get('/api/workspaces/:id/thumbnail', async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const workspacePath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);
        const imagePath = path.join(workspacePath, 'thumbnail.png');

        try {
            await fs.access(imagePath);
            res.sendFile(imagePath);
        } catch {
            res.status(404).send('Thumbnail not found');
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to serve thumbnail' });
    }
});

// Delete a workspace
app.delete('/api/workspaces/:id', async (req, res) => {
    const workspaceId = req.params.id;
    if (workspaceId === 'default') {
        return res.status(400).json({ error: 'Cannot delete the default workspace' });
    }

    try {
        console.log(`🗑️  CRITICAL: Deletion request for workspace: ${workspaceId}`);

        // 1. Kick active sessions
        sessionManager.disconnectWorkspace(workspaceId);

        // 2. Terminate background processes (watchers, initializers)
        ProcessRegistry.kill(workspaceId);

        // 3. Cleanup Service Instances (Close DBs, clear caches)
        await DatabaseService.cleanup(workspaceId);
        SystemConfigFactory.cleanup(workspaceId);
        MetricsService.cleanup(workspaceId);
        WorkspaceManager.cleanup(workspaceId);

        // 4. Delete Filesystem Directories
        const brainPath = path.resolve(__dirname, `../brain/workspaces/${workspaceId}`);
        const assetPath = path.resolve(__dirname, `../../client/public/workspaces/${workspaceId}`);

        // Recursive deletion with safety check
        await fs.rm(brainPath, { recursive: true, force: true });
        await fs.rm(assetPath, { recursive: true, force: true });

        console.log(`✅ Workspace [${workspaceId}] deleted successfully.`);
        res.json({ status: 'ok', message: `Workspace ${workspaceId} deleted` });

    } catch (error) {
        console.error(`❌ Failed to delete workspace ${workspaceId}:`, error);
        res.status(500).json({ error: 'Failed to complete deletion' });
    }
});

// Tracking Endpoint
app.post('/api/tracking/event', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const event = req.body;
        await MetricsService.getInstance(workspaceId).trackEvent(event);
        res.json({ status: 'tracked' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        console.error('Metrics Error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// HITL Endpoints (For Watcher Agents)
app.post('/api/hitl/request', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { section, type, message, proposal } = req.body;
        const id = await notificationService.requestApproval(section, type, message, proposal, workspaceId);
        res.json({ id, status: 'PENDING' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
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
        await ensureWorkspaceExists(workspaceId);

        const config = await SystemConfigFactory.getInstance(workspaceId).getConfig();
        res.json(config);
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.status(500).json({ error: 'Failed to load config' });
    }
});

// Debug/Bypass Endpoint: Fetch latest research for hydration
// Debug/Bypass Endpoint: Fetch latest research for hydration
app.get('/api/debug/research', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        // Use StateManager for consistent access
        const stateManager = WorkspaceManager.getStateManager(workspaceId);
        const data = stateManager.loadLatest();

        if (data) {
            res.json(data);
        } else {
            // Return empty/default object instead of 404 to satisfy "create/handle gracefully" request
            // This allows the client to init with defaults
            res.json({});
        }
    } catch (error) {
        // Quiet failure for fresh workspaces
        res.json({});
    }
});

// Endpoint: Fetch streaming thought history (real-time logs)
app.get('/api/debug/research/thoughts', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const thoughts = WorkspaceManager.getStateManager(workspaceId).getThoughts();
        res.json(thoughts);
    } catch (error) {
        // No log found (legacy or fresh), return empty
        res.json([]);
    }
});

app.post('/api/config/lock', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { section, isLocked } = req.body;
        const service = SystemConfigFactory.getInstance(workspaceId);
        const config = await service.getConfig();
        (config.locks as any)[section] = isLocked;
        await service.updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.status(500).json({ error: 'Failed to update lock' });
    }
});

app.post('/api/config/feedback', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { directive, value } = req.body;
        console.log(`📝 DIRECTIVE UPDATE [${workspaceId}]: ${directive} = "${value}"`);
        const service = SystemConfigFactory.getInstance(workspaceId);
        const config = await service.getConfig();
        (config.feedback as any)[directive] = value;
        await service.updateConfig(config);
        res.json({ status: 'ok' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.status(500).json({ error: 'Failed to update feedback' });
    }
});

// --- Workspace State Persistence ---

app.get('/api/workspace/state/:id', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const stateId = req.params.id; // 'canvas_layout' | 'ui_state'
        const db = DatabaseService.getInstance(workspaceId);
        const data = await db.loadWorkspaceState(stateId);
        res.json({ data });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        console.error('Failed to load workspace state:', error);
        res.status(500).json({ error: 'Failed', details: String(error) });
    }
});

app.post('/api/workspace/state', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { id, data } = req.body;
        const db = DatabaseService.getInstance(workspaceId);
        await db.saveWorkspaceState(id, data);
        res.json({ status: 'ok' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        console.error('Failed to save workspace state:', error);
        res.status(500).json({ error: 'Failed', details: String(error) });
    }
});

// --- Session History Persistence ---

app.get('/api/workspace/history', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { limit } = req.query;
        const db = DatabaseService.getInstance(workspaceId);
        const history = await db.loadHistory(Number(limit) || 50);
        res.json(history);
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        console.error('Failed to load history:', error);
        res.status(500).json({ error: 'Failed', details: String(error) });
    }
});

app.post('/api/workspace/history', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { role, content, metadata } = req.body;
        const db = DatabaseService.getInstance(workspaceId);
        await db.saveHistory(role, content, metadata);
        res.json({ status: 'ok' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        console.error('Failed to save history:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/config/update_section', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const { section, metric, value } = req.body;
        console.log(`📊 METRIC UPDATE [${workspaceId}]: ${section}.${metric} = ${value}`);
        const service = SystemConfigFactory.getInstance(workspaceId);
        // Use the service method to handle top-level (hitl) vs nested (sections) updates
        await service.updateSection(section, { [metric]: value });
        res.json({ status: 'ok' });
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.status(500).json({ error: 'Failed to update metric' });
    }
});

// Broadcast Refresh Endpoint (For Agents)
app.post('/api/logos/generate', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { context, research } = req.body;
        console.log(`🎨 LOGO REQUEST [${workspaceId}]: Context="${context || 'None'}"`);

        const generator = new InitialLogoGenerator(workspaceId, (log) => {
            // 1. Broadcast tool execution logs to this workspace
            const message = JSON.stringify(log);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

            // 2. Persist to History (for Page Reloads)
            // We use 'tool_log' role so we can filter it out of the main chat but show it in the activity feed
            // FIX: Ensure title exists to prevent SQLITE_CONSTRAINT error
            const title = log.title || log.toolName || 'System Action';
            DatabaseService.getInstance(workspaceId).saveHistory('tool_log', title, log)
                .catch(err => console.error('Failed to persist tool log:', err));

            // 3. Persist to thoughts (for activity history reloads)
            WorkspaceManager.getStateManager(workspaceId).appendThought({
                id: log.id || `log-${Date.now()}`,
                stepIndex: 5,
                nodeId: log.toolName || 'logo-gen',
                title: title,
                content: log.message || '',
                timestamp: new Date(log.timestamp || Date.now()).toISOString()
            }).catch(err => console.error('Failed to persist thought log:', err));
        });
        await generator.generate(context);

        // AUTOMATIC CHAINING: Run Transparency Baker immediately
        console.log(`🧼 AUTOMATION: Triggering Transparency Baker for [${workspaceId}]...`);
        const kit = await bakeTransparency(workspaceId, (log) => {
            // Reuse same broadcast logic for seamless UI feedback
            const message = JSON.stringify(log);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            const title = log.title || log.toolName || 'System Action';
            DatabaseService.getInstance(workspaceId).saveHistory('tool_log', title, log)
                .catch(err => console.error('Failed to persist tool log:', err));

            // 3. Persist to thoughts (for activity history reloads)
            WorkspaceManager.getStateManager(workspaceId).appendThought({
                id: log.id || `log-${Date.now()}`,
                stepIndex: 5,
                nodeId: log.toolName || 'baker',
                title: title,
                content: log.message || '',
                timestamp: new Date(log.timestamp || Date.now()).toISOString()
            }).catch(err => console.error('Failed to persist thought log:', err));
        });

        // BROADCAST: Signal Assets Ready (Client Soft Refresh)
        const assetUpdateMsg = JSON.stringify({
            type: 'ASSET_UPDATE',
            resource: 'logo_kit',
            workspaceId: workspaceId,
            timestamp: Date.now()
        });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(assetUpdateMsg);
            }
        });

        res.json({ status: 'ok', message: 'Logo generation and transparency complete', kit });
    } catch (error) {
        console.error('Logo Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate logos' });
    }
});

app.post('/api/logos/finalize', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        console.log(`🧼 LOGO FINALIZE REQUEST [${workspaceId}]: Baking transparency...`);

        const result = await bakeTransparency(workspaceId, (log) => {
            // 1. Broadcast tool execution logs to this workspace
            const message = JSON.stringify(log);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });

            // 2. Persist to History
            // FIX: Ensure title exists to prevent SQLITE_CONSTRAINT error
            const title = log.title || log.toolName || 'System Action';
            DatabaseService.getInstance(workspaceId).saveHistory('tool_log', title, log)
                .catch(err => console.error('Failed to persist tool log:', err));

            // 3. Persist to thoughts (for activity history reloads)
            WorkspaceManager.getStateManager(workspaceId).appendThought({
                id: log.id || `log-${Date.now()}`,
                stepIndex: 5,
                nodeId: log.toolName || 'baker',
                title: title,
                content: log.message || '',
                timestamp: new Date(log.timestamp || Date.now()).toISOString()
            }).catch(err => console.error('Failed to persist thought log:', err));
        });

        // BROADCAST: Signal Assets Ready (Client Soft Refresh)
        const assetUpdateMsg = JSON.stringify({
            type: 'ASSET_UPDATE',
            resource: 'logo_kit',
            workspaceId: workspaceId,
            timestamp: Date.now()
        });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(assetUpdateMsg);
            }
        });

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

// Broadcast Log Endpoint (For External Processes)
app.post('/api/broadcast/log', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const log = req.body;

        // 1. Broadcast
        const message = JSON.stringify(log);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });

        // 2. Persist to History (Non-blocking)
        const title = log.title || log.toolName || 'System Action';
        // Only persist if it looks like a meaningful log (has id/type)
        if (log.id && log.type) {
            DatabaseService.getInstance(workspaceId).saveHistory('tool_log', title, log)
                .catch(err => console.error('Failed to persist external log:', err));

            // 3. Persist to thoughts (for activity history reloads)
            if (log.type === 'TOOL_EXECUTION_LOG') {
                WorkspaceManager.getStateManager(workspaceId).appendThought({
                    id: log.id,
                    stepIndex: 5, // Strategy/Agent phase for background logs
                    nodeId: log.toolName || 'system',
                    title: title,
                    content: log.message || '',
                    timestamp: new Date(log.timestamp || Date.now()).toISOString()
                }).catch(err => console.error('Failed to persist thought log:', err));
            }
        }

        res.json({ status: 'ok' });
    } catch (e) {
        console.error("Broadcast Log Error:", e);
        res.status(500).json({ error: 'Failed to broadcast log' });
    }
});

// Analytics & State History Endpoints
app.get('/api/analytics/states', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const db = DatabaseService.getInstance(workspaceId);
        const states = await db.getAllStates() || [];
        const leads = await db.getAllLeads() || [];

        const stateAnalytics = states.map((state: any) => ({
            ...state,
            leadCount: leads.filter((l: any) => l.page_state_hash === state.state_hash).length
        }));

        res.json(stateAnalytics);
    } catch (error: any) {
        if (error.message === 'WORKSPACE_NOT_FOUND') {
            return res.status(404).json({ error: 'Workspace not found' });
        }
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});

app.get('/api/analytics/current', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        await ensureWorkspaceExists(workspaceId);

        const config = await SystemConfigFactory.getInstance(workspaceId).getConfig();
        const currentStateHash = config.current_state_hash || '';

        // Source of Truth: Database (State-Isolated Metrics)
        const db = DatabaseService.getInstance(workspaceId);

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
        const db = DatabaseService.getInstance(getWorkspaceId(req));
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
                variant: block.variant_id || "N/A"
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
app.post('/api/action/run-initializers', async (req, res) => {
    const workspaceId = getWorkspaceId(req);
    console.log(`🚀 TRIGGER: Starting Full System Initialization for Workspace: ${workspaceId}...`);

    // 🛑 SINGLETON CHECK: Kill any existing orchestrator for this workspace
    // CRITICAL: We MUST await this kill command. If we don't, the new process spawns and registers
    // *while* the taskkill is still iterating, causing the new process to be killed immediately (Suicide).
    if (ProcessRegistry.isTracking(workspaceId)) {
        console.log(`⚠️ Found existing orchestrator for ${workspaceId}. Terminating before restart...`);
        await ProcessRegistry.kill(workspaceId);
    }

    const orchestratorPath = path.resolve(__dirname, 'run_watchers.ts');

    // ROBUST SPAWN LOGIC (Hidden Window)
    // We spawn 'node' directly. On Windows, 'windowsHide: true' + 'detached: true'
    // correctly hides the window while keeping the process independent.
    // We avoid 'cmd /c' because it forces a console window to appear despite 'windowsHide'.
    const safeCommand = 'node';
    const safeArgs = ['--import', 'tsx', orchestratorPath, '--init', `--workspace=${workspaceId}`];

    const child = spawn(safeCommand, safeArgs, {
        detached: true, // Detach to prevent parent crash linkage
        stdio: 'ignore', // Ignore stdio to prevent pipe issues (client relies on completed files, not logs)
        cwd: path.resolve(__dirname, '..'),
        windowsHide: true // Run in background (Hidden)
    });

    child.unref(); // Allow parent to exit independently if needed, but mainly to decouple

    child.on('error', (error) => {
        console.error(`❌ Spawn Error:`, error);
    });

    // Register for tracking so it can be killed on deletion or restart
    ProcessRegistry.register(workspaceId, child);

    res.json({ status: 'ok', message: 'Initialization process started' });
});

app.post('/api/config/revert', async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { stateHash } = req.body;
        console.log(`⏪ REVERT REQUEST [${workspaceId}]: State=${stateHash}`);

        const db = DatabaseService.getInstance(getWorkspaceId(req));
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

        const db = DatabaseService.getInstance(getWorkspaceId(req));
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


// ============================
// TELEGRAM BOT ENDPOINTS
// ============================
import { telegramService } from './services/TelegramService.js';

// Telegram webhook (receives updates from Telegram)
app.post('/api/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;
        console.log('📱 Telegram update received:', JSON.stringify(update).slice(0, 200));

        // Handle /start command (link user to workspace)
        if (update.message?.text?.startsWith('/start')) {
            const chatId = update.message.chat.id;
            const username = update.message.from?.username;
            const startParam = update.message.text.split(' ')[1]; // workspace ID encoded

            if (startParam) {
                try {
                    const workspaceId = Buffer.from(startParam, 'base64url').toString();
                    await telegramService.linkUser(String(chatId), workspaceId, username);
                } catch (e) {
                    await telegramService.sendMessage(String(chatId), '❌ Invalid link. Please use the QR code from your workspace.');
                }
            } else {
                await telegramService.sendMessage(String(chatId), '👋 Welcome to Beevo!\n\nTo receive notifications, please use the "Connect Telegram" button in your workspace.');
            }
        }

        // Handle callback queries (button presses)
        if (update.callback_query) {
            const result = await telegramService.handleCallback(update.callback_query);
            if (result) {
                // Resolve the intervention
                const notificationService = NotificationService.getInstance();
                const action = result.action === 'approve' ? 'APPROVED' : 'REJECTED';
                await notificationService.resolveRequest(result.interventionId, action as any, `Via Telegram`);
            }
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Telegram webhook error:', error);
        res.json({ ok: true }); // Always return 200 to Telegram
    }
});

// Get Telegram bot link for a workspace
app.get('/api/telegram/link', (req, res) => {
    const workspaceId = getWorkspaceId(req);
    const link = telegramService.getBotLink(workspaceId);
    const configured = telegramService.isConfigured();
    res.json({ link, configured });
});


// ============================
// WEB PUSH ENDPOINTS
// ============================
import { pushService } from './services/PushService.js';

// Get VAPID public key for client subscription
app.get('/api/push/vapid-key', (req, res) => {
    const publicKey = pushService.getPublicKey();
    const configured = pushService.isConfigured();
    res.json({ publicKey, configured });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { subscription } = req.body;
        const userAgent = req.headers['user-agent'];

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        pushService.subscribe(subscription, workspaceId, userAgent);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Push subscription error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', (req, res) => {
    try {
        const { endpoint } = req.body;
        if (endpoint) {
            pushService.unsubscribe(endpoint);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});



const PORT = Number(process.env.PORT) || WS_CONFIG.SERVER_PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
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
