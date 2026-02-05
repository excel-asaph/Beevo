
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { DatabaseService } from './services/DatabaseService.js';
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

async function runGenerator(name: string) {
    return new Promise((resolve) => {
        console.log(`\n🚀 [${WORKSPACE_ID}] Starting ${name}...`);
        // Use npx tsx to execute the typescript generators
        const agentPath = path.resolve(__dirname, `agents/${name}`);
        // Pass workspace arg
        const child = spawn('node', ['--import', 'tsx', agentPath, `--workspace=${WORKSPACE_ID}`], {
            stdio: 'inherit',
            windowsHide: true
        });
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

