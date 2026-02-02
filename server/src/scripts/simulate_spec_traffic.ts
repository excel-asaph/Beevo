
import { v4 as uuidv4 } from 'uuid';
import { getLiveState, sendSyntheticEvent } from './simulation_utils';

const SIMULATION_COUNT = 30;

// Interaction scenarios
const SCENARIOS = [
    { type: 'BOUNCER', weight: 0.4, nodes: 0, dwell: [200, 800] },
    { type: 'INTERACTOR', weight: 0.4, nodes: 2, dwell: [2000, 5000] },
    { type: 'POWER_USER', weight: 0.2, nodes: 4, dwell: [6000, 12000] }
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

    if (index % 10 === 0) console.log(`[User ${index + 1}/${SIMULATION_COUNT}] ${scenario.type} | Dwell: ${dwellMs}ms | Nodes: ${scenario.nodes}`);

    // 0. Page View (Strict Separation)
    await sendSyntheticEvent(sessionId, state.hash, 'page_root', 'view_page');

    // 1. Initial View
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_component');

    // 2. Simulate interactions
    for (let i = 0; i < scenario.nodes; i++) {
        await new Promise(r => setTimeout(r, 200));
        await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'spec_interaction', {
            data: { nodeId: `spec-0${i + 1}`, action: 'click' }
        });
    }

    // 3. Dwell Summary
    await new Promise(r => setTimeout(r, 100));
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'spec_dwell_summary', { meta: { dwell_ms: dwellMs } });
}

async function main() {
    console.log("🚀 Starting SMART Traffic Simulation for Spec Block...");

    // Dynamically resolve the LIVE Spec Block ID
    const state = await getLiveState('spec');

    console.log(`🎯 Target: State=[${state.hash}] Variant=[${state.variantId}]`);
    console.log(`🤖 Count: ${SIMULATION_COUNT} (Synthetic Users)`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i, state);
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("✅ Simulation Complete. Metrics sent to synthetic log.");
}

main().catch(console.error);
