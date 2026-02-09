import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

/** Valid phases for the thinking process. */
export type ThinkingPhase = 'idle' | 'analyzing' | 'researching' | 'generating' | 'complete' | 'error';

/**
 * Represents a single step in the thought process.
 */
interface ThinkingStep {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    timestamp?: number;
}

/**
 * Props for the ThinkingCard component.
 */
interface ThinkingCardProps {
    /** The current high-level phase of the operation. */
    phase: ThinkingPhase;
    /** The list of individual steps to display. */
    steps: ThinkingStep[];
    /** A text description of the specific action currently being performed (footer). */
    currentAction?: string;
    /** Additional CSS classes. */
    className?: string;
}

const phaseLabels: Record<ThinkingPhase, string> = {
    idle: 'Waiting for input',
    analyzing: 'Analyzing request',
    researching: 'Researching trends',
    generating: 'Generating content',
    complete: 'Task complete',
    error: 'Error occurred'
};

const phaseColors: Record<ThinkingPhase, string> = {
    idle: 'text-slate-400',
    analyzing: 'text-amber-400',
    researching: 'text-blue-400',
    generating: 'text-purple-400',
    complete: 'text-emerald-400',
    error: 'text-red-400'
};

/**
 * A sleek card component that visualizes the AI's "thinking" process.
 * 
 * Displays:
 * - A pulsing brain icon during active states.
 * - A list of steps with status indicators (pending, active spinner, checkmark, error).
 * - A specific "current action" footer.
 * - Completion state feedback.
 * 
 * @param {ThinkingCardProps} props - The component props.
 */
export const ThinkingCard: React.FC<ThinkingCardProps> = ({
    phase,
    steps,
    currentAction,
    className = ''
}) => {
    const isActive = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`
                rounded-xl p-4
                bg-gradient-to-br from-slate-800/80 to-slate-900/80
                border border-slate-700/50
                backdrop-blur-sm
                ${className}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <motion.div
                        animate={isActive ? { rotate: 360 } : {}}
                        transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: 'linear' }}
                    >
                        <Brain className={`w-5 h-5 ${phaseColors[phase]}`} />
                    </motion.div>
                    <h3 className="font-semibold text-white text-sm">AI Thinking</h3>
                </div>

                {isActive && (
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex items-center space-x-1"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animation-delay-200" />
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animation-delay-400" />
                    </motion.div>
                )}
            </div>

            {/* Current phase indicator */}
            <div className={`text-xs font-medium ${phaseColors[phase]} mb-3`}>
                {phaseLabels[phase]}
            </div>

            {/* Steps list */}
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start space-x-2"
                        >
                            {/* Status icon */}
                            <div className="mt-0.5 flex-shrink-0">
                                {step.status === 'pending' && (
                                    <div className="w-4 h-4 rounded-full border border-slate-600" />
                                )}
                                {step.status === 'active' && (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Loader2 className="w-4 h-4 text-indigo-400" />
                                    </motion.div>
                                )}
                                {step.status === 'complete' && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                )}
                                {step.status === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                )}
                            </div>

                            {/* Step text */}
                            <span className={`text-xs leading-relaxed ${step.status === 'active'
                                ? 'text-slate-200'
                                : step.status === 'complete'
                                    ? 'text-slate-400'
                                    : 'text-slate-500'
                                }`}>
                                {step.text}
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Current action footer */}
            {currentAction && isActive && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 pt-3 border-t border-slate-700/50"
                >
                    <div className="flex items-center text-xs text-indigo-300">
                        <ChevronRight className="w-3 h-3 mr-1" />
                        <span>{currentAction}</span>
                    </div>
                </motion.div>
            )}

            {/* Completion message */}
            {phase === 'complete' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 pt-3 border-t border-slate-700/50 text-center"
                >
                    <span className="text-xs text-emerald-400">✓ All tasks completed</span>
                </motion.div>
            )}
        </motion.div>
    );
};
