
import axios from 'axios';
import { WS_CONFIG } from '../../../shared/constants.js';

const API_BASE = `http://127.0.0.1:${WS_CONFIG.SERVER_PORT || 3001}/api/hitl`;

/**
 * Client for interacting with the internal Notification/HITL API.
 * Used by agents or services to request user approval.
 */
export class NotificationClient {
    private static instance: NotificationClient;

    private constructor() { }

    /**
     * Retrieves the singleton instance of NotificationClient.
     * 
     * @returns {NotificationClient} The NotificationClient instance.
     */
    public static getInstance(): NotificationClient {
        if (!NotificationClient.instance) {
            NotificationClient.instance = new NotificationClient();
        }
        return NotificationClient.instance;
    }

    /**
     * Blocks execution until the request is Approved or Rejected.
     * Returns true if Approved, false if Rejected.
     */
    /**
     * Sends an approval request to the system and waits for a response (Approved/Rejected).
     * Blocks execution until resolved or returns immediately if auto-approved.
     * 
     * @param {string} section - The section requesting approval.
     * @param {'PRE_GENERATION' | 'POST_GENERATION'} type - The type of intervention.
     * @param {string} message - The explanation message.
     * @param {any} [proposal] - Optional proposal data.
     * @param {string} [workspaceId='default'] - The workspace identifier.
     * @returns {Promise<{ approved: boolean; feedback?: string }>} The result of the request.
     */
    async requestApproval(
        section: string,
        type: 'PRE_GENERATION' | 'POST_GENERATION',
        message: string,
        proposal?: any,
        workspaceId: string = 'default'
    ): Promise<{ approved: boolean; feedback?: string }> {
        try {
            // 1. Send Request
            const response = await axios.post(`${API_BASE}/request`, {
                section,
                type,
                message,
                proposal
            }, {
                headers: {
                    'x-workspace-id': workspaceId
                }
            });

            const { id, status } = response.data;

            if (status === 'AUTO_APPROVED') {
                return { approved: true };
            }

            console.log(`🚦 HITL: Waiting for approval... (ID: ${id})`);

            // 2. Poll for Status
            return new Promise((resolve, reject) => {
                const poll = setInterval(async () => {
                    try {
                        const check = await axios.get(`${API_BASE}/status/${id}`);
                        const reqState = check.data;

                        if (reqState.status === 'APPROVED') {
                            clearInterval(poll);
                            resolve({ approved: true, feedback: reqState.feedback });
                        } else if (reqState.status === 'REJECTED') {
                            clearInterval(poll);
                            resolve({ approved: false });
                        }
                        // Else keep polling
                    } catch (e) {
                        console.error("HITL Poll Error:", e);
                        // Optional: Retry logic or abort
                    }
                }, 1000); // Check every second
            });

        } catch (error) {
            console.error("❌ HITL Request Failed. defaulting to Safe Mode (Aborting).", error);
            return { approved: false };
        }
    }
}

