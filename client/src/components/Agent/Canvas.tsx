import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Wifi, WifiOff } from 'lucide-react';
import type { ReactFlowInstance } from '@xyflow/react';

// Custom nodes
import { StickyNode } from './nodes/StickyNode';
import { PaletteNode } from './nodes/PaletteNode';
import { TypographyNode } from './nodes/TypographyNode';
import { VoiceOrbNode } from './nodes/VoiceOrbNode';
import { InspirationNode } from './nodes/InspirationNode';
import { VaultNode } from './nodes/VaultNode';
import { FrameNode } from './nodes/FrameNode';
import { ThoughtSignatureNode } from './nodes';
import { LogoStructureNode } from './nodes/LogoStructureNode';
import { ImageryNode } from './nodes/ImageryNode';
import { TextNode } from './nodes/TextNode';
import { InfoCardNode } from './nodes/InfoCardNode';
import { StackedContentNode } from './nodes/StackedContentNode';
import { LogoStudioFrame } from './nodes/LogoStudioFrame';

// UI Components
import { ThinkingPanel, ThinkingPhase, ThinkingStep } from './ThinkingPanel';
import { ResearchScreen } from './ResearchScreen';
import { DropZone } from './DropZone';
// No WatcherSettings needed here
import { ControlHud, InteractionMode } from './ControlHud';
import { CanvasNavigation } from './CanvasNavigation';
import { CanvasHeader } from './CanvasHeader';
import { ControlCenter } from './ControlCenter';
import { WorkspaceLanding } from './WorkspaceLanding';

// Hooks & Store
import { useWorkspace } from '../../context/WorkspaceContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioStream } from '../../hooks/useAudioStream';
import { useBrandStore } from '../../stores/useBrandStore';
import { useShallow } from 'zustand/react/shallow';
import { useCanvasHistory } from '../../hooks/useCanvasHistory';
import type { LogoInspiration, LogoStructureOption } from '@shared/types';
import { apiGenerateLogos, apiFinalizeLogos } from '../../api';

// React Flow node with proper typing
// Helper to fetch kit from backend
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
    voiceOrb: VoiceOrbNode,
    inspiration: InspirationNode,
    vault: VaultNode,
    frame: FrameNode,
    thoughtSignature: ThoughtSignatureNode,
    logoStructure: LogoStructureNode,
    imagery: ImageryNode,
    text: TextNode,
    infoCard: InfoCardNode,
    stackedContent: StackedContentNode,
    logoStudio: LogoStudioFrame,
};

export type CanvasPhase = 'onboarding' | 'loading' | 'canvas';

interface CanvasProps {
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
    tools: 280,
};

// Calculate X positions sequentially
// Note: All frames are now arranged horizontally
const getFrameX = (index: number) => {
    const order = ['identity', 'overview', 'strategy', 'visuals', 'logoStructure', 'logoInspiration', 'imagery', 'tools'] as const;
    let x = FRAME_START_X;
    for (let i = 0; i < index; i++) {
        x += FRAME_WIDTHS[order[i]] + FRAME_GAP;
    }
    return x;
};

const FRAMES = {
    identity: { id: 'frame-identity', title: 'Brand Name', icon: 'identity', x: getFrameX(0), y: 80, minWidth: FRAME_WIDTHS.identity, minHeight: 180, color: 'gray' as const },
    overview: { id: 'frame-overview', title: 'Overview', icon: 'dashboard', x: getFrameX(1), y: 80, minWidth: FRAME_WIDTHS.overview, minHeight: 400, color: 'gray' as const },
    strategy: { id: 'frame-strategy', title: 'Brand Strategy', icon: 'strategy', x: getFrameX(2), y: 80, minWidth: FRAME_WIDTHS.strategy, minHeight: 450, color: 'gray' as const },
    visuals: { id: 'frame-visuals', title: 'Visual Identity', icon: 'visuals', x: getFrameX(3), y: 80, minWidth: FRAME_WIDTHS.visuals, minHeight: 550, color: 'gray' as const },

    // Split Logo Frames
    logoStructure: { id: 'frame-logo-structure', title: 'Logo Structure', icon: 'structure', x: getFrameX(4), y: 80, minWidth: FRAME_WIDTHS.logoStructure, minHeight: 400, color: 'gray' as const },
    logoInspiration: { id: 'frame-logo-inspiration', title: 'Logo Inspiration', icon: 'inspiration', x: getFrameX(5), y: 80, minWidth: FRAME_WIDTHS.logoInspiration, minHeight: 400, color: 'gray' as const },

    // New Imagery Frame
    imagery: { id: 'frame-imagery', title: 'Imagery Concepts', icon: 'imagery', x: getFrameX(6), y: 80, minWidth: FRAME_WIDTHS.imagery, minHeight: 550, color: 'gray' as const },

    tools: { id: 'frame-tools', title: 'Tools', icon: 'tools', x: getFrameX(7), y: 80, minWidth: FRAME_WIDTHS.tools, minHeight: 450, color: 'gray' as const },
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

export const Canvas: React.FC<CanvasProps> = ({ onBack }) => {



    const { workspaceId } = useWorkspace();
    // ========== ZUSTAND STORE - SPLIT SUBSCRIPTIONS FOR STABILITY ==========

    // Brand data slice - uses shallow comparison to prevent re-renders when values haven't changed
    const { dna, colorOptions, fontOptions, logoInspirations, logoOptions, imageryOptions, vaultStats, thoughtSignatures, researchStatus, phase, loadingMessage } = useBrandStore(
        useShallow((state) => ({
            dna: state.dna,
            colorOptions: state.colorOptions,
            fontOptions: state.fontOptions,

            logoInspirations: state.logoInspirations,
            logoOptions: state.logoOptions,
            imageryOptions: state.imageryOptions,
            vaultStats: state.vaultStats,
            thoughtSignatures: state.thoughtSignatures,
            researchStatus: state.researchStatus,
            phase: state.phase,
            loadingMessage: state.loadingMessage,
        }))
    );

    // Voice state slice - separate subscription so voice changes don't trigger full node rebuild
    const { voiceState, aiMessage } = useBrandStore(
        useShallow((state) => ({
            voiceState: state.voiceState,
            aiMessage: state.aiMessage,
        }))
    );

    // Actions - these are stable references (Zustand guarantees this)
    const updateDNA = useBrandStore((state) => state.updateDNA);
    const setColorOptions = useBrandStore((state) => state.setColorOptions);
    const setFontOptions = useBrandStore((state) => state.setFontOptions);

    const setLogoInspirations = useBrandStore((state) => state.setLogoInspirations);
    const setLogoOptions = useBrandStore((state) => state.setLogoOptions);
    const setImageryOptions = useBrandStore((state) => state.setImageryOptions);
    const setVaultStats = useBrandStore((state) => state.setVaultStats); // New
    const setPhase = useBrandStore((state) => state.setPhase);
    const setLoadingMessage = useBrandStore((state) => state.setLoadingMessage);
    const setVoiceState = useBrandStore((state) => state.setVoiceState);
    const setAiMessage = useBrandStore((state) => state.setAiMessage);
    const selectColor = useBrandStore((state) => state.selectColor);
    const selectFont = useBrandStore((state) => state.selectFont);
    const addThoughtSignature = useBrandStore((state) => state.addThoughtSignature);
    const setResearchStatus = useBrandStore((state) => state.setResearchStatus);

    // Canvas-specific local state (not shared)
    const [isDragOver, setIsDragOver] = useState(false);

    // Thinking panel state (local, not needed in store)
    const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>('idle');
    const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
    const [thinkingCollapsed, setThinkingCollapsed] = useState(false);

    // UNSTABLE: Logo Studio State (Debug Features)
    const [showLogoStudio, setShowLogoStudio] = useState(false);
    const [isLogoGenerating, setIsLogoGenerating] = useState(false);
    const [generatedLogos, setGeneratedLogos] = useState<any[]>([]); // Relaxed type for mapping
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

    // Auto-skip discovery/research if flag is present (Development/Testing Convenience)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('skip_discovery') === 'true' || params.get('skip') === 'true') {
            console.log("⏩ Skipping discovery/research phases...");
            setPhase('canvas');
        }
    }, [setPhase]);

    // Handler for running logo generation
    const handleRunLogoGeneration = useCallback(async () => {
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
                        nodes: [{ id: 'frame-logo-studio' }],
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

                setAiMessage("Generating logo concepts based on your research... This may take up to 20 seconds.");

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
                    url: `/workspaces/${workspaceId}/assets/generated_logos/logo_variant_${m.id}.png?v=${Date.now()}`,
                    displayName: m.title
                }));

                setGeneratedLogos(mappedLogos);
                setIsLogoGenerating(false);
                setAiMessage("Logo concepts generated! Review them in the Logo Studio.");

            } catch (error) {
                console.error("Generation error:", error);
                setAiMessage("Error generating logos. Check console.");
                setIsLogoGenerating(false);
            }
        }
    }, [showLogoStudio, dna, setAiMessage, rfInstance, workspaceId]);

    // HUD Interaction State
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');
    const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [manuallyMovedNodes, setManuallyMovedNodes] = useState<Set<string>>(new Set());
    // Voice session control - when true, Gemini session is ended (full mute)
    const [isVoiceSessionEnded, setIsVoiceSessionEnded] = useState(false);
    // Transcript State
    const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'ai'; text: string; timestamp: Date }>>([]);

    // React Flow instance for zoom/fit controls
    useReactFlow();

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

    // Helper to add thinking step
    const addThinkingStep = useCallback((text: string, status: 'pending' | 'active' | 'complete' = 'active') => {
        const step: ThinkingStep = { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, text, status };
        setThinkingSteps(prev => [...prev, step]);
        return step.id;
    }, []);

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

    // Keyboard Shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    // Capture state BEFORE drag starts
    const onNodeDragStart = useCallback((event: any, node: CanvasNode) => {
        dragStartNodesRef.current = nodes;
    }, [nodes]);

    // Capture state AFTER drag ends
    const onNodeDragStop = useCallback((event: any, node: CanvasNode) => {
        takeSnapshot(dragStartNodesRef.current);
    }, [takeSnapshot]);

    // WebSocket handlers - NOW USING ZUSTAND STORE
    const ws = useWebSocket({
        onSessionStarted: (sessionId) => {
            console.log('🎨 Canvas connected:', sessionId);
            setAiMessage("Connected! Tell me about your brand.");
        },

        onTranscription: (role, text) => {
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

        onAudioReceived: (base64Audio) => {
            // Only play audio if session is active
            if (!isVoiceSessionEnded) {
                audio.playAudio(base64Audio);
            }
        },



        onFullStateUpdate: (state) => {
            console.log('📦 FULL_STATE_UPDATE received:', state);

            // 1. Update DNA
            if (state.brandDNA) updateDNA(state.brandDNA);

            // 2. Update Colors (with mapping)
            if (state.colorPalettes?.palettes) {
                // @ts-ignore - Assuming ColorOption handles isSelected is added to store type
                const options = state.colorPalettes.palettes.map((p, i) => ({
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
                const options = state.typographyPairings.fonts.map((f, i) => ({
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
                    id: l.id || `logo-${i}`,
                    url: l.url || l.imageUrl,
                    displayName: l.brandName || l.source || 'Logo', // Map brandName/source to displayName
                    isSelected: l.isSelected || false,
                    brandName: l.brandName, // Keep original brandName if needed
                    source: l.source, // Keep original source if needed
                    description: l.description,
                }));
                setLogoInspirations(inspirations);
            }

            // 5. Update Logo Options
            if (state.logoStructures?.options) {
                console.log('📦 Setting logo options from FULL_STATE:', state.logoStructures.options.length);
                setLogoOptions(state.logoStructures.options);
            }

            // 6. Update Imagery Suggestions
            if (state.imagery?.suggestions) {
                console.log('📦 Setting imagery options from FULL_STATE:', state.imagery.suggestions.length);
                setImageryOptions(state.imagery.suggestions);
            }

            // Force phase to canvas now that data is loaded
            console.log('🎨 Data loaded, switching phase to CANVAS');
            setPhase('canvas');
        },

        onLogoStructureOptions: (options) => {
            console.log('🏗️ Logo Structure Options received via WS:', options);
            if (options && options.length > 0) {
                setLogoOptions(options);
            }
        },

        onImagerySuggestions: (suggestions) => {
            console.log('🎨 Imagery Suggestions received via WS:', suggestions);
            if (suggestions && suggestions.length > 0) {
                setImageryOptions(suggestions);
                addThinkingStep(`Created ${suggestions.length} imagery concepts`, 'complete');
            }
        },



        onLogoResearchResult: (logos, insights, screenshots) => {
            console.log('🖼️ Received logo research results:', logos.length);
            // Map to LogoInspiration[]
            const inspirations: LogoInspiration[] = logos.map((l: any, i: number) => ({
                id: l.id || `logo-${Date.now()}-${i}`,
                url: l.url || l.imageUrl,
                displayName: l.brandName || l.name || l.source || 'Competitor', // Map brandName/name/source to displayName
                isSelected: false,
                brandName: l.brandName,
                source: l.source,
                description: l.description
            }));
            setLogoInspirations(inspirations); // This will trigger node render via store
            addThinkingStep(`Found ${inspirations.length} logo inspirations`, 'complete');
        },

        onToolProcessingStart: (toolType) => {
            setThinkingPhase('analyzing');
            addThinkingStep(`Processing: ${toolType}`, 'active');
        },

        onToolProcessingEnd: () => {
            setThinkingSteps(prev => prev.map(s =>
                s.status === 'active' ? { ...s, status: 'complete' as const } : s
            ));
        },

        onThought: (logic) => {
            addThinkingStep(logic, 'complete');
        },

        onVaultUpdate: (stats) => {
            console.log('🏦 Vault Stats Update:', stats);
            setVaultStats(stats);
            addThinkingStep('Brand Vault updated', 'complete');
        },

        // Thinking Handlers
        onThinkingStart: (timestamp) => {
            setThinkingPhase('analyzing');
            setThinkingSteps(prev => [...prev, { id: `think-${timestamp}`, text: 'Analyzing...', status: 'active' }]);
        },

        onThinkingStream: (thought, phase) => {
            const phaseMap: Record<string, ThinkingPhase> = {
                'classify': 'analyzing',
                'analyze': 'researching',
                'decide': 'generating',
                'execute': 'generating'
            };
            setThinkingPhase(prev => phaseMap[phase] || prev);
        },

        onThinkingEnd: (duration, toolDecided, thoughtSummary) => {
            setThinkingPhase('complete');
            setTimeout(() => setThinkingPhase('idle'), 3000);
        },

        // Agentic Brand Discovery handlers
        onResearchUpdate: (status, message, step, totalSteps, competitors, thoughts) => {
            console.log('🔍 Research Update:', status, message, `Step ${step}/${totalSteps}`, `Thoughts: ${thoughts?.length || 0}`);

            // Only switch to loading if we're NOT already in canvas phase
            // This prevents the race condition where colors arrive before research completes
            if (status === 'started' || status === 'searching' || status === 'analyzing' || status === 'generating') {
                if (phase !== 'canvas') {
                    setPhase('loading');
                    setLoadingMessage(message);
                }
            } else if (status === 'complete') {
                // Research complete - ensure we're in canvas
                if (phase !== 'canvas') {
                    setPhase('canvas');
                }
                setLoadingMessage('Research complete!');
            }

            setResearchStatus({
                isResearching: status !== 'complete',
                status,
                message,
                step: step || 0,
                totalSteps: totalSteps || 5,
                competitors: competitors || [],
                thoughts: thoughts || []
            });

            // Sync thinkingPhase with research status
            const phaseMap: Record<string, ThinkingPhase> = {
                'started': 'analyzing',
                'searching': 'researching',
                'analyzing': 'analyzing',
                'generating': 'generating',
                'complete': 'complete'
            };
            setThinkingPhase(phaseMap[status] || 'analyzing');

            // Use server thoughts directly for ThinkingPanel during research
            // This prevents duplicates by replacing local state with server state
            if (thoughts && thoughts.length > 0) {
                setThinkingSteps(thoughts);
            }

            // When complete, ensure ALL thoughts are marked complete
            if (status === 'complete') {
                setThinkingSteps(prev => prev.map(t => ({ ...t, status: 'complete' as const })));
            }
        },

        onThoughtSignature: (nodeId, title, reasoning, confidence) => {
            console.log('💡 Thought Signature:', nodeId, title);
            addThoughtSignature({ nodeId, title, reasoning, confidence });

            // Map phase ID to step index for ResearchScreen visibility
            const stepMap: Record<string, number> = {
                'identity': 0,
                'competitors': 1,
                'colors': 2,
                'typography': 3,
                'strategy': 4
            };
            const stepIndex = stepMap[nodeId] ?? 0;
            const stepId = `step${stepIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

            // Add directly to thinking steps with correct ID and reasoning text
            setThinkingSteps(prev => [...prev, {
                id: stepId,
                text: reasoning || title,
                status: 'complete'
            }]);
        },

        onError: (message) => {
            console.error('Canvas error:', message);
            setAiMessage(`Error: ${message}`);
            setVoiceState('idle');
        },

        onInterrupt: () => {
            audio.stopPlayback();
        }
    });

    // Audio stream with VAD
    const audio = useAudioStream({
        onAudioData: (base64Audio) => {
            ws.sendAudio(base64Audio);
        },
        // VAD: Signal activity start when user begins speaking
        onSpeechStart: () => {
            console.log('🎙️ VAD: User started speaking, signaling activity start');
            ws.sendActivityStart();
        },
        // VAD: Signal activity end when user stops speaking
        onSpeechEnd: () => {
            console.log('🎤 VAD: User finished speaking, signaling activity end');
            ws.sendActivityEnd();
        },
        silenceThresholdMs: 1500 // 1.5s of silence triggers speech end (increased for natural pauses)
    });

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
            addThinkingStep(`Selected: ${selected.name}`, 'complete');
        }
    }, [colorOptions, selectColor, ws, addThinkingStep]);

    const handleFontSelect = useCallback((fontId: string) => {
        const selected = fontOptions.find(f => f.id === fontId);
        if (selected) {
            selectFont(fontId); // Store handles DNA update + remove from options
            ws.sendSelection('font', selected.name);
            addThinkingStep(`Selected font: ${selected.name}`, 'complete');
        }
    }, [fontOptions, selectFont, ws, addThinkingStep]);

    const handleLogoStructureSelect = useCallback((structureId: string) => {
        const option = logoOptions.find(opt => opt.id === structureId);
        if (option) {
            ws.sendSelection('structure', option.id);
            console.log('Selected logo structure:', option.type, option.id);
            addThinkingStep(`Selected logo structure: ${option.type}`, 'complete');
        }
    }, [logoOptions, ws, addThinkingStep]);

    const handleImagerySelect = useCallback((id: string) => {
        const option = imageryOptions.find(opt => opt.id === id);
        if (option) {
            ws.sendSelection('imagery', option.id);
            console.log('Selected imagery:', option.concept, option.id);
            addThinkingStep(`Selected imagery concept: ${option.concept}`, 'complete');
        }
    }, [imageryOptions, ws, addThinkingStep]);

    // Vault Upload Handler
    const handleVaultUpload = useCallback((files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];

        console.log('🏦 Uploading to Vault:', file.name);
        setVaultStats({ isIngesting: true }); // Optimistic update
        addThinkingStep(`Ingesting ${file.name} to Brand Vault...`, 'active');

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            // Send with 'vault' target
            ws.sendFile(file, base64, 'vault');
        };
        reader.readAsDataURL(file);
    }, [ws, setVaultStats, addThinkingStep]);

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
            Object.values(FRAMES).forEach((frame) => {
                derivedNodes.push({
                    id: frame.id,
                    type: 'frame',
                    position: existingPositions.get(frame.id) || { x: frame.x, y: frame.y },
                    draggable: true,
                    data: {
                        title: frame.title,
                        minWidth: frame.minWidth,
                        minHeight: frame.minHeight,
                        color: frame.color,
                        icon: frame.icon,
                        onRun: frame.icon === 'inspiration' ? handleRunLogoGeneration : undefined,
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

            // Track heights to push down subsequent nodes (Imagery)
            let leftColHeight = 0;
            let rightColHeight = 0;

            // 1. COLORS (Left Column)
            const colorsStatus = colorOptions.length > 0 ? 'options' : (dna.colors?.items && dna.colors.items.length > 0 ? 'saved' : 'empty');
            // Dynamic Height Calculation
            const PALETTE_ITEM_HEIGHT = 100; // Approx height per palette card
            const PALETTE_BASE_HEIGHT = 80;  // Header + padding

            let colorsHeight = 120;
            if (colorsStatus === 'saved') colorsHeight = 150;
            if (colorsStatus === 'options') {
                colorsHeight = PALETTE_BASE_HEIGHT + (colorOptions.length * PALETTE_ITEM_HEIGHT);
            }

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
                leftColHeight = getMeasuredHeight('colors', colorsHeight);
            }


            // 2. TYPOGRAPHY (Right Column)
            const typographyStatus = fontOptions.length > 0 ? 'options' : (dna.typography?.items && dna.typography.items.length > 0 ? 'saved' : 'empty');
            // Dynamic Height Calculation
            const FONT_ITEM_HEIGHT = 120; // Approx height per font card
            const FONT_BASE_HEIGHT = 80;

            let typographyHeight = 120;
            if (typographyStatus === 'saved') typographyHeight = 150;
            if (typographyStatus === 'options') {
                typographyHeight = FONT_BASE_HEIGHT + (fontOptions.length * FONT_ITEM_HEIGHT);
            }

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
                            id: `font-${i}`,
                            name,
                            category: 'sans-serif' as const,
                        })) : undefined,
                        onSelect: handleFontSelect,
                        originalPosition: getOriginalPosition('typography', typoAutoPos.x, typoAutoPos.y),
                    },
                });
                rightColHeight = getMeasuredHeight('typography', typographyHeight);
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

            // --- FRAME: Tools (Vault, Voice Orb) ---
            // Voice Orb
            {
                const orbAutoPos = { x: 40, y: 50 };
                derivedNodes.push({
                    id: 'voiceOrb',
                    type: 'voiceOrb',
                    parentId: FRAMES.tools.id,
                    extent: 'parent',
                    position: getLayoutPosition('voiceOrb', orbAutoPos.x, orbAutoPos.y),
                    draggable: true,
                    data: {
                        state: voiceState,
                        message: aiMessage,
                        onActivate: handleVoiceActivate,
                        onDeactivate: handleVoiceDeactivate,
                        originalPosition: getOriginalPosition('voiceOrb', orbAutoPos.x, orbAutoPos.y),
                    },
                });
            }

            // Brand Vault
            {
                const vaultAutoPos = { x: 20, y: 280 };
                derivedNodes.push({
                    id: 'vault',
                    type: 'vault',
                    parentId: FRAMES.tools.id,
                    extent: 'parent',
                    position: getLayoutPosition('vault', vaultAutoPos.x, vaultAutoPos.y),
                    draggable: true,
                    data: {
                        label: 'Brand Vault',
                        fileCount: vaultStats.fileCount,
                        totalTokens: vaultStats.totalTokens,
                        isIngesting: vaultStats.isIngesting,
                        onUpload: handleVaultUpload,
                        originalPosition: getOriginalPosition('vault', vaultAutoPos.x, vaultAutoPos.y),
                    },
                });
            }


            // --- FRAME: Logo Studio (Move to end to calc max height) ---
            if (showLogoStudio) {
                // Calculate max bottom Y of the first row dynamically
                let maxBottomY = 800; // Reasonable min start

                // Iterate all current derived nodes to find bottom-most edge
                derivedNodes.forEach(node => {
                    // Only consider nodes relevant to the main flow (ignore existing logo studio if present to avoid loop)
                    if (node.id === 'frame-logo-studio') return;

                    let y = node.position.y;
                    // If child, add parent Y
                    if (node.parentId) {
                        const parent = derivedNodes.find(p => p.id === node.parentId);
                        if (parent) y += parent.position.y;
                    }

                    // Estimate height: prioritized measured > data.minHeight > fallback
                    // We use generous fallbacks to ensure clearance
                    let h = 300;
                    if (node.type === 'frame') h = (node.data as any)?.minHeight || 400;
                    if (node.type === 'text') h = 100;
                    if (node.type === 'infoCard') h = 150;

                    // Use actual measured if available
                    const measured = getMeasuredHeight(node.id, 0);
                    if (measured > 0) h = measured;

                    if (y + h > maxBottomY) maxBottomY = y + h;
                });

                const startX = FRAMES.identity.x;
                const newRowY = maxBottomY + 80; // Buffer

                derivedNodes.push({
                    id: 'frame-logo-studio',
                    type: 'logoStudio',
                    position: { x: startX, y: newRowY },
                    draggable: true,
                    data: {
                        title: 'Logo Studio',
                        isGenerating: isLogoGenerating,
                        logos: generatedLogos,
                        onGenerate: async (ctx: string) => {
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
                        },
                        onExport: () => {
                            console.log('Export clicked');
                            window.window.alert("Exporting Kit...");
                        },
                        onFinalize: async () => {
                            console.log('Finalizing (Baking Transparency)...');
                            setAiMessage("Making logos transparent...");
                            try {
                                await apiFinalizeLogos(workspaceId);
                                setAiMessage("Transparency baked! Check /workspaces/" + workspaceId + "/assets/transparent_logos/ folder.");
                                window.alert("Transparency baked successfully!");
                            } catch (e) {
                                console.error(e);
                                setAiMessage("Transparency baking failed.");
                            }
                        }
                    },
                });
            }

            // Create thought signature nodes for each stored signature
            // Position them relative to their parent nodes
            const nodeOffsets: Record<string, { x: number; y: number }> = {
                'colors': { x: 320, y: 40 },      // Right of palette node
                'typography': { x: 320, y: 230 }, // Right of typography node
                'inspiration': { x: 320, y: 410 }, // Right of inspiration node
            };

            thoughtSignatures.forEach((sig) => {
                const offset = nodeOffsets[sig.nodeId] || { x: 350, y: 0 };
                derivedNodes.push({
                    id: `thought-${sig.nodeId}`,
                    type: 'thoughtSignature',
                    parentId: FRAMES.visuals.id, // Place in visuals frame
                    extent: 'parent',
                    position: existingPositions.get(`thought-${sig.nodeId}`) || offset,
                    draggable: true,
                    data: {
                        parentNodeId: sig.nodeId,
                        title: sig.title,
                        reasoning: sig.reasoning,
                        confidence: sig.confidence,
                    },
                });
            });

            return derivedNodes;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dna, colorOptions, fontOptions, logoInspirations, logoOptions, imageryOptions, vaultStats, thoughtSignatures, phase, FRAMES, showLogoStudio, isLogoGenerating, generatedLogos]);

    // ========== EFFECT 2: Update voice orb state only ==========
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
                    // Only auto-position if frame hasn't been manually moved
                    if (!manuallyMovedFrames.has(frameId)) {
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

    // File upload handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    }, []);

    const handleFileUpload = useCallback((files: File[]) => {
        const file = files[0];
        if (!file) return;

        // Show loading phase with analysis message
        setLoadingMessage(`Analyzing ${file.name}...`);
        setPhase('loading');
        addThinkingStep(`Uploading ${file.name}...`, 'active');

        // Convert file to base64 and send to backend
        const reader = new FileReader();
        reader.onload = async () => {
            const rawBase64 = (reader.result as string).split(',')[1];


            addThinkingStep('Processing file content...', 'active');
            setLoadingMessage('Extracting brand identity...');

            // Send file to backend via WebSocket for analysis
            // The backend will process and send DNA_UPDATE events
            const sent = ws.sendFile(file, rawBase64);

            if (!sent) {
                console.warn('WebSocket not connected, skipping file upload');
                setLoadingMessage('Connection lost. Please try again.');
                setTimeout(() => {
                    setPhase('onboarding');
                    setLoadingMessage('Extracting brand identity...');
                }, 2000);
            }

            // The backend will process and send DNA_UPDATE events which will trigger the phase change
            // via the onDNAUpdate callback
        };
        reader.readAsDataURL(file);
    }, [ws, addThinkingStep]);

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
                    <div className="flex items-center space-x-2">
                        {ws.status === 'connected' ? (
                            <Wifi className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <WifiOff className="w-4 h-4 text-slate-500" />
                        )}
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-semibold text-white">Agent Canvas</span>
                    </div>
                </header>

                {/* Voice Orb */}
                <motion.button
                    onClick={handleOrbClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                        w-20 h-20 rounded-full 
                        ${voiceState === 'listening' ? 'bg-emerald-600 ring-emerald-400' :
                            voiceState === 'speaking' ? 'bg-indigo-600 ring-indigo-400' :
                                'bg-slate-800 ring-slate-600'}
                        ring-4 shadow-2xl
                        flex items-center justify-center
                        transition-all duration-300
                    `}
                >
                    <div className="w-6 h-6 rounded-full bg-white/20" />
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

                {audio.isRecording && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-2 text-red-400">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs">Recording</span>
                    </div>
                )}

                {/* File upload drop zone */}
                <div className="mt-12">
                    {ws.sessionId ? (
                        <DropZone
                            isDragOver={isDragOver}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onFileSelect={handleFileUpload}
                        />
                    ) : (
                        <div className="flex flex-col items-center space-y-4 p-8 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-800/50">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-400 text-sm font-medium">Connecting to Brain...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Render loading phase - Premium Research Screen
    if (phase === 'loading') {
        return (
            <ResearchScreen
                isVisible={true}
                currentStep={researchStatus.step || 0}
                message={researchStatus.message || loadingMessage}
                competitors={researchStatus.competitors || []}
                thoughts={thinkingSteps}
                brandName={dna.name.value}
                industry={dna.industry.value}
            />
        );
    }

    // Render canvas phase
    return (
        <div className="w-full h-screen flex flex-col bg-white overflow-hidden">
            {/* Global Header */}
            <CanvasHeader
                onBack={onBack}
                connectionStatus={ws.status === 'connected' ? 'connected' : 'disconnected'}
                isControlCenterOpen={isControlCenterOpen}
                onToggleControlCenter={() => setIsControlCenterOpen(!isControlCenterOpen)}
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
                    <Panel position="bottom-left" style={{ top: '50%', left: '24px', transform: 'translateY(-50%)', margin: 0 }} className="z-50">
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
                    <Panel position="bottom-right" className="mr-4 mb-4 flex flex-col items-end space-y-4 pointer-events-none">
                        <AnimatePresence>
                            {(thinkingPhase !== 'idle' || thinkingSteps.length > 0) && (
                                <div className="pointer-events-auto">
                                    <ThinkingPanel
                                        phase={thinkingPhase}
                                        steps={thinkingSteps}
                                        isCollapsed={thinkingCollapsed}
                                        onToggleCollapse={() => setThinkingCollapsed(!thinkingCollapsed)}
                                    />
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Navigation Controls */}
                        <CanvasNavigation />
                    </Panel>
                </ReactFlow>

                {/* Control Center - Right Side Panel */}
                <ControlCenter
                    isOpen={isControlCenterOpen}
                    onClose={() => setIsControlCenterOpen(false)}
                    thinkingPhase={thinkingPhase}
                    thinkingSteps={thinkingSteps}
                    isMuted={audio.isMuted}
                    onToggleMute={audio.toggleMute}
                    aiVoiceState={voiceState}
                    connectionStatus={ws.status === 'connected' ? 'connected' : ws.status === 'connecting' ? 'connecting' : 'disconnected'}
                    transcript={transcript}
                />
            </div>

        </div>
    );
};

export default Canvas;
