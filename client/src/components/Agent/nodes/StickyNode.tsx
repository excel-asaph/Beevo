import React from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Pencil, Check, Lock } from 'lucide-react';

/**
 * Available background colors for sticky notes.
 */
export type StickyColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

/**
 * Data structure for the StickyNode.
 */
export interface StickyNodeData {
    /** Label text for the sticky note header. */
    label: string;
    /** Content of the sticky note. Can be text or an array of items. */
    content: string | string[];
    /** Background color of the note. Defaults to 'yellow'. */
    color?: StickyColor;
    /** Current status of the note. */
    status?: 'empty' | 'active' | 'complete' | 'locked';
    /** Content display mode. 'text' for block text, 'list' for bullets, 'tags' for pills. */
    displayMode?: 'text' | 'list' | 'tags';
    /** Optional icon to display in the header. */
    icon?: React.ReactNode;
    /** Callback triggered when the edit button is clicked. */
    onEdit?: () => void;
}

const colorStyles: Record<StickyColor, { bg: string; border: string; shadow: string }> = {
    yellow: {
        bg: 'bg-amber-100',
        border: 'border-amber-200',
        shadow: 'shadow-amber-200/50'
    },
    pink: {
        bg: 'bg-pink-100',
        border: 'border-pink-200',
        shadow: 'shadow-pink-200/50'
    },
    blue: {
        bg: 'bg-sky-100',
        border: 'border-sky-200',
        shadow: 'shadow-sky-200/50'
    },
    green: {
        bg: 'bg-emerald-100',
        border: 'border-emerald-200',
        shadow: 'shadow-emerald-200/50'
    },
    purple: {
        bg: 'bg-violet-100',
        border: 'border-violet-200',
        shadow: 'shadow-violet-200/50'
    },
    orange: {
        bg: 'bg-orange-100',
        border: 'border-orange-200',
        shadow: 'shadow-orange-200/50'
    },
};

/**
 * A custom Node component for ReactFlow that simulates a sticky note.
 * 
 * Features:
 * - Color themes (Yellow, Pink, Blue, etc.).
 * - "Tape" visual effect.
 * - Supports text, list, and tag content modes.
 * - Interactive elements (Edit, Lock).
 * - Animated entrance and hover effects.
 * 
 * @param {NodeProps} props - The node props provided by ReactFlow.
 */
export const StickyNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as StickyNodeData;
    const color = nodeData.color || 'yellow';
    const styles = colorStyles[color];
    const status = nodeData.status || 'complete';
    const isLocked = status === 'locked';
    const isEmpty = status === 'empty';

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
            animate={{
                scale: 1,
                opacity: 1,
                rotate: selected ? 0 : Math.random() * 4 - 2
            }}
            whileHover={{ scale: 1.02, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`
                relative min-w-[180px] max-w-[240px] p-4 rounded-lg
                ${styles.bg} ${styles.border} border
                shadow-lg ${styles.shadow}
                ${selected ? 'ring-2 ring-indigo-400' : ''}
                ${isLocked ? 'opacity-60' : ''}
                cursor-grab active:cursor-grabbing
            `}
            style={{
                // Sticky note tape effect
                backgroundImage: `linear-gradient(135deg, transparent 10px, ${color === 'yellow' ? '#fef3c7' : 'transparent'} 0)`,
            }}
        >
            {/* Tape decoration at top */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 bg-white/60 rounded-sm shadow-sm" />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    {nodeData.icon && (
                        <span className="text-slate-600">{nodeData.icon}</span>
                    )}
                    <h3 className="font-semibold text-slate-800 text-sm">{nodeData.label}</h3>
                </div>

                <div className="flex items-center space-x-1">
                    {status === 'complete' && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                        </div>
                    )}
                    {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                    {!isLocked && !isEmpty && nodeData.onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); nodeData.onEdit?.(); }}
                            className="p-1 rounded hover:bg-white/50 transition-colors"
                        >
                            <Pencil className="w-3 h-3 text-slate-500" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="text-slate-700 text-sm leading-relaxed">
                {isEmpty ? (
                    <p className="text-slate-400 italic">Waiting for input...</p>
                ) : nodeData.displayMode === 'tags' && Array.isArray(nodeData.content) ? (
                    <div className="flex flex-wrap gap-2">
                        {nodeData.content.map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-white/60 rounded-md text-xs font-medium text-slate-700 border border-slate-200/50">
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : Array.isArray(nodeData.content) ? (
                    <ul className="space-y-1">
                        {nodeData.content.map((item, i) => (
                            <li key={i} className="flex items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 mr-2 flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>{nodeData.content}</p>
                )}
            </div>

            {/* Active indicator pulse */}
            {status === 'active' && (
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500"
                />
            )}

            {/* Connection handles (hidden by default, can be used for connecting nodes) */}
            <Handle
                type="source"
                position={Position.Right}
                className="opacity-0 hover:opacity-100 transition-opacity"
            />
            <Handle
                type="target"
                position={Position.Left}
                className="opacity-0 hover:opacity-100 transition-opacity"
            />
        </motion.div>
    );
};

export default StickyNode;
