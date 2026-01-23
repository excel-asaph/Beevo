import React from 'react';
import { motion } from 'framer-motion';
import { Layout, Check, Info } from 'lucide-react';
import { LogoStructureOption } from '@shared/types';

export interface LogoStructureCardProps {
    options: LogoStructureOption[];
    onSelect?: (id: string) => void;
}

export const LogoStructureCard: React.FC<LogoStructureCardProps> = ({ options, onSelect }) => {
    // Debug log
    React.useEffect(() => {
        if (options && options.length > 0) {
            console.log('🎨 LogoStructureCard rendering with options:', options.length);
        }
    }, [options]);

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
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        onClick={() => onSelect && onSelect(option.id)}
                        className={`
                            relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden
                            ${option.isSelected
                                ? 'bg-white border-green-500 shadow-xl'
                                : 'bg-gray-50 border-gray-200 hover:border-green-300 hover:bg-white shadow-md'}
                        `}
                    >
                        {/* selection indicator */}
                        <div className={`
                            absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                            ${option.isSelected
                                ? 'bg-green-500 scale-100 shadow-lg shadow-green-500/50'
                                : 'bg-gray-200 scale-90 opacity-0 group-hover:opacity-100'}
                        `}>
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>

                        {/* Background Gradient Blob - reduced intensity and changed colors for light mode */}
                        <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[50px] transition-all duration-500 ${option.isSelected ? 'bg-green-500/10' : 'bg-gray-200/50 group-hover:bg-green-500/5'
                            }`} />

                        <div className="flex flex-col h-full relative z-10">
                            <h4 className={`text-xl font-bold mb-3 tracking-tight ${option.isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                                {option.type}
                            </h4>

                            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4 flex-grow">
                                {option.reasoning}
                            </p>

                            <div className="pt-4 mt-auto border-t border-gray-100 flex items-center gap-2">
                                <div className={`px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${option.suitability.toLowerCase() === 'high' ? 'bg-green-100 text-green-700' :
                                    option.suitability.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                    {option.suitability} Match
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default LogoStructureCard;
