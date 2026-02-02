
import { v4 as uuidv4 } from 'uuid';
import { getLiveState, sendSyntheticEvent } from './simulation_utils';

const SIMULATION_COUNT = 25;

// Conversion scenarios
const SCENARIOS = [
    { type: 'BOUNCER', weight: 0.6, dwell: [500, 2000], click: false },
    { type: 'CONSIDERER', weight: 0.3, dwell: [4000, 10000], click: true, tier: 'starter' },
    { type: 'HIGH_INTENT', weight: 0.1, dwell: [8000, 15000], click: true, tier: 'pro' }
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

    if (index % 5 === 0) console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Click: ${scenario.click}`);

    // 0. Page View (Strict Separation)
    await sendSyntheticEvent(sessionId, state.hash, 'page_root', 'view_page');

    // 1. Initial View
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_component');

    // 2. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'offer_dwell_summary', { meta: { dwell_ms: dwellMs } });

    // 3. Optional Click
    if (scenario.click) {
        await new Promise(r => setTimeout(r, 50));
        await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'offer_cta_click', {
            meta: { tierId: scenario.tier, action: 'select_plan' }
        });
    }
}

async function main() {
    console.log("🚀 Starting SMART Traffic Simulation for Offer Block...");

    // Dynamically resolve the LIVE Offer Block ID
    const state = await getLiveState('offer');

    console.log(`🎯 Target: State=[${state.hash}] Variant=[${state.variantId}]`);
    console.log(`🤖 Count: ${SIMULATION_COUNT} (Synthetic Users)`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i, state);
        await new Promise(r => setTimeout(r, 20));
    }

    console.log("✅ Simulation Complete. Metrics sent to synthetic log.");
}

main().catch(console.error);
