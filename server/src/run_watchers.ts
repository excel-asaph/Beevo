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

// Helper to extract workspaceId
const getWorkspaceId = () => {
    const arg = process.argv.find(a => a.startsWith('--workspace='));
    return arg ? arg.split('=')[1] : 'default';
};

const WORKSPACE_ID = getWorkspaceId();
const CONFIG_PATH = path.resolve(__dirname, `../brain/workspaces/${WORKSPACE_ID}/watcher_config.json`);

// Helper to load dynamic config
async function loadConfig() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.warn(`⚠️ [${WORKSPACE_ID}] Could not load watcher config, using defaults.`);
        return { bufferMinutes: 5, intervalMinutes: 5 };
    }
}

// Helper to run a script
async function runScript(scriptPath: string) {
    return new Promise<void>((resolve, reject) => {
        // Pass workspace arg
        const child = spawn('node', ['--import', 'tsx', scriptPath, `--workspace=${WORKSPACE_ID}`], {
            stdio: 'inherit',
            windowsHide: true
        });
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Exit code ${code}`));
        });
        child.on('error', reject);
    });
}

const orchestratedLoop = async () => {
    console.log(`🌐 [Orchestrator] Starting for Workspace: ${WORKSPACE_ID}`);

    // 1. Check for Initialization Flag --init
    if (process.argv.includes('--init')) {
        console.log("🚀 [Orchestrator] Initialization Mode Detected.");
        const initPath = path.resolve(__dirname, 'run_initializers.ts');
        try {
            await runScript(initPath);
            console.log("✅ [Orchestrator] Initialization Complete.");
        } catch (e) {
            console.error("❌ [Orchestrator] Initialization Failed:", e);
            return; // Stop if init fails
        }
    }

    // 2. Initial Startup Buffer
    const config = await loadConfig();
    const bufferMs = Math.max(5, config.bufferMinutes) * 60 * 1000;

    console.log(`⏳ [Orchestrator] Waiting ${bufferMs / 60000} minutes before first Watcher Run (Startup Buffer)...`);
    await new Promise(resolve => setTimeout(resolve, bufferMs));

    // 3. Watcher Loop
    const executeCycle = async () => {
        const currentConfig = await loadConfig();
        const intervalMs = Math.max(5, currentConfig.intervalMinutes) * 60 * 1000;

        console.log(`\n🚀 [${new Date().toLocaleTimeString()}] Triggering Watcher Fleet [${WORKSPACE_ID}]...`);

        const promises = WATCHERS.map(watcher => {
            return new Promise<void>((resolve) => {
                const watcherPath = path.resolve(__dirname, 'agents', watcher);
                // Pass workspace arg
                const child = spawn('node', ['--import', 'tsx', watcherPath, `--workspace=${WORKSPACE_ID}`], {
                    stdio: 'inherit',
                    windowsHide: true
                });

                child.on('close', (code) => {
                    console.log(`   ✅ ${watcher} finished`);
                    resolve();
                });
            });
        });

        await Promise.all(promises);

        // Coordinator Seal -> Staged to Live
        console.log("📝 Coordinator: Checking for staged changes...");
        try {
            await StateCoordinator.getInstance(WORKSPACE_ID).sealState("Scheduled Watcher Cycle");
        } catch (e) {
            console.error("❌ Coordinator Seal Failed:", e);
        }

        console.log(`💤 Fleet dormant. Next run in ${intervalMs / 60000} minutes...`);

        // Schedule next run
        setTimeout(executeCycle, intervalMs);
    };

    // Start the first cycle
    executeCycle();
};

// Start the Orchestrator
orchestratedLoop();
