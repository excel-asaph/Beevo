import React from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, Lock, ChevronDown, ChevronUp } from 'lucide-react';

export type CardStatus = 'empty' | 'active' | 'complete' | 'locked';
export type CardType =
    | 'brandName'
    | 'mission'
    | 'colors'
    | 'typography'
    | 'voice'
    | 'imagery'
    | 'overview'
    | 'values'
    | 'custom';

interface BrandCardProps {
    type: CardType;
    title: string;
    icon: React.ReactNode;
    status: CardStatus;
    content?: React.ReactNode;
    value?: string | string[];
    onEdit?: () => void;
    onExpand?: () => void;
    isExpanded?: boolean;
    delay?: number;
    className?: string;
}

// Card type color schemes
const cardColors: Record<CardType, { bg: string; border: string; icon: string }> = {
    brandName: { bg: 'from-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400' },
    mission: { bg: 'from-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400' },
    colors: { bg: 'from-pink-500/10', border: 'border-pink-500/30', icon: 'text-pink-400' },
    typography: { bg: 'from-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400' },
    voice: { bg: 'from-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
    imagery: { bg: 'from-cyan-500/10', border: 'border-cyan-500/30', icon: 'text-cyan-400' },
    overview: { bg: 'from-indigo-500/10', border: 'border-indigo-500/30', icon: 'text-indigo-400' },
    values: { bg: 'from-rose-500/10', border: 'border-rose-500/30', icon: 'text-rose-400' },
    custom: { bg: 'from-slate-500/10', border: 'border-slate-500/30', icon: 'text-slate-400' },
};

export const BrandCard: React.FC<BrandCardProps> = ({
    type,
    title,
    icon,
    status,
    content,
    value,
    onEdit,
    onExpand,
    isExpanded = false,
    delay = 0,
    className = ''
}) => {
    const colors = cardColors[type];
    const isLocked = status === 'locked';
    const isComplete = status === 'complete';
    const isEmpty = status === 'empty';

    // Animation variants
    const cardVariants = {
        hidden: {
            opacity: 0,
            y: 30,
            scale: 0.95
        },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 15,
                delay: delay * 0.1
            }
        },
        hover: {
            scale: 1.02,
            y: -4,
            transition: { type: 'spring', stiffness: 400, damping: 25 }
        }
    };

    const renderValue = () => {
        if (isEmpty) {
            return (
                <p className="text-sm text-slate-500 italic">
                    Waiting for input...
                </p>
            );
        }

        if (Array.isArray(value)) {
            // For colors, render swatches
            if (type === 'colors') {
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {value.map((color, i) => (
                            <div
                                key={i}
                                className="w-8 h-8 rounded-lg shadow-inner border border-white/10"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                );
            }
            // For typography, render font names
            if (type === 'typography') {
                return (
                    <div className="space-y-1 mt-2">
                        {value.map((font, i) => (
                            <p key={i} className="text-sm text-slate-300" style={{ fontFamily: font }}>
                                {font}
                            </p>
                        ))}
                    </div>
                );
            }
            // Default list
            return (
                <ul className="mt-2 space-y-1">
                    {value.map((item, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-2" />
                            {item}
                        </li>
                    ))}
                </ul>
            );
        }

        return <p className="text-sm text-slate-300 mt-2 leading-relaxed">{value}</p>;
    };

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={!isLocked ? "hover" : undefined}
            className={`
                relative rounded-xl p-4
                bg-gradient-to-br ${colors.bg} to-transparent
                border ${colors.border}
                backdrop-blur-sm
                transition-colors duration-300
                ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                ${isComplete ? 'ring-2 ring-emerald-500/30' : ''}
                ${className}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    <span className={colors.icon}>{icon}</span>
                    <h3 className="font-semibold text-white text-sm">{title}</h3>
                </div>

                <div className="flex items-center space-x-1">
                    {isComplete && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"
                        >
                            <Check className="w-3 h-3 text-emerald-400" />
                        </motion.div>
                    )}
                    {isLocked && (
                        <Lock className="w-4 h-4 text-slate-500" />
                    )}
                    {!isLocked && !isEmpty && onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                    )}
                    {onExpand && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onExpand(); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[40px]">
                {content || renderValue()}
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 pt-3 border-t border-white/10"
                >
                    {/* Placeholder for expanded content - will be customized per card type */}
                    <p className="text-xs text-slate-500">Additional options will appear here...</p>
                </motion.div>
            )}

            {/* Active indicator pulse */}
            {status === 'active' && (
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500"
                />
            )}
        </motion.div>
    );
};
