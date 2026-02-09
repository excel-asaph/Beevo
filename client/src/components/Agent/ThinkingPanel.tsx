import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';
import { useActivityStore, ActivityItem as ActivityItemType } from '../../stores/useActivityStore';
import { ActivityItem } from '../ControlCenter/ActivityItem';

/**
 * Extended ActivityItem type that supports grouping of related activities.
 */
export interface GroupedActivityItem extends ActivityItemType {
    /** Child activities grouped under this item. */
    children?: ActivityItemType[];
    /** Whether this item represents a group header. */
    isGroup?: boolean;
}

// Legacy types for compatibility
/** @deprecated Use ActivityStatus from store instead */
export type ThinkingPhase = 'idle' | 'analyzing' | 'researching' | 'generating' | 'complete' | 'error';
/** @deprecated Use ActivityItem from store instead */
export interface ThinkingStep {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

/**
 * Props for the ThinkingPanel component.
 */
interface ThinkingPanelProps {
    // Legacy props (maintained for compatibility but ignored for content)
    /** @deprecated Legacy prop */
    phase?: any;
    /** @deprecated Legacy prop */
    steps?: any;
    /** @deprecated Legacy prop */
    currentAction?: any;
    /** Whether the panel starts in a collapsed state. overrides store state if provided. */
    isCollapsed?: boolean;
    /** Callback to toggle collapse state. */
    onToggleCollapse?: () => void;
}

/**
 * A floating control panel that displays the AI's "Thread of Thought" or activity feed.
 * 
 * Features:
 * - Smart grouping of related sequential activities.
 * - Real-time status updates (running, complete, error).
 * - Collapsible UI with a glassmorphism design.
 * - History clearing functionality.
 * 
 * @param {ThinkingPanelProps} props - The component props.
 */
export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
    isCollapsed: propCollapsed,
    onToggleCollapse: propToggle
}) => {
    const { activities, isPanelOpen, setPanelOpen, clearActivities, hydrateActivities } = useActivityStore();
    const { activeWorkspaceId } = useBrandStore();

    // Internal state for which item is expanded (accordion logic)
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    // Use store state or prop state (hybrid)
    const isOpen = propCollapsed !== undefined ? !propCollapsed : isPanelOpen;
    const togglePanel = propToggle || (() => setPanelOpen(!isPanelOpen));

    const activeCount = activities.filter(a => a.status === 'running').length;

    // Hydrate on mount or project change
    useEffect(() => {
        if (activeWorkspaceId) {
            hydrateActivities(activeWorkspaceId);
        }
    }, [activeWorkspaceId, hydrateActivities]);

    // ==========================================
    // GROUPING LOGIC (The "Smart Mixer")
    // ==========================================
    const groupedActivities = useMemo(() => {
        const result: GroupedActivityItem[] = [];
        let currentGroup: GroupedActivityItem | null = null;

        // Iterate through raw activities
        for (const item of activities) {
            // Check if this item should belong to the current group
            // Rule: Same Title + Sequential Timestamp (within reasonable window, logic simplified to just title here for now)
            if (currentGroup && item.title === currentGroup.title) {
                // Add to existing group
                currentGroup.children = [...(currentGroup.children || []), item];
                // Update timestamp to latest item
                currentGroup.timestamp = item.timestamp;
                // If any child is running, group is running
                if (item.status === 'running') currentGroup.status = 'running';
            } else {
                // If we have a previous group, push it to results
                if (currentGroup) {
                    result.push(currentGroup);
                }

                // Start new "Group Candidate"
                currentGroup = {
                    ...item,
                    children: [item], // It contains itself as the first child
                    isGroup: false // Will set to true if more than 1 child
                };
            }
        }

        // Push the last group
        if (currentGroup) {
            result.push(currentGroup);
        }

        // Post-process: If a "Group" has only 1 child, flatten it back to a single item
        return result.map(g => {
            if (g.children && g.children.length > 1) {
                return {
                    ...g,
                    isGroup: true,
                    // Title should indicate count? handled in UI
                    id: `group-${g.children[0].id}` // Stable Group ID
                };
            }
            // Return the single child (original item)
            return g.children ? g.children[0] : g;
        });
    }, [activities]);

    // Auto-expand NEW groups or running items
    useEffect(() => {
        const runningItems = groupedActivities.filter(a => a.status === 'running' || a.status === 'pending');
        if (runningItems.length > 0) {
            const latest = runningItems[runningItems.length - 1];
            if (!expandedIds.includes(latest.id)) {
                setExpandedIds(prev => [...prev, latest.id]);
            }
        }
    }, [groupedActivities.length]);

    const toggleItem = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`
                w-96 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200
                overflow-hidden flex flex-col max-h-[85vh]
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-white/50">
                <div className="flex items-center space-x-2">
                    <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center
                        ${activeCount > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}
                    `}>
                        <Brain className={`w-5 h-5 ${activeCount > 0 ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Control Center</h3>
                        <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                            {activeCount > 0 ? `${activeCount} PROCESSES ACTIVE` : 'SYSTEM READY'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-1">
                    <button
                        onClick={clearActivities}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                        title="Clear History"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={togglePanel}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Activity Feed */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30"
                    >
                        {groupedActivities.length === 0 ? (
                            <div className="p-12 text-center text-slate-300 flex flex-col items-center">
                                <History className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-xs font-medium">No activity history recorded.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col-reverse justify-end min-h-0 py-2">
                                {/* Render grouped list */}
                                {groupedActivities.slice().reverse().map((item) => (
                                    <ActivityItem
                                        key={item.id}
                                        item={item}
                                        isExpanded={expandedIds.includes(item.id)}
                                        onToggle={() => toggleItem(item.id)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Footer Status Bar */}
                        <div className="p-2 border-t border-slate-100 bg-white/50 text-[10px] text-slate-400 text-center uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            System Online
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ThinkingPanel;
