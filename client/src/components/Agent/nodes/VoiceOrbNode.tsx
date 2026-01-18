import React from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, Loader } from 'lucide-react';

export type VoiceOrbState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted';

export interface VoiceOrbNodeData {
    state: VoiceOrbState;
    message?: string;
    onActivate?: () => void;
    onDeactivate?: () => void;
    onMute?: () => void;
}

const stateColors: Record<VoiceOrbState, { ring: string; bg: string; icon: string }> = {
    idle: { ring: 'ring-slate-400', bg: 'bg-slate-800', icon: 'text-white' },
    listening: { ring: 'ring-emerald-400', bg: 'bg-emerald-600', icon: 'text-white' },
    processing: { ring: 'ring-amber-400', bg: 'bg-amber-500', icon: 'text-white' },
    speaking: { ring: 'ring-indigo-400', bg: 'bg-indigo-600', icon: 'text-white' },
    muted: { ring: 'ring-red-400', bg: 'bg-red-600', icon: 'text-white' },
};

const stateLabels: Record<VoiceOrbState, string> = {
    idle: 'Click to speak',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Speaking...',
    muted: 'Muted',
};

export const VoiceOrbNode: React.FC<NodeProps> = ({ data }) => {
    const nodeData = data as unknown as VoiceOrbNodeData;
    const state = nodeData.state || 'idle';
    const colors = stateColors[state];

    const handleClick = () => {
        if (state === 'idle' || state === 'muted') {
            nodeData.onActivate?.();
        } else {
            nodeData.onDeactivate?.();
        }
    };

    const renderIcon = () => {
        switch (state) {
            case 'listening':
                return <Mic className={`w-6 h-6 ${colors.icon}`} />;
            case 'processing':
                return (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <Loader className={`w-6 h-6 ${colors.icon}`} />
                    </motion.div>
                );
            case 'speaking':
                return <Volume2 className={`w-6 h-6 ${colors.icon}`} />;
            case 'muted':
                return <MicOff className={`w-6 h-6 ${colors.icon}`} />;
            default:
                return <Mic className={`w-6 h-6 ${colors.icon}`} />;
        }
    };

    return (
        <div className="flex flex-col items-center">
            {/* The Orb */}
            <motion.button
                onClick={handleClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                    relative w-16 h-16 rounded-full 
                    ${colors.bg}
                    ring-4 ${colors.ring}
                    shadow-xl
                    flex items-center justify-center
                    transition-all duration-300
                    cursor-pointer
                `}
            >
                {/* Pulse animation for listening/speaking */}
                {(state === 'listening' || state === 'speaking') && (
                    <>
                        <motion.div
                            className={`absolute inset-0 rounded-full ${colors.bg} opacity-40`}
                            animate={{ scale: [1, 1.5, 1.5], opacity: [0.4, 0, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.div
                            className={`absolute inset-0 rounded-full ${colors.bg} opacity-40`}
                            animate={{ scale: [1, 1.3, 1.3], opacity: [0.4, 0, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                        />
                    </>
                )}

                {renderIcon()}
            </motion.button>

            {/* Status label */}
            <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 px-3 py-1.5 bg-slate-800/90 rounded-full shadow-lg"
            >
                <p className="text-xs text-white font-medium">
                    {stateLabels[state]}
                </p>
            </motion.div>

            {/* Current AI message */}
            {nodeData.message && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 max-w-[200px] p-3 bg-white rounded-xl shadow-lg border border-slate-100"
                >
                    <p className="text-sm text-slate-700 text-center leading-relaxed">
                        {nodeData.message}
                    </p>
                </motion.div>
            )}
        </div>
    );
};

export default VoiceOrbNode;
