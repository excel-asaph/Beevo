import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Lightbulb,
    Layers
} from 'lucide-react';
import { ActivityItem as ActivityItemType } from '../../stores/useActivityStore';
import { GroupedActivityItem } from '../../components/Agent/ThinkingPanel';
import { ThoughtStream } from './ThoughtStream';

/**
 * Props for the ActivityItem component.
 */
interface ActivityItemProps {
    /** The activity item data. */
    item: GroupedActivityItem | ActivityItemType;
    /** Whether the item is expanded to show details. */
    isExpanded: boolean;
    /** Callback to toggle expansion state. */
    onToggle: () => void;
    /** Indentation depth for recursive rendering. */
    depth?: number; // For indentation recursion
}

/**
 * Renders a single item or group in the agent's activity feed.
 * 
 * Features:
 * - Hierarchical tree rendering for grouped activities.
 * - Visual status indicators (icons, colors).
 * - Auto-scrolling for active/running items.
 * - Expandable/collapsible details view.
 * - Distinct styling for "Thinking" vs "Action" items.
 * 
 * @param {ActivityItemProps} props - The component props.
 */
export const ActivityItem: React.FC<ActivityItemProps> = ({ item, isExpanded, onToggle, depth = 0 }) => {
    // Cast to grouped type
    const groupedItem = item as GroupedActivityItem;
    const isGroup = !!groupedItem.isGroup;
    const children = groupedItem.children || [];

    const isRunning = item.status === 'running' || item.status === 'pending';
    const isError = item.status === 'error';
    const isSuccess = item.status === 'success';

    // Determine type (Thought vs Action)
    // Heuristic: If title contains "Analyzing", "Reasoning", "Thinking" -> Thought
    const isThought = item.type === 'thought' ||
        item.title.toLowerCase().includes('analyzing') ||
        item.title.toLowerCase().includes('strategy') ||
        item.title.toLowerCase().includes('insight');

    // Auto-scroll logic
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (isExpanded && isRunning && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [item.content, isExpanded, isRunning]);

    // Icon Selection
    const renderIcon = () => {
        if (isRunning) return <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />;
        if (isError) return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
        if (isGroup) return <Layers className="w-3.5 h-3.5 text-indigo-400" />; // Stack icon for groups
        if (isThought) return <Lightbulb className="w-3.5 h-3.5 text-amber-500" />;
        return <Check className="w-3.5 h-3.5 text-emerald-500" />;
    };

    return (
        <div className={`relative ${depth > 0 ? 'ml-4' : ''}`}>
            {/* Vertical Timeline Line */}
            {depth === 0 && (
                <div className="absolute left-[19px] top-8 bottom-0 w-px bg-slate-200/60 -z-10 group-last:hidden" />
            )}

            {/* Header / Main Item */}
            <motion.div
                initial={false}
                className={`
                    relative flex flex-col rounded-lg transition-all duration-200
                    ${isExpanded ? 'bg-white shadow-sm ring-1 ring-slate-100 my-2' : 'hover:bg-white/50 my-0.5'}
                `}
            >
                <button
                    onClick={onToggle}
                    className="w-full flex items-start p-2.5 text-left group"
                >
                    {/* Icon Container with Line Logic */}
                    <div className="relative mr-3 mt-0.5 flex-shrink-0 z-10">
                        <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center border
                            ${isExpanded ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50 border-slate-100 group-hover:bg-white group-hover:border-slate-200'}
                            transition-colors
                        `}>
                            {renderIcon()}
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold truncate ${isThought ? 'text-slate-600 italic' : 'text-slate-700'
                                }`}>
                                {isGroup ? `${item.title} (${children.length})` : item.title}
                            </span>
                            <div className="flex items-center text-slate-300">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </div>
                        </div>

                        {/* Meta / Timestamp */}
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-slate-400 font-mono tracking-wide uppercase">
                                {isGroup ? 'CLUSTER' : isThought ? 'INSIGHT' : 'EXECUTION'}
                                <span className="mx-1.5">•</span>
                                {item.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </button>

                {/* Expanded Content Body */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3 pt-0 ml-9">
                                {isGroup ? (
                                    // Render Group Children (Recursive)
                                    <div className="flex flex-col gap-1 mt-2 border-l border-indigo-100 pl-3">
                                        {children.map((child, idx) => (
                                            <div key={child.id} className="relative py-1">
                                                {/* Child Item (Simplified view) */}
                                                <div className="flex items-start gap-2">
                                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] text-slate-600 font-medium leading-tight">
                                                            {child.title}
                                                        </div>
                                                        {child.content && (
                                                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                                                                {child.content}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    // Render Single Item Content (Clean Document Stream)
                                    <div
                                        ref={contentRef}
                                        className="mt-1 text-xs text-slate-600 leading-relaxed font-sans max-h-60 overflow-y-auto custom-scrollbar pr-2"
                                    >
                                        <div className="bg-slate-50/50 rounded p-2 border border-slate-100/50">
                                            <ThoughtStream
                                                text={item.content}
                                                isComplete={!isRunning}
                                                className="prose prose-sm max-w-none text-slate-600 marker:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
