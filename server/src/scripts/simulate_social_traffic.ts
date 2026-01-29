import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const SERVER_URL = 'http://127.0.0.1:3001/api/tracking/event';
const SIMULATION_COUNT = 30;
const VARIANT_ID = 'social_section_v1';

// Trust scenarios
const SCENARIOS = [
    { type: 'SKEPTIC', weight: 0.4, dwell: [800, 1500], velocity: [1500, 3000] }, // Scrolls fast
    { type: 'READER', weight: 0.4, dwell: [3000, 6000], velocity: [200, 800] },   // Reads testimonials
    { type: 'DEEP_DIVER', weight: 0.2, dwell: [8000, 15000], velocity: [50, 150] } // Pauses long
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
    const velocity = Math.floor(Math.random() * (scenario.velocity[1] - scenario.velocity[0] + 1)) + scenario.velocity[0];

    console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Velocity: ${velocity}px/s`);

    // 1. Initial View
    await sendEvent(sessionId, 'view_component');

    // 2. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendEvent(sessionId, 'social_dwell_summary', { meta: { dwell_ms: dwellMs } });

    // 3. Velocity Signal
    await sendEvent(sessionId, 'social_scroll_velocity', { meta: { velocity: velocity } });
}

async function main() {
    console.log("🚀 Starting Traffic Simulation for Social Block...");
    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i);
        await new Promise(r => setTimeout(r, 50));
    }
    console.log("✅ Simulation Complete.");
}

main().catch(console.error);
