import { useCallback } from 'react';
import { useConfig } from './useConfig';
import { useWorkspace } from '../context/WorkspaceContext';

/**
 * Defines the structure of a tracking event payload.
 */
export type TrackingEvent = {
    /** ID of the block/component triggering the event. */
    blockId: string;
    /** The type of interaction being tracked. */
    eventType: 'view_3s' | 'cta_click' | 'scroll_depth' | 'proof_dwell_summary' | 'pas_dwell_summary' | 'spec_dwell_summary' | 'spec_interaction' | 'social_dwell_summary' | 'social_scroll_velocity' | 'view_component' | 'offer_dwell_summary' | 'offer_cta_click' | 'view_page';
    /** Optional metadata associated with the event. */
    meta?: any;
    /** Timestamp of the event. */
    timestamp: number;
    /** Hash of the current page state for A/B testing correlation. */
    stateHash?: string;
};

/**
 * A hook for tracking user interactions and analytics events.
 * 
 * Features:
 * - Sends events to the backend tracking API.
 * - Suppresses tracking in 'Preview Mode'.
 * - Dispatches local custom events for client-side listeners (e.g., Watcher Agent).
 * - Automatically attaches session and state context.
 * 
 * @param {string} blockId - The ID of the component using this hook.
 * @returns {Object} The tracking function and readiness state.
 */
export const useTracking = (blockId: string) => {
    const { config, loading } = useConfig();

    const { workspaceId } = useWorkspace();

    const track = useCallback((eventType: TrackingEvent['eventType'], meta?: any) => {
        const stateHash = config?.current_state_hash || 'unknown';

        // GLOBAL METRIC SUPPRESSION
        // If 'isPreview' param is in URL (Canvas Iframe or Preview Portal), do NOT track.
        const isPreview = new URLSearchParams(window.location.search).get('isPreview') === 'true';
        if (isPreview) {
            console.log(`🚫 METRIC SUPPRESSED (Preview Mode): ${eventType}`, { blockId, ...meta });
            return;
        }

        const event: TrackingEvent = {
            blockId,
            eventType,
            meta,
            timestamp: Date.now(),
            stateHash
        };

        // Send to backend
        console.log(`%c 🎯 METRIC SENT: ${eventType} [${stateHash}] `, 'background: #222; color: #bada55; padding: 2px 5px; border-radius: 3px;', { blockId, ...meta });
        try {
            fetch('/api/tracking/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-workspace-id': workspaceId
                },
                body: JSON.stringify({
                    sessionId: 'manual_session', // Simple session for manual testing
                    componentId: blockId,
                    stateHash,
                    ...event
                })
            }).catch(err => console.error('Tracking Error:', err));
        } catch (e) {
            console.error('Tracking Dispatch Failed', e);
        }

        // For now, allow dispatching to window for the "Watcher Agent" to potentially pick up if we use a browser extension or local script
        window.dispatchEvent(new CustomEvent('beevo_track', { detail: event }));
    }, [blockId, config, workspaceId]);

    return { track, isReady: !loading && !!config };
};
