import React from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

/**
 * Props for the BrandNameCard component.
 */
export interface BrandNameCardProps {
    /** The generated brand name to display. */
    name: string;
    /** Optional tagline or slogan associated with the brand name. */
    tagline?: string;
}

/**
 * A stylized card component for displaying a generated brand name and tagline.
 * 
 * Features:
 * - Gradient background.
 * - Crown icon.
 * - Animated entrance.
 * 
 * @param {BrandNameCardProps} props - The component props.
 */
export const BrandNameCard: React.FC<BrandNameCardProps> = ({ name, tagline }) => {
    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="min-w-[280px] max-w-[400px] p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl"
        >
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
                <Crown className="w-5 h-5 text-white" />
            </div>

            {/* Brand Name */}
            <h1 className="text-2xl font-bold mb-2 tracking-tight">{name}</h1>

            {/* Tagline */}
            {tagline && (
                <p className="text-slate-400 text-sm italic">{tagline}</p>
            )}
        </motion.div>
    );
};

export default BrandNameCard;
