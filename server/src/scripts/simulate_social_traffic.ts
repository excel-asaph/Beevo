
import { v4 as uuidv4 } from 'uuid';
import { getLiveState, sendSyntheticEvent } from './simulation_utils';

const SIMULATION_COUNT = 30;

// Trust scenarios
const SCENARIOS = [
    { type: 'SKEPTIC', weight: 0.4, dwell: [800, 1500], velocity: [1500, 3000] }, // Scrolls fast
    { type: 'READER', weight: 0.4, dwell: [3000, 6000], velocity: [200, 800] },   // Reads testimonials
    { type: 'DEEP_DIVER', weight: 0.2, dwell: [8000, 15000], velocity: [50, 150] } // Pauses long
];

function pickScenario() {
    const random = Math.random();
    let sum = 0;
    for (const s of SCENARIOS) {
        sum += s.weight;
        if (random < sum) return s;
    }
    return SCENARIOS[0];
}

async function simulateUser(index: number, state: { hash: string, variantId: string }) {
    const sessionId = uuidv4();
    const scenario = pickScenario();
    const dwellMs = Math.floor(Math.random() * (scenario.dwell[1] - scenario.dwell[0] + 1)) + scenario.dwell[0];
    const velocity = Math.floor(Math.random() * (scenario.velocity[1] - scenario.velocity[0] + 1)) + scenario.velocity[0];

    if (index % 10 === 0) console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Velocity: ${velocity}px/s`);

    // 0. Page View (Strict Separation)
    await sendSyntheticEvent(sessionId, state.hash, 'page_root', 'view_page');

    // 1. Initial View
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_component');

    // 2. Retention (view_3s) - Matches Frontend SocialBlock
    if (dwellMs > 3000) {
        await new Promise(r => setTimeout(r, 50));
        await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_3s', { duration: 3000 });
    }

    // 3. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'social_dwell_summary', { meta: { dwell_ms: dwellMs } });

    // 3. Velocity Signal
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'social_scroll_velocity', { meta: { velocity: velocity } });
}

async function main() {
    console.log("🚀 Starting SMART Traffic Simulation for Social Block...");

    // Dynamically resolve the LIVE Social Block ID
    const state = await getLiveState('social');

    console.log(`🎯 Target: State=[${state.hash}] Variant=[${state.variantId}]`);
    console.log(`🤖 Count: ${SIMULATION_COUNT} (Synthetic Users)`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i, state);
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("✅ Simulation Complete. Metrics sent to synthetic log.");
}

main().catch(console.error);
