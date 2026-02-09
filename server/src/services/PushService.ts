/**
 * PushService - Handles Web Push notifications for HITL interventions
 * 
 * Features:
 * - VAPID key management
 * - Subscription storage
 * - Send push notifications with action buttons
 */

import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

interface PushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

interface StoredSubscription {
    subscription: PushSubscription;
    workspaceId: string;
    createdAt: Date;
    userAgent?: string;
}

const SUBSCRIPTIONS_FILE = path.join(process.cwd(), 'brain', 'push_subscriptions.json');

/**
 * Service to handle Web Push notifications.
 * Manages VAPID keys, subscriptions, and sending notifications.
 */
class PushService {
    private subscriptions: Map<string, StoredSubscription> = new Map(); // endpoint -> subscription
    private configured: boolean = false;

    constructor() {
        this.configure();
        this.loadSubscriptions();
    }

    private configure() {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const email = process.env.VAPID_EMAIL || 'mailto:admin@beevo.ai';

        if (publicKey && privateKey) {
            try {
                webpush.setVapidDetails(email, publicKey, privateKey);
                this.configured = true;
                console.log('🔔 Web Push configured successfully');
            } catch (e) {
                console.warn('⚠️ Failed to configure Web Push:', e);
            }
        } else {
            console.log('ℹ️ Web Push not configured (missing VAPID keys)');
        }
    }

    private loadSubscriptions() {
        try {
            if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
                const data = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'));
                data.forEach((sub: StoredSubscription) => {
                    this.subscriptions.set(sub.subscription.endpoint, sub);
                });
                console.log(`🔔 Loaded ${this.subscriptions.size} push subscriptions`);
            }
        } catch (e) {
            console.warn('⚠️ Could not load push subscriptions:', e);
        }
    }

    private saveSubscriptions() {
        try {
            const dir = path.dirname(SUBSCRIPTIONS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(
                SUBSCRIPTIONS_FILE,
                JSON.stringify(Array.from(this.subscriptions.values()), null, 2)
            );
        } catch (e) {
            console.warn('⚠️ Could not save push subscriptions:', e);
        }
    }

    isConfigured(): boolean {
        return this.configured;
    }

    getPublicKey(): string | null {
        return process.env.VAPID_PUBLIC_KEY || null;
    }

    /**
     * Subscribe a client to push notifications
     */
    /**
     * Subscribes a client to push notifications.
     * 
     * @param {PushSubscription} subscription - The web push subscription object.
     * @param {string} workspaceId - The workspace identifier.
     * @param {string} [userAgent] - Optional user agent string.
     */
    subscribe(subscription: PushSubscription, workspaceId: string, userAgent?: string): void {
        const stored: StoredSubscription = {
            subscription,
            workspaceId,
            createdAt: new Date(),
            userAgent
        };
        this.subscriptions.set(subscription.endpoint, stored);
        this.saveSubscriptions();
        console.log(`🔔 Added push subscription for workspace ${workspaceId}`);
    }

    /**
     * Unsubscribe a client
     */
    unsubscribe(endpoint: string): void {
        this.subscriptions.delete(endpoint);
        this.saveSubscriptions();
    }

    /**
     * Get subscriptions for a workspace
     */
    getSubscriptionsForWorkspace(workspaceId: string): StoredSubscription[] {
        return Array.from(this.subscriptions.values()).filter(s => s.workspaceId === workspaceId);
    }

    /**
     * Send push notification to all subscribers of a workspace
     */
    /**
     * Sends a push notification to all subscribers of a workspace.
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @param {object} payload - The notification payload.
     * @param {string} payload.title - Notification title.
     * @param {string} payload.body - Notification body text.
     * @param {string} [payload.tag] - Notification tag for grouping.
     * @param {string} [payload.icon] - Icon URL.
     * @param {string} [payload.badge] - Badge URL.
     * @param {any} [payload.data] - Custom data payload.
     * @param {object[]} [payload.actions] - Action buttons.
     */
    async sendNotification(
        workspaceId: string,
        payload: {
            title: string;
            body: string;
            tag?: string;
            icon?: string;
            badge?: string;
            data?: any;
            actions?: { action: string; title: string }[];
        }
    ): Promise<void> {
        if (!this.configured) {
            console.log('ℹ️ Web Push not configured, skipping');
            return;
        }

        const subs = this.getSubscriptionsForWorkspace(workspaceId);
        if (subs.length === 0) {
            console.log('📭 No push subscriptions for workspace');
            return;
        }

        const payloadStr = JSON.stringify(payload);

        for (const stored of subs) {
            try {
                await webpush.sendNotification(stored.subscription, payloadStr);
                console.log(`🔔 Sent push notification to ${stored.subscription.endpoint.slice(0, 50)}...`);
            } catch (e: any) {
                if (e.statusCode === 410 || e.statusCode === 404) {
                    // Subscription expired or invalid
                    console.log('🗑️ Removing expired subscription');
                    this.subscriptions.delete(stored.subscription.endpoint);
                    this.saveSubscriptions();
                } else {
                    console.error('❌ Push notification failed:', e.message);
                }
            }
        }
    }

    /**
     * Send HITL intervention notification
     */
    /**
     * Sends a specialized HITL intervention notification using push.
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @param {object} intervention - Intervention details.
     * @param {string} intervention.id - Intervention ID.
     * @param {string} intervention.section - Section name.
     * @param {'pre' | 'post'} intervention.type - Intervention type.
     * @param {string} intervention.message - Message content.
     */
    async sendInterventionNotification(
        workspaceId: string,
        intervention: {
            id: string;
            section: string;
            type: 'pre' | 'post';
            message: string;
        }
    ): Promise<void> {
        const typeLabel = intervention.type === 'pre' ? 'Permission to Think' : 'Permission to Commit';

        await this.sendNotification(workspaceId, {
            title: `🤖 ${intervention.section}: ${typeLabel}`,
            body: intervention.message,
            tag: `intervention-${intervention.id}`,
            icon: '/beevo-icon-192.png',
            badge: '/beevo-badge-72.png',
            data: {
                interventionId: intervention.id,
                section: intervention.section,
                type: intervention.type,
                url: `/workspace?id=${workspaceId}#interventions`
            },
            actions: [
                { action: 'approve', title: '✅ Approve' },
                { action: 'reject', title: '❌ Reject' }
            ]
        });
    }

    /**
     * Send status update notification
     */
    async sendStatusNotification(
        workspaceId: string,
        title: string,
        body: string
    ): Promise<void> {
        await this.sendNotification(workspaceId, {
            title,
            body,
            tag: 'status-update',
            icon: '/beevo-icon-192.png'
        });
    }

    /**
     * Generate VAPID keys (one-time setup utility)
     */
    static generateVapidKeys(): { publicKey: string; privateKey: string } {
        return webpush.generateVAPIDKeys();
    }
}

// Singleton instance
export const pushService = new PushService();
export default pushService;
