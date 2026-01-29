import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const SERVER_URL = 'http://127.0.0.1:3001/api/tracking/event';
const SIMULATION_COUNT = 25;
const VARIANT_ID = 'offer_section_v1';

// Conversion scenarios
const SCENARIOS = [
    { type: 'BOUNCER', weight: 0.6, dwell: [500, 2000], click: false },
    { type: 'CONSIDERER', weight: 0.3, dwell: [4000, 10000], click: true, tier: 'starter' },
    { type: 'HIGH_INTENT', weight: 0.1, dwell: [8000, 15000], click: true, tier: 'pro' }
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

    console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Click: ${scenario.click}`);

    // 1. Initial View
    await sendEvent(sessionId, 'view_component');

    // 2. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendEvent(sessionId, 'offer_dwell_summary', { meta: { dwell_ms: dwellMs } });

    // 3. Optional Click
    if (scenario.click) {
        await new Promise(r => setTimeout(r, 500));
        await sendEvent(sessionId, 'offer_cta_click', {
            meta: { tierId: scenario.tier, action: 'select_plan' }
        });
    }
}

async function main() {
    console.log("🚀 Starting Traffic Simulation for Offer Block...");
    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i);
        await new Promise(r => setTimeout(r, 50));
    }
    console.log("✅ Simulation Complete.");
}

main().catch(console.error);
