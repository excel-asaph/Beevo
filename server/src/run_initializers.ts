
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { DatabaseService } from './services/DatabaseService.js';
import { StateCoordinator } from './utils/StateCoordinator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, '../../client/public/assets');
const HISTORY_DIR = path.resolve(__dirname, '../../client/public/assets/history');
const STATES_DIR = path.resolve(__dirname, '../../client/public/assets/states');
const DB_PATH = path.resolve(__dirname, '../brain/beevo_history.db');

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
        console.log(`\n🚀 Starting ${name}...`);
        // Use npx tsx to execute the typescript generators
        const agentPath = path.resolve(__dirname, `agents/${name}`);
        const child = spawn('npx.cmd', ['tsx', `"${agentPath}"`], {
            stdio: 'inherit',
            shell: true
        });
        child.on('close', resolve);
    });
}

async function cleanSlate() {
    console.log("🧹 CLEANING SLATE: Deleting History and Database...");

    // 1. Truncate DB Tables (Fixes Windows File Lock Issue)
    console.log("   - Truncating Database Tables...");
    try {
        const db = DatabaseService.getInstance();
        await db.initialize(); // Ensure connection
        await db.get('DELETE FROM page_states');
        await db.get('DELETE FROM lead_submissions');
        console.log("   - Tables Cleared.");
    } catch (e) {
        console.error("   - Failed to clear tables:", e);
    }

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

    console.log("✨ Slate Cleaned.");
}

async function main() {
    console.log("🔥 STARTING FULL SYSTEM RESET & INITIALIZATION 🔥");

    await cleanSlate();

    console.log("\n🚀 IGNITING INITIAL GENERATORS...");

    for (const gen of GENERATORS) {
        await runGenerator(gen);
    }

    // Final Seal to create State Zero
    console.log("\n🛡️ SEALING STATE ZERO...");
    await StateCoordinator.getInstance().sealState("System Initialization (State Zero)");

    console.log("\n✅ SYSTEM RESET COMPLETE.");
}

main().catch(console.error);
