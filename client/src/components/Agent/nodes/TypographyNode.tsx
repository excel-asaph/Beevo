import React, { useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Type, Check, RefreshCw, Lock } from 'lucide-react';

export interface FontOption {
    id: string;
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'monospace';
    pairing?: string;
    preview?: string;
    reasoning?: string;
}

export interface TypographyNodeData {
    label: string;
    status: 'empty' | 'options' | 'saved' | 'locked';
    options?: FontOption[];
    selectedFonts?: FontOption[];
    onSelect?: (fontId: string, context?: FontOption) => void;
    onRegenerate?: () => void;
}

const categoryColors: Record<string, string> = {
    'serif': 'bg-amber-100 text-amber-700',
    'sans-serif': 'bg-sky-100 text-sky-700',
    'display': 'bg-purple-100 text-purple-700',
    'monospace': 'bg-emerald-100 text-emerald-700',
};

export const TypographyNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as TypographyNodeData;
    const [hoveredFont, setHoveredFont] = useState<string | null>(null);

    const status = nodeData.status || 'empty';
    const isLocked = status === 'locked';

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Type className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Typography will appear here</p>
        </div>
    );

    const renderOptions = () => (
        <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">Select up to 3 fonts:</p>
            {nodeData.options?.map((font, index) => (
                <motion.button
                    key={font.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    onHoverStart={() => setHoveredFont(font.id)}
                    onHoverEnd={() => setHoveredFont(null)}
                    onClick={() => nodeData.onSelect?.(font.id, font)}
                    className={`
                        w-full p-3 rounded-lg border transition-all text-left
                        ${hoveredFont === font.id
                            ? 'border-indigo-400 bg-indigo-50 shadow-md'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }
                    `}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span
                            className="text-lg font-medium text-slate-800"
                            style={{ fontFamily: font.name }}
                        >
                            {font.name}
                        </span>
                        <div className="flex gap-2 items-center">
                            {font.pairing && (
                                <span className="text-xs text-slate-400 font-normal">
                                    + {font.pairing}
                                </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[font.category]}`}>
                                {font.category}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p
                            className="text-sm text-slate-600 truncate"
                            style={{ fontFamily: font.name }}
                        >
                            The quick brown fox jumps over the lazy dog
                        </p>
                        {font.pairing && (
                            <p
                                className="text-xs text-slate-500 truncate opacity-80"
                                style={{ fontFamily: font.pairing }}
                            >
                                The quick brown fox jumps over the lazy dog
                            </p>
                        )}
                    </div>
                    {font.reasoning && hoveredFont === font.id && (
                        <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-xs text-slate-500 mt-2 italic"
                        >
                            {font.reasoning}
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
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Selected Fonts</span>
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            </div>

            {nodeData.selectedFonts?.map((font, i) => (
                <motion.div
                    key={font.id}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-3 bg-slate-50 rounded-lg"
                >
                    <div className="flex items-center justify-between mb-1">
                        <span
                            className="text-lg font-semibold text-slate-800"
                            style={{ fontFamily: font.name }}
                        >
                            {font.name}
                        </span>
                        <div className="flex gap-2 items-center">
                            {font.pairing && (
                                <span className="text-xs text-slate-400 font-normal">
                                    + {font.pairing}
                                </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[font.category]}`}>
                                {font.category}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p
                            className="text-sm text-slate-600 truncate"
                            style={{ fontFamily: font.name }}
                        >
                            Aa Bb Cc 123
                        </p>
                        {font.pairing && (
                            <p
                                className="text-xs text-slate-500 truncate opacity-80"
                                style={{ fontFamily: font.pairing }}
                            >
                                Aa Bb Cc 123
                            </p>
                        )}
                    </div>
                </motion.div>
            ))}
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
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Type className="w-4 h-4 text-white" />
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

export default TypographyNode;
