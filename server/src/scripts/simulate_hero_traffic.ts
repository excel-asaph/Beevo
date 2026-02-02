
import { v4 as uuidv4 } from 'uuid';
import { getLiveState, sendSyntheticEvent, pickScenario } from './simulation_utils';

const SIMULATION_COUNT = 50;

// Scenarios
const SCENARIOS = [
    { type: 'BOUNCE', weight: 0.6 },
    { type: 'ENGAGED', weight: 0.3 },
    { type: 'CONVERTED', weight: 0.1 }
];

async function simulateUser(index: number, state: { hash: string, variantId: string }) {
    const sessionId = uuidv4();
    const scenario = pickScenario(SCENARIOS);

    if (index % 10 === 0) console.log(`[User ${index + 1}/${SIMULATION_COUNT}] Scenario: ${scenario}`);

    // 0. Page View (Always happens first)
    // Note: We send this to 'page_root' component ID ideally, but for now we focus on the component testing.
    // If the system expects page_root events to be separate, we might need a separate call.
    await sendSyntheticEvent(sessionId, state.hash, 'page_root', 'view_page');

    // 1. Component View
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_component');

    if (scenario === 'BOUNCE') return;

    // 2. Retention (view_3s)
    await new Promise(r => setTimeout(r, 50));
    // Use view_3s to match Frontend HeroBlock behavior
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'view_3s', { duration: 3000 });

    if (scenario === 'ENGAGED') return;

    // 3. Click
    await new Promise(r => setTimeout(r, 50));
    await sendSyntheticEvent(sessionId, state.hash, state.variantId, 'cta_click', { target: 'scroll_to_offer' });
}

async function main() {
    console.log("🚀 Starting SMART Traffic Simulation for Hero Block...");

    // Dynamically resolve the LIVE Hero Block ID
    const state = await getLiveState('hero');

    console.log(`🎯 Target: State=[${state.hash}] Variant=[${state.variantId}]`);
    console.log(`🤖 Count: ${SIMULATION_COUNT} (Synthetic Users)`);

    for (let i = 0; i < SIMULATION_COUNT; i++) {
        await simulateUser(i, state);
        await new Promise(r => setTimeout(r, 20));
    }

    console.log("✅ Simulation Complete. Metrics sent to synthetic log.");
}

main().catch(console.error);
