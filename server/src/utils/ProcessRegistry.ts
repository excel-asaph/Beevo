import { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define path to the persistent PID file in the brain directory
const PID_FILE = path.resolve(__dirname, '../../brain/processes.json');

/**
 * ProcessRegistry - Tracks background child processes (watchers, generators)
 * associated with specific workspaces using both Memory (for active server) 
 * and Disk (for persistence across server restarts).
 */
/**
 * ProcessRegistry - Tracks background child processes (watchers, generators)
 * associated with specific workspaces using both Memory (for active server) 
 * and Disk (for persistence across server restarts).
 */
export class ProcessRegistry {
    // In-Memory map for current session management (attaching listeners, etc.)
    private static processes: Map<string, Set<ChildProcess>> = new Map();

    /**
     * Initialize/Ensure PID file exists
     */
    private static ensurePidFile() {
        if (!fs.existsSync(PID_FILE)) {
            try {
                fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
                fs.writeFileSync(PID_FILE, JSON.stringify({}), 'utf-8');
            } catch (e) {
                console.error("❌ [ProcessRegistry] Failed to init PID file:", e);
            }
        }
    }

    private static loadPids(): Record<string, number[]> {
        this.ensurePidFile();
        try {
            const data = fs.readFileSync(PID_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error("❌ [ProcessRegistry] Failed to load PIDs:", e);
            return {};
        }
    }

    private static savePids(pids: Record<string, number[]>) {
        this.ensurePidFile();
        try {
            fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2), 'utf-8');
        } catch (e) {
            console.error("❌ [ProcessRegistry] Failed to save PIDs:", e);
        }
    }

    /**
     * Register a process as belonging to a workspace
     */
    /**
     * Registers a process as belonging to a workspace.
     * Updates both in-memory tracking and disk persistence.
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @param {ChildProcess} process - The child process to track.
     */
    public static register(workspaceId: string, process: ChildProcess): void {
        const pid = process.pid;
        if (!pid) return;

        // 1. Update Memory
        if (!this.processes.has(workspaceId)) {
            this.processes.set(workspaceId, new Set());
        }
        this.processes.get(workspaceId)!.add(process);

        // 2. Update Disk Persistence
        const stored = this.loadPids();
        if (!stored[workspaceId]) stored[workspaceId] = [];
        if (!stored[workspaceId].includes(pid)) {
            stored[workspaceId].push(pid);
            this.savePids(stored);
        }

        console.log(`📌 [ProcessRegistry] Tracking PID ${pid} for ${workspaceId}`);

        // Auto-cleanup on exit (Memory & Disk)
        process.on('exit', () => {
            this.processes.get(workspaceId)?.delete(process);
            this.removePidFromDisk(workspaceId, pid);
        });
    }

    private static removePidFromDisk(workspaceId: string, pid: number) {
        const stored = this.loadPids();
        if (stored[workspaceId]) {
            stored[workspaceId] = stored[workspaceId].filter(p => p !== pid);
            if (stored[workspaceId].length === 0) {
                delete stored[workspaceId];
            }
            this.savePids(stored);
        }
    }

    /**
     * Terminate all processes for a workspace (Memory + Disk/Orphaned)
     */
    /**
     * Terminates all processes for a workspace (Memory + Disk/Orphaned).
     * Cleans up both active and persisted PIDs.
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @returns {Promise<void>}
     */
    public static async kill(workspaceId: string): Promise<void> {
        console.log(`⚔️  [ProcessRegistry] Killing processes for: ${workspaceId}`);

        // 1. Kill confirmed in-memory children (Current Session)
        const workspaceProcesses = this.processes.get(workspaceId);
        if (workspaceProcesses) {
            for (const proc of workspaceProcesses) {
                if (proc.pid) await this.killPid(proc.pid);
            }
            this.processes.delete(workspaceId);
        }

        // 2. Kill any persisted/orphaned PIDs from Disk (Previous Sessions)
        const stored = this.loadPids();
        const pids = stored[workspaceId] || [];

        if (pids.length > 0) {
            console.log(`🧹 [ProcessRegistry] Found ${pids.length} persisted PIDs to clean up...`);
            for (const pid of pids) {
                await this.killPid(pid);
            }
            // Clean up disk
            delete stored[workspaceId];
            this.savePids(stored);
        }
    }

    /**
     * Cross-Platform Kill Logic
     * Windows: taskkill /F /T /PID <pid> (Kills tree + force)
     * Linux/Mac: process.kill(pid, 'SIGTERM') (Standard signal)
     */
    private static async killPid(pid: number): Promise<void> {
        return new Promise((resolve) => {
            try {
                if (process.platform === 'win32') {
                    // Windows: Forcefully kill the process tree (cmd.exe + node.exe)
                    import('child_process').then(({ exec }) => {
                        exec(`taskkill /pid ${pid} /T /F`, (err) => {
                            if (err) {
                                // Ignore "process not found" errors (already dead)
                                if (!err.message.includes('not found')) {
                                    console.warn(`   ⚠️ Failed to taskkill PID ${pid}:`, err.message);
                                }
                            } else {
                                console.log(`   💀 [Windows] Taskkill success: ${pid}`);
                            }
                            resolve();
                        });
                    });
                } else {
                    // Linux/Mac: Standard POSIX signal
                    process.kill(pid, 'SIGTERM');
                    console.log(`   💀 [Linux/Mac] SIGTERM sent: ${pid}`);
                    resolve();
                }
            } catch (e: any) {
                // Ignore "ESRCH" (Process not found / already dead)
                if (e.code !== 'ESRCH') {
                    console.warn(`   ⚠️ Failed to kill PID ${pid}:`, e.message);
                }
                resolve();
            }
        });
    }

    /**
     * Check if a workspace has active processes (Memory OR Disk)
     */
    /**
     * Checks if a workspace has active processes (Memory OR Disk).
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @returns {boolean} True if tracking processes, false otherwise.
     */
    public static isTracking(workspaceId: string): boolean {
        // Check Memory
        if (this.processes.has(workspaceId) && this.processes.get(workspaceId)!.size > 0) return true;

        // Check Disk
        const stored = this.loadPids();
        return !!(stored[workspaceId] && stored[workspaceId].length > 0);
    }
}
