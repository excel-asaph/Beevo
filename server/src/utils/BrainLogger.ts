import * as fs from 'fs';
import * as path from 'path';

export class BrainLogger {
    private static logPath = path.join(process.cwd(), 'brain_activity.log');
    private static sessionStart = new Date().toISOString();

    static log(category: string, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${category.toUpperCase()}] ${message}\n`;

        try {
            fs.appendFileSync(this.logPath, logEntry);
            if (data) {
                const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                fs.appendFileSync(this.logPath, `Details:\n${dataString}\n----------------------------------------\n`);
            }
        } catch (error) {
            console.error('Failed to write to brain log:', error);
        }
    }

    static clear() {
        try {
            fs.writeFileSync(this.logPath, `=== Brain Session Started: ${this.sessionStart} ===\n`);
        } catch (error) {
            console.error('Failed to clear brain log:', error);
        }
    }
}

// Initialize log on first import if needed, or rely on manual clear
// BrainLogger.clear();
