import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { LogoStructureOption } from '@shared/types';

/**
 * Props for the LogoStructureCard component.
 */
export interface LogoStructureCardProps {
    /** List of logo structure options to display. */
    options: LogoStructureOption[];
    /** Callback triggered when an option is selected. */
    onSelect?: (id: string) => void;
}

/**
 * A reusable card component for displaying and selecting logo structure types (e.g., Wordmark, Icon).
 * 
 * Features:
 * - Dynamic icons based on structure type.
 * - Detailed descriptions and suitability badges.
 * - Selection state styling.
 * 
 * @param {LogoStructureCardProps} props - The component props.
 */
export const LogoStructureCard: React.FC<LogoStructureCardProps> = ({ options, onSelect }) => {
    // Helper to get icon based on type
    const getStructureIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('wordmark')) return <div className="flex gap-1"><div className="w-8 h-2 bg-current rounded-sm" /></div>;
        if (t.includes('combination')) return <div className="flex gap-1 items-center"><div className="w-3 h-3 border-2 border-current rounded-full" /><div className="w-6 h-2 bg-current rounded-sm" /></div>;
        if (t.includes('abstract')) return <div className="w-4 h-4 border-2 border-current rounded-tr-lg rounded-bl-lg" />;
        return <div className="w-4 h-4 border-2 border-current rounded-sm" />;
    };

    if (!options || options.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((option) => (
                    <motion.div
                        key={option.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        onClick={() => onSelect && onSelect(option.id)}
                        className={`
                            relative p-5 rounded-3xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden
                            ${option.isSelected
                                ? 'bg-white border-indigo-500 shadow-xl ring-1 ring-indigo-500/20'
                                : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-lg'}
                        `}
                    >
                        {/* Selected Indicator */}
                        {option.isSelected && (
                            <div className="absolute top-3 right-3 text-indigo-500">
                                <div className="bg-indigo-500 text-white rounded-full p-1 shadow-sm">
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col h-full relative z-10">
                            {/* Header: Icon + Title */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-lg ${option.isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-500'} transition-colors`}>
                                    {getStructureIcon(option.type)}
                                </div>
                                <h4 className={`text-lg font-bold tracking-tight ${option.isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {option.type}
                                </h4>
                            </div>

                            {/* Full Description */}
                            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-4">
                                {option.reasoning}
                            </p>

                            <div className="mt-auto flex items-center gap-2">
                                <div className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${option.suitability.toLowerCase() === 'high' ? 'bg-green-100 text-green-700' :
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
