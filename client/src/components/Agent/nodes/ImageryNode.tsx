import React, { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ImagerySuggestion } from '../../../../../shared/types';

interface ImageryNodeData extends Record<string, unknown> {
    options: ImagerySuggestion[];
    onSelect?: (id: string) => void;
}

export const ImageryNode = memo(({ data }: NodeProps<Node<ImageryNodeData>>) => {
    const { options, onSelect } = data;

    if (!options || options.length === 0) return null;

    return (
        <div className="react-flow-node-custom w-[850px]">
            <div className="flex flex-col gap-4 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {options.map((option, i) => (
                        <motion.div
                            key={option.id}

                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            onClick={() => onSelect && onSelect(option.id)}
                            className={`
                                relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden flex flex-col
                                ${option.isSelected
                                    ? 'bg-white border-pink-500 shadow-xl ring-1 ring-pink-500/20'
                                    : 'bg-white border-slate-100 hover:border-pink-300 hover:shadow-lg'}
                            `}
                        >
                            {/* Mood Gradient Background (Subtle) */}
                            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100
                                ${i % 4 === 0 ? 'from-purple-50/50 to-pink-50/50' :
                                    i % 4 === 1 ? 'from-blue-50/50 to-cyan-50/50' :
                                        i % 4 === 2 ? 'from-amber-50/50 to-orange-50/50' :
                                            'from-emerald-50/50 to-teal-50/50'}
                            `} />

                            {/* Selection Indicator */}
                            {option.isSelected && (
                                <div className="absolute top-4 right-4 text-pink-500">
                                    <div className="bg-pink-500 text-white rounded-full p-1 shadow-sm">
                                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col h-full relative z-10">
                                <h4 className={`text-lg font-bold mb-2 tracking-tight ${option.isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                                    {option.concept}
                                </h4>

                                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-0 flex-grow">
                                    {option.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
});
