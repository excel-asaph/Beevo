import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { StateCoordinator } from './utils/StateCoordinator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WATCHERS = [
    'HeroWatcher.ts',
    'ProofWatcher.ts',
    'SocialWatcher.ts',
    'OfferWatcher.ts',
    'PASWatcher.ts',
    'SpecWatcher.ts'
];

const getWorkspaceId = () => {
    const arg = process.argv.find(a => a.startsWith('--workspace='));
    return arg ? arg.split('=')[1] : 'default';
};

const getOnlyWatcher = () => {
    const arg = process.argv.find(a => a.startsWith('--only='));
    return arg ? arg.split('=')[1] : null;
};

const WORKSPACE_ID = getWorkspaceId();
const CONFIG_PATH = path.resolve(__dirname, `../brain/workspaces/${WORKSPACE_ID}/watcher_config.json`);

// Helper to load dynamic config
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        log('warn', 'Config', `Could not load watcher config, using defaults.`);
        return { bufferMinutes: 5, intervalMinutes: 5 };
    }
}

// Helper to broadcast logs
async function broadcastLog(log: any) {
    try {
        // Determine API Port (Default 3000, but Beevo server is on 3001)
        await fetch('http://localhost:3001/api/broadcast/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-workspace-id': WORKSPACE_ID
            },
            body: JSON.stringify(log)
        });
    } catch (e) {
        // Suppress
    }
}

// Structured Logger for Orchestrator
/**
 * Structured Logger for the Orchestrator.
 * Logs to console and broadcasts to the broadcast/log API.
 * 
 * @param {string} status - The status level.
 * @param {string} title - The title of the log.
 * @param {string} message - The log message.
 */
function log(status: 'info' | 'success' | 'start' | 'error' | 'warn', title: string, message: string) {
    const icon = status === 'error' ? '❌' : status === 'success' ? '✅' : status === 'start' ? '🚀' : status === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${icon} [Orchestrator] ${title}: ${message}`);

    // Map 'warn' to 'info' for AgentLogger schema or keep it if schema supports it. Schema has info/success/error/start.
    // We'll map warn to info with a prefix.
    const agentStatus = status === 'warn' ? 'info' : status;
    const finalMessage = status === 'warn' ? `[WARN] ${message}` : message;

    broadcastLog({
        type: 'TOOL_EXECUTION_LOG', // Mimic AgentLogger
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        toolName: 'Orchestrator',
        title: title,
        message: finalMessage,
        status: agentStatus,
        timestamp: Date.now(),
        workspaceId: WORKSPACE_ID
    });
}

// Helper to run a script
/**
 * Helper to run a script in a child process (Windows/Linux compatible).
 * 
 * @param {string} scriptPath - The absolute path to the script.
 * @returns {Promise<void>}
 */
async function runScript(scriptPath: string) {
    return new Promise<void>((resolve, reject) => {
        // ROBUST WINDOWS SPAWN LOGIC
        const safeCommand = process.platform === 'win32' ? 'cmd' : 'node';
        const safeArgs = process.platform === 'win32'
            ? ['/c', 'node', '--import', 'tsx', scriptPath, `--workspace=${WORKSPACE_ID}`]
            : ['--import', 'tsx', scriptPath, `--workspace=${WORKSPACE_ID}`];

        const child = spawn(safeCommand, safeArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });

        const handleStream = (stream: any, type: 'stdout' | 'stderr') => {
            stream.on('data', (data: Buffer) => {
                const text = data.toString();
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (line.includes('__JSON__:')) {
                        const parts = line.split('__JSON__:');
                        try {
                            const jsonStr = parts[1];
                            broadcastLog(JSON.parse(jsonStr));
                        } catch (e) { }
                    } else {
                        // Forward child logs to console but NOT broadcast (avoid double logging)
                        // Unless strictly necessary. Usually we rely on the child to AgentLog.
                        if (type === 'stderr') console.error(line);
                        else console.log(line);
                    }
                }
            });
        };

        handleStream(child.stdout, 'stdout');
        handleStream(child.stderr, 'stderr');

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Exit code ${code}`));
        });
        child.on('error', reject);
    });
}

/**
 * Main Orchestrator Loop.
 * 
 * 1. Checks for initialization flag.
 * 2. Waits for startup buffer.
 * 3. Enters the main watcher cycle loop.
 */
const orchestratedLoop = async () => {
    log('start', 'Startup', `Starting for Workspace: ${WORKSPACE_ID}`);

    // 1. Check for Initialization Flag --init
    if (process.argv.includes('--init')) {
        log('start', 'Initialization', "Initialization Mode Detected.");
        const initPath = path.resolve(__dirname, 'run_initializers.ts');
        try {
            await runScript(initPath);
            log('success', 'Initialization', "Initialization Complete.");

            // BROADCAST: Signal Init Complete (First State Ready)
            // We need to fetch the config to get the hash, effectively
            const configService = await import('./services/SystemConfigService.js').then(m => m.SystemConfigFactory.getInstance(WORKSPACE_ID));
            const sysConfig = await configService.getConfig();
            log('info', 'Broadcast', `Broadcasting INIT STATE_UPDATE for hash: ${sysConfig.current_state_hash}`);
            await broadcastLog({
                type: 'STATE_UPDATE',
                hash: sysConfig.current_state_hash,
                path: sysConfig.active_assets_path,
                workspaceId: WORKSPACE_ID,
                timestamp: Date.now()
            });
        } catch (e) {
            log('error', 'Initialization Failed', `${e}`);
            return; // Stop if init fails
        }
    }

    // 2. Initial Startup Buffer
    const config = await loadConfig();
    const isNow = process.argv.includes('--now');
    const bufferMs = isNow ? 0 : Math.max(5, config.bufferMinutes) * 60 * 1000;

    if (bufferMs > 0) {
        log('info', 'Startup Buffer', `Waiting ${bufferMs / 60000} minutes before first Watcher Run...`);
        await new Promise(resolve => setTimeout(resolve, bufferMs));
    } else if (isNow) {
        log('info', 'Startup Buffer', `--now detected: Bypassing startup buffer.`);
    }

    // 3. Watcher Loop
    const executeCycle = async () => {
        // Reload config every cycle to get fresh "Master Switch" state
        const configService = await import('./services/SystemConfigService.js').then(m => m.SystemConfigFactory.getInstance(WORKSPACE_ID));
        const sysConfig = await configService.getConfig(); // Get full system config for HITL switch
        const watcherConfig = await loadConfig(); // Get watcher specific config (interval)

        const intervalMs = Math.max(5, watcherConfig.intervalMinutes) * 60 * 1000;

        log('start', 'Cycle Start', `Triggering Watcher Fleet [${WORKSPACE_ID}]...`);

        // 🟢 MASTER SWITCH CHECK
        if (!sysConfig.hitl.enabled) {
            log('info', 'Master Switch', "Switch OFF. System Paused.");
            console.log(`💤 Checking again in ${intervalMs / 60000} minutes...`);
            setTimeout(executeCycle, intervalMs);
            return;
        }

        const onlyWatcher = getOnlyWatcher();
        const activeWatchers = onlyWatcher
            ? WATCHERS.filter(w => w.toLowerCase().includes(onlyWatcher.toLowerCase()))
            : WATCHERS;

        if (onlyWatcher) {
            log('info', 'Targeting', `Specific watcher: ${activeWatchers.join(', ')}`);
        }

        const promises = activeWatchers.map((watcher, index) => {
            return new Promise<void>(async (resolve) => {
                // Stagger spawn to prevent CPU/IO spike (2s delay per watcher)
                if (index > 0) {
                    await new Promise(r => setTimeout(r, index * 2000));
                }

                const watcherPath = path.resolve(__dirname, 'agents', watcher);
                // Pass workspace arg
                const safeCommand = process.platform === 'win32' ? 'node' : 'node'; // Always node here
                const child = spawn(safeCommand, ['--import', 'tsx', watcherPath, `--workspace=${WORKSPACE_ID}`], {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    windowsHide: true // Run in background (Hidden)
                });

                const handleStream = (stream: any, type: 'stdout' | 'stderr') => {
                    stream.on('data', (data: Buffer) => {
                        const text = data.toString();
                        const lines = text.split('\n');
                        for (const line of lines) {
                            if (!line.trim()) continue;
                            if (line.includes('__JSON__:')) {
                                try {
                                    const jsonStr = line.split('__JSON__:')[1];
                                    broadcastLog(JSON.parse(jsonStr));
                                } catch (e) { }
                            } else {
                                if (type === 'stderr') console.error(`[${watcher}] ${line}`);
                                else console.log(`[${watcher}] ${line}`);
                            }
                        }
                    });
                };
                handleStream(child.stdout, 'stdout');
                handleStream(child.stderr, 'stderr');

                child.on('close', (code) => {
                    console.log(`   ✅ ${watcher} finished`);
                    resolve();
                });
            });
        });

        await Promise.all(promises);

        // Coordinator Seal -> Staged to Live
        log('info', 'Coordinator', "Checking for staged changes...");
        try {
            const newStateHash = await StateCoordinator.getInstance(WORKSPACE_ID).sealState("Scheduled Watcher Cycle");
            if (newStateHash) {
                log('success', 'State Update', `Broadcasting STATE_UPDATE for hash: ${newStateHash}`);
                await broadcastLog({
                    type: 'STATE_UPDATE',
                    hash: newStateHash,
                    path: `states/${newStateHash}`,
                    workspaceId: WORKSPACE_ID,
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            log('error', 'Coordinator Seal Failed', `${e}`);
        }

        log('success', 'Cycle Complete', `Fleet dormant. Next run in ${intervalMs / 60000} minutes...`);

        // Schedule next run
        setTimeout(executeCycle, intervalMs);
    };

    // Start the first cycle
    executeCycle();
};

// Start the Orchestrator
orchestratedLoop();
