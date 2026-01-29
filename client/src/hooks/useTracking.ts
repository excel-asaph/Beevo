import { useCallback } from 'react';

export type TrackingEvent = {
    blockId: string;
    eventType: 'view_3s' | 'cta_click' | 'scroll_depth' | 'proof_dwell_summary' | 'pas_dwell_summary' | 'spec_dwell_summary' | 'spec_interaction' | 'social_dwell_summary' | 'social_scroll_velocity' | 'view_component' | 'offer_dwell_summary' | 'offer_cta_click';
    meta?: any;
    timestamp: number;
};

export const useTracking = (blockId: string) => {
    const track = useCallback((eventType: TrackingEvent['eventType'], meta?: any) => {
        const event: TrackingEvent = {
            blockId,
            eventType,
            meta,
            timestamp: Date.now(),
        };

        // Send to backend
        console.log(`%c 🎯 METRIC SENT: ${eventType} `, 'background: #222; color: #bada55; padding: 2px 5px; border-radius: 3px;', { blockId, ...meta });
        try {
            fetch('/api/tracking/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'manual_session', // Simple session for manual testing
                    componentId: blockId,
                    ...event
                })
            }).catch(err => console.error('Tracking Error:', err));
        } catch (e) {
            console.error('Tracking Dispatch Failed', e);
        }

        // For now, allow dispatching to window for the "Watcher Agent" to potentially pick up if we use a browser extension or local script
        window.dispatchEvent(new CustomEvent('beevo_track', { detail: event }));
    }, [blockId]);

    return { track };
};
