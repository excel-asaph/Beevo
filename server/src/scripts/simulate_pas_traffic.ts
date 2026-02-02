
import { v4 as uuidv4 } from 'uuid';
import { getLiveState, sendSyntheticEvent } from './simulation_utils';

const SIMULATION_COUNT = 30;

// Scenarios for PAS (Problem-Agitation-Solution)
const SCENARIOS = [
    { type: 'SCROLLER', weight: 0.4, min: 1000, max: 2500 }, // Reads problem, leaves
    { type: 'AGITATED', weight: 0.4, min: 3000, max: 5000 }, // Reads agitation
    { type: 'SOLVED', weight: 0.2, min: 6000, max: 10000 }  // Reads full solution
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
    const dwellMs = Math.floor(Math.random() * (scenario.max - scenario.min + 1)) + scenario.min;

    if (index % 10 === 0) console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms`);

    // 0. Page View (Strict Separation)
    await sendSyntheticEvent(sessionId, state.hash, 'page_root', 'view_page');

    // 1. Initial View
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_component');

    // 2. Retention (If dwelled > 3s)
    // 2. Retention (SKIPPED: PASBlock does not track retention/view_3s)
    // if (dwellMs > 3000) { ... }

    // 3. Dwell Summary
    await new Promise(r => setTimeout(r, 50));
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'pas_dwell_summary', { meta: { dwell_ms: dwellMs } });
}

async function main() {
    console.log("🚀 Starting SMART Traffic Simulation for PAS Block...");

    // Dynamically resolve the LIVE PAS Block ID
    const state = await getLiveState('pas');

    console.log(`🎯 Target: State=[${state.hash}] Variant=[${state.variantId}]`);
    console.log(`🤖 Count: ${SIMULATION_COUNT} (Synthetic Users)`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i, state);
        await new Promise(r => setTimeout(r, 20));
    }

    console.log("✅ Simulation Complete. Metrics sent to synthetic log.");
}

main().catch(console.error);
