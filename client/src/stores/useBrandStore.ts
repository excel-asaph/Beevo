import { create } from 'zustand';
import { BrandDNA, LogoStructureOption, ImagerySuggestion, LogoInspiration } from '@shared/types';

// Local types that include `id` for UI selection (matches Canvas node component expectations)
export interface ColorOption {
    id: string;
    name: string;
    colors: string[];
    reasoning?: string;
    isSelected?: boolean;
}

export interface FontOption {
    id: string;
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'monospace' | 'handwriting' | string;
    pairing?: string;
    reasoning?: string;
    isSelected?: boolean;
}

// Thought Signature - AI reasoning attached to a specific node
export interface ThoughtSignature {
    nodeId: string;
    title: string;
    reasoning: string;
    confidence?: number;
}

// Research status for agentic workflow
export interface ResearchStatus {
    isResearching: boolean;
    status: 'idle' | 'started' | 'searching' | 'analyzing' | 'generating' | 'complete';
    message: string;
    step: number;      // Current step (0-4)
    totalSteps: number;  // Total steps (5)
    competitors: string[];
    thoughts: Array<{
        id: string;
        text: string;
        status: 'pending' | 'active' | 'complete';
    }>;
}

interface BrandStore {
    // Core Data
    dna: BrandDNA;

    // Suggestion Options (temporary, for selection UI)
    colorOptions: ColorOption[];
    fontOptions: FontOption[];
    logoOptions: LogoStructureOption[];
    logoInspirations: LogoInspiration[];
    imageryOptions: ImagerySuggestion[];

    // Vault State
    vaultStats: {
        fileCount: number;
        totalTokens: number;
        isIngesting: boolean;
    };

    // UI State
    voiceState: 'idle' | 'listening' | 'thinking' | 'speaking';
    aiMessage: string;
    phase: 'onboarding' | 'loading' | 'canvas';
    loadingMessage: string;

    // Agentic workflow state
    thoughtSignatures: ThoughtSignature[];
    researchStatus: ResearchStatus;

    // ========== ACTIONS ==========

    // Granular DNA Update (patches only changed fields)
    updateDNA: (patch: Partial<BrandDNA>) => void;

    // Options Management
    setColorOptions: (palettes: ColorOption[]) => void;
    setFontOptions: (fonts: FontOption[]) => void;
    setLogoOptions: (options: LogoStructureOption[]) => void;
    setLogoInspirations: (inspirations: LogoInspiration[]) => void;
    setImageryOptions: (suggestions: ImagerySuggestion[]) => void;
    setVaultStats: (stats: Partial<{ fileCount: number; totalTokens: number; isIngesting: boolean }>) => void;

    // Selection handlers - update DNA and clear options
    selectColor: (paletteId: string) => void;
    selectFont: (fontId: string) => void;

    // UI State
    setVoiceState: (state: 'idle' | 'listening' | 'thinking' | 'speaking') => void;
    setAiMessage: (message: string) => void;
    setPhase: (phase: 'onboarding' | 'loading' | 'canvas') => void;
    setLoadingMessage: (message: string) => void;

    // Agentic workflow actions
    addThoughtSignature: (signature: ThoughtSignature) => void;
    clearThoughtSignatures: () => void;
    setResearchStatus: (status: Partial<ResearchStatus>) => void;
}

export const useBrandStore = create<BrandStore>((set, get) => ({
    // Initial State
    dna: {
        name: { value: '', isSelected: false },
        mission: { value: '', isSelected: false },
        voice: { value: '', isSelected: false },
        tagline: { value: '', isSelected: false },
        values: { items: [], isSelected: false },
        targetAudience: { items: [], isSelected: false },
        mood: { items: [], isSelected: false }
    },
    colorOptions: [],
    fontOptions: [],
    logoOptions: [],
    logoInspirations: [],
    imageryOptions: [],
    vaultStats: {
        fileCount: 0,
        totalTokens: 0,
        isIngesting: false
    },
    voiceState: 'idle',
    aiMessage: '',
    phase: 'onboarding',
    loadingMessage: 'Extracting brand identity...',
    thoughtSignatures: [],
    researchStatus: {
        isResearching: false,
        status: 'idle',
        message: '',
        step: 0,
        totalSteps: 5,
        competitors: [],
        thoughts: []
    },

    // ========== ACTION IMPLEMENTATIONS ==========

    // Simple DNA update - NO node side effects (Canvas derives nodes from DNA)
    updateDNA: (patch) => {
        set((state) => {
            const updates: Partial<BrandStore> = {
                dna: { ...state.dna, ...patch }
            };

            // If we are saving logos, clear inspiration options
            if (patch.logoAssets && patch.logoAssets.length > 0) {
                updates.logoInspirations = [];
            }

            return updates;
        });
    },

    setColorOptions: (palettes) => {
        set({ colorOptions: palettes });
    },

    setFontOptions: (fonts) => {
        set({ fontOptions: fonts });
    },

    setLogoOptions: (options) => {
        set({ logoOptions: options });
    },

    setLogoInspirations: (inspirations) => {
        set({ logoInspirations: inspirations });
    },

    setImageryOptions: (suggestions) => {
        set({ imageryOptions: suggestions });
    },

    setVaultStats: (stats) => {
        set((state) => ({
            vaultStats: { ...state.vaultStats, ...stats }
        }));
    },

    selectColor: (paletteId) => {
        // Handled via WebSocket usually, this might be legacy or local optimisitic update
        // Left empty to prevent direct DNA mutation if relying on server
        const state = get();
        // Implementation removed to prefer WS selection source of truth
    },

    selectFont: (fontId) => {
        // Handled via WebSocket selection
        // Implementation removed to prefer WS selection source of truth
    },

    setVoiceState: (voiceState) => set({ voiceState }),
    setAiMessage: (aiMessage) => set({ aiMessage }),
    setPhase: (phase) => set({ phase }),
    setLoadingMessage: (loadingMessage) => set({ loadingMessage }),

    // Agentic workflow actions
    addThoughtSignature: (signature) => set((state) => ({
        thoughtSignatures: [
            ...state.thoughtSignatures.filter(ts => ts.nodeId !== signature.nodeId),
            signature
        ]
    })),
    clearThoughtSignatures: () => set({ thoughtSignatures: [] }),
    setResearchStatus: (status) => set((state) => ({
        researchStatus: { ...state.researchStatus, ...status }
    })),
}));

export default useBrandStore;
