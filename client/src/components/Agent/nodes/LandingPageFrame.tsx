import React, { memo, useState, useEffect } from 'react';
import { NodeProps, NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, ExternalLink, X, Copy, Check, Maximize2, Minimize2, Globe } from 'lucide-react';
import ReactDOM from 'react-dom';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useBrandStore } from '../../../stores/useBrandStore';

/**
 * Data structure for the LandingPageFrame.
 */
export interface LandingPageFrameData {
    /** Title of the landing page frame. */
    title: string;
    /** Whether the landing page is currently being generated. */
    isGenerating: boolean;
    /** Theme color key. */
    color?: string;
    /** Whether the frame is locked. */
    locked?: boolean;
}

// Reusable Tooltip Button
const TooltipButton = ({
    icon: Icon,
    label,
    onClick,
    className = "",
    children,
    tooltipPosition = 'top'
}: {
    icon?: any,
    label?: string,
    onClick?: (e: React.MouseEvent) => void,
    className?: string,
    children?: React.ReactNode,
    tooltipPosition?: 'top' | 'bottom'
}) => (
    <div className="relative group flex items-center justify-center">
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick?.(e);
            }}
            className={`p-1.5 hover:bg-gray-100/50 rounded-lg text-gray-600 hover:text-gray-900 transition-colors ${className}`}
        >
            {children ? children : (Icon && <Icon className="w-4 h-4" strokeWidth={1.5} />)}
        </button>
        {label && (
            <div className={`
                absolute left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-white shadow-xl border border-gray-100 rounded-lg text-[11px] font-semibold text-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50
                ${tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
            `}>
                {label}
            </div>
        )}
    </div>
);

/**
 * A specialized Frame Node for displaying a live preview of the generated landing page.
 * 
 * Features:
 * - Embedded iframe for live preview.
 * - Smart refresh monitoring (reloads on asset/state updates).
 * - "Open in new tab" action.
 * - Responsive container with maximize/minimize capabilities.
 * 
 * @param {NodeProps} props - The node props provided by ReactFlow.
 */
const LandingPageFrameComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
    const nodeData = data as unknown as LandingPageFrameData;
    const { title, isGenerating } = nodeData;
    const [showPreview, setShowPreview] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false); // New state for maximize toggle
    const { workspaceId } = useWorkspace();
    const [copied, setCopied] = useState(false);

    // Store subscription for smart refresh
    const lastAssetUpdate = useBrandStore(state => state.lastAssetUpdate);
    const lastStateUpdate = useBrandStore(state => state.lastStateUpdate);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Configurable dimensions
    const FRAME_WIDTH = 800;
    const FRAME_HEIGHT = 600;

    // Scale factor calculation: Assume typical Desktop 1440px width
    const TARGET_WIDTH = 1440;
    const scale = FRAME_WIDTH / TARGET_WIDTH; // approx 0.55

    const { fitView } = useReactFlow();

    const handleFocus = () => {
        fitView({ nodes: [{ id }], duration: 800, padding: 0.2 });
    };

    // Construct absolute URL to ensure iframe loads correctly (Clean start)
    const landingPageUrl = new URL(window.location.origin);
    landingPageUrl.searchParams.set('mode', 'landing_page');
    landingPageUrl.searchParams.set('workspace', workspaceId);
    const fullUrl = landingPageUrl.toString();

    // Secondary URL for iframe with preview suppression
    const iframeUrl = new URL(fullUrl);
    iframeUrl.searchParams.set('isPreview', 'true');

    const [iframeKey, setIframeKey] = useState(0);

    // SMART REFRESH: Listen to global signals (Asset or State)
    useEffect(() => {
        if (lastAssetUpdate > 0 || lastStateUpdate > 0) {
            console.log("♻️ Landing Page Frame: Detected signal update, refreshing...");
            setIsRefreshing(true);
            setIframeKey(prev => prev + 1); // Force remount

            // Artificial delay to show the nice skeleton shimmer (perceived performance)
            setTimeout(() => {
                setIsRefreshing(false);
            }, 1200);
        }
    }, [lastAssetUpdate, lastStateUpdate]);

    // Force iframe remount to fix "lazy paint" bug without needing a drag
    useEffect(() => {
        const timer = setTimeout(() => {
            setIframeKey(prev => prev + 1);
        }, 300); // 300ms buffer for layout to settle
        return () => clearTimeout(timer);
    }, []);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const [iframeReady, setIframeReady] = useState(false);

    // Reset iframe ready when preview opens
    useEffect(() => {
        if (!showPreview) setIframeReady(false);
    }, [showPreview]);

    return (
        <div style={{ position: 'relative' }}>
            {/* Frame Title */}
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
                    zIndex: 20
                }}
                className="custom-drag-handle"
            >
                <Globe className="w-4 h-4" />
                {title}
            </div>

            {/* Frame Container */}
            <div
                style={{
                    width: FRAME_WIDTH,
                    height: FRAME_HEIGHT,
                    background: '#ffffff',
                    border: `3px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 24,
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                    // GPU Optimization: Force rasterization to fix "blank until move" bug
                    transform: 'translateZ(0)',
                    willChange: 'transform, opacity'
                }}
            >
                {/* Content Area */}
                <div className="w-full h-full relative bg-gray-50 overflow-hidden">
                    {isGenerating || isRefreshing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white">
                            {/* Pinking Animation */}
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 border-4 border-pink-100 rounded-full animate-ping" />
                                <div className="absolute inset-2 border-4 border-pink-200 rounded-full animate-pulse" />
                                <div className="absolute inset-4 bg-gradient-to-tr from-pink-400 to-rose-500 rounded-full flex items-center justify-center shadow-lg transform transition-transform animate-bounce">
                                    <span className="text-2xl">✨</span>
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-gray-800 font-semibold text-lg">Designing Landing Page...</h3>
                                <p className="text-gray-500 text-sm">Our agents are crafting your copy, social proof, and layout.</p>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="w-full h-full origin-top-left bg-white"
                            style={{
                                width: FRAME_WIDTH,
                                height: FRAME_HEIGHT,
                                overflow: 'hidden' // Clip content to frame
                            }}
                        >
                            {/* Iframe Implementation for Total Isolation & Better Performance in Canvas */}
                            <div
                                style={{
                                    width: TARGET_WIDTH,
                                    height: FRAME_HEIGHT / scale,
                                    transform: `scale(${scale})`,
                                    transformOrigin: '0 0',
                                    isolation: 'isolate', // Create new stacking context
                                    pointerEvents: 'auto', // Interactive!
                                    background: 'white' // Ensure opaque background
                                }}
                            >
                                <iframe
                                    key={`${workspaceId}-${iframeKey}`}
                                    src={`${iframeUrl.toString()}&t=${iframeKey}`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        visibility: iframeKey > 0 ? 'visible' : 'hidden'
                                    }}
                                    title="Landing Page Preview"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* HUD Toolbar */}
            <NodeToolbar
                isVisible={selected && !isGenerating}
                position={Position.Top}
                offset={32}
                className="pointer-events-auto nodrag nopan"
            >
                <motion.div
                    className="flex gap-2 items-center bg-white rounded-xl shadow-lg border border-gray-100 p-1"
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    <TooltipButton label="Focus (F)" onClick={handleFocus}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="8" cy="8" r="5" />
                            <line x1="8" y1="1" x2="8" y2="3.5" />
                            <line x1="8" y1="12.5" x2="8" y2="15" />
                            <line x1="1" y1="8" x2="3.5" y2="8" />
                            <line x1="12.5" y1="8" x2="15" y2="8" />
                        </svg>
                    </TooltipButton>

                    <div className="w-[1px] h-4 bg-gray-200 mx-1" />

                    <TooltipButton
                        label="Preview Full Page"
                        onClick={(e) => {
                            setShowPreview(true);
                            setIsMaximized(false);
                        }}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium px-3 flex items-center gap-2"
                    >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Preview</span>
                    </TooltipButton>

                    <TooltipButton
                        label={copied ? "Copied!" : "Copy Link"}
                        onClick={handleCopyLink}
                        className={copied ? "text-green-600" : ""}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </TooltipButton>

                    <TooltipButton label="Open in New Tab" onClick={() => window.open(fullUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                    </TooltipButton>
                </motion.div>
            </NodeToolbar>

            {/* GLOSSY MODAL PREVIEW */}
            {ReactDOM.createPortal(
                <AnimatePresence>
                    {showPreview && (
                        <motion.div
                            key="landing-page-preview-modal"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPreview(false)}
                            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 pointer-events-auto"
                            style={{ transform: 'translateZ(0)' }} // Hardware acceleration
                        >
                            {/* Modal Container */}
                            <motion.div
                                initial={{ scale: 0.95, y: 30, opacity: 0 }}
                                animate={{
                                    scale: 1,
                                    y: 0,
                                    opacity: 1,
                                    width: isMaximized ? '100%' : '90%',
                                    height: isMaximized ? '100%' : '85%',
                                    borderRadius: isMaximized ? 0 : 24
                                }}
                                exit={{ scale: 0.95, y: 30, opacity: 0 }}
                                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`
                                    relative bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden flex flex-col
                                    ${isMaximized ? 'fixed inset-0 rounded-none' : 'max-w-6xl rounded-2xl'}
                                `}
                                style={{ transform: 'translateZ(0)' }}
                            >
                                {/* Glassy Header - Super Glass Effect */}
                                <div className="relative z-20 h-14 flex items-center justify-between px-6 border-b border-white/5 bg-neutral-600/10 backdrop-blur-3xl shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors cursor-pointer" onClick={() => setShowPreview(false)} />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors cursor-pointer" onClick={() => setIsMaximized(!isMaximized)} />
                                        <div className="w-3 h-3 rounded-full bg-green-400 hover:bg-green-500 transition-colors cursor-pointer" />
                                        <span className="ml-4 text-sm font-medium text-white/80">Landing Page Preview</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <TooltipButton tooltipPosition="bottom" onClick={() => setIsMaximized(!isMaximized)} label={isMaximized ? "Minimize" : "Maximize"} className="text-white/70 hover:text-white hover:bg-white/10">
                                            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                        </TooltipButton>

                                        <div className="w-[1px] h-4 bg-white/20 mx-1" />

                                        <TooltipButton tooltipPosition="bottom" onClick={handleCopyLink} label={copied ? "Copied!" : "Copy Link"} className={`text-white/70 hover:text-white hover:bg-white/10 ${copied ? 'text-green-400' : ''}`}>
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </TooltipButton>

                                        <TooltipButton tooltipPosition="bottom" onClick={() => window.open(fullUrl, '_blank')} label="Open in New Tab" className="text-white/70 hover:text-white hover:bg-white/10">
                                            <ExternalLink className="w-4 h-4" />
                                        </TooltipButton>

                                        <div className="w-[1px] h-4 bg-white/20 mx-1" />

                                        <TooltipButton tooltipPosition="bottom" onClick={() => setShowPreview(false)} label="Close Preview" className="text-white/70 hover:text-red-400 hover:bg-white/10">
                                            <X className="w-4 h-4" />
                                        </TooltipButton>
                                    </div>
                                </div>

                                {/* Iframe Content */}
                                <div className="flex-1 bg-black relative">
                                    <motion.div
                                        animate={{ opacity: iframeReady ? 1 : 0 }}
                                        className="w-full h-full"
                                    >
                                        <iframe
                                            src={`${iframeUrl.toString()}&t=${iframeKey}`}
                                            className="w-full h-full border-none"
                                            title="Modal Preview"
                                            onLoad={() => setIframeReady(true)}
                                        />
                                    </motion.div>

                                    {/* Preview Shimmer Overlay */}
                                    <AnimatePresence>
                                        {!iframeReady && (
                                            <motion.div
                                                initial={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 bg-gray-50/80 backdrop-blur-sm flex items-center justify-center z-10"
                                            >
                                                <div className="flex flex-col items-center gap-6 w-full max-w-4xl p-10">
                                                    <div className="w-full h-12 bg-white/60 rounded-lg overflow-hidden relative border border-white/60 shadow-sm backdrop-blur-md">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                                                    </div>
                                                    <div className="w-3/4 h-8 bg-white/60 rounded-md overflow-hidden relative border border-white/60 shadow-sm backdrop-blur-md">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                                                    </div>
                                                    <div className="w-full aspect-video bg-white/40 rounded-2xl overflow-hidden relative mt-4 border border-white/50 shadow-inner backdrop-blur-md">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Maximized "Back to Canvas" Floating Button */}
                                    {isMaximized && (
                                        <motion.button
                                            initial={{ y: -50, opacity: 0 }}
                                            animate={{ y: 20, opacity: 1 }}
                                            className="absolute top-0 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-6 py-2.5 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-50 transition-all hover:scale-105 z-50 text-sm font-bold border border-gray-200"
                                            onClick={() => setIsMaximized(false)}
                                        >
                                            <Minimize2 className="w-4 h-4" />
                                            <span>Back</span>
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export const LandingPageFrame = memo(LandingPageFrameComponent);
