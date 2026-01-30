import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Configuration: Frequency of Watcher Runs
const RUN_INTERVAL_MS = 180 * 1000; // 3 Minute

console.log(`⏰ Watcher Orchestrator started. Running every ${RUN_INTERVAL_MS / 1000}s`);

const runWatchers = async () => {
    console.log(`\n🚀 [${new Date().toLocaleTimeString()}] Triggering Watcher Fleet...`);

    const promises = WATCHERS.map(watcher => {
        return new Promise<void>((resolve) => {
            const watcherPath = path.resolve(__dirname, 'agents', watcher);

            // Use ts-node or node depending on setup. Assuming ts-node via npx or similar for dev.
            // For production, these should be compiled JS. 
            // We use 'npx tsx' to run typescript files directly.
            // Quote the path to handle spaces in directory names
            const child = spawn('npx', ['tsx', `"${watcherPath}"`], {
                stdio: 'inherit',
                shell: true
            });

            child.on('close', (code) => {
                console.log(`✅ ${watcher} finished (Exit Code: ${code})`);
                resolve();
            });

            child.on('error', (err) => {
                console.error(`❌ ${watcher} failed:`, err);
                resolve();
            });
        });
    });

    await Promise.all(promises);

    // NEW: Seal the state if any changes were staged by the watchers
    console.log("🛡️  Orchestrator: Sealing any staged improvements...");
    await StateCoordinator.getInstance().sealState("Optimization Fleet: Automated Cycle");

    console.log(`💤 Fleet dormant. Waiting for next cycle...`);
};

// Initial Run
runWatchers();

// Scheduled Loop
setInterval(runWatchers, RUN_INTERVAL_MS);
