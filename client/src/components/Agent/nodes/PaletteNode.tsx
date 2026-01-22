import React, { useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, RefreshCw, Lock } from 'lucide-react';

export interface ColorOption {
    id: string;
    name: string;
    colors: string[];
    reasoning?: string;
    isSelected?: boolean;
}

export interface PaletteNodeData {
    label: string;
    status: 'empty' | 'options' | 'saved' | 'locked';
    options?: ColorOption[];
    selectedPalette?: ColorOption; // Deprecated but kept for backward compatibility
    selectedPalettes?: ColorOption[];
    onSelect?: (paletteId: string, context?: ColorOption) => void;
    onRegenerate?: () => void;
}

export const PaletteNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as PaletteNodeData;
    const [hoveredPalette, setHoveredPalette] = useState<string | null>(null);

    const status = nodeData.status || 'empty';
    const isLocked = status === 'locked';

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Palette className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Color palette will appear here</p>
        </div>
    );

    const renderOptions = () => (
        <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-2">Choose a palette:</p>
            {nodeData.options?.map((palette, index) => (
                <motion.button
                    key={palette.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onHoverStart={() => setHoveredPalette(palette.id)}
                    onHoverEnd={() => setHoveredPalette(null)}
                    onClick={() => nodeData.onSelect?.(palette.id, palette)}
                    className={`
                        w-full p-3 rounded-lg border transition-all
                        ${hoveredPalette === palette.id
                            ? 'border-indigo-400 bg-indigo-50 shadow-md'
                            : (palette.isSelected ? 'border-emerald-500 bg-emerald-50 shadow-md ring-1 ring-emerald-500' : 'border-slate-200 bg-white hover:border-slate-300')
                        }
                    `}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700">{palette.name}</span>
                        {palette.isSelected && (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex gap-1">
                        {palette.colors.map((color, i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: index * 0.1 + i * 0.05 }}
                                className="w-8 h-8 rounded-md shadow-inner border border-white/50"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                    {palette.reasoning && hoveredPalette === palette.id && (
                        <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-xs text-slate-500 mt-2 text-left"
                        >
                            {palette.reasoning}
                        </motion.p>
                    )}
                </motion.button>
            ))}

            {nodeData.onRegenerate && (
                <button
                    onClick={nodeData.onRegenerate}
                    className="w-full py-2 text-xs text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1"
                >
                    <RefreshCw className="w-3 h-3" />
                    Generate more options
                </button>
            )}
        </div>
    );

    const renderSaved = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">
                    Selected Palettes
                </span>
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            </div>

            {/* Fallback for single legacy selection */}
            {!nodeData.selectedPalettes && nodeData.selectedPalette && (
                renderSingleSavedPalette(nodeData.selectedPalette, 0)
            )}

            {/* Render multiple selections */}
            {nodeData.selectedPalettes?.map((palette, index) => renderSingleSavedPalette(palette, index))}
        </div>
    );

    const renderSingleSavedPalette = (palette: ColorOption, index: number) => (
        <div key={palette.id || index} className="pt-2 border-t border-slate-100 first:border-0 first:pt-0">
            <div className="text-xs font-medium text-slate-700 mb-2">{palette.name}</div>
            <div className="flex gap-2 mb-2">
                {palette.colors.map((color, i) => (
                    <motion.div
                        key={i}
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 + i * 0.05 }}
                        className="flex-1 group relative"
                    >
                        <div
                            className="aspect-square rounded-lg shadow-md border border-white/50"
                            style={{ backgroundColor: color }}
                        />
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {color}
                        </span>
                    </motion.div>
                ))}
            </div>
            {palette.reasoning && (
                <p className="text-xs text-slate-500 italic">
                    {palette.reasoning}
                </p>
            )}
        </div>
    );

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.01 }}
            className={`
                relative min-w-[280px] max-w-[320px] p-4 rounded-xl
                bg-white border border-slate-200
                shadow-lg shadow-slate-200/50
                ${selected ? 'ring-2 ring-indigo-400' : ''}
                ${isLocked ? 'opacity-60' : ''}
                cursor-grab active:cursor-grabbing
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                        <Palette className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-800">{nodeData.label}</h3>
                </div>
                {isLocked && <Lock className="w-4 h-4 text-slate-400" />}
            </div>

            {/* Content based on status */}
            <AnimatePresence mode="wait">
                {status === 'empty' && renderEmpty()}
                {status === 'options' && renderOptions()}
                {(status === 'saved' || status === 'locked') && renderSaved()}
            </AnimatePresence>

            {/* Active indicator */}
            {status === 'options' && (
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500"
                />
            )}

            <Handle type="source" position={Position.Right} className="opacity-0" />
            <Handle type="target" position={Position.Left} className="opacity-0" />
        </motion.div>
    );
};

export default PaletteNode;
