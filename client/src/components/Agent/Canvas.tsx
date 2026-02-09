import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Node,
    NodeTypes,
    Panel,
    BackgroundVariant,
    useReactFlow,
    SelectionMode,
    Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { ReactFlowInstance } from '@xyflow/react';
import html2canvas from 'html2canvas';

// Custom nodes
import { StickyNode } from './nodes/StickyNode';
import { PaletteNode } from './nodes/PaletteNode';
import { TypographyNode } from './nodes/TypographyNode';

import { InspirationNode } from './nodes/InspirationNode';
import { FrameNode } from './nodes/FrameNode';
import { ThoughtSignatureNode } from './nodes';
import { LogoStructureNode } from './nodes/LogoStructureNode';
import { ImageryNode } from './nodes/ImageryNode';
import { TextNode } from './nodes/TextNode';
import { InfoCardNode } from './nodes/InfoCardNode';
import { StackedContentNode } from './nodes/StackedContentNode';
import { LogoStudioFrame } from './nodes/LogoStudioFrame';
import { LandingPageFrame } from './nodes/LandingPageFrame';

// UI Components
import { ResearchScreen } from './ResearchScreen';
import { LoadingOverlay } from './LoadingOverlay';
// No WatcherSettings needed here
import { ControlHud, InteractionMode } from './ControlHud';
import { CanvasNavigation } from './CanvasNavigation';
import { CanvasHeader } from './CanvasHeader';

import { ControlCenter } from './ControlCenter';
import { CommandCenterModal } from './CommandCenter/CommandCenterModal';
import { WorkspaceLanding } from './WorkspaceLanding';
import { SnackbarContainer } from './SnackbarContainer';

// Hooks & Store
import { useWorkspace } from '../../context/WorkspaceContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioStream } from '../../hooks/useAudioStream';
import { useBrandStore } from '../../stores/useBrandStore';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import { useActivityStore } from '../../stores/useActivityStore';
import { apiGenerateLogos } from '../../api';
// React Flow node with proper typing
/**
 * Fetches the logo styling kit from the backend for the current workspace.
 * Uses a timestamp to bust caching for fresh assets.
 * 
 * @param {string} workspaceId - The ID of the current workspace.
 * @returns {Promise<any | null>} The logo kit JSON object or null if failed.
 */
const fetchLogoKit = async (workspaceId: string) => {
    try {
        // Cache-busting with timestamp
        // const res = await fetch(`http://localhost:3000/client/public/assets/logo_kit_challenger.json?t=${Date.now()}`);

        // Dynamic path based on workspace isolation
        const url = `/workspaces/${workspaceId}/assets/logo_kit_challenger.json?t=${Date.now()}`;
        const res2 = await fetch(url);

        if (!res2.ok) throw new Error("Kit not found");
        return await res2.json();
    } catch (e) {
        console.warn("Failed to fetch logo kit", e);
        return null;
    }
};

type CanvasNode = Node<Record<string, unknown>>;

// Define node types for ReactFlow
const nodeTypes: NodeTypes = {
    sticky: StickyNode,
    palette: PaletteNode,
    typography: TypographyNode,
    inspiration: InspirationNode,
    frame: FrameNode,
    thoughtSignature: ThoughtSignatureNode,
    logoStructure: LogoStructureNode,
    imagery: ImageryNode,
    text: TextNode,
    infoCard: InfoCardNode,
    stackedContent: StackedContentNode,
    'logo-studio': LogoStudioFrame,
    'landing-page': LandingPageFrame,
};

/** Represents the high-level phase of the canvas experience. */
export type CanvasPhase = 'onboarding' | 'loading' | 'canvas';

/**
 * Props for the Canvas component.
 */
interface CanvasProps {
    /** Callback function to handle returning to the previous screen. */
    onBack?: () => void;
}


// Frame definitions for canvas layout
// Using new Figma-style solid background colors: 'white' | 'cream' | 'gray' | 'blue'
// Consistent 30px gap between frames
const FRAME_GAP = 30;
const NODE_GAP = 16; // Consistent 16px gap (matching Logo Structure gap-4)
const FRAME_START_X = 50;

// Define frame widths (generous to accommodate content)
const FRAME_WIDTHS = {
    identity: 200,
    overview: 320,   // Fits stacked content cards
    strategy: 320,   // Fits stacked content with tags
    visuals: 700,    // Color palettes + typography (side-by-side at 320px each + 16px gap)
    logoStructure: 700, // Matches Visuals width
    logoInspiration: 700, // Matches Structure width
    imagery: 360,     // Fits imagery cards
    landingPage: 800, // New landing page frame width
};

// Calculate X positions sequentially
// Note: All frames are now arranged horizontally
const getFrameX = (index: number) => {
    const order = ['identity', 'overview', 'strategy', 'visuals', 'logoStructure', 'logoInspiration', 'imagery', 'landingPage'] as const;
    let x = FRAME_START_X;
    for (let i = 0; i < index; i++) {
        x += FRAME_WIDTHS[order[i]] + FRAME_GAP;
    }
    return x;
};

const FRAMES = {
    identity: { id: 'frame-identity', title: 'Brand Name', icon: 'identity', x: getFrameX(0), y: 80, minWidth: FRAME_WIDTHS.identity, minHeight: 180, color: 'gray' as const },
    overview: { id: 'frame-overview', title: 'Overview', icon: 'dashboard', x: getFrameX(1), y: 80, minWidth: FRAME_WIDTHS.overview, minHeight: 400, color: 'green' as const },
    strategy: { id: 'frame-strategy', title: 'Brand Strategy', icon: 'strategy', x: getFrameX(2), y: 80, minWidth: FRAME_WIDTHS.strategy, minHeight: 450, color: 'blue' as const },
    visuals: { id: 'frame-visuals', title: 'Visual Identity', icon: 'visuals', x: getFrameX(3), y: 80, minWidth: FRAME_WIDTHS.visuals, minHeight: 550, color: 'red' as const },

    // Split Logo Frames
    logoStructure: { id: 'frame-logo-structure', title: 'Logo Structure', icon: 'structure', x: getFrameX(4), y: 80, minWidth: FRAME_WIDTHS.logoStructure, minHeight: 400, color: 'yellow' as const },
    logoInspiration: { id: 'frame-logo-inspiration', title: 'Logo Inspiration', icon: 'inspiration', x: getFrameX(5), y: 80, minWidth: FRAME_WIDTHS.logoInspiration, minHeight: 400, color: 'gray' as const },

    // New Imagery Frame
    imagery: { id: 'frame-imagery', title: 'Imagery Concepts', icon: 'imagery', x: getFrameX(6), y: 80, minWidth: FRAME_WIDTHS.imagery, minHeight: 550, color: 'gray' as const },

    landingPage: { id: 'frame-landing-page', title: 'Landing Page', icon: 'landing', x: getFrameX(7), y: 80, minWidth: FRAME_WIDTHS.landingPage, minHeight: 600, color: 'gray' as const },
};

// HELPER: Estimate node height for initial positioning
const estimateHeight = (content: string | any[], type: 'text' | 'tags' = 'text'): number => {
    const BASE_HEIGHT = 80; // Header + padding
    const CHARS_PER_LINE = 35;
    const LINE_HEIGHT = 20;

    if (type === 'tags' && Array.isArray(content)) {
        // Estimate tag rows
        const totalChars = content.join('').length + (content.length * 2); // Items + gaps
        const rows = Math.ceil(totalChars / 25); // Fewer chars per line for tags
        return BASE_HEIGHT + (rows * 30);
    }

    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const lines = Math.ceil((text?.length || 0) / CHARS_PER_LINE);
    return BASE_HEIGHT + (lines * LINE_HEIGHT);
};

/**
 * The core Canvas component that orchestrates the brand creation experience.
 * 
 * This complex component manages:
 * - **State Management**: Subscribes to `useBrandStore` for all brand data (DNA, colors, logos, etc.).
 * - **Real-time Updates**: Connects to WebSockets for live collaboration and AI stream updates.
 * - **Interactive Graph**: Renders the ReactFlow graph with custom nodes (`StickyNode`, `PaletteNode`, etc.).
 * - **Phase Control**: Transitions between 'onboarding', 'loading' (research), and 'canvas' modes.
 * - **UI Overlays**: Manages the `CommandCenter`, `ThinkingPanel`, `LogoStudio`, and `Snackbar` notifications.
 * 
 * It acts as the central hub for the "Agent" mode of the application.
 * 
 * @param {CanvasProps} props - The component props.
 */
export const Canvas: React.FC<CanvasProps> = ({ onBack }) => {



    const { workspaceId, setWorkspaceId } = useWorkspace();
    // ========== ZUSTAND STORE - SPLIT SUBSCRIPTIONS FOR STABILITY ==========

    // Brand data slice
    const {
        dna, colorOptions, fontOptions, logoInspirations, logoOptions, imageryOptions, generatedLogos,
        vaultStats, thoughtSignatures, researchStatus, phase, loadingMessage,
        canvasLayoutOverrides, uiStateOverrides, history, isHydrated, setLayoutOverride, setUiOverride,
        hydratePersistence, hydrateHistory, hydrateResearch, setActiveWorkspaceId, activeWorkspaceId,
        isCommandCenterOpen, setIsCommandCenterOpen, setPendingInterventions
    } = useBrandStore(
        useShallow((state) => ({
            dna: state.dna,
            colorOptions: state.colorOptions,
            fontOptions: state.fontOptions,
            logoInspirations: state.logoInspirations,
            logoOptions: state.logoOptions,
            imageryOptions: state.imageryOptions,
            generatedLogos: state.generatedLogos,
            vaultStats: state.vaultStats,
            thoughtSignatures: state.thoughtSignatures,
            researchStatus: state.researchStatus,
            phase: state.phase,
            loadingMessage: state.loadingMessage,
            canvasLayoutOverrides: state.canvasLayoutOverrides,
            uiStateOverrides: state.uiStateOverrides,
            history: state.history,
            isHydrated: state.isHydrated,
            setLayoutOverride: state.setLayoutOverride,
            setUiOverride: state.setUiOverride,
            hydratePersistence: state.hydratePersistence,
            hydrateHistory: state.hydrateHistory,
            hydrateResearch: state.hydrateResearch,
            setActiveWorkspaceId: state.setActiveWorkspaceId,
            activeWorkspaceId: state.activeWorkspaceId,
            isCommandCenterOpen: state.isCommandCenterOpen,
            setIsCommandCenterOpen: state.setIsCommandCenterOpen,
            setPendingInterventions: state.setPendingInterventions
        }))
    );

    // Refs to break hook circular dependency
    const wsRef = useRef<any>(null);
    const audioRef = useRef<any>(null);

    // Voice state slice
    const { voiceState, aiMessage } = useBrandStore(
        useShallow((state) => ({
            voiceState: state.voiceState,
            aiMessage: state.aiMessage,
        }))
    );

    // Actions
    const updateDNA = useBrandStore((state) => state.updateDNA);
    const setColorOptions = useBrandStore((state) => state.setColorOptions);
    const setFontOptions = useBrandStore((state) => state.setFontOptions);
    const setLogoInspirations = useBrandStore((state) => state.setLogoInspirations);
    const setLogoOptions = useBrandStore((state) => state.setLogoOptions);
    const setImageryOptions = useBrandStore((state) => state.setImageryOptions);

    const setGeneratedLogos = useBrandStore((state) => state.setGeneratedLogos);
    const setPhase = useBrandStore((state) => state.setPhase);
    const setLoadingMessage = useBrandStore((state) => state.setLoadingMessage);
    const setVoiceState = useBrandStore((state) => state.setVoiceState);
    const setAiMessage = useBrandStore((state) => state.setAiMessage);
    const selectColor = useBrandStore((state) => state.selectColor);
    const selectFont = useBrandStore((state) => state.selectFont);
    const addThoughtSignature = useBrandStore((state) => state.addThoughtSignature);
    const setResearchStatus = useBrandStore((state) => state.setResearchStatus);
    const appendResearchThoughts = useBrandStore((state) => state.appendResearchThoughts);

    const resetStore = useBrandStore((state) => state.resetStore);
    const triggerStateUpdate = useBrandStore((state) => state.triggerStateUpdate);
    const triggerAssetUpdate = useBrandStore((state) => state.triggerAssetUpdate);
    const addSnackbar = useBrandStore((state) => state.addSnackbar);

    // ACTIVITY STORE
    const { addActivity, completeActivity } = useActivityStore();

    // Canvas-specific local state
    const [isDragOver, setIsDragOver] = useState(false);

    // Thinking panel state (Legacy local state REMOVED - using store now for persistence)
    // const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>('idle');
    // const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

    // State for Logo Studio
    // SYNCED: Logo Studio State
    const showLogoStudio = !!uiStateOverrides.showLogoStudio;
    const setShowLogoStudio = (val: boolean) => setUiOverride('showLogoStudio', val);
    const [isLogoGenerating, setIsLogoGenerating] = useState(false);


    // SYNCED: Landing Page State
    const showLandingPage = !!uiStateOverrides.showLandingPage;
    const setShowLandingPage = (val: boolean) => setUiOverride('showLandingPage', val);
    const [isLandingPageGenerating, setIsLandingPageGenerating] = useState(false);

    const { fitView, getNodes } = useReactFlow();
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

    // Hydrate Persistence on Mount
    useEffect(() => {
        if (workspaceId) {
            console.log(`🧹 Resetting Store for Workspace Switch: ${workspaceId}`);
            resetStore(true); // Preserve phase/auth, but clear data (dna, nodes, overrides)

            setActiveWorkspaceId(workspaceId);
            hydratePersistence(workspaceId);
            hydrateHistory(workspaceId);
            hydrateResearch(workspaceId);

            // Initial fetch for interventions
            fetch(`/api/hitl/pending`, { headers: { 'x-workspace-id': workspaceId } })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setPendingInterventions(data);
                })
                .catch(err => console.error('Failed to load initial interventions', err));
        } else {
            setActiveWorkspaceId(null);
        }
    }, [workspaceId, phase, hydratePersistence, hydrateHistory, hydrateResearch, setActiveWorkspaceId, resetStore]);

    // url-sync: Force Context to match URL on mount (Fixes navigation from Dashboard)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlWorkspaceId = params.get('workspace');
        if (urlWorkspaceId && urlWorkspaceId !== workspaceId) {
            console.log(`🔄 Force-Syncing Context to URL: ${urlWorkspaceId}`);
            setWorkspaceId(urlWorkspaceId);
        }
    }, [setWorkspaceId, workspaceId]);

    // auto-resume: Check workspace state to determine initial phase
    useEffect(() => {
        if (phase === 'entry' && workspaceId && workspaceId !== 'default') {
            const determinePhase = async () => {
                try {
                    console.log(` Checking workspace status for: ${workspaceId}`);
                    const res = await fetch(`/api/workspaces/check/${workspaceId}`);
                    const data = await res.json();

                    if (data.exists && data.hasState) {
                        console.log("✅ State found via API -> Starting in CANVAS mode");
                        setPhase('canvas');
                    } else {
                        console.log("🆕 No state found -> Starting in ONBOARDING mode");
                        setPhase('onboarding');
                    }
                } catch (e) {
                    console.error("Failed to check workspace status, defaulting to onboarding:", e);
                    setPhase('onboarding');
                }
            };
            determinePhase();
        }
    }, [phase, workspaceId, setPhase]);

    // Auto-skip discovery/research if flag is present (Development/Testing Convenience)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('skip_discovery') === 'true' || params.get('skip') === 'true') {
            console.log("⏩ Skipping discovery/research phases...");
            setPhase('canvas');
        }
    }, [setPhase]);

    // AUTO-HYDRATE LOGOS on Entry
    useEffect(() => {
        const hydrateLogos = async () => {
            if (showLogoStudio && workspaceId && generatedLogos.length === 0) {
                console.log("🔍 Auto-hydrating logo kit...");
                const existingKit = await fetchLogoKit(workspaceId);
                if (existingKit && Object.keys(existingKit).length > 0) {
                    const mapping = [
                        { id: 'primary', title: 'Primary Logo' },
                        { id: 'inverted', title: 'Inverted Logo' },
                        { id: 'icon', title: 'Brand Icon' },
                        { id: 'icon_inverted', title: 'Icon (Inverted)' },
                        { id: 'wordmark', title: 'Wordmark' },
                        { id: 'wordmark_inverted', title: 'Wordmark (Inverted)' },
                        { id: 'social', title: 'Social Asset' },
                        { id: 'social_inverted', title: 'Social (Inverted)' },
                    ];
                    const mappedLogos = mapping.map(m => ({
                        id: m.id,
                        title: m.title,
                        url: `/workspaces/${workspaceId}/assets/generated_logos/logo_variant_${m.id}.png?v=${Date.now()}`,
                        displayName: m.title
                    }));
                    setGeneratedLogos(mappedLogos);
                }
            }
        };
        hydrateLogos();
    }, [showLogoStudio, workspaceId, generatedLogos.length, setGeneratedLogos]);

    // Handler for running logo generation
    const handleRunLogoGeneration = useCallback(async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log("▶️ Run button clicked!");

        // Validation: Ensure research is complete
        const missingItems: string[] = [];
        if (!dna.name?.value) missingItems.push('Brand Name');
        if (!dna.mission?.value) missingItems.push('Mission Statement');

        console.log("✅ Starting generation...");

        if (!showLogoStudio) {
            setShowLogoStudio(true);
            setIsLogoGenerating(true);
            setGeneratedLogos([]);
            setAiMessage("Checking for existing logo concepts...");

            // Focus on the new frame IMMEDIATELY (with small delay for render)
            if (rfInstance) {
                setTimeout(() => {
                    rfInstance.fitView({
                        nodes: [{ id: 'logo-studio-frame' }],
                        padding: 0.2,
                        duration: 1200
                    });
                }, 100);
            }

            try {
                // 1. CHECK FOR EXISTING LOGOS FIRST
                const existingKit = await fetchLogoKit(workspaceId);

                if (existingKit && Object.keys(existingKit).length > 0) {
                    console.log("📂 Found existing logo kit, skipping generation.");

                    // REFRESH KIT LOGIC (Shared)
                    // FORCE OPAQUE PATHS (User Requirement)
                    const mapping = [
                        { id: 'primary', title: 'Primary Logo' },
                        { id: 'inverted', title: 'Inverted Logo' },
                        { id: 'icon', title: 'Brand Icon' },
                        { id: 'icon_inverted', title: 'Icon (Inverted)' },
                        { id: 'wordmark', title: 'Wordmark' },
                        { id: 'wordmark_inverted', title: 'Wordmark (Inverted)' },
                        { id: 'social', title: 'Social Asset' },
                        { id: 'social_inverted', title: 'Social (Inverted)' },
                    ];

                    const mappedLogos = mapping.map(m => ({
                        id: m.id,
                        title: m.title,
                        // Use timestamp to force refresh image in browser
                        url: `/workspaces/${workspaceId}/assets/generated_logos/logo_variant_${m.id}.png?v=${Date.now()}`,
                        displayName: m.title
                    }));

                    setGeneratedLogos(mappedLogos);
                    setIsLogoGenerating(false);
                    setAiMessage("Loaded existing logo concepts.");
                    return; // EXIT EARLY
                }

                setAiMessage("Generating logo concepts & baking transparency... This may take up to 45 seconds.");

                // 2. IF NO EXISTING LOGOS, RUN GENERATION
                await apiGenerateLogos(workspaceId);

                // REFRESH KIT
                const kit = await fetchLogoKit(workspaceId);

                // FORCE OPAQUE PATHS (User Requirement)
                // We map known keys to the predictable generated path
                const mapping = [
                    { id: 'primary', title: 'Primary Logo' },
                    { id: 'inverted', title: 'Inverted Logo' },
                    { id: 'icon', title: 'Brand Icon' },
                    { id: 'icon_inverted', title: 'Icon (Inverted)' },
                    { id: 'wordmark', title: 'Wordmark' },
                    { id: 'wordmark_inverted', title: 'Wordmark (Inverted)' },
                    { id: 'social', title: 'Social Asset' },
                    { id: 'social_inverted', title: 'Social (Inverted)' },
                ];

                const mappedLogos = mapping.map(m => ({
                    id: m.id,
                    title: m.title,
                    // Use timestamp to force refresh image in browser
                    // UPDATE: Point to transparent_logos instead of generated_logos
                    url: `/workspaces/${workspaceId}/assets/transparent_logos/logo_variant_${m.id}_transparent.png?v=${Date.now()}`,
                    displayName: m.title
                }));

                setGeneratedLogos(mappedLogos);
                setIsLogoGenerating(false);
                setAiMessage("Logo concepts generated and processed! Review them in the Logo Studio.");

                // SIGNAL REFRESH: Tell other components (Landing Page Frame) to reload
                useBrandStore.getState().triggerAssetUpdate();

            } catch (error) {
                console.error("Generation error:", error);
                setAiMessage("Error generating logos. Check console.");
                setIsLogoGenerating(false);
            }
        }
    }, [showLogoStudio, dna, setAiMessage, rfInstance, workspaceId]);

    // HUD Interaction State
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');
    // State
    const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(true); // Activty Feed State - Default Open for Discovery

    const [isLocked, setIsLocked] = useState(false);
    const [manuallyMovedNodes, setManuallyMovedNodes] = useState<Set<string>>(new Set());
    // Voice session control - when true, Gemini session is ended (full mute)
    const [isVoiceSessionEnded, setIsVoiceSessionEnded] = useState(false);
    // Transcript State
    const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'ai'; text: string; timestamp: Date }>>([]);

    // React Flow instance for zoom/fit controls
    // useReactFlow(); // Already destructured above

    // React Flow integration - sync store nodes to ReactFlow
    const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // NOTE: The sync effect that merges store nodes with ReactFlow is located
    // AFTER the selection handler definitions (handleColorSelect, handleFontSelect)
    // to avoid "Cannot access before initialization" error.

    // History Hook
    const { takeSnapshot, undo, redo, canUndo, canRedo } = useCanvasHistory();
    // Ref to store nodes state for drag start (to avoid snapshotting if no move happened)
    const dragStartNodesRef = useRef<CanvasNode[]>([]);

    // Helper to add thinking step - NOW UPDATES STORE directly
    const addThinkingStep = useCallback((text: string, status: 'pending' | 'active' | 'complete' = 'active') => {
        const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        appendResearchThoughts([{ id, text, status }]);
        return id;
    }, [appendResearchThoughts]);

    // Handle Undo/Redo Actions
    const handleUndo = useCallback(() => {
        const restoredNodes = undo(nodes);
        if (restoredNodes) {
            // @ts-ignore - casting for react flow nodes
            setNodes(restoredNodes);
        }
    }, [undo, nodes]);

    const handleRedo = useCallback(() => {
        const restoredNodes = redo(nodes);
        if (restoredNodes) {
            // @ts-ignore
            setNodes(restoredNodes);
        }
    }, [redo, nodes]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
                return;
            }

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            }

            // Tool Shortcuts
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                setInteractionMode('select');
            }
            if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                setInteractionMode('pan');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, setInteractionMode]);

    // Capture state BEFORE drag starts
    const onNodeDragStart = useCallback((event: any, node: CanvasNode) => {
        dragStartNodesRef.current = nodes;
    }, [nodes]);

    // Capture state AFTER drag ends
    const onNodeDragStop = useCallback((event: any, node: CanvasNode) => {
        takeSnapshot(dragStartNodesRef.current);

        // Sync to persistence
        if (node.id) {
            setLayoutOverride(node.id, {
                x: node.position.x,
                y: node.position.y
            });
        }
    }, [takeSnapshot, setLayoutOverride]);

    // ========== HANDLER: Snapshot & Back ==========

    // Reusable Snapshot Function
    const captureSnapshot = useCallback(async (silent = false) => {
        if (!workspaceId || workspaceId === 'default' || !isHydrated) return;

        try {
            const element = document.querySelector('.react-flow') as HTMLElement;
            if (!element) return;

            if (!silent) console.log('📸 Capturing canvas snapshot...');

            const canvas = await html2canvas(element, {
                scale: 0.3, // Low res (30%) for thumbnails - highly optimized
                useCORS: true,
                logging: false,
                ignoreElements: (el) => el.classList.contains('dont-snapshot')
            });

            const image = canvas.toDataURL('image/png');

            // Upload via beacon strategy if on unmount, otherwise standard fetch
            await fetch(`/api/workspaces/${workspaceId}/thumbnail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image })
            });

            if (!silent) console.log('📸 Snapshot saved.');
        } catch (e) {
            if (!silent) console.error("Snapshot failed", e);
        }
    }, [workspaceId, isHydrated]);

    // Autosave Effect
    useEffect(() => {
        if (!workspaceId || workspaceId === 'default') return;

        const intervalId = setInterval(() => {
            // Only autosave if tab is visible to save resources
            if (!document.hidden) {
                captureSnapshot(true);
            }
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [workspaceId, captureSnapshot]);

    // WebSocket handlers - NOW USING ZUSTAND STORE
    const wsOptions = useMemo(() => ({
        onSessionStarted: (sessionId: string) => {
            console.log('🎨 Canvas connected:', sessionId);
            setAiMessage("Connected! Tell me about your brand.");
        },

        onTranscription: (role: 'user' | 'model', text: string) => {
            // Update transcript - merge consecutive messages from same role
            setTranscript(prev => {
                const lastMsg = prev[prev.length - 1];
                const newRole = role === 'model' ? 'ai' : 'user';

                // If same role as last message, append to it (merging chunks)
                if (lastMsg && lastMsg.role === newRole) {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, text: lastMsg.text + ' ' + text }
                    ];
                }

                // Otherwise create new message
                return [...prev, { role: newRole, text, timestamp: new Date() }];
            });

            // Only update voice state if session is active
            if (!isVoiceSessionEnded) {
                if (role === 'model') {
                    setAiMessage(text);
                    setVoiceState('speaking');
                } else {
                    setVoiceState('listening');
                }
            }
        },

        onAudioReceived: (base64Audio: string) => {
            // Only play audio if session is active
            if (!isVoiceSessionEnded) {
                audioRef.current?.playAudio(base64Audio);
            }
        },

        onDNAUpdate: (dna: any) => {
            updateDNA(dna);
        },

        onFullStateUpdate: (state: any) => {
            console.log('📦 FULL_STATE_UPDATE received:', state);

            // 1. Update DNA
            if (state.brandDNA) updateDNA(state.brandDNA);

            // 2. Update Colors (with mapping)
            if (state.colorPalettes?.palettes) {
                // @ts-ignore
                const options = state.colorPalettes.palettes.map((p: any, i: number) => ({
                    id: p.id || `palette-${i}`,
                    name: p.name || `Palette ${i + 1}`,
                    colors: p.colors,
                    reasoning: (p as any).reasoning,
                    vibe: (p as any).vibe,
                    isSelected: p.isSelected
                }));
                setColorOptions(options);
            }

            // 3. Update Fonts (with mapping)
            if (state.typographyPairings?.fonts) {
                // @ts-ignore
                const options = state.typographyPairings.fonts.map((f: any, i: number) => ({
                    id: f.id || `font-${i}`,
                    name: f.name,
                    category: f.category || 'sans-serif',
                    reasoning: f.reasoning,
                    pairing: (f as any).pairing,
                    isSelected: f.isSelected
                }));
                setFontOptions(options);
            }

            // 4. Update Logos
            if (state.logoInspirations?.inspirations) {
                const inspirations = state.logoInspirations.inspirations.map((l: any, i: number) => ({
                    id: l.id || `logo-${Date.now()}-${i}`,
                    url: l.url || l.imageUrl,
                    displayName: l.brandName ? `Logo ${i + 1} - ${l.brandName}` : `Logo ${i + 1}`,
                    isSelected: l.isSelected || false,
                    brandName: l.brandName,
                    source: l.source,
                    description: l.description,
                }));
                setLogoInspirations(inspirations);
            }

            // 5. Update Logo Options
            if (state.logoStructures?.options) {
                setLogoOptions(state.logoStructures.options);
            }

            // 6. Update Imagery Suggestions
            if (state.imagery?.suggestions) {
                setImageryOptions(state.imagery.suggestions);
            }

            // 7. Update Thoughts (Unified Log)
            if (state.thoughts && Array.isArray(state.thoughts) && state.thoughts.length > 0) {
                console.log(`🧠 [Canvas] Hydrating ${state.thoughts.length} thoughts from server.`);
                const mappedThoughts = state.thoughts.map((t: any) => ({
                    id: t.id,
                    // Format: "Title: Content" or just Content if no title
                    text: t.title ? `${t.title}: ${t.content}` : t.content || t.text,
                    status: 'complete'
                }));

                setResearchStatus({
                    thoughts: mappedThoughts,
                    // Ensure status reflects completion if we are loading history
                    status: 'complete',
                    isResearching: false
                });

                // ALSO: Populate Activity Store (Control Center)
                state.thoughts.forEach((t: any) => {
                    addActivity({
                        id: t.id,
                        type: 'thought',
                        title: t.title || 'Reasoning',
                        content: t.content || t.text || '',
                        status: 'success',
                        timestamp: new Date(t.timestamp || Date.now()),
                        duration: 0
                    });
                });
            }

            // Force phase to canvas now that data is loaded
            // Fix: Do NOT force phase change if we are currently in LOADING phase (research in progress)
            // This prevents the premature jump to canvas. Let onResearchUpdate handle the transition.
            if (phase !== 'loading') {
                setPhase('canvas');
            }
        },

        onLogoStructureOptions: (options: any[]) => {
            if (options && options.length > 0) {
                setLogoOptions(options);
            }
        },

        onImagerySuggestions: (suggestions: any[]) => {
            if (suggestions && suggestions.length > 0) {
                setImageryOptions(suggestions);
                addThinkingStep(`Created ${suggestions.length} imagery concepts`, 'complete');
            }
        },

        onLogoResearchResult: (logos: any[], insights: any, screenshots: string[]) => {
            const inspirations = logos.map((l: any, i: number) => ({
                id: l.id || `logo-${Date.now()}-${i}`,
                url: l.url || l.imageUrl,
                displayName: l.brandName || l.name ? `Logo ${i + 1} - ${l.brandName || l.name}` : `Logo ${i + 1}`,
                isSelected: false,
                brandName: l.brandName,
                source: l.source,
                description: l.description
            }));
            setLogoInspirations(inspirations);
            addThinkingStep(`Found ${inspirations.length} logo inspirations`, 'complete');
        },

        onToolProcessingStart: (toolType?: 'display_fonts' | 'display_colors' | 'update_dna' | 'search_logo_inspiration' | 'display_logo_structure_options' | 'display_imagery_suggestions', targetField?: string) => {
            // setThinkingPhase('analyzing'); // REMOVED
            addThinkingStep(`Processing: ${toolType || 'Tool'}`, 'active');
        },

        onToolProcessingEnd: () => {
            // Bulk update status to complete for active
            // Note: Current store implementation is simple, for now just leave as is since append handles add
            // If we need to update status of existing items, we'd need a specific action.
            // For safety, we can just rely on stream updates or ignore this local-only optimization
            // as stream usually sends completion event anyway.
        },

        onToolExecution: (msg: any) => {
            const content = msg.message || (msg.args ? JSON.stringify(msg.args, null, 2) : '');
            const title = msg.title || msg.toolName || 'Tool Execution';
            const toolName = msg.toolName;

            // 1. Handle "Start" -> Create new running activity
            if (msg.status === 'start') {
                addActivity({
                    id: msg.id,
                    type: 'tool',
                    title: title,
                    content: content,
                    status: 'running',
                    timestamp: new Date(msg.timestamp),
                    meta: { toolName } // Store toolName for correlation
                });
            }
            // 2. Handle "Info" -> Create instantaneous log
            else if (msg.status === 'info') {
                addActivity({
                    id: msg.id,
                    type: 'tool',
                    title: title,
                    content: content,
                    status: 'success', // Info logs are "done"
                    timestamp: new Date(msg.timestamp),
                    meta: { toolName }
                });
            }
            // 3. Handle "Success" / "Error" -> Log it AND close pending tool activities of same type
            else if (msg.status === 'success' || msg.status === 'error') {
                // Add the completion log itself
                addActivity({
                    id: msg.id,
                    type: 'tool',
                    title: title, // e.g. "Transparency Complete"
                    content: content || msg.result || '',
                    status: msg.status,
                    timestamp: new Date(msg.timestamp),
                    meta: { toolName }
                });

                // Heuristic: If this is a success/error for a tool, find any "running" activity 
                // with the same toolName and mark it complete.
                // This handles the "Start" -> ... -> "Success" flow where IDs differ.
                useActivityStore.getState().activities.forEach(a => {
                    if (a.status === 'running' && a.meta?.toolName === toolName) {
                        completeActivity(a.id, msg.status, 'Completed');
                    }
                });
            }
        },

        onThought: (logic: string) => {
            addThinkingStep(logic, 'complete');
        },



        onThinkingStart: (timestamp: number) => {
            // setThinkingPhase('analyzing'); // REMOVED
            appendResearchThoughts([{ id: `think-${timestamp}`, text: 'Analyzing...', status: 'active' }]);
        },

        // onThinkingStream: REMOVED (Legacy UI logic)

        // onThinkingEnd: REMOVED (Legacy UI logic)


        onInterventionRequired: (count: number, requests: any[]) => {
            console.log(`🚥 [Canvas] Received ${count} intervention requests via WS.`);
            setPendingInterventions(requests);

            // Add snackbar notifications for new interventions
            requests.forEach((req: any) => {
                addSnackbar({
                    id: `snackbar-${req.id}`,
                    title: 'Approval Required',
                    message: req.message || 'An AI agent needs your input before proceeding.',
                    section: req.section,
                    type: 'intervention',
                    interventionId: req.id,
                    duration: 10000 // 10 seconds for interventions
                });
            });
        },

        // Signal-Driven Architecture
        onStateUpdate: (hash: string, path: string) => {
            console.log(`🔄 [Canvas] Signal: STATE_UPDATE (Hash: ${hash})`);
            triggerStateUpdate();
        },

        onAssetUpdate: (resource: string) => {
            console.log(`🖼️ [Canvas] Signal: ASSET_UPDATE (Resource: ${resource})`);
            triggerAssetUpdate();
        },

        onResearchUpdate: (status: 'started' | 'searching' | 'analyzing' | 'generating' | 'complete', message: string, step: number, totalSteps: number, competitors?: string[], thoughts?: any[]) => {
            if (status === 'started' || status === 'searching' || status === 'analyzing' || status === 'generating') {
                if (phase !== 'canvas') {
                    setPhase('loading');
                    setLoadingMessage(message);
                }
            } else if (status === 'complete') {
                if (phase !== 'canvas') setPhase('canvas');
                setLoadingMessage('Research complete!');
            }

            setResearchStatus({
                isResearching: status !== 'complete',
                status: status as any,
                message,
                step: step || 0,
                totalSteps: totalSteps || 5,
                competitors: competitors || [],
                thoughts: thoughts || []
            });

            // setThinkingPhase(phaseMap[status] as any || 'analyzing'); // REMOVED

            if (thoughts && thoughts.length > 0) {
                // Prefix thoughts with step index for ResearchScreen filtering
                const prefixedThoughts = thoughts.map(t => ({
                    ...t,
                    id: t.id.startsWith('step') ? t.id : `step${step || 0}-${t.id}`
                }));

                // USE STORE ACTION
                appendResearchThoughts(prefixedThoughts);
            }

            if (status === 'complete') {
                // Optional: mark all as complete in store if improved logic needed
            }
        },

        onThoughtSignature: (nodeId: string, title: string, reasoning: string, confidence?: number) => {
            // FIX: Pass as a single object as expected by the store
            addThoughtSignature({ nodeId, title, reasoning, confidence });

            // Update Activity Feed
            addActivity({
                id: `thought-${Date.now()
                    }-${Math.random().toString(36).substr(2, 9)} `,
                type: 'thought',
                title: title || 'Reasoning',
                content: reasoning,
                status: 'success',
                timestamp: new Date()
            });
        },

        onError: (message: string, code?: string, redirect?: boolean) => {
            console.error(`Canvas error: ${message} (Code: ${code})`);

            if (redirect) {
                console.warn('🔄 Critical Error - Redirecting to Landing Page...');
                setAiMessage(`Error: ${message} `);
                // Short delay to let user see connection failed
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                setAiMessage(`Error: ${message} `);
                setVoiceState('idle');
            }
        },

        onInterrupt: () => {
            audioRef.current?.stopPlayback();
        }
    }), [
        workspaceId, phase, isVoiceSessionEnded, updateDNA, setColorOptions, setFontOptions,
        setLogoInspirations, setLogoOptions, setImageryOptions, addThinkingStep,
        addThoughtSignature, setPhase, setLoadingMessage, setResearchStatus,
        addActivity, completeActivity, appendResearchThoughts
    ]);

    const ws = useWebSocket(wsOptions);
    wsRef.current = ws;

    // Audio stream with VAD
    const audio = useAudioStream({
        onAudioData: (base64Audio) => {
            wsRef.current?.sendAudio(base64Audio);
        },
        // VAD: Signal activity start when user begins speaking
        onSpeechStart: () => {
            console.log('🎙️ VAD: User started speaking, signaling activity start');
            wsRef.current?.sendActivityStart();
        },
        // VAD: Signal activity end when user stops speaking
        onSpeechEnd: () => {
            console.log('🎤 VAD: User finished speaking, signaling activity end');
            wsRef.current?.sendActivityEnd();
        },
        silenceThresholdMs: 1500 // 1.5s of silence triggers speech end (increased for natural pauses)
    });
    audioRef.current = audio;

    // Connect when phase is not entry, but prevent disconnect on phase change
    useEffect(() => {
        if (phase !== 'entry' && ws.status === 'disconnected') {
            ws.connect();
        }
    }, [phase, ws.status]);

    // Cleanup only on unmount
    useEffect(() => {
        return () => {
            ws.disconnect();
            audio.stopRecording();
        };
    }, []);

    // Start session when connected
    useEffect(() => {
        if (ws.status === 'connected' && !ws.sessionId) {
            ws.startSession();
        }
    }, [ws.status, ws.sessionId]);

    // Auto-start microphone when session is established (NOT when resuming from mute)
    useEffect(() => {
        // Skip auto-start if user previously ended the voice session manually
        if (ws.sessionId && !audio.isRecording && !isVoiceSessionEnded) {
            // Small delay to let the AI greeting start first
            const timer = setTimeout(async () => {
                try {
                    await audio.startRecording();
                    setVoiceState('listening');
                    console.log('🎤 Auto-started microphone recording');
                } catch (err) {
                    console.error('Failed to auto-start mic:', err);
                }
            }, 1000); // Wait 1 second for AI to start greeting
            return () => clearTimeout(timer);
        }
    }, [ws.sessionId, isVoiceSessionEnded]);

    // Voice handlers
    const handleVoiceActivate = useCallback(async () => {
        try {
            await audio.startRecording();
            setVoiceState('listening');
            setAiMessage("I'm listening...");
        } catch (err) {
            console.error('Mic error:', err);
            setAiMessage("Could not access microphone.");
        }
    }, [audio]);

    const handleVoiceDeactivate = useCallback(() => {
        audio.stopRecording();
        audio.stopPlayback();
        ws.sendInterrupt(); // Tell server to stop AI
        setVoiceState('idle');
        setAiMessage("Click to continue speaking...");
    }, [audio, ws]);

    // Toggle orb - if active, stop; if idle, start
    const handleOrbClick = useCallback(() => {
        console.log('🔵 Orb clicked! Current voiceState:', voiceState);
        if (voiceState === 'idle') {
            console.log('▶️ Starting voice...');
            handleVoiceActivate();
        } else {
            console.log('⏹️ Stopping voice and sending interrupt...');
            // Stop everything when clicked while active
            handleVoiceDeactivate();
        }
    }, [voiceState, handleVoiceActivate, handleVoiceDeactivate]);

    // Selection handlers - use store actions + notify server
    const handleColorSelect = useCallback((paletteId: string) => {
        const selected = colorOptions.find(p => p.id === paletteId);
        if (selected) {
            selectColor(paletteId); // Store handles DNA update + clear options
            ws.sendSelection('color', selected.colors.join(','));
            addThinkingStep(`Selected: ${selected.name} `, 'complete');
        }
    }, [colorOptions, selectColor, ws, addThinkingStep]);

    const handleFontSelect = useCallback((fontId: string) => {
        const selected = fontOptions.find(f => f.id === fontId);
        if (selected) {
            selectFont(fontId); // Store handles DNA update + remove from options
            ws.sendSelection('font', selected.name);
            addThinkingStep(`Selected font: ${selected.name} `, 'complete');
        }
    }, [fontOptions, selectFont, ws, addThinkingStep]);

    const handleLogoStructureSelect = useCallback((structureId: string) => {
        const option = logoOptions.find(opt => opt.id === structureId);
        if (option) {
            ws.sendSelection('structure', option.id);
            console.log('Selected logo structure:', option.type, option.id);
            addThinkingStep(`Selected logo structure: ${option.type} `, 'complete');
        }
    }, [logoOptions, ws, addThinkingStep]);

    const handleImagerySelect = useCallback((id: string) => {
        const option = imageryOptions.find(opt => opt.id === id);
        if (option) {
            ws.sendSelection('imagery', option.id);
            console.log('Selected imagery:', option.concept, option.id);
            addThinkingStep(`Selected imagery concept: ${option.concept} `, 'complete');
        }
    }, [imageryOptions, ws, addThinkingStep]);



    const handleRunLandingPage = useCallback(async () => {
        // 1. Activate Frame
        setShowLandingPage(true);
        setIsLandingPageGenerating(true);

        // 2. Position & Focus Logic
        // Calculate position relative to Logo Studio (or Inspiration if Studio not active)
        const referenceFrame = showLogoStudio ? 'logo-studio-frame' : FRAMES.logoInspiration.id;
        const refNode = getNodes().find(n => n.id === referenceFrame);

        // Default position if ref not found (far right)
        let targetX = FRAMES.landingPage.x;
        let targetY = FRAMES.landingPage.y;

        if (refNode) {
            const refWidth = refNode.measured?.width ?? refNode.width ?? 680;
            targetX = refNode.position.x + refWidth + 100; // 100px gap
            targetY = refNode.position.y;
        }

        // Store this calculated position in layout overrides so it persists
        const layoutUpdate = { x: targetX, y: targetY };
        useBrandStore.getState().setLayoutOverride(FRAMES.landingPage.id, layoutUpdate);

        // Pan to the new frame location comfortably
        setTimeout(() => {
            fitView({
                nodes: [{ id: FRAMES.landingPage.id }],
                duration: 1000,
                padding: 0.2,
                minZoom: 0.3
            });
        }, 100);

        // 3. Trigger Backend
        try {
            await fetch('/api/action/run-initializers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-workspace-id': workspaceId
                },
                body: JSON.stringify({
                    init: true,  // Flag to run initializers
                    workspaceId
                })
            });
            // 4. Success Handling
            setIsLandingPageGenerating(false);
            // Refresh storage to get new state (Silent update)
            hydratePersistence(workspaceId, true);
        } catch (error) {
            console.error("Failed to generate landing page:", error);
            setIsLandingPageGenerating(false);
        }
    }, [workspaceId, showLogoStudio, getNodes, fitView, hydratePersistence]);

    // Helper for Logo Studio generation (extracted from handleRunLogoGeneration)
    const handleLogoStudioGenerate = useCallback(async (ctx: string) => {
        console.log('Generating with context:', ctx);
        setIsLogoGenerating(true);
        setAiMessage("Refining designs...");
        try {
            await apiGenerateLogos(workspaceId, ctx);
            // Refresh logic (duplicated for now, could be extracted)
            const mapping = ['primary', 'inverted', 'icon', 'icon_inverted', 'wordmark', 'wordmark_inverted', 'social', 'social_inverted'];
            const mappedLogos = mapping.map(id => ({
                id,
                title: id.charAt(0).toUpperCase() + id.slice(1).replace('_', ' '),
                url: `/workspaces/${workspaceId}/assets/generated_logos/logo_variant_${id}.png?v=${Date.now()}`
            }));
            setGeneratedLogos(mappedLogos);
            setIsLogoGenerating(false);
            setAiMessage("Designs refreshed!");
        } catch (e) {
            console.error(e);
            setIsLogoGenerating(false);
            setAiMessage("Refinement failed.");
        }
    }, [workspaceId, setAiMessage, setGeneratedLogos]);


    // ========== EFFECT 1: Derive brand data nodes ==========
    // Only runs when brand DNA or options change - NOT on every voice state change
    useEffect(() => {
        // Only build nodes when in canvas phase
        if (phase !== 'canvas') {
            setNodes([]);
            return;
        }

        // Use functional update to access current nodes and preserve positions
        setNodes((currentNodes) => {
            // Create a map/lookup for existing nodes to access measurements
            const existingNodesMap = new Map(currentNodes.map(n => [n.id, n]));

            // Helper to get layout position (preserves manual moves)
            const getLayoutPosition = (id: string, autoX: number, autoY: number) => {
                // 1. Check Store Overrides (Persistent)
                const override = canvasLayoutOverrides[id];
                if (override && override.x !== undefined && override.y !== undefined) {
                    return { x: override.x, y: override.y };
                }

                // 2. Check local session moves
                if (manuallyMovedNodes.has(id)) {
                    const existing = existingNodesMap.get(id);
                    if (existing) return existing.position;
                }
                return { x: autoX, y: autoY };
            };

            // Helper to get or set original position (for Arrange reset)
            const getOriginalPosition = (id: string, autoX: number, autoY: number) => {
                const existing = existingNodesMap.get(id);
                // Preserve existing originalPosition if available
                if (existing?.data?.originalPosition) {
                    return existing.data.originalPosition as { x: number; y: number };
                }
                // Otherwise, use the auto-calculated position as original
                return { x: autoX, y: autoY };
            };

            const getMeasuredHeight = (id: string, fallback: number) => {
                const n = existingNodesMap.get(id);
                return n?.measured?.height ?? fallback;
            };

            // Create a map of existing positions (for frames mainly)
            const existingPositions = new Map(
                currentNodes.map(n => [n.id, n.position])
            );

            const derivedNodes: CanvasNode[] = [];

            // ========== STEP 1: Generate Frame Nodes FIRST ==========
            // Frames must exist before their children

            // Map frame IDs to thought signature lists
            const frameSignatures: Record<string, typeof thoughtSignatures> = {
                'frame-identity': [],
                'frame-overview': [],
                'frame-strategy': [],
                'frame-visuals': [],
                'frame-logo-structure': [],
                'frame-logo-inspiration': [],
            };

            // Aggregate signatures by logic
            thoughtSignatures.forEach(sig => {
                const nodeId = sig.nodeId;
                const title = sig.title.toLowerCase();

                // 1. Identity
                if (nodeId === 'identity') {
                    frameSignatures['frame-identity'].push(sig);
                }
                // 2. Overview (Competitors OR 'Research Complete')
                else if (nodeId === 'competitors' || title.includes('research complete')) {
                    frameSignatures['frame-overview'].push(sig);
                }
                // 3. Strategy (Differentiation) - Exclude 'Research Complete' if it was caught above
                else if (nodeId === 'strategy' && !title.includes('research complete')) {
                    frameSignatures['frame-strategy'].push(sig);
                }
                // 4. Visuals (Colors OR Typography)
                else if (nodeId === 'colors' || nodeId === 'typography') {
                    frameSignatures['frame-visuals'].push(sig);
                }
                // 5. Logo Structure
                else if (nodeId === 'logo') {
                    frameSignatures['frame-logo-structure'].push(sig);
                }
                // 6. Logo Inspiration
                else if (nodeId === 'inspiration') {
                    frameSignatures['frame-logo-inspiration'].push(sig);
                }
            });

            Object.values(FRAMES).forEach((frame) => {
                // Skip landing page frame here to avoid duplicate node ID 'frame-landing-page'
                // This frame is rendered separately with type 'landing-page' below.
                if (frame.id === 'frame-landing-page') return;

                const override = canvasLayoutOverrides[frame.id];

                derivedNodes.push({
                    id: frame.id,
                    type: 'frame',
                    position: (override && override.x !== undefined) ? { x: override.x, y: override.y } : (existingPositions.get(frame.id) || { x: frame.x, y: frame.y }),
                    draggable: !(override?.locked),
                    data: {
                        title: frame.title,
                        minWidth: override?.width || frame.minWidth,
                        minHeight: override?.height || frame.minHeight,
                        color: override?.color || frame.color,
                        locked: override?.locked || false,
                        icon: frame.icon,
                        onRun: frame.icon === 'inspiration' ? handleRunLogoGeneration : undefined,
                        thoughtSignatures: frameSignatures[frame.id], // Pass array
                    },
                });
            });



            // ========== STEP 2: Generate Child Nodes with parentId ==========

            // --- FRAME: Identity (Brand Name) ---
            if (dna.name) {
                const brandAutoPos = { x: 20, y: 40 };
                derivedNodes.push({
                    id: 'brandName',
                    type: 'text',
                    parentId: FRAMES.identity.id,
                    extent: 'parent',
                    position: getLayoutPosition('brandName', brandAutoPos.x, brandAutoPos.y),
                    draggable: true,
                    data: {
                        text: dna.name?.value,
                        variant: 'headline',
                        align: 'left',
                        originalPosition: getOriginalPosition('brandName', brandAutoPos.x, brandAutoPos.y),
                    },
                });
            }


            // --- FRAME: Overview (Mission, Tagline, Mood) ---
            // Individual nodes for separability
            {
                let currentY = 50;
                const LEFT_X = 15;
                const GAP = NODE_GAP;

                if (dna.mission?.value) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'mission',
                        type: 'infoCard',
                        parentId: FRAMES.overview.id,
                        extent: 'parent',
                        position: getLayoutPosition('mission', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Mission',
                            content: dna.mission.value,
                            icon: 'mission',
                            originalPosition: getOriginalPosition('mission', autoPos.x, autoPos.y),
                        },
                    });
                    currentY += getMeasuredHeight('mission', estimateHeight(dna.mission.value)) + GAP;
                }

                if (dna.tagline?.value) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'tagline',
                        type: 'infoCard',
                        parentId: FRAMES.overview.id,
                        extent: 'parent',
                        position: getLayoutPosition('tagline', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Tagline',
                            content: dna.tagline.value,
                            icon: 'tagline',
                            originalPosition: getOriginalPosition('tagline', autoPos.x, autoPos.y),
                        },
                    });
                    currentY += getMeasuredHeight('tagline', estimateHeight(dna.tagline.value)) + GAP;
                }

                if (dna.mood?.items && dna.mood.items.length > 0) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'mood',
                        type: 'infoCard',
                        parentId: FRAMES.overview.id,
                        extent: 'parent',
                        position: getLayoutPosition('mood', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Mood',
                            content: dna.mood.items,
                            icon: 'mood',
                            displayMode: 'tags',
                            originalPosition: getOriginalPosition('mood', autoPos.x, autoPos.y),
                        },
                    });
                }
            }

            // --- FRAME: Strategy (Voice, Values, Audience) ---
            // Individual nodes for separability
            {
                let currentY = 50;
                const LEFT_X = 15;
                const GAP = NODE_GAP;

                if (dna.voice?.value) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'voice',
                        type: 'infoCard',
                        parentId: FRAMES.strategy.id,
                        extent: 'parent',
                        position: getLayoutPosition('voice', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Brand Voice',
                            content: dna.voice.value,
                            icon: 'voice',
                            originalPosition: getOriginalPosition('voice', autoPos.x, autoPos.y),
                        },
                    });
                    currentY += getMeasuredHeight('voice', estimateHeight(dna.voice.value)) + GAP;
                }

                if (dna.values?.items && dna.values.items.length > 0) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'values',
                        type: 'infoCard',
                        parentId: FRAMES.strategy.id,
                        extent: 'parent',
                        position: getLayoutPosition('values', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Brand Values',
                            content: dna.values.items,
                            icon: 'values',
                            displayMode: 'tags',
                            originalPosition: getOriginalPosition('values', autoPos.x, autoPos.y),
                        },
                    });
                    currentY += getMeasuredHeight('values', estimateHeight(dna.values.items, 'tags')) + GAP;
                }

                if (dna.targetAudience?.items && dna.targetAudience.items.length > 0) {
                    const autoPos = { x: LEFT_X, y: currentY };
                    derivedNodes.push({
                        id: 'audience',
                        type: 'infoCard',
                        parentId: FRAMES.strategy.id,
                        extent: 'parent',
                        position: getLayoutPosition('audience', autoPos.x, autoPos.y),
                        draggable: true,
                        data: {
                            title: 'Target Audience',
                            content: dna.targetAudience.items,
                            icon: 'audience',
                            displayMode: 'tags',
                            originalPosition: getOriginalPosition('audience', autoPos.x, autoPos.y),
                        },
                    });
                }
            }

            // --- FRAME: Visuals (Colors, Typography, Logo Inspiration) ---

            // Dynamic Accordion Logic
            // Calculate heights based on state (status: 'options' | 'saved' | 'empty')
            // These approx heights must match the rendered component heights + padding
            const PADDING = NODE_GAP;
            let currentY = 50; // Start Y relative to frame
            const COL_WIDTH = 320; // Width for side-by-side columns (matched to max-w-[320px] of nodes)
            const COL_GAP = NODE_GAP;



            // 1. COLORS (Left Column)
            const colorsStatus = colorOptions.length > 0 ? 'options' : (dna.colors?.items && dna.colors.items.length > 0 ? 'saved' : 'empty');
            // Dynamic Height Calculation
            const PALETTE_ITEM_HEIGHT = 100; // Approx height per palette card
            const PALETTE_BASE_HEIGHT = 80;  // Header + padding



            if (colorOptions.length > 0 || (dna.colors?.items && dna.colors.items.length > 0)) {
                const colorsAutoPos = { x: 20, y: currentY };
                derivedNodes.push({
                    id: 'colors',
                    type: 'palette',
                    parentId: FRAMES.visuals.id,
                    extent: 'parent',
                    position: getLayoutPosition('colors', colorsAutoPos.x, colorsAutoPos.y),
                    draggable: true, // Allow manual adjustment
                    data: {
                        label: 'Color Palette',
                        status: colorsStatus,
                        options: colorOptions,
                        selectedPalette: colorsStatus === 'saved' ? {
                            id: 'selected',
                            name: 'Selected Colors',
                            colors: dna.colors?.items || [],
                        } : undefined,
                        onSelect: handleColorSelect,
                        originalPosition: getOriginalPosition('colors', colorsAutoPos.x, colorsAutoPos.y),
                    },
                });
            }


            // 2. TYPOGRAPHY (Right Column)
            const typographyStatus = fontOptions.length > 0 ? 'options' : (dna.typography?.items && dna.typography.items.length > 0 ? 'saved' : 'empty');
            // Dynamic Height Calculation
            const FONT_ITEM_HEIGHT = 120; // Approx height per font card
            const FONT_BASE_HEIGHT = 80;



            if (fontOptions.length > 0 || (dna.typography?.items && dna.typography.items.length > 0)) {
                const typoAutoPos = { x: 20 + COL_WIDTH + COL_GAP, y: currentY };
                derivedNodes.push({
                    id: 'typography',
                    type: 'typography',
                    parentId: FRAMES.visuals.id,
                    extent: 'parent',
                    position: getLayoutPosition('typography', typoAutoPos.x, typoAutoPos.y),
                    draggable: true, // Allow manual adjustment
                    data: {
                        label: 'Typography',
                        status: typographyStatus,
                        options: fontOptions,
                        selectedFonts: typographyStatus === 'saved' && dna.typography?.items ? dna.typography.items.map((name: string, i: number) => ({
                            id: `font - ${i} `,
                            name,
                            category: 'sans-serif' as const,
                        })) : undefined,
                        onSelect: handleFontSelect,
                        originalPosition: getOriginalPosition('typography', typoAutoPos.x, typoAutoPos.y),
                    },
                });
            }

            // IMAGERY removed from visual frame
            // Frame height calculation update if needed (left handled by auto-height)



            // --- FRAME: Logo Structure ---
            // Replaced single Logo Direction frame with two independent frames

            if (logoOptions.length > 0) {
                const logoAutoPos = { x: PADDING, y: 50 };
                derivedNodes.push({
                    id: 'logoStructures',
                    type: 'logoStructure',
                    parentId: FRAMES.logoStructure.id,
                    extent: 'parent',
                    position: getLayoutPosition('logoStructures', logoAutoPos.x, logoAutoPos.y),
                    draggable: true,
                    data: {
                        label: 'Logo Structures',
                        options: logoOptions,
                        onSelect: handleLogoStructureSelect,
                        originalPosition: getOriginalPosition('logoStructures', logoAutoPos.x, logoAutoPos.y),
                    },
                });
            }

            // --- FRAME: Logo Inspiration ---
            const inspirationStatus = (dna.logoAssets && dna.logoAssets.length > 0) ? 'saved' : (logoInspirations.length > 0 ? 'options' : 'empty');

            if (logoInspirations.length > 0 || (dna.logoAssets && dna.logoAssets.length > 0)) {
                const inspAutoPos = { x: PADDING, y: 50 };
                derivedNodes.push({
                    id: 'inspiration',
                    type: 'inspiration',
                    parentId: FRAMES.logoInspiration.id,
                    extent: 'parent',
                    position: getLayoutPosition('inspiration', inspAutoPos.x, inspAutoPos.y),
                    draggable: true,
                    data: {
                        label: 'Logo Inspiration',
                        status: inspirationStatus,
                        options: logoInspirations,
                        saved: dna.logoAssets,
                        onRun: handleRunLogoGeneration,
                        originalPosition: getOriginalPosition('inspiration', inspAutoPos.x, inspAutoPos.y),
                    },
                });
            }

            // --- FRAME: Imagery Concepts ---
            if (imageryOptions.length > 0) {
                const imgAutoPos = { x: PADDING, y: 50 };
                derivedNodes.push({
                    id: 'imagery',
                    type: 'imagery',
                    parentId: FRAMES.imagery.id,
                    extent: 'parent',
                    position: getLayoutPosition('imagery', imgAutoPos.x, imgAutoPos.y),
                    draggable: true,
                    data: {
                        label: 'Imagery Concepts',
                        options: imageryOptions,
                        onSelect: handleImagerySelect,
                        originalPosition: getOriginalPosition('imagery', imgAutoPos.x, imgAutoPos.y),
                    },
                });
            }




            // REMOVED: Thought signatures are now inside the AI Reasoning tool in the Frame HUD
            // No longer generating sticky notes for them.

            // ========== STEP 5: Logo Studio Frame (Optional) ==========
            if (showLogoStudio) {
                const lsOverride = canvasLayoutOverrides['logo-studio-frame'];

                // Dynamic Positioning Calculation
                // Logo Structure Frame is at FRAMES.logoStructure (x, y)
                // Content is a 2-column grid of cards. Approx height calculation:
                // Card Height ~220px. Rows = Math.ceil(logoOptions.length / 2).
                // Frame Header ~60px. Padding ~40px.
                const cardsCount = logoOptions.length || 3; // Default 3 if empty
                const rows = Math.ceil(cardsCount / 2); // 2 columns
                const cardHeight = 240; // Safe estimate
                const gap = 20;
                const logoStructureHeight = 80 + (rows * cardHeight) + ((rows - 1) * gap) + 40;

                // Position logic: If override exists, use it. Else, place below Logo Structure.
                const defaultX = FRAMES.logoStructure.x;
                const defaultY = FRAMES.logoStructure.y + logoStructureHeight + 80; // 80px gap between frames

                derivedNodes.push({
                    id: 'logo-studio-frame',
                    type: 'logo-studio',
                    position: (lsOverride && lsOverride.x !== undefined)
                        ? { x: lsOverride.x, y: lsOverride.y }
                        : { x: defaultX, y: defaultY },
                    data: {
                        title: 'Logo Studio',
                        isGenerating: isLogoGenerating,
                        logos: generatedLogos || [],
                        onGenerate: handleLogoStudioGenerate,
                        onExport: () => console.log('Export logos'),
                        onRun: handleRunLandingPage, // Connect the trigger
                        color: lsOverride?.color || 'cyan', // Default to Cyan
                        locked: lsOverride?.locked || false
                    },
                    draggable: !(lsOverride?.locked),
                });
            }

            // ========== STEP 6: Landing Page Frame (Optional) ==========
            if (showLandingPage) {
                const lpOverride = canvasLayoutOverrides[FRAMES.landingPage.id];
                derivedNodes.push({
                    id: FRAMES.landingPage.id,
                    type: 'landing-page',
                    position: (lpOverride && lpOverride.x !== undefined)
                        ? { x: lpOverride.x, y: lpOverride.y }
                        : { x: FRAMES.landingPage.x, y: FRAMES.landingPage.y },
                    data: {
                        title: 'Landing Page',
                        isGenerating: isLandingPageGenerating,
                        color: lpOverride?.color || 'white',
                        locked: lpOverride?.locked || false
                    },
                    draggable: !(lpOverride?.locked),
                });
            }

            return derivedNodes;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dna, colorOptions, fontOptions, logoInspirations, logoOptions, imageryOptions, vaultStats, thoughtSignatures, phase, FRAMES, showLogoStudio, isLogoGenerating, generatedLogos, canvasLayoutOverrides, showLandingPage, isLandingPageGenerating]);

    // ========== EFFECT 2: Auto-Focus on Logo Studio ==========
    // ========== EFFECT 2: Auto-Focus on Logo Studio ==========
    useEffect(() => {
        if (showLogoStudio && rfInstance) {
            // Wait for render cycle to place the node
            setTimeout(() => {
                const node = rfInstance.getNode('logo-studio-frame');
                if (node) {
                    rfInstance.fitView({
                        nodes: [{ id: 'logo-studio-frame' }],
                        padding: 0.2,
                        duration: 800,
                    });
                }
            }, 100);
        }
    }, [showLogoStudio, isLogoGenerating, rfInstance]);

    // ========== EFFECT 3: Update voice orb state only ==========
    // Runs frequently during conversation, but only updates the voiceOrb node data
    useEffect(() => {
        if (phase !== 'canvas') return;

        // Update only the voiceOrb node's data - doesn't rebuild other nodes
        setNodes((currentNodes) =>
            currentNodes.map(node =>
                node.id === 'voiceOrb'
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            state: voiceState,
                            message: aiMessage,
                        },
                    }
                    : node
            )
        );
    }, [voiceState, aiMessage, phase]);

    // ========== EFFECT 3: Dynamic Frame Auto-Layout ==========
    // Repositions frames based on measured widths to maintain consistent gaps
    // Uses refs and debouncing to prevent infinite update loops
    const [manuallyMovedFrames, setManuallyMovedFrames] = useState<Set<string>>(new Set());
    const frameOrderRef = useRef<string[]>(['frame-identity', 'frame-overview', 'frame-strategy', 'frame-visuals', 'frame-logo-structure', 'frame-logo-inspiration', 'frame-imagery', 'frame-tools']);
    const lastMeasuredWidthsRef = useRef<Map<string, number>>(new Map());
    const layoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track when user manually drags a frame
    const handleNodesChangeWithTracking = useCallback((changes: import('@xyflow/react').NodeChange<CanvasNode>[]) => {
        changes.forEach((change) => {
            // Detect drag end on frame nodes
            if (change.type === 'position' && change.dragging === false) {
                if (change.id?.startsWith('frame-')) {
                    setManuallyMovedFrames(prev => new Set([...prev, change.id!]));
                } else {
                    // Track manual movement for content nodes too
                    setManuallyMovedNodes(prev => new Set([...prev, change.id!]));
                }
            }
        });
        onNodesChange(changes);
    }, [onNodesChange]);

    // Auto-layout effect - repositions frames that haven't been manually moved
    // Uses debouncing to prevent infinite loops
    useEffect(() => {
        if (phase !== 'canvas') return;

        // Clear any pending layout timeout
        if (layoutTimeoutRef.current) {
            clearTimeout(layoutTimeoutRef.current);
        }

        // Debounce the layout calculation
        layoutTimeoutRef.current = setTimeout(() => {
            // Get frame nodes with measured dimensions
            const frameNodes = nodes.filter(n => n.type === 'frame' && n.id.startsWith('frame-'));

            // Check if all frames have been measured
            const allMeasured = frameNodes.every(f => f.measured?.width);
            if (!allMeasured || frameNodes.length === 0) return;

            // Check if measured widths have changed since last layout
            let widthsChanged = false;
            frameNodes.forEach(f => {
                const measuredWidth = f.measured?.width || 0;
                const lastWidth = lastMeasuredWidthsRef.current.get(f.id) || 0;
                if (Math.abs(measuredWidth - lastWidth) > 5) { // 5px threshold to avoid micro-updates
                    widthsChanged = true;
                    lastMeasuredWidthsRef.current.set(f.id, measuredWidth);
                }
            });

            // Only recalculate if widths actually changed
            if (!widthsChanged) return;

            // Calculate new positions based on measured widths
            let currentX = FRAME_START_X;
            const newPositions = new Map<string, { x: number; y: number }>();
            let hasChanges = false;

            frameOrderRef.current.forEach((frameId) => {
                const frameNode = frameNodes.find(f => f.id === frameId);
                if (frameNode) {
                    // Only auto-position if frame hasn't been manually moved (check local session OR database overrides)
                    const hasDatabaseOverride = canvasLayoutOverrides[frameId] && canvasLayoutOverrides[frameId].x !== undefined;
                    if (!manuallyMovedFrames.has(frameId) && !hasDatabaseOverride) {
                        const newX = currentX;
                        // Only mark as changed if position differs significantly
                        if (Math.abs(frameNode.position.x - newX) > 2) {
                            newPositions.set(frameId, { x: newX, y: 80 });
                            hasChanges = true;
                        }

                        // Standard Layout Logic continues...

                    }

                    // Use measured width for spacing calculation
                    const measuredWidth = frameNode.measured?.width || FRAME_WIDTHS[frameId.replace('frame-', '') as keyof typeof FRAME_WIDTHS] || 300;
                    currentX += measuredWidth + FRAME_GAP;
                }
            });

            // Only update if there are actual position changes
            if (hasChanges && newPositions.size > 0) {
                setNodes((currentNodes) =>
                    currentNodes.map((node) => {
                        const newPos = newPositions.get(node.id);
                        if (newPos) {
                            return { ...node, position: newPos };
                        }
                        return node;
                    })
                );
            }
        }, 100); // 100ms debounce

        return () => {
            if (layoutTimeoutRef.current) {
                clearTimeout(layoutTimeoutRef.current);
            }
        };
    }, [nodes, phase, manuallyMovedFrames]);

    // ========== EFFECT: Initial Fit View ==========
    const initialFitDone = useRef(false);
    useEffect(() => {
        if (phase === 'canvas' && nodes.length > 0 && !initialFitDone.current && rfInstance) {
            // Small delay to ensure layout is stable
            setTimeout(() => {
                rfInstance.fitView({ padding: 0.1, duration: 800 });
                initialFitDone.current = true;
            }, 500);
        }
    }, [phase, nodes.length, rfInstance]);



    // Render entry phase (Brand Name Entry)
    if (phase === 'entry') {
        return <WorkspaceLanding />;
    }

    // Render onboarding phase
    if (phase === 'onboarding') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center relative">
                {/* Background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px]" />

                {/* Header */}
                <header className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
                    <button
                        onClick={onBack}
                        className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="text-sm font-medium">Back</span>
                    </button>

                </header>

                {/* Voice Orb */}
                <motion.button
                    onClick={handleOrbClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
w-[200px] h-[200px] rounded-full
                        ${voiceState === 'listening' ? 'bg-emerald-600/20 ring-4 ring-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.3)]' :
                            voiceState === 'speaking' ? 'bg-indigo-600/20 ring-4 ring-indigo-500/50 shadow-[0_0_80px_rgba(99,102,241,0.3)] animate-pulse' :
                                'bg-slate-800/50 ring-2 ring-slate-700 hover:bg-slate-800'
                        }
                        backdrop-blur-xl
                        flex items-center justify-center
                        transition-all duration-500 ease-out
                        group
    `}
                >
                    <div className={`w-24 h-24 rounded-full transition-all duration-500 ${voiceState === 'speaking' ? 'bg-indigo-400/80 shadow-lg shadow-indigo-500/50' : voiceState === 'listening' ? 'bg-emerald-400/80 shadow-lg shadow-emerald-500/50' : 'bg-white/10 group-hover:bg-white/20'}`} />
                </motion.button>

                <p className="mt-4 text-slate-400 text-sm">
                    {voiceState === 'idle' ? 'Click to start talking' :
                        voiceState === 'listening' ? 'Listening...' :
                            voiceState === 'speaking' ? 'Speaking...' : 'Processing...'}
                </p>

                {aiMessage && (
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 max-w-md text-center text-lg text-slate-300"
                    >
                        {aiMessage}
                    </motion.p>
                )}




            </div>
        );
    }

    // Render loading phase - Premium Research Screen
    if (!isHydrated) {
        return <LoadingOverlay />;
    }

    if (phase === 'loading') {
        return (
            <ResearchScreen
                isVisible={true}
                currentStep={researchStatus.step || 0}
                message={researchStatus.message || loadingMessage}
                competitors={researchStatus.competitors || []}
                thoughts={researchStatus.thoughts || []}
                brandName={dna.name.value}
                industry={dna.industry?.value || ''}
            />
        );
    }

    // ========== HANDLER: Snapshot & Back ==========

    const handleBack = async () => {
        // 1. Capture Snapshot
        await captureSnapshot();

        // 2. Call original onBack
        if (onBack) onBack();
    };


    // Render canvas phase
    return (
        <div className="w-full h-screen flex flex-col bg-white overflow-hidden">
            {/* Global Header */}
            <CanvasHeader
                onBack={handleBack}
                connectionStatus={ws.status === 'connected' ? 'connected' : 'disconnected'}
                isControlCenterOpen={isActivityFeedOpen}
                onOpenActivityFeed={() => setIsActivityFeedOpen(!isActivityFeedOpen)}
            />

            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onInit={setRfInstance}
                    onNodesChange={handleNodesChangeWithTracking}
                    onEdgesChange={onEdgesChange}
                    onNodeDragStart={onNodeDragStart}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    panOnDrag={!isLocked && interactionMode === 'pan'}
                    selectionMode={interactionMode === 'select' ? SelectionMode.Full : SelectionMode.Partial}
                    nodesDraggable={!isLocked}
                    nodesConnectable={!isLocked}
                    elementsSelectable={!isLocked}
                    fitView
                    minZoom={0.3}
                    maxZoom={2}
                    defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                    proOptions={{ hideAttribution: true }}
                    className="bg-white"
                    onPaneClick={() => window.dispatchEvent(new CustomEvent('closeCanvasMenus'))}
                >
                    <Background variant={BackgroundVariant.Dots} gap={34} size={1.5} color="#9ca3af" />

                    {/* Standard controls removed in favor of custom HUD */}
                    {/* Controls and MiniMap removed - using custom ControlHud instead */}

                    {/* Control HUD */}
                    <Panel position="bottom-left" style={{ top: '50%', left: '24px', transform: 'translateY(-50%)', margin: 0 }} className="z-50 dont-snapshot">
                        <ControlHud
                            mode={interactionMode}
                            setMode={setInteractionMode}
                            isLocked={isLocked}
                            onToggleLock={() => setIsLocked(!isLocked)}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            voiceState={isVoiceSessionEnded ? 'idle' : voiceState}
                            onVoiceToggle={() => {
                                if (isVoiceSessionEnded) {
                                    // Resume: Restart Gemini session and microphone
                                    console.log('🎤 Resuming voice session...');
                                    setIsVoiceSessionEnded(false);
                                    ws.startSession(); // Restart Gemini Live connection
                                    // Recording will auto-start via the useEffect when sessionId is set
                                } else {
                                    // Mute: Fully end Gemini session to prevent any AI processing
                                    console.log('🔇 Ending voice session (full disconnect)...');
                                    setIsVoiceSessionEnded(true);
                                    audio.stopRecording();
                                    audio.stopPlayback();
                                    ws.endSession(); // Close Gemini Live connection on server
                                    setVoiceState('idle');
                                    setAiMessage('Voice muted. Click to resume.');
                                }
                            }}
                        />
                    </Panel>

                    {/* Thinking Panel & Navigation - Bottom Right */}
                    <Panel position="bottom-right" className="mr-4 mb-4 flex flex-col items-end space-y-4 pointer-events-none dont-snapshot">


                        {/* Navigation Controls */}
                        <CanvasNavigation />
                    </Panel>
                </ReactFlow>

                {/* Command Center Modal (Settings) */}
                <CommandCenterModal />

                {/* Snackbar Notifications (Top Right) */}
                <SnackbarContainer />

                {/* Control Center (Activity Feed) */}
                <ControlCenter
                    isOpen={isActivityFeedOpen}
                    onClose={() => setIsActivityFeedOpen(false)}
                    thinkingPhase={'idle'} // Unused prop, set to default
                    thinkingSteps={[]} // Unused prop
                    isMuted={isVoiceSessionEnded}
                    onToggleMute={() => {
                        // Simple toggle logic mirroring the HUD
                        if (isVoiceSessionEnded) {
                            setIsVoiceSessionEnded(false);
                            wsRef.current?.startSession();
                        } else {
                            setIsVoiceSessionEnded(true);
                            audioRef.current?.stopRecording();
                            wsRef.current?.endSession();
                        }
                    }}
                    aiVoiceState={voiceState}
                    connectionStatus={wsRef.current?.status === 'connected' ? 'connected' : 'disconnected'}
                    transcript={transcript}
                    onRunInitializers={handleRunLandingPage}
                />
            </div>

        </div>
    );
};

export default Canvas;
