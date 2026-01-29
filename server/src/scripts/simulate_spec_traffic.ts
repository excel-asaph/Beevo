import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const SERVER_URL = 'http://127.0.0.1:3001/api/tracking/event';
const SIMULATION_COUNT = 30;
const VARIANT_ID = 'spec_section_v1';

// Interaction scenarios
const SCENARIOS = [
    { type: 'BOUNCER', weight: 0.4, nodes: 0, dwell: [200, 800] },
    { type: 'INTERACTOR', weight: 0.4, nodes: 2, dwell: [2000, 5000] },
    { type: 'POWER_USER', weight: 0.2, nodes: 4, dwell: [6000, 12000] }
];

async function sendEvent(sessionId: string, eventName: string, payload: any = {}) {
    try {
        await axios.post(SERVER_URL, {
            sessionId,
            timestamp: Date.now(),
            eventType: eventName,
            componentId: VARIANT_ID,
            ...payload
        });
    } catch (error: any) {
        // console.error(`Error sending ${eventName}:`, error.message);
    }
}

function pickScenario() {
    const random = Math.random();
    let sum = 0;
    for (const s of SCENARIOS) {
        sum += s.weight;
        if (random < sum) return s;
    }
    return SCENARIOS[0];
}

async function simulateUser(index: number) {
    const sessionId = uuidv4();
    const scenario = pickScenario();
    const dwellMs = Math.floor(Math.random() * (scenario.dwell[1] - scenario.dwell[0] + 1)) + scenario.dwell[0];

    console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Nodes: ${scenario.nodes}`);

    // 1. Initial View
    await sendEvent(sessionId, 'view_component');

    // 2. Simulate interactions
    for (let i = 0; i < scenario.nodes; i++) {
        await new Promise(r => setTimeout(r, 500));
        await sendEvent(sessionId, 'spec_interaction', {
            data: { nodeId: `spec-0${i + 1}`, action: 'click' }
        });
    }

    // 3. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendEvent(sessionId, 'spec_dwell_summary', { meta: { dwell_ms: dwellMs } });
}

async function main() {
    console.log("🚀 Starting Traffic Simulation for Spec Block...");
    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i);
        await new Promise(r => setTimeout(r, 50));
    }
    console.log("✅ Simulation Complete.");
}

main().catch(console.error);
