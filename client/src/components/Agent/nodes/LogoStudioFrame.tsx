import React, { memo, useState } from 'react';
import { NodeProps, NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Settings2, Sparkles, Ghost } from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';

// Types
export interface LogoStudioNodeData {
    title: string;
    isGenerating: boolean;
    logos: Array<{
        id: string;
        url: string;
        title: string;
    }>;
    onGenerate?: (context: string) => void;
    onExport?: () => void;
    onFinalize?: () => void;
    // Persist visual preferences
    color?: string;
    locked?: boolean;
}

// Custom Icons matching FrameNode
const ArrangeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.25" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.25" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.25" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.25" />
    </svg>
);

const FitToContentIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5.5V3A1.25 1.25 0 0 1 3 1.75H5.5" />
        <path d="M10.5 1.75H13A1.25 1.25 0 0 1 14.25 3V5.5" />
        <path d="M14.25 10.5V13A1.25 1.25 0 0 1 13 14.25H10.5" />
        <path d="M5.5 14.25H3A1.25 1.25 0 0 1 1.75 13V10.5" />
        <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
);

const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="7" width="11" height="7" rx="1.75" />
        <path d="M4.75 7V5a3.25 3.25 0 1 1 6.5 0v2" />
    </svg>
);

const UnlockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="7" width="11" height="7" rx="1.75" />
        <path d="M11.25 7V5a3.25 3.25 0 0 0-6.5 0" />
    </svg>
);

const ExportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10.5V3" />
        <path d="M4.5 6.5L8 3l3.5 3.5" />
        <path d="M2.5 10.5v2A1.25 1.25 0 0 0 3.75 13.75h8.5a1.25 1.25 0 0 0 1.25-1.25v-2" />
    </svg>
);

// Figma-style color themes
const FRAME_THEMES: Record<string, { bg: string; border: string; title: string }> = {
    white: { bg: '#ffffff', border: '#e2e8f0', title: '#333333' },
    gray: { bg: '#f7f7f7', border: '#e5e7eb', title: '#333333' },
    red: { bg: '#ffb3b3', border: '#fca5a5', title: '#333333' },
    peach: { bg: '#fe968b', border: '#f4877d', title: '#333333' },
    orange: { bg: '#ffbd8b', border: '#f5aa78', title: '#333333' },
    yellow: { bg: '#fee28f', border: '#ebd07f', title: '#333333' },
    green: { bg: '#94df9e', border: '#82cc8c', title: '#333333' },
    mint: { bg: '#a7f3d0', border: '#6ee7b7', title: '#333333' },
    cyan: { bg: '#8fd9f2', border: '#7bc0d6', title: '#333333' },
    blue: { bg: '#7fbcff', border: '#6ba3e0', title: '#333333' },
    purple: { bg: '#e591ef', border: '#d67ddd', title: '#333333' },
    violet: { bg: '#c4b5fd', border: '#a78bfa', title: '#333333' },
};

// Skeleton loader
const LogoSkeleton: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0.4 }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity, delay }}
        className="w-32 h-32 rounded-2xl"
        style={{
            background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)',
        }}
    />
);

// Individual logo result
const LogoResultItem: React.FC<{
    logo: { id: string; url: string; title: string };
    index: number;
}> = ({ logo, index }) => {
    const { resolveAssetUrl } = useWorkspace();
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="flex flex-col items-center gap-2"
        >
            <div className="w-32 h-32 rounded-2xl bg-white shadow-md border border-gray-100 overflow-hidden flex items-center justify-center">
                <img
                    src={resolveAssetUrl(logo.url)}
                    alt={logo.title}
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="12">Logo</text></svg>';
                    }}
                />
            </div>
            <span className="text-xs font-medium text-gray-600 text-center max-w-[128px] truncate">
                {logo.title}
            </span>
        </motion.div>
    );
};

// Reusable Tooltip Button
const TooltipButton = ({
    icon: Icon,
    label,
    onClick,
    className = "",
    children
}: {
    icon?: any,
    label?: string,
    onClick?: () => void,
    className?: string,
    children?: React.ReactNode
}) => (
    <div className="relative group flex items-center justify-center">
        <button
            onClick={onClick}
            className={`p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-gray-900 transition-colors ${className}`}
        >
            {children ? children : (Icon && <Icon className="w-5 h-5" strokeWidth={1.5} />)}
        </button>
        {label && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-gray-100 shadow-sm rounded-md text-[11px] font-semibold text-gray-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {label}
            </div>
        )}
    </div>
);

// Toggle Switch Component
const ViewToggle: React.FC<{
    value: 'logos' | 'context';
    onChange: (value: 'logos' | 'context') => void;
}> = ({ value, onChange }) => (
    <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
        <button
            onClick={() => onChange('logos')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${value === 'logos'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
        >
            Logos
        </button>
        <button
            onClick={() => onChange('context')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${value === 'context'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
        >
            Override
        </button>
    </div>
);

// Main Component
const LogoStudioFrameComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
    const nodeData = data as unknown as LogoStudioNodeData;
    const { title, isGenerating, logos, onGenerate, onExport, onFinalize } = nodeData;

    // Use local state if data props aren't available, but try to sync? 
    // Ideally we update node data
    const [viewMode, setViewMode] = useState<'logos' | 'context'>('logos');
    const [contextText, setContextText] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Derived from data or default
    const color = nodeData.color || 'white';
    const locked = nodeData.locked || false;

    const { fitView, setNodes } = useReactFlow();
    const theme = FRAME_THEMES[color] || FRAME_THEMES.white;
    const colorOrder = ['white', 'gray', 'red', 'peach', 'orange', 'yellow', 'green', 'mint', 'cyan', 'blue', 'purple', 'violet'];

    // Frame dimensions
    const frameWidth = 680;
    const frameHeight = isGenerating ? 320 : Math.max(320, Math.ceil(logos.length / 4) * 180 + 100);

    // Pinkish theme for loading state (overrides user color if generating)
    const activeBg = isGenerating ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)' : theme.bg;
    const activeBorder = selected ? '#3b82f6' : theme.border;

    const handleFocus = () => {
        fitView({ nodes: [{ id }], duration: 800, padding: 0.2 });
    };

    const handleColorChange = (newColor: string) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, color: newColor } }
                    : node
            )
        );
        setShowColorPicker(false);
    };

    const handleLockToggle = () => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, locked: !locked }, draggable: !locked }
                    : node
            )
        );
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Frame Title - Floating ABOVE */}
            <div
                style={{
                    position: 'absolute',
                    top: -32,
                    left: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#333333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    pointerEvents: 'all',
                    cursor: 'grab',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    zIndex: 20
                }}
                className="custom-drag-handle"
            >
                <span>🎨</span>
                {title}
            </div>

            {/* Frame Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                    width: frameWidth,
                    height: frameHeight,
                    background: activeBg,
                    border: `3px solid ${activeBorder}`,
                    borderRadius: 24,
                    position: 'relative',
                    transition: 'background 0.5s ease, height 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                }}
            >
                {/* Header with Toggle */}
                <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-sm z-10">
                    <ViewToggle value={viewMode} onChange={setViewMode} />
                    <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {/* Content Area */}
                <div className="absolute top-14 left-0 right-0 bottom-0 p-4 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {isGenerating ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-wrap gap-4 justify-center items-center h-full"
                            >
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <LogoSkeleton key={i} delay={i * 0.15} />
                                ))}
                            </motion.div>
                        ) : (
                            viewMode === 'logos' ? (
                                <motion.div
                                    key="logos"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-wrap gap-4 justify-start"
                                >
                                    {logos.map((logo, i) => (
                                        <LogoResultItem key={logo.id || i} logo={logo} index={i} />
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div key="context" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                                    {/* Context UI Omitted for brevity, assumed same as before */}
                                    <textarea
                                        value={contextText}
                                        onChange={(e) => setContextText(e.target.value)}
                                        placeholder="Add context..."
                                        className="flex-1 w-full p-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
                                    />
                                    <div className="flex items-center justify-end mt-3 gap-2">
                                        <button onClick={() => onFinalize?.()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            <Ghost className="w-3.5 h-3.5" /> Transparent
                                        </button>
                                        <button onClick={() => onGenerate?.(contextText)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-pink-500 rounded-lg shadow-sm hover:bg-pink-600 transition-colors">
                                            <Play className="w-3.5 h-3.5" /> Generate
                                        </button>
                                    </div>
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Selection HUD - Full Parity */}
            <NodeToolbar
                isVisible={selected}
                position={Position.Top}
                offset={32}
                className="pointer-events-auto"
            >
                <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2 items-center"
                >
                    {/* AI Assistant Button */}
                    <TooltipButton label="AI Assistant" className="bg-white rounded-xl shadow-lg border border-gray-100 !p-1 hover:!bg-gray-50">
                        <Sparkles className="w-4 h-4 text-gray-700" strokeWidth={1.75} />
                    </TooltipButton>

                    {/* Main Controls Pill */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 flex items-center px-1.5 py-0.5 gap-1">
                        {/* Color Picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="flex items-center gap-1.5 p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <div
                                    className="w-4 h-4 rounded-full border border-gray-200"
                                    style={{ background: color === 'white' ? '#d1d5db' : theme.border }}
                                />
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-500 transition-transform ${showColorPicker ? 'rotate-180' : ''}`}>
                                    <path d="M2 3.5L5 6.5L8 3.5" />
                                </svg>
                            </button>
                            {/* Color Picker Popover */}
                            {showColorPicker && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50">
                                        <div className="bg-gray-100 rounded-full shadow-xl border border-gray-200 px-2 py-1.5 flex items-center gap-1.5">
                                            {colorOrder.map((colorKey) => {
                                                const colorTheme = FRAME_THEMES[colorKey];
                                                const isSelected = colorKey === color;
                                                const isWhite = colorKey === 'white';
                                                return (
                                                    <button
                                                        key={colorKey}
                                                        onClick={() => handleColorChange(colorKey)}
                                                        className={`w-5 h-5 rounded-full border-2 transition-all ${isSelected ? 'border-gray-400 scale-110' : 'border-black/5 hover:scale-110 hover:border-black/10'}`}
                                                        style={{ background: isWhite ? '#e5e7eb' : colorTheme.bg }}
                                                        title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                                                    >
                                                        {isWhite && <svg className="w-full h-full" viewBox="0 0 20 20"><line x1="4" y1="16" x2="16" y2="4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" /></svg>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

                        {locked ? (
                            <TooltipButton label="Unlock" onClick={handleLockToggle}>
                                <UnlockIcon />
                            </TooltipButton>
                        ) : (
                            <>
                                <TooltipButton label="Arrange" onClick={() => { /* No-op for now */ }}>
                                    <ArrangeIcon />
                                </TooltipButton>
                                <TooltipButton label="Lock" onClick={handleLockToggle}>
                                    <LockIcon />
                                </TooltipButton>

                                <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

                                <TooltipButton label="Fit to content" onClick={() => { /* Auto-handled */ }}>
                                    <FitToContentIcon />
                                </TooltipButton>
                                <TooltipButton label="Focus (F)" onClick={handleFocus}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="8" cy="8" r="5" />
                                        <line x1="8" y1="1" x2="8" y2="3.5" />
                                        <line x1="8" y1="12.5" x2="8" y2="15" />
                                        <line x1="1" y1="8" x2="3.5" y2="8" />
                                        <line x1="12.5" y1="8" x2="15" y2="8" />
                                    </svg>
                                </TooltipButton>
                                <TooltipButton label="Export" onClick={onExport}>
                                    <ExportIcon />
                                </TooltipButton>
                            </>
                        )}
                    </div>
                </motion.div>
            </NodeToolbar>
        </div>
    );
};

export const LogoStudioFrame = memo(LogoStudioFrameComponent);
