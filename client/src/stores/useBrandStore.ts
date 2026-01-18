import { create } from 'zustand';
import { BrandDNA, LogoStructureOption, ImagerySuggestion, LogoInspiration } from '@shared/types';

// Local types that include `id` for UI selection (matches Canvas node component expectations)
export interface ColorOption {
    id: string;
    name: string;
    colors: string[];
    reasoning?: string;
}

export interface FontOption {
    id: string;
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'monospace';
    reasoning?: string;
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
        name: '',
        mission: '',
        colors: [],
        typography: [],
        voice: '',
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

            // If we are updating colors (and not just clearing them), clear options
            if (patch.colors && patch.colors.length > 0) {
                updates.colorOptions = [];
            }

            // If we are updating typography, clear font options
            if (patch.typography && patch.typography.length > 0) {
                updates.fontOptions = [];
            }

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
        const state = get();
        const selected = state.colorOptions.find(p => p.id === paletteId);
        if (selected) {
            // Update DNA with selected colors
            set((s) => ({
                dna: { ...s.dna, colors: selected.colors },
                colorOptions: [] // Clear options
            }));
        }
    },

    selectFont: (fontId) => {
        const state = get();
        const selected = state.fontOptions.find(f => f.id === fontId);
        if (selected) {
            // Add to typography array, remove from options
            set((s) => ({
                dna: {
                    ...s.dna,
                    typography: [...(s.dna.typography || []), selected.name]
                },
                fontOptions: s.fontOptions.filter(f => f.id !== fontId)
            }));
        }
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
