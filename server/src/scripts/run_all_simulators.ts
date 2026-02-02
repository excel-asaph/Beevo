import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIPTS = [
    'simulate_hero_traffic.ts',
    'simulate_proof_traffic.ts',
    'simulate_pas_traffic.ts',
    'simulate_spec_traffic.ts',
    'simulate_social_traffic.ts',
    'simulate_offer_traffic.ts'
];

async function runScript(scriptName: string) {
    return new Promise<void>((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        console.log(`🚀 Launching: ${scriptName}`);

        // Use 'npx tsx' to execute the script
        // Quote path to handle spaces in 'Github Projects'
        const child = spawn('npx', ['tsx', `"${scriptPath}"`], {
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Finished: ${scriptName}`);
                resolve();
            } else {
                console.error(`❌ Failed: ${scriptName} (Code: ${code})`);
                reject(new Error(`Script ${scriptName} failed`));
            }
        });
    });
}

async function main() {
    console.log("🌪️ Starting ALL Traffic Simulators...");

    // Run them in parallel using Promise.all
    try {
        await Promise.all(SCRIPTS.map(runScript));
        console.log("\n✨ ALL SIMULATIONS COMPLETE ✨");
    } catch (e) {
        console.error("\n💥 A simulator crashed:", e);
    }
}

main();
