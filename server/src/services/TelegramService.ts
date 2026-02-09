/**
 * TelegramService - Handles Telegram Bot notifications for HITL interventions
 * 
 * Features:
 * - Send intervention requests with inline action buttons
 * - Handle callbacks for Approve/Reject/Reply
 * - Link Telegram users to workspaces
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface TelegramUser {
    chatId: string;
    workspaceId: string;
    linkedAt: Date;
    username?: string;
}

interface InterventionRequest {
    id: string;
    section: string;
    type: 'pre' | 'post';
    message: string;
    workspaceId: string;
    timestamp?: Date;
}

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const USERS_FILE = path.join(process.cwd(), 'brain', 'telegram_users.json');

/**
 * Service to handle Telegram Bot integration for notifications and HITL interventions.
 * Manages user linking, message sending, and callback handling.
 */
class TelegramService {
    private users: Map<string, TelegramUser> = new Map(); // chatId -> user

    constructor() {
        this.loadUsers();
    }

    private get token(): string {
        return process.env.TELEGRAM_BOT_TOKEN || '';
    }

    private get baseUrl(): string {
        return `${TELEGRAM_API_BASE}${this.token}`;
    }

    private loadUsers() {
        try {
            if (fs.existsSync(USERS_FILE)) {
                const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
                data.forEach((user: TelegramUser) => {
                    this.users.set(user.chatId, user);
                });
                console.log(`📱 Loaded ${this.users.size} Telegram users`);
            }
        } catch (e) {
            console.warn('⚠️ Could not load Telegram users:', e);
        }
    }

    private saveUsers() {
        try {
            const dir = path.dirname(USERS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(this.users.values()), null, 2));
        } catch (e) {
            console.warn('⚠️ Could not save Telegram users:', e);
        }
    }

    isConfigured(): boolean {
        return !!this.token && this.token.length > 10;
    }

    /**
     * Link a Telegram chat to a workspace
     */
    /**
     * Links a Telegram chat ID to a Beevo workspace.
     * 
     * @param {string} chatId - The Telegram chat ID.
     * @param {string} workspaceId - The workspace identifier.
     * @param {string} [username] - Optional Telegram username.
     */
    async linkUser(chatId: string, workspaceId: string, username?: string): Promise<void> {
        const user: TelegramUser = {
            chatId,
            workspaceId,
            linkedAt: new Date(),
            username
        };
        this.users.set(chatId, user);
        this.saveUsers();
        console.log(`🔗 Linked Telegram user ${chatId} to workspace ${workspaceId}`);

        // Send confirmation
        await this.sendMessage(chatId, `✅ *Connected to Beevo!*\n\nYou'll receive notifications when AI agents need your approval.\n\nWorkspace: \`${workspaceId.slice(0, 8)}...\``, 'Markdown');
    }

    /**
     * Unlink a Telegram chat from workspace
     */
    unlinkUser(chatId: string): void {
        this.users.delete(chatId);
        this.saveUsers();
    }

    /**
     * Get users linked to a workspace
     */
    getUsersForWorkspace(workspaceId: string): TelegramUser[] {
        return Array.from(this.users.values()).filter(u => u.workspaceId === workspaceId);
    }

    /**
     * Get user by chatId
     */
    getUserByChatId(chatId: string): TelegramUser | undefined {
        return this.users.get(chatId);
    }

    /**
     * Send a simple message
     */
    async sendMessage(chatId: string, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<any> {
        if (!this.isConfigured()) {
            console.warn('⚠️ Telegram not configured');
            return null;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: parseMode
            });
            return response.data;
        } catch (e: any) {
            console.error('❌ Telegram sendMessage error:', e.response?.data || e.message);
            return null;
        }
    }

    /**
     * Send an intervention request with action buttons
     */
    /**
     * Sends an intervention request to linked users of a workspace.
     * Includes inline buttons for Approve, Reject, and Reply.
     * 
     * @param {InterventionRequest} intervention - The intervention details.
     */
    async sendInterventionRequest(intervention: InterventionRequest): Promise<void> {
        if (!this.isConfigured()) {
            console.warn('⚠️ Telegram not configured, skipping notification');
            return;
        }

        const users = this.getUsersForWorkspace(intervention.workspaceId);
        if (users.length === 0) {
            console.log('📱 No Telegram users linked to workspace, skipping');
            return;
        }

        const typeEmoji = intervention.type === 'pre' ? '🤔' : '✨';
        const typeLabel = intervention.type === 'pre' ? 'Permission to Think' : 'Permission to Commit';

        const text = `
${typeEmoji} *Beevo Agent Alert*
━━━━━━━━━━━━━━━━━━━━━
📍 *Section:* ${intervention.section}
🏷️ *Type:* ${typeLabel}

${intervention.message}

_Tap a button below to respond:_
`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Approve', callback_data: `approve:${intervention.id}` },
                    { text: '❌ Reject', callback_data: `reject:${intervention.id}` }
                ],
                [
                    { text: '💬 Reply with Feedback', callback_data: `reply:${intervention.id}` }
                ]
            ]
        };

        for (const user of users) {
            try {
                await axios.post(`${this.baseUrl}/sendMessage`, {
                    chat_id: user.chatId,
                    text,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                console.log(`📱 Sent Telegram notification to ${user.chatId}`);
            } catch (e: any) {
                console.error(`❌ Failed to send to ${user.chatId}:`, e.response?.data || e.message);
            }
        }
    }

    /**
     * Handle callback queries from inline buttons
     */
    /**
     * Handles callback queries from Telegram inline buttons (Approve/Reject/Reply).
     * 
     * @param {any} callbackQuery - The Telegram callback query object.
     * @returns {Promise<{ action: string; interventionId: string; chatId: string } | null>} The parsed action details or null.
     */
    async handleCallback(callbackQuery: any): Promise<{ action: string; interventionId: string; chatId: string } | null> {
        const chatId = callbackQuery.message?.chat?.id;
        const data = callbackQuery.data;
        const callbackQueryId = callbackQuery.id;

        if (!data || !chatId) return null;

        const [action, interventionId] = data.split(':');

        // Acknowledge the callback
        try {
            await axios.post(`${this.baseUrl}/answerCallbackQuery`, {
                callback_query_id: callbackQueryId,
                text: action === 'reply' ? 'Send your feedback as a reply to this message' : `Action: ${action}`
            });
        } catch (e) {
            console.warn('⚠️ Could not answer callback query');
        }

        // Update the message to show action taken
        if (action !== 'reply') {
            const statusEmoji = action === 'approve' ? '✅' : '❌';
            const statusText = action === 'approve' ? 'Approved' : 'Rejected';

            try {
                await axios.post(`${this.baseUrl}/editMessageText`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    text: `${callbackQuery.message.text}\n\n${statusEmoji} *${statusText}* by you`,
                    parse_mode: 'Markdown'
                });
            } catch (e) {
                console.warn('⚠️ Could not edit message');
            }
        }

        return { action, interventionId, chatId: String(chatId) };
    }

    /**
     * Send status update (e.g., after watcher completes)
     */
    async sendStatusUpdate(workspaceId: string, message: string): Promise<void> {
        if (!this.isConfigured()) return;

        const users = this.getUsersForWorkspace(workspaceId);
        for (const user of users) {
            await this.sendMessage(user.chatId, `📊 *Status Update*\n\n${message}`);
        }
    }

    /**
     * Generate a deep link for users to start the bot
     */
    getBotLink(workspaceId: string): string {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'BeevoAgentBot';
        const startParam = Buffer.from(workspaceId).toString('base64url');
        return `https://t.me/${botUsername}?start=${startParam}`;
    }
}

// Singleton instance
export const telegramService = new TelegramService();
export default telegramService;
