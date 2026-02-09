import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandCard, CardType, CardStatus } from './BrandCard';
import {
    Tag, Target, Palette, Type, Volume2, Image, FileText, Heart
} from 'lucide-react';

/**
 * Data structure representing a single card in the grid.
 */
export interface CardData {
    /** Unique identifier for the card. */
    id: string;
    /** The type of content the card displays (determines styling/icon). */
    type: CardType;
    /** valid title for the card. */
    title: string;
    /** The current state of the card. */
    status: CardStatus;
    /** The content value(s) to display. */
    value?: string | string[];
}

/**
 * Props for the CardGrid component.
 */
interface CardGridProps {
    /** Array of card data objects to render. */
    cards: CardData[];
    /** Callback triggered when a card is clicked for editing. */
    onEditCard?: (cardId: string) => void;
    /** Additional CSS classes. */
    className?: string;
}

// Map card types to icons
const cardIcons: Record<CardType, React.ReactNode> = {
    brandName: <Tag size={18} />,
    mission: <Target size={18} />,
    colors: <Palette size={18} />,
    typography: <Type size={18} />,
    voice: <Volume2 size={18} />,
    imagery: <Image size={18} />,
    overview: <FileText size={18} />,
    values: <Heart size={18} />,
    custom: <FileText size={18} />,
};

// Card type to display title
const cardTitles: Record<CardType, string> = {
    brandName: 'Brand Name',
    mission: 'Mission',
    colors: 'Color Palette',
    typography: 'Typography',
    voice: 'Brand Voice',
    imagery: 'Imagery & Style',
    overview: 'Brand Overview',
    values: 'Core Values',
    custom: 'Custom',
};

/**
 * A responsive grid layout for displaying multiple `BrandCard` components.
 * 
 * Handles the staggered animation entrance of cards and responsive column sizing.
 * 
 * @param {CardGridProps} props - The component props.
 */
export const CardGrid: React.FC<CardGridProps> = ({
    cards,
    onEditCard,
    className = ''
}) => {
    // Container animation
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
            }
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${className}`}
        >
            <AnimatePresence mode="popLayout">
                {cards.map((card, index) => (
                    <BrandCard
                        key={card.id}
                        type={card.type}
                        title={card.title || cardTitles[card.type]}
                        icon={cardIcons[card.type]}
                        status={card.status}
                        value={card.value}
                        delay={index}
                        onEdit={onEditCard ? () => onEditCard(card.id) : undefined}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

/**
 * Utility function to generate the initial set of empty cards for a new brand.
 * 
 * @returns {CardData[]} An array of initialized, empty CardData objects.
 */
export const createInitialCards = (): CardData[] => [
    { id: 'brandName', type: 'brandName', title: 'Brand Name', status: 'empty' },
    { id: 'mission', type: 'mission', title: 'Mission Statement', status: 'empty' },
    { id: 'overview', type: 'overview', title: 'Brand Overview', status: 'empty' },
    { id: 'values', type: 'values', title: 'Core Values', status: 'empty' },
    { id: 'voice', type: 'voice', title: 'Brand Voice', status: 'empty' },
    { id: 'colors', type: 'colors', title: 'Color Palette', status: 'empty' },
    { id: 'typography', type: 'typography', title: 'Typography', status: 'empty' },
    { id: 'imagery', type: 'imagery', title: 'Imagery & Style', status: 'empty' },
];
