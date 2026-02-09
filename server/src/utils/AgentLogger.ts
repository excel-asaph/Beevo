/**
 * Logger utility for agents to emit structured logs.
 * These logs are captured by the system orchestrator and can be broadcasted to clients.
 */
export class AgentLogger {
    private toolName: string;
    private workspaceId: string;
    private onLog?: (log: any) => void;

    /**
     * Initializes a new AgentLogger instance.
     * 
     * @param {string} toolName - The name of the tool or agent using this logger.
     * @param {string} workspaceId - The workspace identifier.
     * @param {function} [onLog] - Optional callback to handle log entries inline.
     */
    constructor(toolName: string, workspaceId: string, onLog?: (log: any) => void) {
        this.toolName = toolName;
        this.workspaceId = workspaceId;
        this.onLog = onLog;
    }

    /**
     * Core logging method that formats output with the __JSON__: prefix 
     * for the system orchestrator to capture and broadcast.
     */
    private emit(title: string, message?: string, status: 'start' | 'info' | 'success' | 'error' = 'info', data?: any) {
        const logEntry = {
            type: 'TOOL_EXECUTION_LOG',
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            toolName: this.toolName,
            title: title,
            message: message || '',
            status: status,
            args: data,
            timestamp: Date.now(),
            workspaceId: this.workspaceId
        };

        // This prefix is the "Secret Handshake" for run_watchers.ts
        console.log(`__JSON__:${JSON.stringify(logEntry)}`);

        // If a callback is provided (e.g. for in-process usage like index.ts), call it
        if (this.onLog) {
            this.onLog(logEntry);
        }
    }

    /**
     * Logs the start of an operation.
     * 
     * @param {string} title - Brief title of the operation.
     * @param {string} [message] - Detailed message.
     * @param {any} [data] - Additional data to log.
     */
    start(title: string, message?: string, data?: any) {
        this.emit(title, message, 'start', data);
    }

    /**
     * Logs an informational message.
     * 
     * @param {string} title - Brief title.
     * @param {string} [message] - Detailed message.
     * @param {any} [data] - Additional data.
     */
    info(title: string, message?: string, data?: any) {
        this.emit(title, message, 'info', data);
    }

    /**
     * Logs a success message.
     * 
     * @param {string} title - Brief title.
     * @param {string} [message] - Detailed message.
     * @param {any} [data] - Additional data.
     */
    success(title: string, message?: string, data?: any) {
        this.emit(title, message, 'success', data);
    }

    /**
     * Logs an error message.
     * 
     * @param {string} title - Brief title.
     * @param {string} [message] - Detailed message.
     * @param {any} [data] - Additional data.
     */
    error(title: string, message?: string, data?: any) {
        this.emit(title, message, 'error', data);
    }

    /**
     * Utility to log standard console messages as well, for internal debugging
     */
    console(message: string) {
        console.log(`[${this.toolName}] ${message}`);
    }
}
