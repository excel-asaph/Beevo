import { create } from 'zustand';

export type ActivityType = 'thought' | 'tool' | 'system';
export type ActivityStatus = 'pending' | 'running' | 'success' | 'error';

/**
 * Represents a single activity item in the system log.
 */
export interface ActivityItem {
    id: string;
    type: ActivityType;
    /** Display title for the activity (e.g., "Generating Colors"). */
    title: string;
    /** Detailed content, stream text, or tool arguments. */
    content: string;
    status: ActivityStatus;
    timestamp: Date;
    duration?: number;
    /** Metadata storage for raw tool args or results. */
    meta?: any;
}

/**
 * Store definition for managing system activities and logs.
 */
interface ActivityStore {
    activities: ActivityItem[];
    isPanelOpen: boolean;

    /** Adds a new activity to the log. */
    addActivity: (item: ActivityItem) => void;
    /** Updates an existing activity by ID. */
    updateActivity: (id: string, updates: Partial<ActivityItem>) => void;
    /** Marks an activity as complete (success/error). */
    completeActivity: (id: string, status: 'success' | 'error', result?: string) => void;
    /** Clears all activity history. */
    clearActivities: () => void;
    /** Toggles the visibility of the activity panel. */
    setPanelOpen: (isOpen: boolean) => void;

    /** Returns the currently running activity, if any. */
    getActiveActivity: () => ActivityItem | undefined;
    /** Fetches and merges activity history from the backend. */
    hydrateActivities: (workspaceId: string) => Promise<void>;
}

/**
 * Zustand store for managing activity logs and status.
 * 
 * Features:
 * - Tracks 'pending', 'running', 'success', 'error' states.
 * - Hydrates history from backend tool logs and research thoughts.
 * - Provides real-time updates for UI feedback.
 */
export const useActivityStore = create<ActivityStore>((set, get) => ({
    activities: [],
    isPanelOpen: true,

    addActivity: (item) => set((state) => {
        // Prevent duplicates if ID exists
        if (state.activities.some(a => a.id === item.id)) return state;
        return { activities: [...state.activities, item] };
    }),

    updateActivity: (id, updates) => set((state) => ({
        activities: state.activities.map(a =>
            a.id === id ? { ...a, ...updates } : a
        )
    })),

    completeActivity: (id, status, result) => set((state) => ({
        activities: state.activities.map(a => {
            if (a.id !== id) return a;
            return {
                ...a,
                status,
                content: result || a.content, // Update content with result if provided, else keep generic
                duration: Date.now() - a.timestamp.getTime()
            };
        })
    })),

    clearActivities: () => set({ activities: [] }),
    setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),

    getActiveActivity: () => get().activities.find(a => a.status === 'running'),

    hydrateActivities: async (workspaceId: string) => {
        try {
            // 1. Fetch General History (Tool Logs)
            const historyRes = await fetch(`/api/workspace/history?limit=100`, {
                headers: { 'x-workspace-id': workspaceId }
            });
            const historyData = await historyRes.json();

            let mappedActivities: ActivityItem[] = [];

            if (Array.isArray(historyData)) {
                const toolLogs = historyData.filter((item: any) => item.role === 'tool_log');
                mappedActivities = toolLogs.map((log: any) => {
                    const meta = log.metadata || {};
                    return {
                        id: meta.id || `hist-${new Date(log.timestamp).getTime()}`,
                        type: meta.type || 'tool',
                        title: log.content,
                        content: meta.message || '',
                        status: meta.status || 'success',
                        timestamp: new Date(log.timestamp),
                        duration: meta.duration,
                        meta: meta
                    };
                });
            }

            // 2. Fetch Research Thoughts (The new persistent log)
            try {
                const thoughtsRes = await fetch(`/api/debug/research/thoughts`, { headers: { 'x-workspace-id': workspaceId } });
                if (thoughtsRes.ok) {
                    const thoughts = await thoughtsRes.json();
                    if (Array.isArray(thoughts)) {
                        const researchActivities: ActivityItem[] = thoughts.map((t: any) => ({
                            id: t.id,
                            type: 'thought',
                            title: t.title,
                            content: t.content,
                            status: 'success',
                            timestamp: new Date(t.timestamp),
                            duration: 0
                        }));
                        mappedActivities = [...mappedActivities, ...researchActivities];
                    }
                }
            } catch (e) {
                // Ignore if missing, it's optional
            }

            // 3. Sort merged list by time
            mappedActivities.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            set({ activities: mappedActivities });

        } catch (e) {
            console.error('Failed to hydrate activities:', e);
        }
    }
}));
