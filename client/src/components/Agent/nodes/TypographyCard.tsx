import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Type, Check } from 'lucide-react';

export interface FontOption {
    id?: string;
    name: string;
    category?: 'serif' | 'sans-serif' | 'display' | 'monospace';
    pairing?: string;
    reasoning?: string;
}

interface TypographyCardProps {
    fonts: FontOption[];
    onFontClick?: (fontName: string) => void;
}

const categoryColors: Record<string, string> = {
    'serif': 'bg-amber-100 text-amber-700',
    'sans-serif': 'bg-sky-100 text-sky-700',
    'display': 'bg-purple-100 text-purple-700',
    'monospace': 'bg-emerald-100 text-emerald-700',
};

export const TypographyCard: React.FC<TypographyCardProps> = ({ fonts, onFontClick }) => {
    const [hoveredFont, setHoveredFont] = useState<string | null>(null);
    const hasFonts = fonts && fonts.length > 0;

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="min-w-[280px] max-w-[320px] p-4 rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Type className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-800">Typography</h3>
                </div>
                {hasFonts && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-400 mb-3">
                {hasFonts ? 'Select up to 3 fonts:' : 'No fonts generated yet'}
            </p>

            {/* Font List */}
            <div className="space-y-2">
                {fonts.map((font, index) => {
                    const fontId = font.id || font.name;
                    const category = font.category || 'sans-serif';
                    return (
                        <motion.button
                            key={fontId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.08 }}
                            onMouseEnter={() => setHoveredFont(fontId)}
                            onMouseLeave={() => setHoveredFont(null)}
                            onClick={() => onFontClick?.(font.name)}
                            className={`
                                w-full p-3 rounded-lg border transition-all text-left
                                ${hoveredFont === fontId
                                    ? 'border-indigo-400 bg-indigo-50 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }
                            `}
                        >
                            {/* Font Name + Pairing + Category */}
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
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[category]}`}>
                                        {category}
                                    </span>
                                </div>
                            </div>

                            {/* Font Preview */}
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

                            {/* Reasoning on hover */}
                            <AnimatePresence>
                                {font.reasoning && hoveredFont === fontId && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="text-xs text-slate-500 mt-2 italic"
                                    >
                                        {font.reasoning}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default TypographyCard;
