import * as fs from 'fs';
import * as path from 'path';

/**
 * ResearchLogger - Detailed logging for research phases
 * Captures: Inputs, Tool Calls, Outputs, UI Messages
 */
export class ResearchLogger {
    private static logPath = path.join(process.cwd(), 'research_debug.log');
    private static sessionId = Date.now().toString(36);

    static startSession(brandName: string, industry: string) {
        const header = `
╔════════════════════════════════════════════════════════════════════╗
║                    RESEARCH SESSION STARTED                         ║
║  Session ID: ${this.sessionId.padEnd(52)}║
║  Brand: ${brandName.padEnd(57)}║
║  Industry: ${industry.padEnd(54)}║
║  Time: ${new Date().toISOString().padEnd(57)}║
╚════════════════════════════════════════════════════════════════════╝
`;
        fs.writeFileSync(this.logPath, header);
    }

    static phase(phaseIndex: number, phaseName: string) {
        const divider = `
┌──────────────────────────────────────────────────────────────────────┐
│  PHASE ${phaseIndex}: ${phaseName.toUpperCase().padEnd(56)}│
│  Time: ${new Date().toISOString().padEnd(58)}│
└──────────────────────────────────────────────────────────────────────┘
`;
        this.append(divider);
    }

    static input(label: string, value: any) {
        const formatted = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        this.append(`📥 INPUT [${label}]:\n${formatted}\n`);
    }

    static toolCall(toolName: string, args: any) {
        this.append(`🔧 TOOL CALL: ${toolName}`);
        this.append(`   Arguments: ${JSON.stringify(args, null, 2)}\n`);
    }

    static toolResult(toolName: string, result: any) {
        const formatted = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        this.append(`✅ TOOL RESULT [${toolName}]:\n${formatted.slice(0, 2000)}${formatted.length > 2000 ? '...[TRUNCATED]' : ''}\n`);
    }

    static aiPrompt(purpose: string, prompt: string) {
        this.append(`🤖 AI PROMPT [${purpose}]:\n${prompt.slice(0, 1500)}${prompt.length > 1500 ? '...[TRUNCATED]' : ''}\n`);
    }

    static aiResponse(purpose: string, response: string) {
        this.append(`🤖 AI RESPONSE [${purpose}]:\n${response.slice(0, 2000)}${response.length > 2000 ? '...[TRUNCATED]' : ''}\n`);
    }

    static uiMessage(type: string, data: any) {
        this.append(`📤 UI MESSAGE [${type}]:\n${JSON.stringify(data, null, 2)}\n`);
    }

    static output(label: string, value: any) {
        const formatted = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        this.append(`📦 OUTPUT [${label}]:\n${formatted}\n`);
    }

    static thought(stepIndex: number, text: string) {
        this.append(`💭 THOUGHT [Step ${stepIndex}]: ${text}`);
    }

    static error(context: string, error: any) {
        this.append(`❌ ERROR [${context}]: ${error?.message || error}\n${error?.stack || ''}\n`);
    }

    static separator() {
        this.append('────────────────────────────────────────────────────────────────────────\n');
    }

    static endSession(summary: any) {
        const footer = `
╔════════════════════════════════════════════════════════════════════╗
║                    RESEARCH SESSION COMPLETE                        ║
║  Time: ${new Date().toISOString().padEnd(57)}║
╚════════════════════════════════════════════════════════════════════╝

SUMMARY:
${JSON.stringify(summary, null, 2)}
`;
        this.append(footer);
    }

    private static append(text: string) {
        try {
            fs.appendFileSync(this.logPath, text + '\n');
        } catch (e) {
            console.error('ResearchLogger write failed:', e);
        }
    }
}
