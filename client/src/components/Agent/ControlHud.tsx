import React from 'react';
import { motion } from 'framer-motion';
import {
    MousePointer2,
    Hand,
    Square,
    Type,
    Pencil,
    Lock,
    Unlock,
    Mic,
    Loader,
    Volume2,
    Undo2,
    Redo2
} from 'lucide-react';

export type InteractionMode = 'select' | 'pan' | 'add' | 'text' | 'draw';
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ControlHudProps {
    mode: InteractionMode;
    setMode: (mode: InteractionMode) => void;
    isLocked: boolean;
    onToggleLock: () => void;
    // Voice Orb Props
    voiceState?: VoiceState;
    onVoiceToggle?: () => void;
    // History
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

// Voice Orb styling based on state
const voiceStateStyles: Record<VoiceState, { bg: string; ring: string }> = {
    idle: { bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', ring: 'ring-indigo-300/50' },
    listening: { bg: 'bg-gradient-to-br from-emerald-500 to-teal-600', ring: 'ring-emerald-300/50' },
    thinking: { bg: 'bg-gradient-to-br from-amber-500 to-orange-600', ring: 'ring-amber-300/50' },
    speaking: { bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', ring: 'ring-indigo-300/50' },
};

const voiceStateTooltips: Record<VoiceState, string> = {
    idle: 'Click to speak',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'AI Speaking...',
};

export const ControlHud: React.FC<ControlHudProps> = ({
    mode,
    setMode,
    isLocked,
    onToggleLock,
    voiceState = 'idle',
    onVoiceToggle,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false
}) => {
    const ToolButton = ({
        icon: Icon,
        active,
        onClick,
        label,
        showDot = false,
        disabled = false
    }: {
        icon: any,
        active?: boolean,
        onClick: () => void,
        label: string,
        showDot?: boolean,
        disabled?: boolean
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative p-2.5 rounded-xl transition-all duration-200 group
                ${active
                    ? 'bg-gray-950 text-white'
                    : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                }
            `}
        >
            <Icon size={16} strokeWidth={2.5} />
            {showDot && !active && !disabled && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}

            {/* Tooltip */}
            {!disabled && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-white text-gray-700 text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-100 flex items-center gap-2">
                    <span>{label.split('(')[0].trim()}</span>
                    {label.includes('(') && (
                        <span className="text-gray-400 text-[11px] font-normal">{label.match(/\((.*?)\)/)?.[1]}</span>
                    )}
                </div>
            )}
        </button>
    );

    const Divider = () => <div className="w-6 h-[1px] bg-gray-200 my-1.5 opacity-60" />;

    // Voice Orb Icon based on state
    const VoiceIcon = () => {
        switch (voiceState) {
            case 'listening':
                return <Mic className="w-6 h-6 text-white" />;
            case 'thinking':
                return (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                        <Loader className="w-6 h-6 text-white" />
                    </motion.div>
                );
            case 'speaking':
                return <Volume2 className="w-6 h-6 text-white" />;
            default:
                return <Mic className="w-6 h-6 text-white" />;
        }
    };

    const styles = voiceStateStyles[voiceState];
    const tooltip = voiceStateTooltips[voiceState];
    const isActive = voiceState === 'listening' || voiceState === 'speaking';

    return (
        <div className="flex flex-col items-center">
            {/* Voice Orb - Above the HUD Pill */}
            <motion.button
                onClick={onVoiceToggle}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className={`
                    relative w-14 h-14 rounded-full mb-2
                    ${styles.bg}
                    ring-4 ${styles.ring}
                    shadow-lg
                    flex items-center justify-center
                    transition-all duration-300
                    cursor-pointer
                    group
                `}
            >
                {/* Pulse Animation when Active */}
                {isActive && (
                    <>
                        <motion.div
                            className={`absolute inset-0 rounded-full ${styles.bg} opacity-40`}
                            animate={{ scale: [1, 1.5, 1.5], opacity: [0.4, 0, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.div
                            className={`absolute inset-0 rounded-full ${styles.bg} opacity-40`}
                            animate={{ scale: [1, 1.3, 1.3], opacity: [0.4, 0, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                        />
                    </>
                )}

                <VoiceIcon />

                {/* Tooltip */}
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-white text-gray-700 text-[12px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-gray-100 flex items-center gap-2">
                    {tooltip}
                </div>
            </motion.button>

            {/* Main Tools HUD Pill */}
            <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex flex-col items-center px-1.5 py-2.5 bg-[#f8f8f8]/95 backdrop-blur-xl border border-gray-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-full gap-1"
            >
                {/* Main Interaction Tools */}
                <ToolButton
                    icon={MousePointer2}
                    active={mode === 'select'}
                    onClick={() => setMode('select')}
                    label="Select (V)"
                />
                <ToolButton
                    icon={Hand}
                    active={mode === 'pan'}
                    onClick={() => setMode('pan')}
                    label="Pan (H)"
                />

                {/* Add to Canvas - Consolidated with hover popover */}
                <div className="relative group">
                    <button
                        className={`
                            relative p-2.5 rounded-xl transition-all duration-200
                            ${(mode === 'add' || mode === 'text' || mode === 'draw')
                                ? 'bg-gray-950 text-white'
                                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                            }
                        `}
                    >
                        {/* Plus icon with box */}
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="2" y="2" width="14" height="14" rx="3" />
                            <line x1="9" y1="5.5" x2="9" y2="12.5" />
                            <line x1="5.5" y1="9" x2="12.5" y2="9" />
                        </svg>
                        {/* Dot indicator */}
                        {!(mode === 'add' || mode === 'text' || mode === 'draw') && (
                            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        )}
                    </button>

                    {/* Hover Popover */}
                    <div className="absolute left-full ml-3 top-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-gray-100 py-2 px-1 min-w-[160px]">
                            <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Add to Canvas
                            </div>
                            <button
                                onClick={() => setMode('add')}
                                className={`w-full px-3 py-2 text-left text-[13px] rounded-lg flex items-center gap-3 transition-colors ${mode === 'add' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <Square size={16} />
                                <span>Frame</span>
                                <span className="ml-auto text-[11px] text-gray-400">F</span>
                            </button>
                            <button
                                onClick={() => setMode('text')}
                                className={`w-full px-3 py-2 text-left text-[13px] rounded-lg flex items-center gap-3 transition-colors ${mode === 'text' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <Type size={16} />
                                <span>Text</span>
                                <span className="ml-auto text-[11px] text-gray-400">T</span>
                            </button>
                            <button
                                onClick={() => setMode('draw')}
                                className={`w-full px-3 py-2 text-left text-[13px] rounded-lg flex items-center gap-3 transition-colors ${mode === 'draw' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                <Pencil size={16} />
                                <span>Draw</span>
                                <span className="ml-auto text-[11px] text-gray-400">P</span>
                            </button>
                        </div>
                    </div>
                </div>

                <Divider />

                {/* Undo/Redo Controls */}
                <ToolButton
                    icon={Undo2}
                    onClick={onUndo || (() => { })}
                    label="Undo (Ctrl+Z)"
                    disabled={!canUndo}
                />
                <ToolButton
                    icon={Redo2}
                    onClick={onRedo || (() => { })}
                    label="Redo (Ctrl+Y)"
                    disabled={!canRedo}
                />

                <Divider />

                {/* Lock Control */}
                <ToolButton
                    icon={isLocked ? Lock : Unlock}
                    active={isLocked}
                    onClick={onToggleLock}
                    label={isLocked ? "Unlock Canvas" : "Lock Canvas"}
                />
            </motion.div>
        </div>
    );
};
