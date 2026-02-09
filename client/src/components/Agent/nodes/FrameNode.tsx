import React, { memo, useState, useEffect } from 'react';
import { NodeProps, useStore, NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Fingerprint,
    Compass,
    Palette,
    Shapes,
    Lightbulb,
    Image as ImageIcon,
    Wrench,
    Grid,
    Type,
    Sparkles
} from 'lucide-react';
import { useBrandStore } from '../../../stores/useBrandStore';
import { AIReasoningPopover, ThoughtSignatureData } from './AIReasoningPopover';

// Custom Icons matching the reference images exactly
const ArrangeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.25" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.25" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.25" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.25" />
    </svg>
);

const FitToContentIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {/* Corner brackets pointing inward */}
        <path d="M2 5.5V3A1.25 1.25 0 0 1 3 1.75H5.5" />
        <path d="M10.5 1.75H13A1.25 1.25 0 0 1 14.25 3V5.5" />
        <path d="M14.25 10.5V13A1.25 1.25 0 0 1 13 14.25H10.5" />
        <path d="M5.5 14.25H3A1.25 1.25 0 0 1 1.75 13V10.5" />
        {/* Center dot */}
        <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
);

const ExportIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10.5V3" />
        <path d="M4.5 6.5L8 3l3.5 3.5" />
        <path d="M2.5 10.5v2A1.25 1.25 0 0 0 3.75 13.75h8.5a1.25 1.25 0 0 0 1.25-1.25v-2" />
    </svg>
);

const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="7" width="11" height="7" rx="1.75" />
        <path d="M4.75 7V5a3.25 3.25 0 1 1 6.5 0v2" />
    </svg>
);

const FocusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="5" />
        <line x1="8" y1="1" x2="8" y2="3.5" />
        <line x1="8" y1="12.5" x2="8" y2="15" />
        <line x1="1" y1="8" x2="3.5" y2="8" />
        <line x1="12.5" y1="8" x2="15" y2="8" />
    </svg>
);

const UnlockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="7" width="11" height="7" rx="1.75" />
        <path d="M11.25 7V5a3.25 3.25 0 0 0-6.5 0" />
    </svg>
);

const RunIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.5 2.5a1 1 0 0 1 1.5-.87l8 4.62a1 1 0 0 1 0 1.74l-8 4.62a1 1 0 0 1-1.5-.87V2.5z" />
    </svg>
);

const FRAME_ICONS: Record<string, React.FC<{ className?: string }>> = {
    dashboard: LayoutDashboard,
    identity: Fingerprint,
    strategy: Compass,
    visuals: Palette,
    structure: Shapes,
    inspiration: Lightbulb,
    imagery: ImageIcon,
    tools: Wrench,
    grid: Grid,
    type: Type,
};

/**
 * Data structure for the FrameNode.
 */
export interface FrameNodeData {
    /** Title of the frame. */
    title: string;
    /** Icon key to render in the header (must match keys in FRAME_ICONS). */
    icon?: string; // Key for FRAME_ICONS
    /** Minimum width of the frame in pixels. */
    minWidth?: number;
    /** Minimum height of the frame in pixels. */
    minHeight?: number;
    /** Theme color key. */
    color?: string; // Key for FRAME_THEMES
    /** Whether the frame is locked (preventing resizing/movement). */
    locked?: boolean; // Whether the frame is locked
    /** Callback when the "Run" button is clicked (e.g., for Logo Inspiration). */
    onRun?: () => void; // Callback when Run button is clicked (for Logo Inspiration)
    /** List of AI thought signatures associated with this frame. */
    thoughtSignatures?: ThoughtSignatureData[]; // AI Reasoning data for this frame (Array)
}

// Figma-style color themes for frames
// Figma-style color themes for frames (Solid Pastel Backgrounds)
const FRAME_THEMES: Record<string, { bg: string; border: string; title: string }> = {
    white: {
        bg: '#ffffff',
        border: '#e2e8f0', // Keep subtle border for visibility
        title: '#333333',
    },
    gray: {
        bg: '#f7f7f7', // User provided
        border: '#e5e7eb', // Subtle border
        title: '#333333',
    },
    red: {
        bg: '#ffb3b3',
        border: '#fca5a5', // Slightly darker than BG
        title: '#333333',
    },
    peach: {
        bg: '#fe968b',
        border: '#f4877d', // Slightly darker
        title: '#333333',
    },
    orange: {
        bg: '#ffbd8b',
        border: '#f5aa78', // Slightly darker
        title: '#333333',
    },
    yellow: {
        bg: '#fee28f',
        border: '#ebd07f', // Slightly darker (Golden)
        title: '#333333',
    },
    green: {
        bg: '#94df9e',
        border: '#82cc8c', // Slightly darker
        title: '#333333',
    },
    mint: {
        bg: '#a7f3d0',
        border: '#6ee7b7', // Slightly darker
        title: '#333333',
    },
    cyan: {
        bg: '#8fd9f2',
        border: '#7bc0d6', // Slightly darker
        title: '#333333',
    },
    blue: {
        bg: '#7fbcff',
        border: '#6ba3e0', // Slightly darker
        title: '#333333',
    },
    purple: {
        bg: '#e591ef',
        border: '#d67ddd', // Slightly darker
        title: '#333333',
    },
    violet: {
        bg: '#c4b5fd',
        border: '#a78bfa', // Slightly darker
        title: '#333333',
    },
};

// Selection color (Vibrant UI Blue matching reference)
const SELECTION_COLOR = '#3b82f6';



// Hook to calculate frame size based on children
function useFrameSize(frameId: string, minWidth: number, minHeight: number) {
    const nodes = useStore((state) => state.nodes);

    // Find all children of this frame
    const children = nodes.filter((n) => n.parentId === frameId);

    if (children.length === 0) {
        return { width: minWidth, height: minHeight };
    }

    // Calculate bounding box of all children
    let maxRight = 0;
    let maxBottom = 0;

    children.forEach((child) => {
        const childWidth = (child.measured?.width ?? child.width ?? 250) as number;
        const childHeight = (child.measured?.height ?? child.height ?? 150) as number;

        const right = child.position.x + childWidth;
        const bottom = child.position.y + childHeight;

        maxRight = Math.max(maxRight, right);
        maxBottom = Math.max(maxBottom, bottom);
    });

    // Add padding
    const PADDING = 40;

    return {
        width: Math.max(minWidth, maxRight + PADDING),
        height: Math.max(minHeight, maxBottom + PADDING),
    };
}

// Reusable Tooltip Button Component for Frame Node
const TooltipButton = ({
    icon: Icon,
    label,
    onClick,
    className = "",
    children // For Color Picker custom content
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
        {/* Custom Tooltip */}
        {label && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-gray-100 shadow-sm rounded-md text-[11px] font-semibold text-gray-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {label}
            </div>
        )}
    </div>
);

/**
 * A custom Node component for ReactFlow that acts as a container "Frame".
 * 
 * Features:
 * - Resizable dimensions.
 * - Customizable header with icon and title.
 * - Toolbar with actions (Expand, Lock, Run).
 * - "AI Reasoning" popover integration for displaying generated thoughts.
 * - Theming support.
 * 
 * @param {NodeProps} props - The node props provided by ReactFlow.
 */
const FrameNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
    const frameData = data as unknown as FrameNodeData;
    const { title, icon, minWidth = 300, minHeight = 200, color = 'white', locked = false, onRun, thoughtSignatures } = frameData;
    const theme = FRAME_THEMES[color] || FRAME_THEMES.white;
    const isInspirationFrame = icon === 'inspiration';
    const isLogoStudio = title === 'Logo Studio'; // Identify Logo Studio frame

    // Color picker state
    const [showColorPicker, setShowColorPicker] = useState(false);
    // AI Reasoning popover state
    const [showReasoningPopover, setShowReasoningPopover] = useState(false);
    const { setNodes, fitView, getNodes } = useReactFlow();

    // Order of colors in the picker (matching reference image)
    const colorOrder = ['white', 'gray', 'red', 'peach', 'orange', 'yellow', 'green', 'mint', 'cyan', 'blue', 'purple', 'violet'];

    const setLayoutOverride = useBrandStore((state) => state.setLayoutOverride);

    // Handle color change
    const handleColorChange = (newColor: string) => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, color: newColor } }
                    : node
            )
        );
        setLayoutOverride(id, { color: newColor });
        setShowColorPicker(false);
    };

    // Handle Lock/Unlock toggle
    const handleLockToggle = () => {
        const nextLocked = !locked;
        setNodes((nodes) =>
            nodes.map((node) => {
                // Lock/unlock the frame itself
                if (node.id === id) {
                    return { ...node, data: { ...node.data, locked: nextLocked }, draggable: !nextLocked };
                }
                // Lock/unlock children
                if (node.parentId === id) {
                    return { ...node, draggable: !nextLocked, selectable: !nextLocked };
                }
                return node;
            })
        );
        setLayoutOverride(id, { locked: nextLocked });
    };

    // Store original positions on mount (for Arrange reset)
    useEffect(() => {
        const allNodes = getNodes();
        const children = allNodes.filter((n) => n.parentId === id);
        const needsOriginalPositions = children.some((child) => !child.data?.originalPosition);

        if (needsOriginalPositions && children.length > 0) {
            setNodes((nodes) =>
                nodes.map((node) => {
                    if (node.parentId === id && !node.data?.originalPosition) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                originalPosition: { x: node.position.x, y: node.position.y },
                            },
                        };
                    }
                    return node;
                })
            );
        }
    }, [id, getNodes, setNodes]);

    // Handle Arrange (restore original positions)
    const handleArrange = () => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.parentId === id && node.data?.originalPosition) {
                    const origPos = node.data.originalPosition as { x: number; y: number };
                    return {
                        ...node,
                        position: {
                            x: origPos.x,
                            y: origPos.y,
                        },
                    };
                }
                return node;
            })
        );
    };

    // Handle Fit to Content
    const handleFitToContent = () => {
        const allNodes = getNodes();
        const children = allNodes.filter((n) => n.parentId === id);
        if (children.length === 0) return;

        let maxRight = 0;
        let maxBottom = 0;

        children.forEach((child) => {
            const childWidth = (child.measured?.width ?? child.width ?? 200) as number;
            const childHeight = (child.measured?.height ?? child.height ?? 150) as number;
            maxRight = Math.max(maxRight, child.position.x + childWidth);
            maxBottom = Math.max(maxBottom, child.position.y + childHeight);
        });

        const PADDING = 40;
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, minWidth: maxRight + PADDING, minHeight: maxBottom + PADDING } }
                    : node
            )
        );
    };

    // Handle Focus (zoom to frame)
    const handleFocus = () => {
        fitView({ nodes: [{ id }], duration: 800, padding: 0.2 });
    };



    // Resolve icon component
    const IconComponent = icon ? FRAME_ICONS[icon] : null;

    // Dynamic sizing based on children
    const { width, height } = useFrameSize(id, minWidth, minHeight);

    return (
        <div style={{ position: 'relative' }}>
            {/* Frame Title - Floating ABOVE the frame (Figma-style) */}
            <div
                style={{
                    position: 'absolute',
                    top: -32,
                    left: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#333333', // Static neutral color
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    pointerEvents: 'all', // Allow clicking/dragging
                    cursor: 'grab', // Show grab cursor
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    transition: 'color 0.15s ease',
                }}
                className="custom-drag-handle"
            >
                {IconComponent && <IconComponent className="w-4 h-4" />}
                {title}
            </div>

            {/* Frame Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                    width,
                    height,
                    background: theme.bg,
                    border: selected ? `3px solid ${SELECTION_COLOR}` : `3px solid ${theme.border}`, // Selection replaces border color
                    borderRadius: 24, // Rounder corners
                    position: 'relative',
                    transition: 'width 0.3s ease, height 0.3s ease, border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.3s ease',
                    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.05)', // Clean shadow, no outer ring
                }}
            >
                {/* Selection Handles - Removed per user request */}

                {/* Content Area - children render here via ReactFlow */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: 'none', // Children handle their own events
                    }}
                />
            </motion.div>

            {/* Selection HUD */}
            <NodeToolbar
                isVisible={selected}
                position={Position.Top}
                offset={32} // Clear the title but stay close to frame
                className="pointer-events-auto"
            >
                <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-2 items-center"
                >


                    {/* AI Reasoning Button - Hide on Logo Studio, show only if signatures exist */}
                    {!isLogoStudio && thoughtSignatures && thoughtSignatures.length > 0 && (
                        <div className="relative">
                            <TooltipButton
                                label="AI Reasoning"
                                onClick={() => setShowReasoningPopover(!showReasoningPopover)}
                                className="bg-white rounded-xl shadow-lg border border-gray-100 !p-1 hover:!bg-gray-50"
                            >
                                <Sparkles className="w-4 h-4 text-gray-900" strokeWidth={1.75} />
                            </TooltipButton>
                            {showReasoningPopover && (
                                <AIReasoningPopover
                                    signatures={thoughtSignatures}
                                    onClose={() => setShowReasoningPopover(false)}
                                />
                            )}
                        </div>
                    )}

                    {/* Run Button - Context Aware */}
                    {(isInspirationFrame || isLogoStudio) && (
                        <TooltipButton
                            label={isLogoStudio ? "Build Landing Page" : "Generate Logos"}
                            onClick={onRun}
                            className="bg-white rounded-xl shadow-lg border border-gray-100 !p-1.5 hover:!bg-gray-50"
                        >
                            <RunIcon />
                        </TooltipButton>
                    )}

                    {/* Main Controls Pill */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 flex items-center px-1.5 py-0.5 gap-1">
                        {/* Color Picker with Popover */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(!showColorPicker)}
                                className="flex items-center gap-1.5 p-1 hover:bg-gray-100 rounded-md text-gray-600 hover:text-gray-900 transition-colors"
                            >
                                <div
                                    className="w-4 h-4 rounded-full border border-gray-200"
                                    style={{ background: color === 'white' ? '#d1d5db' : theme.border }}
                                />
                                {/* Custom rounded chevron */}
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 10 10"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`text-gray-500 transition-transform ${showColorPicker ? 'rotate-180' : ''}`}
                                >
                                    <path d="M2 3.5L5 6.5L8 3.5" />
                                </svg>
                            </button>

                            {/* Color Picker Popover */}
                            {showColorPicker && (
                                <>
                                    {/* Backdrop to close on click outside */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowColorPicker(false)}
                                    />
                                    {/* Popover */}
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
                                                        className={`w-5 h-5 rounded-full border-2 transition-all ${isSelected
                                                            ? 'border-gray-400 scale-110'
                                                            : 'border-black/5 hover:scale-110 hover:border-black/10'
                                                            }`}
                                                        style={{
                                                            background: isWhite ? '#e5e7eb' : colorTheme.bg,
                                                        }}
                                                        title={colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}
                                                    >
                                                        {/* Diagonal stripe for "none/white" option */}
                                                        {isWhite && (
                                                            <svg className="w-full h-full" viewBox="0 0 20 20">
                                                                <line x1="4" y1="16" x2="16" y2="4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

                        {/* Conditional rendering based on locked state */}
                        {locked ? (
                            /* When locked: show only Unlock button */
                            <TooltipButton label="Unlock" onClick={handleLockToggle}>
                                <UnlockIcon />
                            </TooltipButton>
                        ) : (
                            /* When unlocked: show all controls */
                            <>
                                <TooltipButton label="Arrange" onClick={handleArrange}>
                                    <ArrangeIcon />
                                </TooltipButton>
                                <TooltipButton label="Lock" onClick={handleLockToggle}>
                                    <LockIcon />
                                </TooltipButton>

                                <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

                                <TooltipButton label="Fit to content" onClick={handleFitToContent}>
                                    <FitToContentIcon />
                                </TooltipButton>
                                <TooltipButton label="Focus (F)" onClick={handleFocus}>
                                    <FocusIcon />
                                </TooltipButton>
                            </>
                        )}
                    </div>
                </motion.div>
            </NodeToolbar >
        </div >
    );
};

export const FrameNode = memo(FrameNodeComponent);
