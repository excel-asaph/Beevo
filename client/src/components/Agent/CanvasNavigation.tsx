import React, { useState, useEffect, useRef } from 'react';
import { useReactFlow, useViewport, useStore } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Floating navigation controls for the ReactFlow canvas.
 * 
 * Provides:
 * - Zoom controls (In, Out, Fit View).
 * - Zoom to selection.
 * - Keyboard shortcuts (Ctrl/Cmd +/-, D, F).
 * - A dropdown menu for zoom options.
 * 
 * This component uses `reactflow` hooks to manipulate the viewport.
 */
export const CanvasNavigation: React.FC = () => {
    const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow();
    const { zoom } = useViewport();

    // Check if any nodes are selected
    const hasSelection = useStore((s) => s.nodes.some((n) => n.selected));

    const [showZoomMenu, setShowZoomMenu] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Zoom menu ref for click outside
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setShowZoomMenu(false);
            }
        };

        // Also listen for custom event dispatched from ReactFlow pane click
        const handlePaneClick = () => {
            setShowZoomMenu(false);
        };

        document.addEventListener('click', handleClickOutside);
        window.addEventListener('closeCanvasMenus', handlePaneClick);
        return () => {
            document.removeEventListener('click', handleClickOutside);
            window.removeEventListener('closeCanvasMenus', handlePaneClick);
        };
    }, []);

    // Format zoom percentage with fallback
    const zoomPercent = Math.round((zoom && !Number.isNaN(zoom) ? zoom : 1) * 100);

    const handleZoomIn = () => { zoomIn(); };
    const handleZoomOut = () => { zoomOut(); };
    const handleFitView = () => { fitView({ duration: 800, padding: 0.25 }); setShowZoomMenu(false); };

    const handleZoomToSelection = () => {
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
            fitView({ nodes: selectedNodes, duration: 800, padding: 0.35 });
            setShowZoomMenu(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignore if typing in an input or content editable element
            const target = event.target as HTMLElement;
            if (
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.isContentEditable
            ) {
                return;
            }

            const isCtrlOrCmd = event.ctrlKey || event.metaKey;

            if (isCtrlOrCmd && (event.key === '=' || event.key === '+')) {
                event.preventDefault();
                handleZoomIn();
            }

            if (isCtrlOrCmd && event.key === '-') {
                event.preventDefault();
                handleZoomOut();
            }

            if ((event.key === 'd' || event.key === 'D') && !isCtrlOrCmd && !event.altKey && !event.shiftKey) {
                event.preventDefault();
                handleFitView();
            }

            if ((event.key === 'f' || event.key === 'F') && !isCtrlOrCmd && !event.altKey && !event.shiftKey) {
                const hasSelectedNodes = getNodes().some(n => n.selected);
                if (hasSelectedNodes) {
                    event.preventDefault();
                    handleZoomToSelection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoomIn, zoomOut, fitView, getNodes]);

    // Determine if pill background should show
    const showPillBg = isHovered || showZoomMenu;



    const shortcutColorClass = hasSelection ? 'text-gray-400' : 'text-gray-300';

    return (
        <div className="flex items-center select-none pointer-events-auto">
            {/* Zoom Control */}
            <div className="relative" ref={menuRef}>
                {/* Dropdown Menu */}
                <AnimatePresence>
                    {showZoomMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="absolute bottom-full right-0 mb-2 w-52 bg-gray-100/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.1)] border border-gray-300 overflow-hidden py-2 px-1"
                        >
                            <button
                                onClick={handleZoomIn}
                                className="w-full px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-200 rounded-lg flex justify-between items-center transition-colors"
                            >
                                <span>Zoom in</span>
                                <span className="text-gray-400 text-[12px] font-medium">⌘ +</span>
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="w-full px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-200 rounded-lg flex justify-between items-center transition-colors"
                            >
                                <span>Zoom out</span>
                                <span className="text-gray-400 text-[12px] font-medium">⌘ -</span>
                            </button>
                            <button
                                onClick={handleFitView}
                                className="w-full px-3.5 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-200 rounded-lg flex justify-between items-center transition-colors"
                            >
                                <span>Zoom to fit</span>
                                <span className="text-gray-400 text-[12px] font-medium">D</span>
                            </button>
                            <button
                                onClick={handleZoomToSelection}
                                disabled={!hasSelection}
                                className={`w-full px-3.5 py-2 text-left text-[13px] flex justify-between items-center transition-colors rounded-lg ${hasSelection ? 'text-gray-700 hover:bg-gray-200 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                                <span>Zoom to selection</span>
                                <span className={`${shortcutColorClass} text-[12px] font-medium`}>F</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Zoom Button */}
                <button
                    onClick={() => setShowZoomMenu(!showZoomMenu)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="relative h-8 flex items-center gap-5 px-4 rounded-full transition-all duration-150"
                >
                    {/* Pill Background - Only shows on hover/active */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-gray-200 backdrop-blur-sm"
                        initial={false}
                        animate={{
                            opacity: showPillBg ? 1 : 0
                        }}
                        transition={{ duration: 0.15 }}
                    />

                    {/* Content */}
                    <span className="relative text-[13px] font-medium text-gray-600">
                        {zoomPercent}%
                    </span>
                    {/* Rounded triangle dropdown indicator */}
                    <svg
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        className={`relative fill-gray-500 transition-transform duration-200 ${showZoomMenu ? 'rotate-180' : ''}`}
                    >
                        <path d="M1.5 0.5C0.8 0.5 0.4 1.3 0.9 1.8L4.4 5.3C4.8 5.7 5.2 5.7 5.6 5.3L9.1 1.8C9.6 1.3 9.2 0.5 8.5 0.5H1.5Z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
