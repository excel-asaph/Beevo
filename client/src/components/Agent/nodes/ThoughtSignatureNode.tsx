import React, { useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export interface ThoughtSignatureData {
    parentNodeId: string;
    title: string;
    reasoning: string;
    confidence?: number;
}

const ThoughtSignatureNode: React.FC<NodeProps> = ({ data }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const nodeData = data as ThoughtSignatureData;
    const { title, reasoning, confidence } = nodeData;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
                relative
                ${isExpanded ? 'w-80' : 'w-auto'}
                transition-all duration-300 ease-out
            `}
        >
            {/* Collapsed View - Just the lightbulb icon */}
            {!isExpanded && (
                <motion.button
                    onClick={() => setIsExpanded(true)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="
                        flex items-center gap-2 px-3 py-2
                        bg-gradient-to-br from-amber-50 to-yellow-100
                        border-2 border-amber-300
                        rounded-full shadow-lg
                        cursor-pointer
                        hover:from-amber-100 hover:to-yellow-200
                        hover:shadow-xl
                        transition-all duration-200
                    "
                    title={`View AI Reasoning: ${title}`}
                >
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 max-w-32 truncate">
                        {title}
                    </span>
                    <ChevronDown className="w-4 h-4 text-amber-500" />
                </motion.button>
            )}

            {/* Expanded View - Full reasoning card */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="
                            bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50
                            border-2 border-amber-300
                            rounded-xl shadow-xl
                            overflow-hidden
                        "
                    >
                        {/* Header */}
                        <div
                            onClick={() => setIsExpanded(false)}
                            className="
                                flex items-center justify-between px-4 py-3
                                bg-gradient-to-r from-amber-100 to-yellow-100
                                border-b border-amber-200
                                cursor-pointer
                                hover:from-amber-200 hover:to-yellow-200
                                transition-colors
                            "
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-400 rounded-lg">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-semibold text-amber-900">
                                    {title}
                                </span>
                            </div>
                            <ChevronUp className="w-5 h-5 text-amber-600" />
                        </div>

                        {/* Reasoning Content */}
                        <div className="p-4">
                            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                                {reasoning}
                            </p>

                            {/* Confidence Indicator */}
                            {confidence !== undefined && (
                                <div className="mt-4 pt-3 border-t border-amber-200">
                                    <div className="flex items-center justify-between text-xs text-amber-700">
                                        <span>Confidence</span>
                                        <span className="font-medium">{Math.round(confidence * 100)}%</span>
                                    </div>
                                    <div className="mt-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${confidence * 100}%` }}
                                            transition={{ delay: 0.2, duration: 0.6 }}
                                            className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Badge */}
                        <div className="px-4 py-2 bg-amber-100/50 border-t border-amber-200">
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                                <Lightbulb className="w-3 h-3" />
                                <span>AI Reasoning • Deep Think</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ThoughtSignatureNode;
