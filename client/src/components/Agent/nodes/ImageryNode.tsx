import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Check } from 'lucide-react';
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
            <Handle type="target" position={Position.Top} className="handle-target" />

            <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-pink-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Visual Imagery Concepts</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {options.map((option) => (
                        <motion.div
                            key={option.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            onClick={() => onSelect && onSelect(option.id)}
                            className={`
                                relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden
                                ${option.isSelected
                                    ? 'bg-white border-pink-500 shadow-xl'
                                    : 'bg-gray-50 border-gray-200 hover:border-pink-300 hover:bg-white shadow-md'}
                            `}
                        >
                            {/* selection indicator */}
                            <div className={`
                                absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                                ${option.isSelected
                                    ? 'bg-pink-500 scale-100 shadow-lg shadow-pink-500/50'
                                    : 'bg-gray-200 scale-90 opacity-0 group-hover:opacity-100'}
                            `}>
                                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            </div>

                            {/* Background Gradient Blob */}
                            <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[50px] transition-all duration-500 ${option.isSelected ? 'bg-pink-500/10' : 'bg-gray-200/50 group-hover:bg-pink-500/5'
                                }`} />

                            <div className="flex flex-col h-full relative z-10">
                                <h4 className={`text-xl font-bold mb-3 tracking-tight ${option.isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                                    {option.concept}
                                </h4>

                                <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4 flex-grow">
                                    {option.description}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="handle-source" />
        </div>
    );
});
