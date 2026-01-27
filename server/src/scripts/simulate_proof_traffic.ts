import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const SERVER_URL = 'http://127.0.0.1:3001/api/tracking/event';
const SIMULATION_COUNT = 40;
const VARIANT_ID = 'proof_section_v1';

// Scenarios for Dwell Time
// Target Dwell Time for Success is usually > 2000ms.
// 50% Skimmers (Fast scroll, low dwell: 400-800ms)
// 30% Readers (Medium dwell: 1500-2500ms)
// 20% Deep Divers (High dwell: 3000-6000ms)

const SCENARIOS = [
    { type: 'SKIMMER', weight: 0.5, min: 400, max: 900 },
    { type: 'READER', weight: 0.3, min: 1800, max: 2800 },
    { type: 'DIVER', weight: 0.2, min: 3500, max: 7000 }
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
        console.error(`Error sending ${eventName}:`, error.message);
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

    // Random dwell time within scenario range
    const dwellMs = Math.floor(Math.random() * (scenario.max - scenario.min + 1)) + scenario.min;

    console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms`);

    // 1. Initial View
    await sendEvent(sessionId, 'view_component');

    // 2. Dwell Summary (Simulate the event sent when user leaves the block)
    await new Promise(r => setTimeout(r, 100));
    await sendEvent(sessionId, 'proof_dwell_summary', { meta: { dwell_ms: dwellMs } });
}

async function main() {
    console.log("🚀 Starting Traffic Simulation for Proof Block...");
    console.log(`Target Variant: ${VARIANT_ID}`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i);
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("✅ Simulation Complete.");
}

main().catch(console.error);
