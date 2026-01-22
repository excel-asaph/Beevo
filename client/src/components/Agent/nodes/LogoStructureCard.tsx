import React from 'react';
import { motion } from 'framer-motion';
import { Layout, Check, Info } from 'lucide-react';
import { LogoStructureOption } from '@shared/types';

export interface LogoStructureCardProps {
    options: LogoStructureOption[];
    onSelect?: (id: string) => void;
}

export const LogoStructureCard: React.FC<LogoStructureCardProps> = ({ options, onSelect }) => {
    if (!options || options.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Layout className="w-4 h-4 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Logo Structure</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option) => (
                    <motion.div
                        key={option.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => onSelect && onSelect(option.id)}
                        className={`
                            relative p-5 rounded-xl border cursor-pointer transition-all duration-200
                            ${option.isSelected
                                ? 'bg-indigo-500/10 border-indigo-500 shadow-indigo-500/20 shadow-lg'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'}
                        `}
                    >
                        {/* selection indicator */}
                        {option.isSelected && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            </div>
                        )}

                        <div className="flex flex-col h-full">
                            <h4 className={`text-lg font-bold mb-2 ${option.isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                                {option.type}
                            </h4>

                            <p className="text-sm text-slate-400 mb-3 flex-grow">
                                {option.reasoning}
                            </p>

                            <div className="pt-3 mt-auto border-t border-slate-700/50 flex items-start gap-2">
                                <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-slate-500">
                                    {option.suitability}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default LogoStructureCard;
