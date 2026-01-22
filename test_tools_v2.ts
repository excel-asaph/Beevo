
import { ToolHandler } from './server/src/gemini/ToolHandler';
import { stateManager } from './server/src/services/StateManager';

// Mock dependencies
const mockSend = (msg: any) => console.log('OUTGOING:', msg.type, msg.palettes?.length || msg.fonts?.length || msg.results?.length || '');
const mockUpdate = (field: string, val: any) => console.log('STATE UPDATE:', field, val.value || val.items);

// Initialize
const handler = new ToolHandler(mockSend, mockUpdate);

async function runTests() {
    console.log('--- TEST 1: GENERATE PALETTES ---');
    // Note: This might fail if no API key, but we'll see the flow
    try {
        const res1 = await handler.handleToolCalls([{
            id: '1', name: 'display_palette_options', args: { palette_count: 2, mood_filter: 'Cyberpunk' }
        }]);
        console.log('Result 1:', res1[0].response.result);
    } catch (e) {
        console.log('Test 1 skipped/failed (likely API key):', e.message);
    }

    console.log('\n--- TEST 2: SELECT PALETTE ---');
    const mockPalettes = [
        { id: 'p1', name: 'Neon', colors: ['#000', '#0f0'], isSelected: true },
        { id: 'p2', name: 'Dark', colors: ['#000', '#333'], isSelected: false }
    ];
    const res2 = await handler.handleToolCalls([{
        id: '2', name: 'display_palette_options', args: { palettes: mockPalettes }
    }]);
    console.log('Result 2:', res2[0].response.result);

    // Verify State Updates
    const state = stateManager.loadLatest();
    console.log('Saved DNA Colors:', state?.brandDNA?.colors?.items);
    console.log('Saved Palettes:', state?.colorPalettes?.palettes?.length);

    console.log('\n--- TEST 3: SEARCH LOGO INSPIRATION ---');
    try {
        const res3 = await handler.handleToolCalls([{
            id: '3', name: 'display_logo_inspirations', args: { search_query: 'abstract geometric' }
        }]);
        console.log('Result 3:', res3[0].response.result);
    } catch (e) {
        console.log('Test 3 skipped/failed (likely API key):', e.message);
    }

    console.log('\n--- TEST 4: SELECT LOGO INSPIRATION ---');
    const mockInspirations = [
        { id: 'logo_1', displayName: 'Logo 1', url: 'http://example.com/1.png', isSelected: true },
        { id: 'logo_2', displayName: 'Logo 2', url: 'http://example.com/2.png', isSelected: false }
    ];
    const res4 = await handler.handleToolCalls([{
        id: '4', name: 'display_logo_inspirations', args: { inspirations: mockInspirations }
    }]);
    console.log('Result 4:', res4[0].response.result);

    const state2 = stateManager.loadLatest();
    console.log('Saved Inspirations:', state2?.logoInspirations?.inspirations?.length);
    console.log('Selected Count:', state2?.logoInspirations?.inspirations?.filter((i: any) => i.isSelected).length);
}

runTests().catch(console.error);
