import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Brain,
    MessageSquare,
    Settings2,
    Sparkles,
    Bot,
    Mic,
    MicOff,
    History
} from 'lucide-react';
import { ThinkingStep, ThinkingPhase } from './ThinkingPanel';

import { useBrandStore } from '../../stores/useBrandStore';
import { useActivityStore } from '../../stores/useActivityStore';
import { ActivityItem } from '../ControlCenter/ActivityItem';

/**
 * Defined tabs available in the Control Center.
 */
type ControlCenterTab = 'assistant' | 'thinking' | 'studio' | 'settings';

/**
 * Custom Scrollbar Styles injected into the component.
 */
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }
`;

/**
 * Props for the ControlCenter component.
 */
interface ControlCenterProps {
    /** Whether the control center panel is currently visible. */
    isOpen: boolean;
    /** Callback to close the panel. */
    onClose: () => void;
    // AI Thinking
    /** Current phase of the AI's reasoning process. */
    thinkingPhase: ThinkingPhase;
    /** List of steps taken by the AI during its reasoning. */
    thinkingSteps: ThinkingStep[];
    // Mic control
    /** Whether the microphone is currently muted. */
    isMuted?: boolean;
    /** Callback to toggle microphone mute state. */
    onToggleMute?: () => void;
    // AI Voice State (from store - matches VoiceOrb)
    /** Current voice interaction state of the AI. */
    aiVoiceState?: 'idle' | 'listening' | 'thinking' | 'speaking';
    // Connection
    /** WebSocket connection status. */
    connectionStatus?: 'connected' | 'disconnected' | 'connecting';
    // Transcript
    /** Conversation transcript history. */
    transcript?: Array<{ role: 'user' | 'ai'; text: string; timestamp?: Date }>;
    // Actions
    /** Callback to run initial system setup/initializers. */
    onRunInitializers?: () => void;
}

// Inject styles
const StyleInjector = () => (
    <style>{scrollbarStyles}</style>
);

const phaseLabels: Record<ThinkingPhase, string> = {
    idle: 'Ready',
    analyzing: 'Analyzing',
    researching: 'Researching',
    generating: 'Generating',
    complete: 'Complete',
    error: 'Error',
};

// Tab configuration
const tabs: { id: ControlCenterTab; icon: React.ElementType; label: string }[] = [
    { id: 'assistant', icon: Bot, label: 'AI Assistant' },
    { id: 'thinking', icon: Brain, label: 'AI Thinking' },
    { id: 'studio', icon: Sparkles, label: 'Logo Studio' },
    { id: 'settings', icon: Settings2, label: 'Settings' },
];

// Animated AI Eyes Component
/**
 * Animated AI Eyes component that blinks and reacts to voice state.
 * 
 * @param {Object} props
 * @param {'idle' | 'listening' | 'speaking'} props.voiceState - The current voice state.
 */
const AIEyes: React.FC<{ voiceState: 'idle' | 'listening' | 'speaking' }> = ({ voiceState }) => {
    const [isBlinking, setIsBlinking] = useState(false);

    // Random blink effect
    useEffect(() => {
        const blinkInterval = setInterval(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 150);
        }, 3000 + Math.random() * 2000); // Blink every 3-5 seconds

        return () => clearInterval(blinkInterval);
    }, []);

    const eyeVariants = {
        open: { scaleY: 1 },
        blink: { scaleY: 0.1 },
        listening: { scaleY: 0.85 },
    };

    const currentState = isBlinking ? 'blink' : voiceState === 'listening' ? 'listening' : 'open';

    return (
        <div className="flex items-center justify-center gap-6">
            {[0, 1].map((i) => (
                <motion.div
                    key={i}
                    className="w-14 h-24 bg-gray-900 rounded-full"
                    variants={eyeVariants}
                    animate={currentState}
                    transition={{
                        duration: isBlinking ? 0.08 : 0.3,
                        ease: 'easeInOut'
                    }}
                    style={{ originY: 0.5 }}
                />
            ))}
        </div>
    );
};

// Voice Waveform Component
/**
 * Animated Voice Waveform component.
 * Displays a set of bars that animate based on the current voice state.
 * 
 * @param {Object} props
 * @param {'idle' | 'listening' | 'speaking'} props.state - The animation state.
 */
const VoiceWaveform: React.FC<{ state: 'idle' | 'listening' | 'speaking' }> = ({ state }) => {
    const barCount = 5;

    return (
        <div className="flex items-end justify-center gap-1 h-8">
            {Array.from({ length: barCount }).map((_, i) => (
                <motion.div
                    key={i}
                    className="w-1 bg-gray-400 rounded-full"
                    animate={{
                        height: state === 'idle'
                            ? 4
                            : state === 'listening'
                                ? [8, 16, 8]
                                : [8, 24, 12, 20, 8],
                        backgroundColor: state === 'speaking'
                            ? '#6366f1'
                            : state === 'listening'
                                ? '#10b981'
                                : '#9ca3af'
                    }}
                    transition={{
                        height: {
                            duration: state === 'idle' ? 0.3 : 0.4 + i * 0.1,
                            repeat: state === 'idle' ? 0 : Infinity,
                            repeatType: 'reverse',
                            ease: 'easeInOut',
                        },
                        backgroundColor: { duration: 0.2 }
                    }}
                    style={{ minHeight: 4 }}
                />
            ))}
        </div>
    );
};

// AI Assistant Page
/**
 * Sub-page: AI Assistant.
 * Displays the main AI interface with eyes, voice controls, and status.
 */
const AIAssistantPage: React.FC<{
    isMuted: boolean;
    onToggleMute: () => void;
    aiVoiceState: 'idle' | 'listening' | 'thinking' | 'speaking';
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    onTranscriptClick: () => void;
}> = ({ isMuted, onToggleMute, aiVoiceState, connectionStatus, onTranscriptClick }) => {
    // Derive display state from connection and AI voice state
    let displayState: 'idle' | 'listening' | 'speaking' = 'idle';
    let statusText = 'Offline';

    if (connectionStatus === 'connected') {
        // Map aiVoiceState to display state
        if (aiVoiceState === 'speaking') {
            displayState = 'speaking';
            statusText = 'Speaking';
        } else if (aiVoiceState === 'thinking') {
            displayState = 'listening'; // Eyes narrow slightly
            statusText = 'Thinking...';
        } else if (aiVoiceState === 'listening') {
            displayState = 'listening';
            statusText = 'Listening';
        } else {
            displayState = 'idle';
            statusText = 'Ready';
        }
    } else if (connectionStatus === 'connecting') {
        displayState = 'idle';
        statusText = 'Connecting...';
    } else {
        displayState = 'idle';
        statusText = 'Offline';
    }

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* AI Eyes - True Center */}
            <div className="flex-1 flex items-center justify-center">
                <AIEyes voiceState={displayState} />
            </div>

            {/* Bottom Controls - Fixed at bottom */}
            <div className="w-full flex items-center justify-between px-4 pb-4">
                {/* Mic Button - Left */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleMute}
                    disabled={connectionStatus !== 'connected'}
                    className={`p-2.5 rounded-full transition-all ${isMuted && connectionStatus === 'connected'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </motion.button>

                {/* Voice Waveform - Center */}
                <div className="flex flex-col items-center gap-2">
                    <VoiceWaveform state={displayState} />
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        {statusText}
                    </span>
                </div>

                {/* Transcript Button - Right */}
                <button
                    onClick={onTranscriptClick}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600 hover:text-gray-800"
                >
                    <MessageSquare size={18} />
                </button>
            </div>
        </div>
    );
};

// AI Thinking Page - Updated to use Activity Store and Grouping (Synced with ThinkingPanel)
/**
 * Sub-page: AI Thinking.
 * Displays a feed of the AI's rigorous reasoning process (activity feed).
 * Auto-scrolls and groups related activities.
 */
const AIThinkingPage: React.FC = () => {
    const { activities, hydrateActivities } = useActivityStore();
    const { activeWorkspaceId } = useBrandStore();
    const [expandedIds, setExpandedIds] = useState<string[]>([]);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Hydrate logic
    useEffect(() => {
        if (activeWorkspaceId) {
            hydrateActivities(activeWorkspaceId);
        }
    }, [activeWorkspaceId, hydrateActivities]);

    // Grouping Logic (Duplicated from ThinkingPanel for now to avoid circular deps or complex refactor)
    const groupedActivities = React.useMemo(() => {
        const result: any[] = [];
        let currentGroup: any | null = null; // Using any to avoid complex type surgery in this file for now

        for (const item of activities) {
            if (currentGroup && item.title === currentGroup.title) {
                currentGroup.children = [...(currentGroup.children || []), item];
                currentGroup.timestamp = item.timestamp;
                if (item.status === 'running') currentGroup.status = 'running';
            } else {
                if (currentGroup) result.push(currentGroup);
                currentGroup = {
                    ...item,
                    children: [item],
                    isGroup: false
                };
            }
        }
        if (currentGroup) result.push(currentGroup);

        return result.map(g => {
            if (g.children && g.children.length > 1) {
                return { ...g, isGroup: true, id: `group-${g.children[0].id}` };
            }
            return g.children ? g.children[0] : g;
        });
    }, [activities]);

    // Auto-expand new running items AND Auto-Scroll
    useEffect(() => {
        const runningItems = groupedActivities.filter((a: any) => a.status === 'running' || a.status === 'pending');
        if (runningItems.length > 0) {
            const latest = runningItems[runningItems.length - 1];
            if (!expandedIds.includes(latest.id)) {
                setExpandedIds(prev => [...prev, latest.id]);
            }
        }
        // Auto-scroll to bottom on activity change
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [groupedActivities.length, expandedIds.length]);

    const toggleItem = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-gray-800">Activity Feed</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                    {activities.length} Events
                </div>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {groupedActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <History className="w-8 h-8 opacity-20" />
                        <p className="text-xs">No activity history yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col justify-start min-h-0 py-2">
                        {groupedActivities.map((item: any) => (
                            <ActivityItem
                                key={item.id}
                                item={item}
                                isExpanded={expandedIds.includes(item.id)}
                                onToggle={() => toggleItem(item.id)}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            {/* Status Bar */}
            <div className="px-3 py-2 border-t border-gray-100 bg-white text-[10px] text-center text-gray-400 uppercase tracking-wider font-medium">
                Real-time Connection Active
            </div>
        </div>
    );
};

// Transcript Modal
/**
 * Modal to display the full conversation transcript.
 */
const TranscriptModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    transcript: Array<{ role: 'user' | 'ai'; text: string; timestamp?: Date }>;
}> = ({ isOpen, onClose, transcript }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col rounded-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-sm font-bold text-gray-800">Transcript</span>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {transcript.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-8">
                                Conversation history will appear here...
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {transcript.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] ${msg.role === 'ai'
                                            ? 'bg-gray-100 text-gray-700'
                                            : 'bg-indigo-500 text-white'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const ControlCenter: React.FC<ControlCenterProps> = ({
    isOpen,
    onClose,
    thinkingPhase,
    thinkingSteps,
    isMuted = false,
    onToggleMute = () => { },
    aiVoiceState = 'idle',
    connectionStatus = 'connected',

    transcript = [],
    onRunInitializers,
}) => {
    const [activeTab, setActiveTab] = useState<ControlCenterTab>('assistant');
    const [showTranscript, setShowTranscript] = useState(false);

    return (
        <AnimatePresence>
            <StyleInjector />
            {isOpen && (
                <motion.div
                    initial={{ x: 320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 320, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="absolute top-4 right-4 bottom-4 w-72 bg-white/98 backdrop-blur-xl border border-gray-300 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl overflow-hidden flex flex-col z-50"
                >
                    {/* Tab Bar */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`p-2 rounded-lg transition-all ${isActive
                                            ? 'bg-gray-900 text-white'
                                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                            }`}
                                        title={tab.label}
                                    >
                                        <Icon size={16} />
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 relative overflow-hidden">
                        {/* AI Assistant Page */}
                        {activeTab === 'assistant' && (
                            <AIAssistantPage
                                isMuted={isMuted}
                                onToggleMute={onToggleMute}
                                aiVoiceState={aiVoiceState}
                                connectionStatus={connectionStatus}
                                onTranscriptClick={() => setShowTranscript(true)}
                            />
                        )}

                        {/* AI Thinking Page */}
                        {activeTab === 'thinking' && (
                            <AIThinkingPage />
                        )}

                        {/* Logo Studio Page */}
                        {activeTab === 'studio' && (
                            <div className="flex-1 flex items-center justify-center p-4">
                                <p className="text-xs text-gray-400 text-center">
                                    Logo Studio coming soon...
                                </p>
                            </div>
                        )}



                        {/* Settings Page */}
                        {activeTab === 'settings' && (
                            <div className="flex-1 flex items-center justify-center p-4">
                                <p className="text-xs text-gray-400 text-center">
                                    Settings coming soon...
                                </p>
                            </div>
                        )}

                        {/* Transcript Modal */}
                        <TranscriptModal
                            isOpen={showTranscript}
                            onClose={() => setShowTranscript(false)}
                            transcript={transcript}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ControlCenter;
