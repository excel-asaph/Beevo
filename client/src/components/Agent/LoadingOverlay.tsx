import React from 'react';
import { motion } from 'framer-motion';


/**
 * Props for the LoadingOverlay component.
 */
interface LoadingOverlayProps {
    /** The message to display while loading. Defaults to "Beevo is preparing your workspace...". */
    message?: string;
}

/**
 * A full-screen overlay component displayed during initial loading or heavy processing.
 * 
 * Features:
 * - Ambient background glow animations.
 * - Floating "Beevo" logo.
 * - Shimmering text effect for the loading message.
 * - An indeterminate progress bar.
 * 
 * @param {LoadingOverlayProps} props - The component props.
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    message = "Beevo is preparing your workspace..."
}) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900"
        >
            {/* Ambient Background Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative flex flex-col items-center gap-6">
                {/* Logo/Icon with floating animation */}
                <motion.div
                    animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="text-6xl drop-shadow-2xl"
                >
                    🐝
                </motion.div>

                {/* Shimmering Text */}
                <div className="flex flex-col items-center gap-2">
                    <motion.h2
                        className="text-xl font-medium tracking-tight"
                        style={{
                            background: 'linear-gradient(90deg, #94a3b8 0%, #f8fafc 50%, #94a3b8 100%)',
                            backgroundSize: '200% 100%',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                        animate={{
                            backgroundPosition: ['200% 0%', '-200% 0%']
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                    >
                        {message}
                    </motion.h2>


                </div>

                {/* Progress Bar (Indeterminate) */}
                <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-200"
                        animate={{
                            x: ['-100%', '100%']
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        style={{ width: '40%' }}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default LoadingOverlay;
