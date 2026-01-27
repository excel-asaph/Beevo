import React, { useCallback, useState, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    NodeTypes,
    Panel,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Wifi, WifiOff } from 'lucide-react';

// Custom nodes
import { StickyNode } from './nodes/StickyNode';
import { PaletteNode, ColorOption } from './nodes/PaletteNode';
import { TypographyNode, FontOption } from './nodes/TypographyNode';
import { VoiceOrbNode } from './nodes/VoiceOrbNode';
import { InspirationNode, InspirationNodeData } from './nodes/InspirationNode';
import { VaultNode } from './nodes/VaultNode';
import { FrameNode } from './nodes/FrameNode';
import { ThoughtSignatureNode } from './nodes';
import { LogoStructureNode } from './nodes/LogoStructureNode';
import { ImageryNode } from './nodes/ImageryNode';

// UI Components
import { ThinkingPanel, ThinkingPhase, ThinkingStep } from './ThinkingPanel';
import { ResearchScreen } from './ResearchScreen';
import { DropZone } from './DropZone';

// Hooks & Store
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAudioStream } from '../../hooks/useAudioStream';
import { useBrandStore } from '../../stores/useBrandStore';
import { useShallow } from 'zustand/react/shallow';
import type { FontSuggestion, ColorPalette, LogoInspiration, LogoStructureOption } from '@shared/types';

// React Flow node with proper typing
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
};

export type CanvasPhase = 'onboarding' | 'loading' | 'canvas';

interface CanvasProps {
    onBack?: () => void;
}

// Frame definitions for Miro-style layout (horizontal arrangement)
const FRAMES = {
    identity: { id: 'frame-identity', title: 'Brand Name', x: 50, y: 80, minWidth: 280, minHeight: 180, color: 'yellow' as const },
    overview: { id: 'frame-overview', title: 'Overview', x: 380, y: 80, minWidth: 300, minHeight: 250, color: 'blue' as const },
    strategy: { id: 'frame-strategy', title: 'Brand Strategy', x: 730, y: 80, minWidth: 300, minHeight: 350, color: 'purple' as const },

    visuals: { id: 'frame-visuals', title: 'Visual Identity', x: 1080, y: 80, minWidth: 500, minHeight: 550, color: 'green' as const },
    logo: { id: 'frame-logo', title: 'Logo Direction', x: 1700, y: 80, minWidth: 500, minHeight: 550, color: 'green' as const },
    tools: { id: 'frame-tools', title: 'Tools', x: 2250, y: 80, minWidth: 300, minHeight: 450, color: 'default' as const },
};

export const Canvas: React.FC<CanvasProps> = ({ onBack }) => {
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

    // React Flow integration - sync store nodes to ReactFlow
    const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
    const [edges, , onEdgesChange] = useEdgesState([]);

    // NOTE: The sync effect that merges store nodes with ReactFlow is located
    // AFTER the selection handler definitions (handleColorSelect, handleFontSelect)
    // to avoid "Cannot access before initialization" error.

    // Helper to add thinking step
    const addThinkingStep = useCallback((text: string, status: 'pending' | 'active' | 'complete' = 'active') => {
        const step: ThinkingStep = { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, text, status };
        setThinkingSteps(prev => [...prev, step]);
        return step.id;
    }, []);

    // WebSocket handlers - NOW USING ZUSTAND STORE
    const ws = useWebSocket({
        onSessionStarted: (sessionId) => {
            console.log('🎨 Canvas connected:', sessionId);
            setAiMessage("Connected! Tell me about your brand.");
        },

        onTranscription: (role, text) => {
            if (role === 'model') {
                setAiMessage(text);
                setVoiceState('speaking');
            } else {
                setVoiceState('listening');
            }
        },

        onAudioReceived: (base64Audio) => {
            audio.playAudio(base64Audio);
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
                    brandName: l.displayName || l.brandName,
                    source: l.source,
                    description: l.description,
                    isSelected: l.isSelected
                }));
                setLogoInspirations(inspirations);
            }

            // 5. Update Logo Options
            if (state.logoStructures?.options) {
                console.log('📦 Setting logo options from FULL_STATE:', state.logoStructures.options.length);
                setLogoOptions(state.logoStructures.options);
            }
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

    // Connect on mount
    useEffect(() => {
        ws.connect();
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

    // Auto-start microphone when session is established
    useEffect(() => {
        if (ws.sessionId && !audio.isRecording) {
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
    }, [ws.sessionId]);

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
            // Create a map of existing positions (for both frames and child nodes)
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
                    },
                });
            });

            // ========== STEP 2: Generate Child Nodes with parentId ==========

            // --- FRAME: Identity (Brand Name) ---
            if (dna.name) {
                derivedNodes.push({
                    id: 'brandName',
                    type: 'sticky',
                    parentId: FRAMES.identity.id,
                    extent: 'parent',
                    position: existingPositions.get('brandName') || { x: 20, y: 50 },
                    draggable: true,
                    data: {
                        label: '📛 Brand Name',
                        content: dna.name?.value,
                        color: 'yellow',
                        status: 'complete',
                    },
                });
            }

            // --- FRAME: Overview (Mission + Tagline) ---
            if (dna.mission) {
                derivedNodes.push({
                    id: 'mission',
                    type: 'sticky',
                    parentId: FRAMES.overview.id,
                    extent: 'parent',
                    position: existingPositions.get('mission') || { x: 20, y: 50 },
                    draggable: true,
                    data: {
                        label: '🎯 Mission',
                        content: dna.mission?.value,
                        color: 'blue',
                        status: 'complete',
                    },
                });
            }

            if (dna.tagline) {
                derivedNodes.push({
                    id: 'tagline',
                    type: 'sticky',
                    parentId: FRAMES.overview.id,
                    extent: 'parent',
                    position: existingPositions.get('tagline') || { x: 20, y: 240 },
                    draggable: true,
                    data: {
                        label: '✨ Tagline',
                        content: dna.tagline?.value,
                        color: 'blue',
                        status: 'complete',
                    },
                });
            }

            // --- FRAME: Strategy (Voice, Values) ---
            if (dna.voice) {
                derivedNodes.push({
                    id: 'voice',
                    type: 'sticky',
                    parentId: FRAMES.strategy.id,
                    extent: 'parent',
                    position: existingPositions.get('voice') || { x: 20, y: 50 },
                    draggable: true,
                    data: {
                        label: '💬 Brand Voice',
                        content: dna.voice?.value,
                        color: 'purple',
                        status: 'complete',
                    },
                });
            }

            if (dna.values && dna.values.items && dna.values.items.length > 0) {
                derivedNodes.push({
                    id: 'values',
                    type: 'sticky',
                    parentId: FRAMES.strategy.id,
                    extent: 'parent',
                    position: existingPositions.get('values') || { x: 20, y: 240 },
                    draggable: true,
                    data: {
                        label: '💎 Brand Values',
                        content: dna.values.items,
                        color: 'purple',
                        displayMode: 'tags',
                        status: 'complete',
                    },
                });
            }

            // --- Missing Nodes: Target Audience & Mood ---
            if (dna.targetAudience && dna.targetAudience.items && dna.targetAudience.items.length > 0) {
                derivedNodes.push({
                    id: 'audience',
                    type: 'sticky',
                    parentId: FRAMES.strategy.id, // Adding to Strategy Frame
                    extent: 'parent',
                    position: existingPositions.get('audience') || { x: 20, y: 430 },
                    draggable: true,
                    data: {
                        label: '👥 Target Audience',
                        content: dna.targetAudience.items,
                        color: 'purple',
                        displayMode: 'list', // Verify if 'list' is supported by StickyNode, defaulting to 'tags' if not or standard string join
                        status: 'complete',
                    },
                });
            }

            if (dna.mood && dna.mood.items && dna.mood.items.length > 0) {
                derivedNodes.push({
                    id: 'mood',
                    type: 'sticky',
                    parentId: FRAMES.overview.id, // Adding to Overview Frame
                    extent: 'parent',
                    position: existingPositions.get('mood') || { x: 20, y: 430 },
                    draggable: true,
                    data: {
                        label: '🎭 Mood',
                        content: dna.mood.items,
                        color: 'blue',
                        displayMode: 'tags',
                        status: 'complete',
                    },
                });
            }

            // --- FRAME: Visuals (Colors, Typography, Logo Inspiration) ---

            // Dynamic Accordion Logic
            // Calculate heights based on state (status: 'options' | 'saved' | 'empty')
            // These approx heights must match the rendered component heights + padding
            const PADDING = 20;
            let currentY = 50; // Start Y relative to frame

            // 1. COLORS
            // 1. COLORS
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
                derivedNodes.push({
                    id: 'colors',
                    type: 'palette',
                    parentId: FRAMES.visuals.id,
                    extent: 'parent',
                    position: existingPositions.get('colors') || { x: 20, y: currentY },
                    draggable: false, // Lock dragging to enforce accordion
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
                    },
                });
            }
            // Push down next node
            currentY += colorsHeight + PADDING;


            // 2. TYPOGRAPHY
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
                derivedNodes.push({
                    id: 'typography',
                    type: 'typography',
                    parentId: FRAMES.visuals.id,
                    extent: 'parent',
                    position: { x: 20, y: currentY }, // Always enforce calculated Y
                    draggable: false,
                    data: {
                        label: 'Typography',
                        status: typographyStatus,
                        options: fontOptions,
                        selectedFonts: typographyStatus === 'saved' && dna.typography?.items ? dna.typography.items.map((name, i) => ({
                            id: `font-${i}`,
                            name,
                            category: 'sans-serif' as const,
                        })) : undefined,
                        onSelect: handleFontSelect,
                    },
                });
            }
            // Push down next node
            currentY += typographyHeight + PADDING;


            // Push down next node
            currentY += typographyHeight + PADDING;

            // 3. IMAGERY CONCEPTS (New Node)
            if (imageryOptions.length > 0) {
                derivedNodes.push({
                    id: 'imagery',
                    type: 'imagery',
                    parentId: FRAMES.visuals.id,
                    extent: 'parent',
                    position: { x: 20, y: currentY },
                    draggable: false,
                    data: {
                        label: 'Imagery Concepts',
                        options: imageryOptions,
                        onSelect: handleImagerySelect,
                    },
                });

                // Calculate height for imagery node to push potential future nodes down
                // Approx height: Header (60) + Rows * CardHeight (~150)
                // Grid is 2 columns, so rows = ceil(length / 2)
                const rows = Math.ceil(imageryOptions.length / 2);
                const IMAGERY_HEIGHT = 60 + (rows * 200);
                currentY += IMAGERY_HEIGHT + PADDING;
            }


            if (logoOptions.length > 0) {
                derivedNodes.push({
                    id: 'logoStructures',
                    type: 'logoStructure',
                    parentId: FRAMES.logo.id,
                    extent: 'parent',
                    // Start at top of Logo Frame
                    position: { x: 20, y: 50 },
                    draggable: false,
                    data: {
                        label: 'Logo Structures',
                        options: logoOptions,
                        onSelect: handleLogoStructureSelect,
                    },
                });
            }
            // Logo column Y tracking
            let logoY = 50;
            const LOGO_STRUCTURE_HEIGHT = 380; // Approx height for grid

            if (logoOptions.length > 0) {
                logoY += LOGO_STRUCTURE_HEIGHT + PADDING;
            }

            // 4. LOGO INSPIRATION
            const inspirationStatus = (dna.logoAssets && dna.logoAssets.length > 0) ? 'saved' : (logoInspirations.length > 0 ? 'options' : 'empty');

            if (logoInspirations.length > 0 || (dna.logoAssets && dna.logoAssets.length > 0)) {
                derivedNodes.push({
                    id: 'inspiration',
                    type: 'inspiration',
                    parentId: FRAMES.logo.id,
                    extent: 'parent',
                    position: { x: 20, y: logoY }, // Follows Structures in Logo Frame
                    draggable: false,
                    data: {
                        label: 'Logo Inspiration',
                        status: inspirationStatus,
                        options: logoInspirations,
                        saved: dna.logoAssets,
                    },
                });
            }

            // --- FRAME: Tools (Vault, Voice Orb) ---
            // Voice Orb
            derivedNodes.push({
                id: 'voiceOrb',
                type: 'voiceOrb',
                parentId: FRAMES.tools.id,
                extent: 'parent',
                position: existingPositions.get('voiceOrb') || { x: 40, y: 50 },
                draggable: true,
                data: {
                    state: voiceState,
                    message: aiMessage,
                    onActivate: handleVoiceActivate,
                    onDeactivate: handleVoiceDeactivate,
                },
            });

            // Brand Vault
            derivedNodes.push({
                id: 'vault',
                type: 'vault',
                parentId: FRAMES.tools.id,
                extent: 'parent',
                position: existingPositions.get('vault') || { x: 20, y: 280 },
                draggable: true,
                data: {
                    label: 'Brand Vault',
                    fileCount: vaultStats.fileCount,
                    totalTokens: vaultStats.totalTokens,
                    isIngesting: vaultStats.isIngesting,
                    onUpload: handleVaultUpload
                },
            });

            // --- THOUGHT SIGNATURE NODES ---
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
    }, [dna, colorOptions, fontOptions, logoInspirations, logoOptions, imageryOptions, vaultStats, thoughtSignatures, phase]);

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
                currentStep={researchStatus.step}
                message={researchStatus.message || loadingMessage}
                competitors={researchStatus.competitors}
                thoughts={thinkingSteps}
                brandName={dna.name}
                industry={dna.industry}
            />
        );
    }

    // Render canvas phase
    return (
        <div className="w-full h-screen bg-[#f4f4f5]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.3}
                maxZoom={2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                className="bg-[#f4f4f5]"
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#a1a1aa" />
                <Controls showInteractive={false} className="bg-white rounded-lg shadow-lg" />
                <MiniMap
                    nodeColor="#6366f1"
                    maskColor="rgba(0,0,0,0.1)"
                    className="bg-white rounded-lg shadow-lg"
                />

                {/* Header Panel */}
                <Panel position="top-left" className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg shadow-md text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                </Panel>

                <Panel position="top-right" className="flex items-center space-x-3">
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${ws.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {ws.status === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                        <span>{ws.status === 'connected' ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-white rounded-lg shadow-md">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-800">Agent Canvas</span>
                    </div>
                </Panel>

                {/* Thinking Panel */}
                <Panel position="bottom-right" className="mr-4 mb-4">
                    <AnimatePresence>
                        {(thinkingPhase !== 'idle' || thinkingSteps.length > 0) && (
                            <ThinkingPanel
                                phase={thinkingPhase}
                                steps={thinkingSteps}
                                isCollapsed={thinkingCollapsed}
                                onToggleCollapse={() => setThinkingCollapsed(!thinkingCollapsed)}
                            />
                        )}
                    </AnimatePresence>
                </Panel>
            </ReactFlow>
        </div>
    );
};

export default Canvas;
