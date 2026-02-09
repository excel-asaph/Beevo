import React from 'react';
import { motion } from 'framer-motion';
import {
    MousePointer2,
    Hand,
    Mic,
    Loader,
    Volume2,
    Undo2,
    Redo2,
    Settings,
    Unlock
} from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';

/** Available interaction modes for the canvas. */
export type InteractionMode = 'select' | 'pan' | 'add' | 'text' | 'draw';
/** Possible states for the voice interface. */
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * Props for the ControlHud component.
 */
interface ControlHudProps {
    /** Current interaction mode of the canvas. */
    mode: InteractionMode;
    /** Callback to set the interaction mode. */
    setMode: (mode: InteractionMode) => void;
    /** Whether the canvas is currently locked. */
    isLocked: boolean;
    /** Callback to toggle the canvas lock state. */
    onToggleLock: () => void;
    // Voice Orb Props
    /** Current state of the voice interface. */
    voiceState?: VoiceState;
    /** Callback to toggle voice listening. */
    onVoiceToggle?: () => void;
    // History
    /** Callback to trigger undo action. */
    onUndo?: () => void;
    /** Callback to trigger redo action. */
    onRedo?: () => void;
    /** Whether undo is currently available. */
    canUndo?: boolean;
    /** Whether redo is currently available. */
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

/**
 * The floating Heads-Up Display (HUD) for canvas controls.
 * 
 * Contains:
 * - **Voice Orb**: Interactive orb for voice commands (Listening, Thinking, Speaking).
 * - **Tool Palette**: Buttons for switching interaction modes (Select, Pan).
 * - **History Controls**: Undo/Redo buttons.
 * - **System Controls**: Command Center toggle and Canvas Lock.
 * 
 * @param {ControlHudProps} props - The component props.
 */
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
    const pendingInterventions = useBrandStore(state => state.pendingInterventions);
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

                {/* Control Center Trigger */}
                <ToolButton
                    icon={Settings}
                    onClick={() => useBrandStore.getState().setIsCommandCenterOpen(true)}
                    label="Command Center"
                    showDot={pendingInterventions.length > 0}
                />

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
