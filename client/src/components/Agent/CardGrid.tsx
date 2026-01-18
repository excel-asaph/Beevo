import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandCard, CardType, CardStatus } from './BrandCard';
import {
    Tag, Target, Palette, Type, Volume2, Image, FileText, Heart
} from 'lucide-react';

export interface CardData {
    id: string;
    type: CardType;
    title: string;
    status: CardStatus;
    value?: string | string[];
}

interface CardGridProps {
    cards: CardData[];
    onEditCard?: (cardId: string) => void;
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

// Utility function to create initial empty cards
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
