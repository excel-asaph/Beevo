import { useCallback } from 'react';

export type TrackingEvent = {
    blockId: string;
    eventType: 'view_3s' | 'cta_click' | 'scroll_depth' | 'proof_dwell_summary';
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
        try {
            fetch('http://localhost:3000/api/tracking/event', {
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
