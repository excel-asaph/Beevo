
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { StateCoordinator } from './utils/StateCoordinator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to extract workspaceId
const getWorkspaceId = () => {
    const arg = process.argv.find(a => a.startsWith('--workspace='));
    return arg ? arg.split('=')[1] : 'default';
};

const WORKSPACE_ID = getWorkspaceId();

const ASSETS_DIR = path.resolve(__dirname, `../../client/public/workspaces/${WORKSPACE_ID}/assets`);
const HISTORY_DIR = path.join(ASSETS_DIR, 'history');
// States are inside assets
const STATES_DIR = path.resolve(ASSETS_DIR, 'states');

const GENERATORS = [
    'InitialHeroGenerator.ts',
    'InitialProofGenerator.ts',
    'InitialSocialGenerator.ts',
    'InitialPASGenerator.ts',
    'InitialSpecGenerator.ts',
    'InitialOfferGenerator.ts'
];

/**
 * Runs a specific generator agent in a child process.
 * 
 * @param {string} name - The filename of the generator agent.
 * @returns {Promise<void>}
 */
async function runGenerator(name: string) {
    return new Promise((resolve) => {
        console.log(`\n🚀 [${WORKSPACE_ID}] Starting ${name}...`);

        const agentPath = path.resolve(__dirname, `agents/${name}`);

        // ROBUST WINDOWS SPAWN LOGIC
        const safeCommand = process.platform === 'win32' ? 'cmd' : 'node';
        const safeArgs = process.platform === 'win32'
            ? ['/c', 'node', '--import', 'tsx', agentPath, `--workspace=${WORKSPACE_ID}`]
            : ['--import', 'tsx', agentPath, `--workspace=${WORKSPACE_ID}`];

        const child = spawn(safeCommand, safeArgs, {
            stdio: ['ignore', 'pipe', 'pipe'], // Pipe output for interception
            windowsHide: true
        });

        // Helper to broadcast logs
        const broadcastLog = async (log: any) => {
            try {
                // Determine API Port (Default 3000, but Beevo server is on 3001)
                // App runs on 3001 for server logs (express) as per shared/constants.js
                await fetch('http://localhost:3001/api/broadcast/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-workspace-id': WORKSPACE_ID
                    },
                    body: JSON.stringify(log)
                });
            } catch (e) {
                // console.warn('Broadcast failed (server likely starting/restarting):', e.message);
            }
        };

        // Stream Handler
        const handleStream = (stream: any, type: 'stdout' | 'stderr') => {
            stream.on('data', (data: Buffer) => {
                const text = data.toString();
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (line.includes('__JSON__:')) {
                        // Extract JSON part
                        const parts = line.split('__JSON__:');
                        try {
                            const jsonStr = parts[1];
                            const logObj = JSON.parse(jsonStr);
                            broadcastLog(logObj);
                        } catch (e) {
                            console.log(`[${name}] Malformed JSON Log:`, line);
                        }
                    } else {
                        // Standard Log pass-through
                        if (type === 'stderr') console.error(`[${name}] ${line}`);
                        else console.log(`[${name}] ${line}`);

                        // OPTIONAL: We could wrap *every* stdout line as a log for the UI?
                        // For now, let's stick to explicit __JSON__ events to avoid noise.
                    }
                }
            });
        };

        handleStream(child.stdout, 'stdout');
        handleStream(child.stderr, 'stderr');

        child.on('close', resolve);
    });
}

async function cleanSlate() {
    console.log(`🧹 [${WORKSPACE_ID}] CLEANING SLATE: Deleting History...`);

    // 1. Database - SKIPPING GLOBAL TRUNCATION FOR SAFETY
    // TODO: Implement workspace-specific deletion
    // try {
    //     const db = DatabaseService.getInstance();
    //     await db.initialize(); 
    //     // await db.get('DELETE FROM page_states'); // DANGEROUS IN MULTI-TENANT
    //     // console.log("   - Tables Cleared.");
    // } catch (e) {
    //     console.error("   - Failed to check tables:", e);
    // }

    // 2. Clear History Assets (preserving directory)
    try {
        await fs.rm(HISTORY_DIR, { recursive: true, force: true });
        await fs.mkdir(HISTORY_DIR, { recursive: true });
    } catch (e) { }

    // 3. Clear States Directory
    try {
        await fs.rm(STATES_DIR, { recursive: true, force: true });
        await fs.mkdir(STATES_DIR, { recursive: true });
    } catch (e) { }

    console.log("✨ Slate Cleaned (Files only).");
}

async function main() {
    console.log(`🔥 STARTING FULL SYSTEM RESET & INITIALIZATION [${WORKSPACE_ID}] 🔥`);

    await cleanSlate();

    console.log("\n🚀 IGNITING INITIAL GENERATORS...");

    for (const gen of GENERATORS) {
        await runGenerator(gen);
    }

    // Final Seal to create State Zero
    console.log("\n🛡️ SEALING STATE ZERO...");
    await StateCoordinator.getInstance(WORKSPACE_ID).sealState("System Initialization (State Zero)");

    console.log("\n✅ SYSTEM RESET COMPLETE.");
}

main().catch(console.error);

