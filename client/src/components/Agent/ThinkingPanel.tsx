import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, Loader, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export type ThinkingPhase = 'idle' | 'analyzing' | 'researching' | 'generating' | 'complete' | 'error';

export interface ThinkingStep {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'complete' | 'error';
}

interface ThinkingPanelProps {
    phase: ThinkingPhase;
    steps: ThinkingStep[];
    currentAction?: string;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const phaseLabels: Record<ThinkingPhase, string> = {
    idle: 'Ready',
    analyzing: 'Analyzing',
    researching: 'Researching',
    generating: 'Generating',
    complete: 'Complete',
    error: 'Error',
};

const phaseColors: Record<ThinkingPhase, string> = {
    idle: 'text-slate-400',
    analyzing: 'text-amber-500',
    researching: 'text-sky-500',
    generating: 'text-indigo-500',
    complete: 'text-emerald-500',
    error: 'text-red-500',
};

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
    phase,
    steps,
    currentAction,
    isCollapsed = false,
    onToggleCollapse,
}) => {
    const isActive = phase !== 'idle';
    const isComplete = phase === 'complete';

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`
                w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200
                overflow-hidden
            `}
        >
            {/* Header */}
            <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    <motion.div
                        animate={isActive && !isComplete ? { rotate: 360 } : {}}
                        transition={{ duration: 2, repeat: isActive && !isComplete ? Infinity : 0, ease: 'linear' }}
                    >
                        <Brain className={`w-5 h-5 ${phaseColors[phase]}`} />
                    </motion.div>
                    <span className="font-semibold text-slate-800">AI Thinking</span>
                </div>

                <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${phaseColors[phase]}`}>
                        {phaseLabels[phase]}
                    </span>
                    {onToggleCollapse && (
                        isCollapsed ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100"
                    >
                        {/* Current action */}
                        {currentAction && (
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                <p className="text-xs text-slate-500">{currentAction}</p>
                            </div>
                        )}

                        {/* Steps list */}
                        <div className="max-h-64 overflow-y-auto p-4">
                            {steps.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-4">
                                    AI reasoning will appear here...
                                </p>
                            )}

                            <ul className="space-y-2">
                                {steps.map((step, i) => (
                                    <motion.li
                                        key={step.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-start space-x-2"
                                    >
                                        {step.status === 'active' && (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            >
                                                <Loader className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                                            </motion.div>
                                        )}
                                        {step.status === 'complete' && (
                                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                        )}
                                        {step.status === 'error' && (
                                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        )}
                                        {step.status === 'pending' && (
                                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 mt-0.5 flex-shrink-0" />
                                        )}

                                        <span className={`text-sm ${step.status === 'active' ? 'text-slate-700' :
                                                step.status === 'complete' ? 'text-slate-500' :
                                                    step.status === 'error' ? 'text-red-600' :
                                                        'text-slate-400'
                                            }`}>
                                            {step.text}
                                        </span>
                                    </motion.li>
                                ))}
                            </ul>
                        </div>

                        {/* Completion badge */}
                        {isComplete && steps.length > 0 && (
                            <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100">
                                <div className="flex items-center justify-center space-x-2">
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span className="text-sm font-medium text-emerald-700">
                                        All tasks completed
                                    </span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ThinkingPanel;
