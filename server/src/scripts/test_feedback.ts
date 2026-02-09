
import { WorkspaceManager } from '../services/StateManager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFeedback() {
    console.log("🚀 Testing Feedback Serialization...");

    const mockFeedbackFromHITL: any = { text: "Make it more aggressive" };
    const mockConfigDirective = "Keep it professional";

    // This mimics the logic in the watchers:
    // const combinedFeedback = [config.feedback.hero_directive, preCheckFeedback].filter(Boolean).join('. ');

    const preCheckFeedback = mockFeedbackFromHITL; // If it's an object
    const combinedFeedback = [mockConfigDirective, preCheckFeedback].filter(Boolean).join('. ');

    console.log("\n--- RESULT ---");
    console.log(`Directive: ${mockConfigDirective}`);
    console.log(`HITL Feedback (Raw):`, mockFeedbackFromHITL);
    console.log(`Combined Feedback (Final): "${combinedFeedback}"`);

    if (combinedFeedback.includes("[object Object]")) {
        console.log("\n❌ BUG DETECTED: Feedback serialized as [object Object]");
    } else {
        console.log("\n✅ SUCCESS: Feedback correctly serialized");
    }
}

testFeedback().catch(console.error);
