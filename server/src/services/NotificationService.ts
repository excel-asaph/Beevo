import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer, WebSocket } from 'ws';
import { InterventionRequest, InterventionStatus } from '../../../shared/types.js';
import { SystemConfigFactory } from './SystemConfigService.js';
import { telegramService } from './TelegramService.js';
import { pushService } from './PushService.js';

/**
 * Service for managing HITL (Human-in-the-Loop) intervention requests.
 * Handles request creation, client broadcasting via WebSocket, and resolution.
 */
export class NotificationService {
    private static instance: NotificationService;
    private queue: (InterventionRequest & { workspaceId: string })[] = [];
    private wss: WebSocketServer | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private autoProceedInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.startAutoProceedLoop();
    }

    /**
     * Retrieves the singleton instance of NotificationService.
     * 
     * @returns {NotificationService} The NotificationService instance.
     */
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
    /**
     * Requests user approval for a specific action (Intervention).
     * 
     * @param {string} section - The section requesting approval.
     * @param {'PRE_GENERATION' | 'POST_GENERATION'} type - The type of intervention.
     * @param {string} message - The explanation message for the user.
     * @param {any} [proposal] - Optional data regarding the proposal.
     * @param {string} [workspaceId='default'] - The workspace identifier.
     * @returns {Promise<string>} The unique ID of the request, or 'AUTO_APPROVED'.
     */
    public async requestApproval(
        section: string,
        type: 'PRE_GENERATION' | 'POST_GENERATION',
        message: string,
        proposal?: any,
        workspaceId: string = 'default'
    ): Promise<string> {
        const config = await SystemConfigFactory.getInstance(workspaceId).getConfig();
        if (!config.hitl.enabled) {
            // If HITL disabled, auto-approve
            return 'AUTO_APPROVED';
        }

        const id = uuidv4();
        const request: InterventionRequest & { workspaceId: string } = {
            id,
            section,
            type,
            message,
            proposal,
            status: 'PENDING',
            timestamp: Date.now(),
            workspaceId
        };

        this.queue.push(request);
        console.log(`🚦 [${workspaceId}] HITL: New Request (${type}) from ${section}. ID: ${id}`);

        this.triggerDebouncedBroadcast();

        // Send mobile notifications
        this.sendMobileNotifications(request);

        return id;
    }

    /**
     * Send notifications to Telegram and Web Push
     */
    private async sendMobileNotifications(request: InterventionRequest & { workspaceId: string }) {
        const intervention = {
            id: request.id,
            section: request.section,
            type: request.type === 'PRE_GENERATION' ? 'pre' as const : 'post' as const,
            message: request.message,
            workspaceId: request.workspaceId
        };

        // Fire and forget - don't block the main flow
        Promise.allSettled([
            telegramService.sendInterventionRequest(intervention),
            pushService.sendInterventionNotification(request.workspaceId, intervention)
        ]).then(results => {
            const [telegram, push] = results;
            if (telegram.status === 'rejected') console.warn('⚠️ Telegram notification failed:', telegram.reason);
            if (push.status === 'rejected') console.warn('⚠️ Push notification failed:', push.reason);
        });
    }

    // Called by Client via WebSocket or HTTP
    /**
     * Resolves a pending intervention request.
     * 
     * @param {string} id - The request ID.
     * @param {InterventionStatus} action - The resolution status ('APPROVED' | 'REJECTED' | 'MODIFIED').
     * @param {string} [feedback] - Optional user feedback.
     */
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

        console.log(`✅ [${req.workspaceId}] HITL: Request ${id} resolved as ${action}`);

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
                // Ideally send only relevant requests to client if client is workspace-aware
                // request object now has workspaceId.
                // client might filter itself.
                client.send(message);
            }
        });
    }

    private startAutoProceedLoop() {
        // Check every 30 seconds
        this.autoProceedInterval = setInterval(async () => {
            const now = Date.now();
            const staleRequests = this.queue.filter(q => q.status === 'PENDING');

            // Group by workspace to minimize config fetches
            // But simple loop is fine.
            for (const req of staleRequests) {
                const config = await SystemConfigFactory.getInstance(req.workspaceId).getConfig();
                const delayMinutes = config.hitl.auto_proceed_delay_m;

                if (delayMinutes <= 0) continue; // Disabled

                const cutoff = now - (delayMinutes * 60 * 1000);
                if (req.timestamp < cutoff) {
                    console.log(`⏰ [${req.workspaceId}] Auto-Proceeding request ${req.id} due to timeout...`);
                    await this.resolveRequest(req.id, 'APPROVED', 'Auto-proceed due to timeout');
                }
            }
        }, 30000);
    }
}

