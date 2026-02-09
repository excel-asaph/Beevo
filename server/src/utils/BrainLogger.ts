import * as fs from 'fs';
import * as path from 'path';

/**
 * Static logger for low-level system activity ("Brain" activity).
 * Logs to a local file `brain_activity.log`.
 */
export class BrainLogger {
    private static logPath = path.join(process.cwd(), 'brain_activity.log');
    private static sessionStart = new Date().toISOString();

    /**
     * Appends a log entry to the brain activity log.
     * 
     * @param {string} category - The category of the log (e.g., 'SYSTEM', 'MEMORY').
     * @param {string} message - The log message.
     * @param {any} [data] - Optional data to log details for.
     */
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

    /**
     * Clears the brain activity log and writes a session start header.
     */
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
