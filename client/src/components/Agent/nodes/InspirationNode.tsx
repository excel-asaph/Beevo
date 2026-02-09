import React, { useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { LogoInspiration } from '../../../../../shared/types';
import { SkeletonBlock } from '../../ui/Skeleton';

/**
 * Data structure for the InspirationNode.
 */
export interface InspirationNodeData {
    /** Label text for the node header. */
    label: string;
    /** Current state of the inspiration grid. */
    status: 'empty' | 'options' | 'saved';
    /** List of generated logo inspirations (when status is 'options'). */
    options?: LogoInspiration[];
    /** List of saved logo inspirations (when status is 'saved'). */
    saved?: LogoInspiration[];
    /** Callback triggered when a logo option is selected. */
    onSelect?: (logoId: string) => void;
    /** Callback triggered when the "Regenerate" button is clicked. */
    onRegenerate?: () => void;
}

/**
 * A custom Node component for ReactFlow that displays a grid of logo inspirations.
 * 
 * Features:
 * - Empty state with skeleton loading.
 * - Options state with selectable logo grid.
 * - Saved state showing confirmed selections.
 * - Regeneration capability.
 * 
 * @param {NodeProps} props - The node props provided by ReactFlow.
 */
export const InspirationNode: React.FC<NodeProps> = ({ data }) => {
    const { resolveAssetUrl } = useWorkspace();
    const nodeData = data as unknown as InspirationNodeData;
    const [hoveredLogo, setHoveredLogo] = useState<string | null>(null);

    const status = nodeData.status || 'empty';

    const renderEmpty = () => (
        <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-square">
                    <SkeletonBlock className="w-full h-full bg-slate-50 border border-slate-100" />
                </div>
            ))}
        </div>
    );

    const renderOptions = () => (
        <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-2">Select an inspiration:</p>
            <div className="grid grid-cols-4 gap-2">
                {nodeData.options?.map((logo, index) => (
                    <motion.button
                        key={logo.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onHoverStart={() => setHoveredLogo(logo.id)}
                        onHoverEnd={() => setHoveredLogo(null)}
                        onClick={() => nodeData.onSelect?.(logo.id)}
                        className={`
                            relative group overflow-hidden rounded-2xl border transition-all flex flex-col
                            ${logo.isSelected
                                ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md bg-emerald-50/10'
                                : hoveredLogo === logo.id
                                    ? 'border-pink-400 ring-2 ring-pink-100 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                            }
                        `}
                    >
                        <div className="aspect-square w-full relative overflow-hidden bg-slate-50">
                            <img
                                src={resolveAssetUrl(logo.url)}
                                alt={logo.displayName || 'Logo inspiration'}
                                className="w-full h-full object-cover"
                            />
                            {/* Overlay on hover or selection */}
                            <div className={`absolute inset-0 transition-opacity flex items-center justify-center
                                ${logo.isSelected ? 'bg-emerald-500/20 opacity-100' : hoveredLogo === logo.id ? 'bg-black/10 opacity-100' : 'opacity-0'}
                            `}>
                                {logo.isSelected && (
                                    <div className="bg-emerald-500 text-white rounded-full p-1 shadow-sm transform scale-100 transition-transform">
                                        <Check className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Always visible label */}
                        <div className={`
                            w-full py-1.5 px-2 border-t transition-colors
                            ${logo.isSelected ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}
                        `}>
                            <span className={`
                                text-xs font-medium truncate block w-full text-center
                                ${logo.isSelected ? 'text-emerald-700' : 'text-slate-600'}
                            `}>
                                {logo.displayName}
                            </span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {nodeData.onRegenerate && (
                <button
                    onClick={nodeData.onRegenerate}
                    className="w-full py-2 text-xs text-slate-500 hover:text-pink-600 flex items-center justify-center gap-1"
                >
                    <RefreshCw className="w-3 h-3" />
                    Generate more options
                </button>
            )}
        </div>
    );

    const renderSaved = () => (
        <div>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-600">
                    Saved Inspiration
                </span>
                <Check className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-2">
                {nodeData.saved?.map((logo, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden border border-emerald-200 shadow-sm relative aspect-square">
                        <img src={resolveAssetUrl(logo.url)} className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="w-[656px]">
            {/* Content */}
            <div className="relative">
                <AnimatePresence mode="wait">
                    {status === 'empty' && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {renderEmpty()}
                        </motion.div>
                    )}
                    {status === 'options' && (
                        <motion.div
                            key="options"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {renderOptions()}
                        </motion.div>
                    )}
                    {status === 'saved' && (
                        <motion.div
                            key="saved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {renderSaved()}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Handles */}
            <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-3 !h-3 opacity-0" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-3 !h-3 opacity-0" />
        </div>
    );
};
