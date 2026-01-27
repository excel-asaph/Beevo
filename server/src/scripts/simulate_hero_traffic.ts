
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const SERVER_URL = 'http://127.0.0.1:3001/api/tracking/event';
const SIMULATION_COUNT = 50; // Number of "users" to simulate
const VARIANT_ID = 'hero_section_v1'; // The ID in hero_block_challenger.json

// Scenarios (Weighted Probability)
// We want to simulate a "Mediocre" performance to trigger the optimizer.
// 60% Bounce (View only)
// 30% Engaged (View + Retention)
// 10% Converted (View + Retention + Click)
const SCENARIOS = [
    { type: 'BOUNCE', weight: 0.6 },
    { type: 'ENGAGED', weight: 0.3 },
    { type: 'CONVERTED', weight: 0.1 }
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
        // console.log(`[${sessionId.slice(0, 4)}] Sent ${eventName}`);
    } catch (error: any) {
        console.error(`Error sending ${eventName}:`, error.message);
    }
}

async function simulateUser(index: number) {
    const sessionId = uuidv4();
    const scenario = pickScenario();

    console.log(`[User ${index + 1}/${SIMULATION_COUNT}] Scenario: ${scenario}`);

    // 1. Always View
    await sendEvent(sessionId, 'view_component');

    if (scenario === 'BOUNCE') {
        return; // User left immediately
    }

    // 2. Retention (Simulate watching the video for 3s)
    await new Promise(r => setTimeout(r, 100)); // Tiny delay for order
    await sendEvent(sessionId, 'retention_trigger', { duration: 3000 });

    if (scenario === 'ENGAGED') {
        return; // User watched but didn't click
    }

    // 3. Click (Conversion)
    await new Promise(r => setTimeout(r, 100));
    await sendEvent(sessionId, 'click_cta', { target: 'scroll_to_offer' });
}

function pickScenario() {
    const random = Math.random();
    let sum = 0;
    for (const s of SCENARIOS) {
        sum += s.weight;
        if (random < sum) return s.type;
    }
    return 'BOUNCE';
}

async function main() {
    console.log("🚀 Starting Traffic Simulation for Hero Block...");
    console.log(`Target Variant: ${VARIANT_ID}`);
    console.log(`Users: ${SIMULATION_COUNT}`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i);
        // Small delay between users to look somewhat natural in logs
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("✅ Simulation Complete.");
}

main().catch(console.error);
