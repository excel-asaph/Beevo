import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';

/** Possible states for the voice interaction orb. */
export type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

/**
 * Props for the VoiceOrb component.
 */
interface VoiceOrbProps {
    /** Current state of the orb. */
    state: OrbState;
    /** Callback triggered when the orb is clicked in 'idle' state. */
    onActivate: () => void;
    /** Callback triggered when the orb is clicked while active. */
    onDeactivate: () => void;
    /** Additional CSS classes. */
    className?: string;
}

/**
 * An interactive, animated orb component that visualizes the current voice interaction state.
 * 
 * Visualizes:
 * - **Idle**: Passive state, ready to listen.
 * - **Listening**: Reacts to audio input (pulsing).
 * - **Processing**: Thinking/Loading animation.
 * - **Speaking**: Visual feedback while the AI is talking.
 * 
 * @param {VoiceOrbProps} props - The component props.
 */
export const VoiceOrb: React.FC<VoiceOrbProps> = ({
    state,
    onActivate,
    onDeactivate,
    className = ''
}) => {
    const isActive = state !== 'idle';

    const handleClick = () => {
        if (isActive) {
            onDeactivate();
        } else {
            onActivate();
        }
    };

    // Color schemes for different states
    const stateColors = {
        idle: {
            bg: 'from-slate-700 to-slate-800',
            ring: 'ring-slate-600',
            glow: 'shadow-slate-900/50'
        },
        listening: {
            bg: 'from-indigo-500 to-purple-600',
            ring: 'ring-indigo-400',
            glow: 'shadow-indigo-500/50'
        },
        processing: {
            bg: 'from-amber-500 to-orange-600',
            ring: 'ring-amber-400',
            glow: 'shadow-amber-500/50'
        },
        speaking: {
            bg: 'from-emerald-500 to-teal-600',
            ring: 'ring-emerald-400',
            glow: 'shadow-emerald-500/50'
        }
    };

    const colors = stateColors[state];

    return (
        <div className={`relative flex flex-col items-center ${className}`}>
            {/* Ripple effects for active states */}
            <AnimatePresence>
                {isActive && (
                    <>
                        {/* Outer ripple */}
                        <motion.div
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 2.5, opacity: 0 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                            className={`absolute w-24 h-24 rounded-full bg-gradient-to-r ${colors.bg}`}
                        />
                        {/* Middle ripple */}
                        <motion.div
                            initial={{ scale: 1, opacity: 0.4 }}
                            animate={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                            className={`absolute w-24 h-24 rounded-full bg-gradient-to-r ${colors.bg}`}
                        />
                    </>
                )}
            </AnimatePresence>

            {/* Main orb button */}
            <motion.button
                onClick={handleClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                    scale: state === 'listening' ? [1, 1.08, 1] : 1,
                }}
                transition={{
                    scale: {
                        duration: 1.5,
                        repeat: state === 'listening' ? Infinity : 0,
                        ease: 'easeInOut'
                    }
                }}
                className={`
                    relative z-10 w-24 h-24 rounded-full 
                    bg-gradient-to-br ${colors.bg}
                    ${colors.ring} ring-2 ring-offset-2 ring-offset-slate-950
                    shadow-2xl ${colors.glow}
                    flex items-center justify-center
                    transition-all duration-300
                    cursor-pointer
                    focus:outline-none focus:ring-4
                `}
            >
                <AnimatePresence mode="wait">
                    {state === 'idle' && (
                        <motion.div
                            key="mic"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                        >
                            <Mic className="w-10 h-10 text-white" />
                        </motion.div>
                    )}
                    {state === 'listening' && (
                        <motion.div
                            key="listening"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                        >
                            <Mic className="w-10 h-10 text-white" />
                        </motion.div>
                    )}
                    {state === 'processing' && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 360 }}
                            transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
                            exit={{ opacity: 0, scale: 0.5 }}
                        >
                            <Loader2 className="w-10 h-10 text-white" />
                        </motion.div>
                    )}
                    {state === 'speaking' && (
                        <motion.div
                            key="speaking"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: [1, 1.1, 1] }}
                            transition={{ scale: { duration: 0.5, repeat: Infinity } }}
                            exit={{ opacity: 0, scale: 0.5 }}
                        >
                            <MicOff className="w-10 h-10 text-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* State label */}
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-sm font-medium text-slate-400"
            >
                {state === 'idle' && 'Click or say "Hey Gemini"'}
                {state === 'listening' && 'Listening...'}
                {state === 'processing' && 'Thinking...'}
                {state === 'speaking' && 'Speaking...'}
            </motion.p>
        </div>
    );
};
