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

async function runScript(scriptName: string, workspaceId: string) {
    return new Promise<void>((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        console.log(`🚀 [${workspaceId}] Launching: ${scriptName}`);

        // Construct arguments
        const args = ['tsx', `"${scriptPath}"`, `--workspace=${workspaceId}`];

        // Use 'npx tsx' to execute the script
        // Quote path to handle spaces in 'Github Projects'
        const child = spawn('npx', args, {
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ [${workspaceId}] Finished: ${scriptName}`);
                resolve();
            } else {
                console.error(`❌ [${workspaceId}] Failed: ${scriptName} (Code: ${code})`);
                reject(new Error(`Script ${scriptName} failed`));
            }
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    console.log(`🌪️ Starting ALL Traffic Simulators for Workspace: ${workspaceId}...`);

    // Run them in parallel using Promise.all
    try {
        await Promise.all(SCRIPTS.map(script => runScript(script, workspaceId)));
        console.log("\n✨ ALL SIMULATIONS COMPLETE ✨");
    } catch (e) {
        console.error("\n💥 A simulator crashed:", e);
    }
}

main();

