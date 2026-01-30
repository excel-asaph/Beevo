import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer, WebSocket } from 'ws';
import { InterventionRequest, InterventionStatus } from '../../../shared/types.js';
import { SystemConfigService } from './SystemConfigService.js';

export class NotificationService {
    private static instance: NotificationService;
    private queue: InterventionRequest[] = [];
    private wss: WebSocketServer | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private autoProceedInterval: NodeJS.Timeout | null = null;
    private configService: SystemConfigService;

    private constructor() {
        this.configService = SystemConfigService.getInstance();
        this.startAutoProceedLoop();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public setSocketServer(wss: WebSocketServer) {
        this.wss = wss;
    }

    // Called by Watchers via HTTP
    public async requestApproval(
        section: string,
        type: 'PRE_GENERATION' | 'POST_GENERATION',
        message: string,
        proposal?: any
    ): Promise<string> {
        const config = await this.configService.getConfig();
        if (!config.hitl.enabled) {
            // If HITL disabled, auto-approve
            return 'AUTO_APPROVED';
        }

        const id = uuidv4();
        const request: InterventionRequest = {
            id,
            section,
            type,
            message,
            proposal,
            status: 'PENDING',
            timestamp: Date.now()
        };

        this.queue.push(request);
        console.log(`🚦 HITL: New Request (${type}) from ${section}. ID: ${id}`);

        this.triggerDebouncedBroadcast();
        return id;
    }

    // Called by Client via WebSocket or HTTP
    public async resolveRequest(
        id: string,
        action: InterventionStatus,
        feedback?: string
    ): Promise<void> {
        const reqIndex = this.queue.findIndex(q => q.id === id);
        if (reqIndex === -1) {
            console.warn(`⚠️ Attempted to resolve unknown request: ${id}`);
            return;
        }

        const req = this.queue[reqIndex];
        req.status = action;
        req.feedback = feedback;

        console.log(`✅ HITL: Request ${id} resolved as ${action}`);

        // If feedback provided, update SystemConfig directives automatically?
        // Optional feature: strict saves feedback to config
        if (feedback && req.section) {
            // We could verify section exists and save...
            // For now, let's keep it ephemeral passing to the watcher
        }

        // Notify Watchers (who are polling) - No action needed, state is updated.
        // Notify Client (to remove from UI)
        this.broadcastQueueUpdate();
    }

    public getRequestStatus(id: string): InterventionRequest | undefined {
        return this.queue.find(q => q.id === id);
    }

    public getPendingRequests(): InterventionRequest[] {
        return this.queue.filter(q => q.status === 'PENDING');
    }

    // --- Batching Logic ---

    private triggerDebouncedBroadcast() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.broadcastQueueUpdate();
            this.debounceTimer = null;
        }, 2000); // 2 Second Debounce
    }

    private broadcastQueueUpdate() {
        if (!this.wss) return;

        const pending = this.getPendingRequests();
        if (pending.length === 0) return;

        console.log(`📢 BROADCAST: Sending ${pending.length} pending interventions to client.`);

        const message = JSON.stringify({
            type: 'INTERVENTION_REQUIRED',
            payload: {
                count: pending.length,
                requests: pending
            }
        });

        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    private startAutoProceedLoop() {
        // Check every 30 seconds
        this.autoProceedInterval = setInterval(async () => {
            const config = await this.configService.getConfig();
            const delayMinutes = config.hitl.auto_proceed_delay_m;

            if (delayMinutes <= 0) return; // Disabled

            const now = Date.now();
            const cutoff = now - (delayMinutes * 60 * 1000);

            const staleRequests = this.queue.filter(q => q.status === 'PENDING' && q.timestamp < cutoff);

            if (staleRequests.length > 0) {
                console.log(`⏰ Auto-Proceeding ${staleRequests.length} stale requests...`);
                for (const req of staleRequests) {
                    await this.resolveRequest(req.id, 'APPROVED', 'Auto-proceed due to timeout');
                }
            }
        }, 30000);
    }
}
