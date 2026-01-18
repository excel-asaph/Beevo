import React from 'react';
import { motion } from 'framer-motion';

interface LoadingBlock {
    color: string;
    width: number;
    height: number;
    x: number;
    y: number;
}

interface LoadingOverlayProps {
    message: string;
    progress?: number;
    isVisible: boolean;
}

// Animated blocks that morph together
const blocks: LoadingBlock[] = [
    { color: '#f59e0b', width: 60, height: 40, x: 0, y: 0 },      // amber
    { color: '#14b8a6', width: 60, height: 60, x: 65, y: 0 },     // teal
    { color: '#ec4899', width: 60, height: 30, x: 0, y: 45 },     // pink
    { color: '#3b82f6', width: 125, height: 40, x: 0, y: 80 },    // blue
];

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    message,
    progress,
    isVisible,
}) => {
    if (!isVisible) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-100"
        >
            {/* Animated blocks */}
            <motion.div
                className="relative w-32 h-32 mb-8"
                animate={{ rotate: [0, 0, 0] }}
            >
                {blocks.map((block, i) => (
                    <motion.div
                        key={i}
                        initial={{
                            x: 0,
                            y: 0,
                            scale: 0,
                            opacity: 0
                        }}
                        animate={{
                            x: block.x,
                            y: block.y,
                            scale: 1,
                            opacity: 1,
                        }}
                        transition={{
                            delay: i * 0.15,
                            duration: 0.6,
                            type: 'spring',
                            stiffness: 200,
                        }}
                        className="absolute rounded-lg shadow-lg"
                        style={{
                            backgroundColor: block.color,
                            width: block.width,
                            height: block.height,
                        }}
                    />
                ))}

                {/* Pulsing effect on the assembled blocks */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0, 0.3, 0],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        delay: 0.8,
                        duration: 2,
                        repeat: Infinity,
                    }}
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
                    }}
                />
            </motion.div>

            {/* Status message */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center space-x-3 px-6 py-3 bg-white rounded-full shadow-lg border border-slate-100"
            >
                {/* Animated search/process icon */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center"
                >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </motion.div>

                <span className="text-slate-700 font-medium">{message}</span>
            </motion.div>

            {/* Progress bar (optional) */}
            {progress !== undefined && (
                <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 200 }}
                    transition={{ delay: 0.7 }}
                    className="mt-6 h-1.5 bg-slate-200 rounded-full overflow-hidden"
                    style={{ width: 200 }}
                >
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-indigo-500 rounded-full"
                        transition={{ duration: 0.3 }}
                    />
                </motion.div>
            )}
        </motion.div>
    );
};

export default LoadingOverlay;
