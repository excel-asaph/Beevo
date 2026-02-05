
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Workspace Resolution
const args = process.argv.slice(2);
const workspaceArg = args.find(a => a.startsWith('--workspace='));
const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

const API_BASE = 'http://127.0.0.1:3001';
const EVENT_URL = `${API_BASE}/api/tracking/event`;
const CONFIG_URL = `${API_BASE}/api/config`;

const client = axios.create({
    headers: {
        'x-workspace-id': workspaceId
    }
});

export async function getLiveState(blockName: string) {
    try {
        console.log(`🔍 [${workspaceId}] Fetching Active System Config...`);
        const configRes = await client.get(CONFIG_URL);
        const config = configRes.data;

        if (!config.current_state_hash) {
            throw new Error("No active state hash found in config");
        }

        const assetsPath = config.active_assets_path || '';
        const assetsDir = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}/assets`);
        const targetDir = path.join(assetsDir, assetsPath);

        console.log(`📂 [${workspaceId}] Target Asset Dir: ${assetsPath || 'root'}`);

        const fileName = `${blockName}_block.json`;
        const filePath = path.join(targetDir, fileName);

        if (!fs.existsSync(filePath)) {
            // Fallback: Try looking for challenger if block not found? 
            // Or just fail.
            throw new Error(`Block file not found: ${filePath}`);
        }

        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        return {
            hash: config.current_state_hash,
            variantId: content.variant_id
        };

    } catch (e: any) {
        console.error(`❌ Failed to resolve live state for ${blockName}:`, e.message);
        process.exit(1);
    }
}

export async function sendSyntheticEvent(sessionId: string, stateHash: string, variantId: string, eventName: string, payload: any = {}) {
    try {
        await client.post(EVENT_URL, {
            sessionId,
            sessionType: 'synthetic',
            timestamp: Date.now(),
            eventType: eventName,
            componentId: variantId,
            stateHash: stateHash,
            ...payload
        });
    } catch (error: any) {
        console.error(`Error sending ${eventName}:`, error.message);
    }
}

export function pickScenario(scenarios: { type: string, weight: number }[]) {
    const random = Math.random();
    let sum = 0;
    for (const s of scenarios) {
        sum += s.weight;
        if (random < sum) return s.type;
    }
    return scenarios[0].type;
}
