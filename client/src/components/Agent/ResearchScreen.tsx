import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Palette, Type, Target, Sparkles, MicOff, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';

// Type for streaming thoughts
interface ThoughtItem {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'complete';
}

interface ResearchStep {
    id: string;
    label: string;
    icon: React.ReactNode;
    status: 'pending' | 'active' | 'complete';
}

interface ResearchScreenProps {
    isVisible: boolean;
    currentStep: number;
    message: string;
    competitors: string[];
    thoughts: ThoughtItem[];
    brandName?: string;
    industry?: string;
}

const RESEARCH_STEPS: Omit<ResearchStep, 'status'>[] = [
    { id: 'vision', label: 'Analyzing your vision', icon: <Target size={16} /> },
    { id: 'competitors', label: 'Finding competitors', icon: <Search size={16} /> },
    { id: 'palettes', label: 'Generating color palettes', icon: <Palette size={16} /> },
    { id: 'typography', label: 'Crafting typography', icon: <Type size={16} /> },
    { id: 'strategy', label: 'Building brand strategy', icon: <Sparkles size={16} /> },
];

// Clearbit logo helper
const getCompetitorLogo = (companyName: string): string => {
    const domainMap: Record<string, string> = {
        'nike': 'nike.com', 'adidas': 'adidas.com', 'puma': 'puma.com',
        'under armour': 'underarmour.com', 'new balance': 'newbalance.com',
        'reebok': 'reebok.com', 'asics': 'asics.com', 'spotify': 'spotify.com',
    };
    const normalized = companyName.toLowerCase().trim();
    return `https://logo.clearbit.com/${domainMap[normalized] || (normalized.replace(/\s+/g, '') + '.com')}`;
};

// Thinking Stream - Just renders thoughts, parent handles scrolling
const ThinkingStream: React.FC<{ thoughts: ThoughtItem[] }> = ({ thoughts }) => {
    if (thoughts.length === 0) return null;

    return (
        <div className="ml-8 space-y-1">
            {thoughts.map((thought) => (
                <div
                    key={thought.id}
                    className={`text-xs font-mono ml-1 ${thought.status === 'active'
                        ? 'text-amber-300'
                        : thought.status === 'complete'
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        }`}
                >
                    <span className="mr-2">
                        {thought.status === 'complete' ? '✓' : thought.status === 'active' ? '›' : '○'}
                    </span>
                    {thought.text}
                </div>
            ))}
        </div>
    );
};

// Competitor Logo Card - Enhanced with domain extraction and multi-fallback
const CompetitorCard: React.FC<{ name: string; index: number }> = ({ name, index }) => {
    const [imgError, setImgError] = useState(false);
    const [useFavicon, setUseFavicon] = useState(false);

    // Extract domain if provided in format "Name (domain.com)"
    const domainMatch = name.match(/\(([^)]+)\)/);
    const displayName = domainMatch ? name.replace(domainMatch[0], '').trim() : name;
    const domain = domainMatch ? domainMatch[1] : null;

    // Build logo URL with fallback chain
    const getClearbitUrl = (d: string) => `https://logo.clearbit.com/${d}`;
    const getGoogleFaviconUrl = (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;

    const logoUrl = domain
        ? (useFavicon ? getGoogleFaviconUrl(domain) : getClearbitUrl(domain))
        : getCompetitorLogo(displayName);

    const handleImageError = () => {
        if (!useFavicon && domain) {
            // Try Google Favicons next
            setUseFavicon(true);
        } else {
            // All failed, show initials
            setImgError(true);
        }
    };

    const getAvatarColor = (str: string): string => {
        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-emerald-500'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.15, type: 'spring', stiffness: 200 }}
            className="flex flex-col items-center gap-1 p-2 bg-slate-700/30 rounded-lg border border-slate-600/50"
        >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center">
                {!imgError ? (
                    <img src={logoUrl} alt={displayName} className="w-full h-full object-contain p-0.5" onError={handleImageError} />
                ) : (
                    <div className={`w-full h-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold text-sm`}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <span className="text-[10px] text-slate-400 font-medium text-center max-w-[60px] truncate">{displayName}</span>
        </motion.div>
    );
};

// Accordion Step with Thinking Stream
const AccordionStep: React.FC<{
    step: ResearchStep;
    stepIndex: number;
    currentStep: number;
    thoughts: ThoughtItem[];
    competitors: string[];
}> = ({ step, stepIndex, currentStep, thoughts, competitors }) => {
    // Auto-collapse logic: only expand if the step is currently ACTIVE
    const isExpanded = step.status === 'active';

    // Filter thoughts for this step (by step index in thought id)
    const stepThoughts = thoughts.filter(t => t.id.startsWith(`step${stepIndex}-`));

    // Scroll ref for auto-scrolling to latest thought
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new thoughts appear
    useEffect(() => {
        if (scrollContainerRef.current && stepThoughts.length > 0) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [stepThoughts]);

    const getStatusIcon = () => {
        switch (step.status) {
            case 'complete': return <CheckCircle2 size={14} className="text-emerald-400" />;
            case 'active': return <Loader2 size={14} className="text-amber-400 animate-spin" />;
            default: return <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600" />;
        }
    };

    return (
        <motion.div
            layout // Enable layout animations
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`rounded-lg overflow-hidden transition-colors ${step.status === 'active'
                ? 'bg-amber-500/10 border border-amber-500/30'
                : step.status === 'complete'
                    ? 'bg-emerald-500/5 border border-transparent'
                    : 'bg-transparent opacity-40'
                }`}
        >
            {/* Header */}
            <motion.div layout="position" className="flex items-center gap-2 py-2 px-3">
                <div className="flex-shrink-0">{getStatusIcon()}</div>
                <div className={`flex-shrink-0 ${step.status === 'active' ? 'text-amber-400' : 'text-slate-500'}`}>
                    {step.icon}
                </div>
                <span className={`text-sm font-medium flex-1 ${step.status === 'active' ? 'text-white' : 'text-slate-400'}`}>
                    {step.label}
                </span>
                {isExpanded && <ChevronDown size={14} className="text-slate-500" />}
            </motion.div>

            {/* Expanded Content - Fixed Height to prevent layout thrashing */}
            <AnimatePresence mode="wait">
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 80 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="px-3 pb-2 overflow-hidden"
                    >
                        {/* Scrollable container for thoughts - ref enables auto-scroll */}
                        <div ref={scrollContainerRef} className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                            {/* Show thinking stream for current step */}
                            {stepThoughts.length > 0 && <ThinkingStream thoughts={stepThoughts} />}

                            {/* Show competitor logos for step 1 */}
                            {stepIndex === 1 && competitors.length > 0 && (
                                <div className="mt-2 ml-8 flex flex-wrap gap-2">
                                    {competitors.map((comp, i) => (
                                        <CompetitorCard key={comp} name={comp} index={i} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Animated Bee (simplified)
const AnimatedBee: React.FC = () => (
    <motion.div
        className="text-5xl"
        animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
        🐝
    </motion.div>
);

// Main ResearchScreen
export const ResearchScreen: React.FC<ResearchScreenProps> = ({
    isVisible,
    currentStep,
    message,
    competitors,
    thoughts,
    brandName,
}) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    // High water mark: never go backwards visually
    const maxStepRef = useRef(0);
    if (currentStep > maxStepRef.current) {
        maxStepRef.current = currentStep;
    }
    // Reset when screen becomes invisible (new session)
    useEffect(() => {
        if (!isVisible) {
            maxStepRef.current = 0;
        }
    }, [isVisible]);

    // Use the max step for visual display
    const effectiveStep = maxStepRef.current;

    useEffect(() => {
        if (!isVisible) { setElapsedTime(0); return; }
        const interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [isVisible]);

    const stepsWithStatus: ResearchStep[] = RESEARCH_STEPS.map((step, index) => ({
        ...step,
        status: index < effectiveStep ? 'complete' : index === effectiveStep ? 'active' : 'pending',
    }));

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
                >
                    {/* Background glows */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center max-w-md w-full mx-4">
                        <AnimatedBee />

                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 text-lg font-bold text-white text-center"
                        >
                            Beevo is building your brand...
                        </motion.h1>

                        <motion.p
                            key={message}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-1 text-xs text-center"
                            style={{
                                background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.6) 0%, rgba(226, 232, 240, 1) 50%, rgba(148, 163, 184, 0.6) 100%)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                                animation: 'shimmer 2s infinite linear'
                            }}
                        >
                            {message}...
                        </motion.p>

                        {/* Steps */}
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-5 w-full p-3 rounded-xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50"
                        >
                            <motion.div layout className="space-y-1.5">
                                {stepsWithStatus.map((step, index) => (
                                    <AccordionStep
                                        key={step.id}
                                        step={step}
                                        stepIndex={index}
                                        currentStep={currentStep}
                                        thoughts={thoughts}
                                        competitors={competitors}
                                    />
                                ))}
                            </motion.div>
                        </motion.div>

                        {/* Footer */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-4 flex items-center gap-5 text-slate-500 text-xs"
                        >
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                <span>{formatTime(elapsedTime)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MicOff size={12} />
                                <span>Mic muted</span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="mt-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/50 border border-slate-700/50"
                        >
                            <Sparkles size={10} className="text-amber-400" />
                            <span className="text-[10px] text-slate-400">Powered by Gemini Deep Think</span>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ResearchScreen;
