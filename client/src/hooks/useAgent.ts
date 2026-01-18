import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import type { CardData } from '../components/Agent/CardGrid';
import type { OrbState } from '../components/Agent/VoiceOrb';
import type { ThinkingPhase } from '../components/Agent/ThinkingCard';
import type { BrandDNA } from '@shared/types';

// Thinking step for the AI reasoning display
interface ThinkingStep {
    id: string;
    text: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    timestamp?: number;
}

// Note: AgentState interface available for future use
// interface AgentState {
//     orbState: OrbState;
//     aiMessage: string;
//     cards: CardData[];
//     thinkingPhase: ThinkingPhase;
//     thinkingSteps: ThinkingStep[];
//     currentAction: string;
//     brandDNA: BrandDNA | null;
//     isConnected: boolean;
//     sessionId: string | null;
// }

interface UseAgentOptions {
    onBrandDNAComplete?: (dna: BrandDNA) => void;
    onError?: (message: string) => void;
}

export function useAgent(options: UseAgentOptions = {}) {
    // Core state
    const [orbState, setOrbState] = useState<OrbState>('idle');
    const [aiMessage, setAiMessage] = useState<string>('');
    const [cards, setCards] = useState<CardData[]>([]);
    const [showCards, setShowCards] = useState(false);

    // Thinking state
    const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>('idle');
    const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
    const [currentAction, setCurrentAction] = useState<string>('');

    // Brand DNA
    const [brandDNA, setBrandDNA] = useState<BrandDNA | null>(null);

    // Audio handling
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);

    // Options ref to avoid stale closures
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Helper to add thinking step
    const addThinkingStep = useCallback((text: string, status: 'pending' | 'active' | 'complete' = 'active') => {
        const step: ThinkingStep = {
            id: Date.now().toString(),
            text,
            status,
            timestamp: Date.now()
        };
        setThinkingSteps(prev => [...prev, step]);
        return step.id;
    }, []);

    // Helper to update thinking step status
    const updateThinkingStep = useCallback((id: string, status: 'complete' | 'error') => {
        setThinkingSteps(prev => prev.map(s =>
            s.id === id ? { ...s, status } : s
        ));
    }, []);

    // Helper to add or update a card
    const upsertCard = useCallback((card: CardData) => {
        setCards(prev => {
            const existing = prev.find(c => c.id === card.id);
            if (existing) {
                return prev.map(c => c.id === card.id ? { ...c, ...card } : c);
            }
            return [...prev, card];
        });
        setShowCards(true);
    }, []);

    // Helper to mark a card complete
    const completeCard = useCallback((cardId: string) => {
        setCards(prev => prev.map(c =>
            c.id === cardId ? { ...c, status: 'complete' as const } : c
        ));
    }, []);

    // Initialize WebSocket with Agent-specific handlers
    const ws = useWebSocket({
        onSessionStarted: (sessionId) => {
            console.log('🎨 Agent session started:', sessionId);
        },

        onSessionEnded: () => {
            setOrbState('idle');
            setAiMessage('');
        },

        onTranscription: (role, text) => {
            if (role === 'model') {
                setAiMessage(text);
                setOrbState('speaking');
            }
        },

        onAudioReceived: (base64Audio) => {
            // Queue audio for playback
            audioQueueRef.current.push(base64Audio);
            if (!isPlayingRef.current) {
                playNextAudio();
            }
        },

        onThinkingStart: () => {
            setThinkingPhase('analyzing');
            setThinkingSteps([]);
            setOrbState('processing');
        },

        onThinkingStream: (thought, phase) => {
            // Add or update current thinking step
            addThinkingStep(thought, 'active');
            setCurrentAction(thought);

            // Map phase to our ThinkingPhase
            const phaseMap: Record<string, ThinkingPhase> = {
                'classify': 'analyzing',
                'analyze': 'analyzing',
                'decide': 'researching',
                'execute': 'generating'
            };
            setThinkingPhase(phaseMap[phase] || 'analyzing');
        },

        onThinkingEnd: (_duration, toolDecided, _thoughtSummary) => {
            // Mark all active steps as complete
            setThinkingSteps(prev => prev.map(s =>
                s.status === 'active' ? { ...s, status: 'complete' as const } : s
            ));

            if (toolDecided) {
                addThinkingStep(`Executing: ${toolDecided}`, 'active');
            }
        },

        onToolProcessingStart: (toolType) => {
            setCurrentAction(`Processing: ${toolType || 'tool'}`);
        },

        onToolProcessingEnd: () => {
            setThinkingPhase('complete');
            setCurrentAction('');
        },

        onDNAUpdate: (dna) => {
            setBrandDNA(dna);

            // Update cards based on DNA fields
            if (dna.name) {
                upsertCard({
                    id: 'brandName',
                    type: 'brandName',
                    title: 'Brand Name',
                    status: 'complete',
                    value: dna.name
                });
            }

            if (dna.mission) {
                upsertCard({
                    id: 'mission',
                    type: 'mission',
                    title: 'Mission',
                    status: 'complete',
                    value: dna.mission
                });
            }

            if (dna.colors && dna.colors.length > 0) {
                upsertCard({
                    id: 'colors',
                    type: 'colors',
                    title: 'Color Palette',
                    status: 'complete',
                    value: dna.colors
                });
            }

            if (dna.typography && dna.typography.length > 0) {
                upsertCard({
                    id: 'typography',
                    type: 'typography',
                    title: 'Typography',
                    status: 'complete',
                    value: dna.typography
                });
            }

            if (dna.voice) {
                upsertCard({
                    id: 'voice',
                    type: 'voice',
                    title: 'Brand Voice',
                    status: 'complete',
                    value: dna.voice
                });
            }

            // Notify completion if we have enough data
            const hasMinimumDNA = dna.name && dna.mission && dna.colors?.length;
            if (hasMinimumDNA) {
                optionsRef.current.onBrandDNAComplete?.(dna);
            }
        },

        onFontSuggestions: (fonts) => {
            // Create typography card with suggestions
            upsertCard({
                id: 'typography',
                type: 'typography',
                title: 'Typography',
                status: 'active',
                value: fonts.map(f => f.name)
            });
        },

        onColorSuggestions: (palettes) => {
            // Create color card with first palette
            if (palettes.length > 0) {
                upsertCard({
                    id: 'colors',
                    type: 'colors',
                    title: 'Color Palette',
                    status: 'active',
                    value: palettes[0].colors
                });
            }
        },

        onError: (message) => {
            console.error('Agent error:', message);
            setAiMessage(`Error: ${message}`);
            setOrbState('idle');
            optionsRef.current.onError?.(message);
        }
    });

    // Audio playback helper
    const playNextAudio = useCallback(async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const base64Audio = audioQueueRef.current.shift()!;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            }

            const ctx = audioContextRef.current;
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Convert PCM16 to Float32
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
            }

            const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => playNextAudio();
            source.start();
        } catch (error) {
            console.error('Audio playback error:', error);
            playNextAudio();
        }
    }, []);

    // Public methods
    const activate = useCallback(() => {
        if (ws.status !== 'connected') {
            ws.connect();
        }
        if (!ws.sessionId) {
            ws.startSession();
        }
        setOrbState('listening');
        setAiMessage("I'm listening. Tell me about your brand...");
    }, [ws]);

    const deactivate = useCallback(() => {
        setOrbState('idle');
        audioQueueRef.current = [];
    }, []);

    const speak = useCallback((text: string) => {
        if (ws.status === 'connected' && ws.sessionId) {
            ws.sendText(text);
            setOrbState('processing');
        }
    }, [ws]);

    const selectOption = useCallback((type: 'font' | 'color' | 'logo' | 'structure' | 'imagery', value: string) => {
        ws.sendSelection(type, value);
    }, [ws]);

    const reset = useCallback(() => {
        setCards([]);
        setShowCards(false);
        setThinkingPhase('idle');
        setThinkingSteps([]);
        setCurrentAction('');
        setBrandDNA(null);
        setAiMessage('');
        setOrbState('idle');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    return {
        // State
        orbState,
        aiMessage,
        cards,
        showCards,
        thinkingPhase,
        thinkingSteps,
        currentAction,
        brandDNA,
        isConnected: ws.status === 'connected',
        sessionId: ws.sessionId,

        // Actions
        activate,
        deactivate,
        speak,
        selectOption,
        reset,
        connect: ws.connect,
        disconnect: ws.disconnect,
        sendAudio: ws.sendAudio,

        // Card helpers
        upsertCard,
        completeCard,

        // Thinking helpers
        addThinkingStep,
        updateThinkingStep,
        setThinkingPhase,
        setCurrentAction,

        // Direct setters for demo mode
        setOrbState,
        setAiMessage,
        setShowCards,
    };
}
