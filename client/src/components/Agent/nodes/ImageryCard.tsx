import React from 'react';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';

/**
 * Props for the ImageryCard component.
 */
export interface ImageryCardProps {
    /** Array of image objects to display. */
    images: { url: string; label?: string }[];
    /** Title of the card. Defaults to 'Imagery'. */
    title?: string;
    /** Callback triggered when an image is clicked. */
    onImageClick?: (url: string) => void;
}

/**
 * A reusable card component for displaying a grid of inspirational images.
 * 
 * Features:
 * - Grid layout for multiple images.
 * - Handles image loading errors with a fallback.
 * - "Show more" indicator if there are more than 6 images.
 * - Click-to-view interaction.
 * 
 * @param {ImageryCardProps} props - The component props.
 */
export const ImageryCard: React.FC<ImageryCardProps> = ({
    images,
    title = 'Imagery',
    onImageClick,
}) => {
    const { resolveAssetUrl } = useWorkspace();
    const hasImages = images && images.length > 0;

    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="min-w-[280px] max-w-[400px] p-4 rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-200/50"
        >
            {/* Header */}
            <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-slate-800">{title}</h3>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-400 mb-3">
                {hasImages ? `${images.length} inspiration${images.length > 1 ? 's' : ''}` : 'No images yet'}
            </p>

            {/* Image Grid */}
            <div className="grid grid-cols-3 gap-2">
                {images.slice(0, 6).map((img, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => onImageClick?.(img.url)}
                    >
                        <img
                            src={resolveAssetUrl(img.url)}
                            alt={img.label || `Inspiration ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            onError={(e) => {
                                // Fallback for broken images
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23e2e8f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" fill="%2394a3b8" dy=".3em">?</text></svg>';
                            }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    </motion.div>
                ))}
            </div>

            {/* Show more indicator */}
            {images.length > 6 && (
                <p className="text-xs text-slate-400 text-center mt-2">
                    +{images.length - 6} more
                </p>
            )}
        </motion.div>
    );
};

export default ImageryCard;
