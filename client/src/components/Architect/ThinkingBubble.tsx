import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Brain, Sparkles, Target, Zap } from 'lucide-react';

interface ThinkingBubbleProps {
    isThinking: boolean;
    startTime: number | null;
    duration: number | null;
    thoughts: string[];
    toolDecided: string | null;
    phase: 'classify' | 'analyze' | 'decide' | 'execute' | null;
}

const phaseIcons = {
    classify: Target,
    analyze: Brain,
    decide: Sparkles,
    execute: Zap
};

const phaseLabels = {
    classify: 'Classifying intent',
    analyze: 'Analyzing context',
    decide: 'Deciding action',
    execute: 'Executing'
};

export const ThinkingBubble: React.FC<ThinkingBubbleProps> = ({
    isThinking,
    startTime,
    duration,
    thoughts,
    toolDecided,
    phase
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    // Real-time timer while thinking
    useEffect(() => {
        if (isThinking && startTime) {
            const interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 100);
            return () => clearInterval(interval);
        }
    }, [isThinking, startTime]);

    // Reset elapsed when done
    useEffect(() => {
        if (!isThinking && duration !== null) {
            setElapsed(Math.floor(duration / 1000));
        }
    }, [isThinking, duration]);

    // Don't render if no thinking data
    if (!isThinking && thoughts.length === 0) {
        return null;
    }

    const PhaseIcon = phase ? phaseIcons[phase] : Brain;
    const displayTime = isThinking ? elapsed : (duration ? Math.floor(duration / 1000) : 0);

    return (
        <div className="my-2 mx-1">
            {/* Main toggle button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left
                    transition-all duration-200
                    ${isThinking
                        ? 'bg-purple-900/40 border border-purple-500/30 animate-pulse'
                        : 'bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60'
                    }
                `}
            >
                {/* Expand chevron */}
                {isExpanded ? (
                    <ChevronDown size={14} className="text-slate-400" />
                ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                )}

                {/* Brain icon with phase indicator */}
                <div className={`
                    p-1 rounded-md
                    ${isThinking ? 'bg-purple-500/30' : 'bg-slate-700/50'}
                `}>
                    <PhaseIcon size={12} className={isThinking ? 'text-purple-400' : 'text-slate-400'} />
                </div>

                {/* Status text */}
                <span className={`text-xs font-medium flex-1 ${isThinking ? 'text-purple-300' : 'text-slate-400'}`}>
                    {isThinking ? (
                        <>
                            {phase ? phaseLabels[phase] : 'Thinking'}...
                            <span className="ml-2 text-purple-400 tabular-nums">{displayTime}s</span>
                        </>
                    ) : (
                        <>
                            Thought for <span className="text-slate-300 tabular-nums">{displayTime}s</span>
                            {toolDecided && (
                                <span className="ml-2 text-emerald-400">→ {toolDecided.replace(/_/g, ' ')}</span>
                            )}
                        </>
                    )}
                </span>
            </button>

            {/* Expanded thoughts panel */}
            {isExpanded && thoughts.length > 0 && (
                <div className="mt-1 ml-5 pl-3 border-l-2 border-slate-700/50">
                    <div className="space-y-1 py-2">
                        {thoughts.map((thought, idx) => (
                            <div
                                key={idx}
                                className="text-xs text-slate-500 flex items-start gap-2"
                            >
                                <span className="text-slate-600 select-none">›</span>
                                <span className="text-slate-400">{thought}</span>
                            </div>
                        ))}
                        {toolDecided && (
                            <div className="text-xs text-emerald-500 flex items-center gap-2 pt-1 border-t border-slate-700/30 mt-2">
                                <Zap size={10} />
                                <span>Decision: {toolDecided.replace(/_/g, ' ')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
