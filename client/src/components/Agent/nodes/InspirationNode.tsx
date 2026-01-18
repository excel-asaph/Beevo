import React, { useState } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Check, RefreshCw, Lock, ExternalLink } from 'lucide-react';
import { LogoInspiration } from '../../../../../shared/types';

export interface InspirationNodeData {
    label: string;
    status: 'empty' | 'options' | 'saved';
    options?: LogoInspiration[];
    saved?: LogoInspiration[];
    onSelect?: (logoId: string) => void;
    onRegenerate?: () => void;
}

export const InspirationNode: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as InspirationNodeData;
    const [hoveredLogo, setHoveredLogo] = useState<string | null>(null);

    const status = nodeData.status || 'empty';

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Logo inspiration will appear here</p>
        </div>
    );

    const renderOptions = () => (
        <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-2">Select an inspiration:</p>
            <div className="grid grid-cols-2 gap-2">
                {nodeData.options?.map((logo, index) => (
                    <motion.button
                        key={logo.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onHoverStart={() => setHoveredLogo(logo.id)}
                        onHoverEnd={() => setHoveredLogo(null)}
                        // onClick={() => nodeData.onSelect?.(logo.id)} // Selection disabled for now until logic defined
                        className={`
                            relative group overflow-hidden rounded-lg border transition-all aspect-square
                            ${hoveredLogo === logo.id
                                ? 'border-pink-400 ring-2 ring-pink-100 shadow-md'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }
                        `}
                    >
                        <img
                            src={logo.url}
                            alt={logo.brandName || 'Logo inspiration'}
                            className="w-full h-full object-cover"
                        />

                        {/* Overlay on hover */}
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${hoveredLogo === logo.id ? 'opacity-100' : 'opacity-0'}`}>
                            {/* <Check className="text-white w-6 h-6" /> */}
                            {/* Just showing brand name for now */}
                            <span className="text-white text-xs font-semibold px-2 text-center">{logo.brandName}</span>
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
                    <div key={i} className="rounded-lg overflow-hidden border border-emerald-200 shadow-sm relative aspect-square">
                        <img src={logo.url} className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className={`
            w-80 bg-white rounded-xl shadow-lg border-2 transition-all duration-300 overflow-hidden
            ${selected ? 'border-pink-400 ring-4 ring-pink-100' : 'border-slate-100'}
        `}>
            {/* Header */}
            <div className={`
                px-4 py-3 border-b flex items-center justify-between
                ${status === 'saved' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100'}
            `}>
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${status === 'saved' ? 'bg-emerald-100 text-emerald-600' : 'bg-pink-100 text-pink-600'}`}>
                        <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{nodeData.label}</span>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
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
            <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-3 !h-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-3 !h-3" />
        </div>
    );
};
