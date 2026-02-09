import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';

/**
 * Props for the ColorPaletteCard component.
 */
export interface ColorPaletteCardProps {
    /** Array of hex color codes to display. */
    colors: string[];
    /** Name of the palette (e.g., "Modern Minimalist"). */
    paletteName?: string;
    /** Callback triggered when a specific color swatch is clicked. */
    onColorClick?: (color: string) => void;
    /** Whether this palette is currently selected/active. */
    isSelected?: boolean;
}

/**
 * A card component that displays a set of colors as a palette.
 * 
 * Features:
 * - Interactive color swatches with hover effects.
 * - Selection state styling.
 * - Displays hex codes on hover.
 * 
 * @param {ColorPaletteCardProps} props - The component props.
 */
export const ColorPaletteCard: React.FC<ColorPaletteCardProps> = ({
    colors,
    paletteName = 'Color Palette',
    onColorClick,
    isSelected = false,
}) => {
    const [hoveredColor, setHoveredColor] = useState<string | null>(null);
    const hasColors = colors && colors.length > 0;

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
                min-w-[280px] max-w-[320px] p-4 rounded-xl bg-white border shadow-lg shadow-slate-200/50
                ${isSelected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                        <Palette className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-800">{paletteName}</h3>
                </div>
                {(hasColors || isSelected) && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-400 mb-3">
                {hasColors ? 'Click to select:' : 'No colors generated yet'}
            </p>

            {/* Color Swatches */}
            <div className="flex gap-2 flex-wrap">
                {colors.map((color, index) => (
                    <motion.button
                        key={`${color}-${index}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onMouseEnter={() => setHoveredColor(color)}
                        onMouseLeave={() => setHoveredColor(null)}
                        onClick={() => onColorClick?.(color)}
                        className={`
                            w-12 h-12 rounded-lg shadow-md border-2 transition-all cursor-pointer
                            ${hoveredColor === color
                                ? 'border-indigo-400 scale-110 shadow-lg'
                                : 'border-white/50 hover:border-slate-300'
                            }
                        `}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
            </div>

            {/* Hovered Color Info */}
            <AnimatePresence>
                {hoveredColor && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="mt-3 text-xs text-slate-500 flex items-center gap-2"
                    >
                        <div
                            className="w-4 h-4 rounded border border-slate-200"
                            style={{ backgroundColor: hoveredColor }}
                        />
                        <span className="font-mono">{hoveredColor}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ColorPaletteCard;
