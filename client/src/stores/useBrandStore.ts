import { create } from 'zustand';
import { BrandDNA, LogoStructureOption, ImagerySuggestion, LogoInspiration, InterventionRequest } from '@shared/types';
import type { SnackbarItem } from '../components/Agent/Snackbar';

/**
 * Represents a selectable color palette option.
 * Includes `id` for UI selection compatibility.
 */
export interface ColorOption {
    id: string;
    name: string;
    colors: string[];
    reasoning?: string;
    isSelected?: boolean;
}

/**
 * Represents a selectable typography pairing option.
 */
export interface FontOption {
    id: string;
    name: string;
    category: 'serif' | 'sans-serif' | 'display' | 'monospace' | 'handwriting' | string;
    pairing?: string;
    reasoning?: string;
    isSelected?: boolean;
}

/**
 * Represents a unit of AI reasoning attached to a specific node/card in the UI.
 */
export interface ThoughtSignature {
    nodeId: string;
    title: string;
    reasoning: string;
    confidence?: number;
}

/**
 * Tracks the status of lengthy agentic research workflows.
 */
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

/**
 * The Global Brand Store.
 * 
 * Manages the entire state of the Brand Agent application, including:
 * - Brand DNA (Identity, Values, Voice)
 * - UI Options (Colors, Fonts, Logos)
 * - Research Status & Progress
 * - Agent State (Listening, Thinking, Speaking)
 * - Vault & File Ingestion Status
 * - Global UI State (Snackbar, Layout Overrides)
 */
interface BrandStore {
    dna: BrandDNA;
    projectName: string;

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
    generatedLogos: any[];

    // UI State
    voiceState: 'idle' | 'listening' | 'thinking' | 'speaking';
    aiMessage: string;
    phase: 'entry' | 'onboarding' | 'loading' | 'canvas';
    loadingMessage: string;

    // Agentic workflow state
    thoughtSignatures: ThoughtSignature[];
    researchStatus: ResearchStatus;

    // Persistence State
    canvasLayoutOverrides: Record<string, { x: number; y: number; width?: number; height?: number; color?: string; locked?: boolean }>;
    uiStateOverrides: Record<string, any>;
    history: Array<{ role: string; content: string; metadata?: any; timestamp: Date }>;
    isHydrated: boolean;
    activeWorkspaceId: string | null;
    isCommandCenterOpen: boolean;
    pendingInterventions: InterventionRequest[];
    lastAssetUpdate: number; // Timestamp of last content/asset change
    lastStateUpdate: number; // Timestamp of last structural/state change

    // Snackbar Notifications
    snackbarQueue: SnackbarItem[];
    focusedInterventionId: string | null;

    // ========== ACTIONS ==========

    // Granular DNA Update (patches only changed fields)
    updateDNA: (patch: Partial<BrandDNA>) => void;

    // Options Management
    setColorOptions: (palettes: ColorOption[]) => void;
    setFontOptions: (fonts: FontOption[]) => void;
    setLogoOptions: (options: LogoStructureOption[]) => void;
    setLogoInspirations: (inspirations: LogoInspiration[]) => void;
    setImageryOptions: (suggestions: ImagerySuggestion[]) => void;
    setGeneratedLogos: (logos: any[]) => void;
    setVaultStats: (stats: Partial<{ fileCount: number; totalTokens: number; isIngesting: boolean }>) => void;

    // Selection handlers - update DNA and clear options
    selectColor: (paletteId: string) => void;
    selectFont: (fontId: string) => void;

    // UI State
    setVoiceState: (state: 'idle' | 'listening' | 'thinking' | 'speaking') => void;
    setAiMessage: (message: string) => void;
    setPhase: (phase: 'entry' | 'onboarding' | 'loading' | 'canvas') => void;
    setLoadingMessage: (message: string) => void;

    // Agentic workflow actions
    addThoughtSignature: (signature: ThoughtSignature) => void;
    clearThoughtSignatures: () => void;
    setResearchStatus: (status: Partial<ResearchStatus> & { thoughts?: ResearchStatus['thoughts'] }) => void;
    appendResearchThoughts: (thoughts: ResearchStatus['thoughts']) => void;
    setProjectName: (name: string) => void;

    // Persistence Actions
    setLayoutOverride: (nodeId: string, override: Partial<{ x: number; y: number; width: number; height: number; color: string; locked: boolean }>) => void;
    setUiOverride: (key: string, value: any) => void;
    hydratePersistence: (workspaceId: string, silent?: boolean) => Promise<void>;
    hydrateHistory: (workspaceId: string) => Promise<void>;
    hydrateResearch: (workspaceId: string) => Promise<void>;
    setActiveWorkspaceId: (workspaceId: string | null) => void;
    setIsCommandCenterOpen: (isOpen: boolean) => void;
    commandCenterTab: 'general' | 'interventions' | 'config' | 'analytics';
    setCommandCenterTab: (tab: 'general' | 'interventions' | 'config' | 'analytics') => void;
    setPendingInterventions: (interventions: InterventionRequest[] | ((prev: InterventionRequest[]) => InterventionRequest[])) => void;
    triggerAssetUpdate: () => void;
    triggerStateUpdate: () => void;
    resetStore: (preservePhase?: boolean) => void;

    // Snackbar Actions
    addSnackbar: (item: SnackbarItem) => void;
    removeSnackbar: (id: string) => void;
    clearAllSnackbars: () => void;
    setFocusedInterventionId: (id: string | null) => void;
}

const INITIAL_STATE = {
    dna: {
        name: { value: '', isSelected: false },
        mission: { value: '', isSelected: false },
        voice: { value: '', isSelected: false },
        tagline: { value: '', isSelected: false },
        industry: { value: '', isSelected: false },
        values: { items: [], isSelected: false },
        targetAudience: { items: [], isSelected: false },
        mood: { items: [], isSelected: false },
        typography: { items: [], isSelected: false },
        colors: { items: [], isSelected: false }
    },
    projectName: 'Untitled',
    colorOptions: [],
    fontOptions: [],
    logoOptions: [],
    logoInspirations: [],
    imageryOptions: [],
    generatedLogos: [],
    vaultStats: {
        fileCount: 0,
        totalTokens: 0,
        isIngesting: false
    },
    voiceState: 'idle' as const,
    aiMessage: '',
    phase: 'entry' as const,
    loadingMessage: 'Extracting brand identity...',
    thoughtSignatures: [],
    researchStatus: {
        isResearching: false,
        status: 'idle' as const,
        message: '',
        step: 0,
        totalSteps: 5,
        competitors: [],
        thoughts: []
    },
    canvasLayoutOverrides: {},
    uiStateOverrides: {},
    history: [],
    isHydrated: false,
    activeWorkspaceId: null as string | null,
    isCommandCenterOpen: false,
    commandCenterTab: 'general' as 'general' | 'interventions' | 'config' | 'analytics',
    pendingInterventions: [] as InterventionRequest[],
    lastAssetUpdate: 0,
    lastStateUpdate: 0,
    snackbarQueue: [] as SnackbarItem[],
    focusedInterventionId: null as string | null,
};

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error ${res.status}: ${text}`);
            }
            return await res.json();
        } catch (err) {
            console.warn(`⚠️ Hydration Fetch Attempt ${i + 1} failed for ${url}:`, err);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
        }
    }
};

export const useBrandStore = create<BrandStore>((set) => ({
    ...INITIAL_STATE,

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

    setGeneratedLogos: (logos) => {
        set({ generatedLogos: logos });
    },

    setImageryOptions: (suggestions) => {
        set({ imageryOptions: suggestions });
    },

    setVaultStats: (stats) => {
        set((state) => ({
            vaultStats: { ...state.vaultStats, ...stats }
        }));
    },

    selectColor: (_paletteId) => {
        // Handled via WebSocket usually, this might be legacy or local optimisitic update
        // Left empty to prevent direct DNA mutation if relying on server
        // Implementation removed to prefer WS selection source of truth
    },

    selectFont: (_fontId) => {
        // Handled via WebSocket selection
        // Implementation removed to prefer WS selection source of truth
    },

    setVoiceState: (voiceState) => set({ voiceState }),
    setAiMessage: (aiMessage) => set({ aiMessage }),
    setPhase: (phase) => set({ phase }),
    setLoadingMessage: (message) => set({ loadingMessage: message }),

    // Agentic workflow actions
    // Agentic workflow actions
    setResearchStatus: (status) => set((state) => {
        // merged thoughts handling
        let newThoughts = state.researchStatus.thoughts;
        if (status.thoughts) {
            // specific update provided, use it (or merge if needed but usually full replacement for strict set)
            newThoughts = status.thoughts;
        }

        return {
            researchStatus: {
                ...state.researchStatus,
                ...status,
                thoughts: newThoughts
            }
        };
    }),

    appendResearchThoughts: (newThoughts) => set((state) => {
        const existingIds = new Set(state.researchStatus.thoughts.map(t => t.id));
        const uniqueThoughts = newThoughts.filter(t => !existingIds.has(t.id));

        if (uniqueThoughts.length === 0) return {}; // No changes

        return {
            researchStatus: {
                ...state.researchStatus,
                thoughts: [...state.researchStatus.thoughts, ...uniqueThoughts]
            }
        };
    }),
    setProjectName: (projectName) => set({ projectName }),
    addThoughtSignature: (signature) => {
        set((state) => {
            const newSignatures = [
                ...state.thoughtSignatures.filter(ts => ts.nodeId !== signature.nodeId),
                signature
            ];

            // Debounce persistence to prevent race conditions
            // (Request 1 overwriting Request 2 due to network lag)
            if ((window as any)._thoughtSaveTimeout) clearTimeout((window as any)._thoughtSaveTimeout);

            (window as any)._thoughtSaveTimeout = setTimeout(() => {
                const workspaceId = state.activeWorkspaceId; // Get fresh ID at execution time
                // Access LATEST state to ensure we save the accumulation
                const currentSignatures = useBrandStore.getState().thoughtSignatures;

                if (workspaceId) {
                    fetch('/api/workspace/state', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
                        body: JSON.stringify({ id: 'thought_signatures', data: currentSignatures })
                    }).catch(e => console.error('Thought Signature sync failed', e));
                }
            }, 1000);

            return { thoughtSignatures: newSignatures };
        });
    },

    clearThoughtSignatures: () => set({ thoughtSignatures: [] }),

    setLayoutOverride: (nodeId, override) => {
        set((state) => {
            const newOverrides = {
                ...state.canvasLayoutOverrides,
                [nodeId]: { ...state.canvasLayoutOverrides[nodeId], ...override }
            };

            // Persist immediately
            // Note: We are saving the ENTIRE overrides object, ensuring the DB has the full picture
            const workspaceId = state.activeWorkspaceId;
            if (workspaceId) {
                fetch('/api/workspace/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
                    body: JSON.stringify({ id: 'canvas_layout', data: newOverrides })
                }).catch(e => console.error('Canvas Layout persistence failed', e));
            }

            return { canvasLayoutOverrides: newOverrides };
        });
    },

    setUiOverride: (key, value) => {
        set((state) => {
            const newUiState = {
                ...state.uiStateOverrides,
                [key]: value
            };

            // Persist immediately
            const workspaceId = state.activeWorkspaceId;
            if (workspaceId) {
                fetch('/api/workspace/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
                    body: JSON.stringify({ id: 'ui_state', data: newUiState })
                }).catch(e => console.error('UI State persistence failed', e));
            }

            return { uiStateOverrides: newUiState };
        });
    },

    hydrateHistory: async (workspaceId) => {
        try {
            const data = await fetchWithRetry(`/api/workspace/history?limit=100`, {
                headers: { 'x-workspace-id': workspaceId }
            });
            if (Array.isArray(data)) {
                // FILTER: Only show chat-relevant roles in the main transcript store
                // 'tool_log' is handled by useActivityStore
                const chatHistory = data.filter((item: any) => ['user', 'model', 'ai'].includes(item.role));
                set({ history: chatHistory.map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) })) });
            }
        } catch (e) {
            console.error('❌ Failed to hydrate history after retries:', e);
        }
    },

    hydratePersistence: async (workspaceId, silent = false) => {
        if (!silent) set({ isHydrated: false });
        try {
            // Load Layout
            const layoutData = await fetchWithRetry(`/api/workspace/state/canvas_layout`, {
                headers: { 'x-workspace-id': workspaceId }
            });
            if (layoutData?.data) {
                set({ canvasLayoutOverrides: layoutData.data });
            }

            // Load UI State
            const uiData = await fetchWithRetry(`/api/workspace/state/ui_state`, {
                headers: { 'x-workspace-id': workspaceId }
            });
            if (uiData?.data) {
                set({ uiStateOverrides: uiData.data });
            }

            // Load Thought Signatures
            const thoughtsData = await fetchWithRetry(`/api/workspace/state/thought_signatures`, {
                headers: { 'x-workspace-id': workspaceId }
            });
            if (thoughtsData?.data && Array.isArray(thoughtsData.data)) {
                set({ thoughtSignatures: thoughtsData.data });
            }

        } catch (e) {
            console.error('❌ Failed to hydrate persistence after retries:', e);
        } finally {
            set({ isHydrated: true });
        }
    },

    hydrateResearch: async (workspaceId: string) => {
        try {
            console.log('🔍 Hydrating Research State...');
            // 1. Fetch Structured Result
            const res = await fetch(`/api/debug/research`, { headers: { 'x-workspace-id': workspaceId } });
            if (!res.ok) {
                console.log('ℹ️ No research artifact found. Skipping hydration.');
                return;
            }
            const data = await res.json();

            // Validation: Ensure we actually have data (handle empty JSON case)
            if (!data.brandDNA) {
                console.log('ℹ️ Empty/Invalid research artifact. Skipping hydration.');
                return;
            }

            // Populate Store
            set({
                dna: data.brandDNA,
                colorOptions: data.colorPalettes?.palettes || [],
                fontOptions: data.typographyPairings?.fonts || [],
                logoOptions: data.logoStructures?.options || [],
                // ... map other fields if necessary
            });

            // 2. Fetch/Reconstruct History
            let thoughts: any[] = [];

            // Try fetching real logs first
            try {
                const logsRes = await fetch(`/api/debug/research/thoughts`, { headers: { 'x-workspace-id': workspaceId } });
                if (logsRes.ok) {
                    const logs = await logsRes.json();
                    if (Array.isArray(logs) && logs.length > 0) {
                        console.log(`✅ Found ${logs.length} persisted thoughts.`);
                        thoughts = logs.map((log: any) => ({
                            id: log.id,
                            text: log.title + ': ' + log.content, // Map to UI expectation
                            status: 'complete'
                        }));
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch research logs', e);
            }

            // Fallback: Synthetic Reconstruction
            if (thoughts.length === 0) {
                console.log('⚠️ No logs found. Generating synthetic history.');
                if (data.brandDNA) thoughts.push({ id: 'syn-1', text: 'Brand DNA Extracted: Analysis complete.', status: 'complete' });
                if (data.competitorResearch) thoughts.push({ id: 'syn-2', text: `Competitor Research: Analyzed ${data.competitorResearch.competitors.length} market leaders.`, status: 'complete' });
                if (data.colorPalettes) thoughts.push({ id: 'syn-3', text: `Color Strategy: Generated ${data.colorPalettes.palettes.length} palettes.`, status: 'complete' });
                if (data.typographyPairings) thoughts.push({ id: 'syn-4', text: `Typography: Selected ${data.typographyPairings.fonts.length} font pairings.`, status: 'complete' });
                thoughts.push({ id: 'syn-5', text: 'Research Phase Complete.', status: 'complete' });
            }

            // 3. Update Status
            set((state) => ({
                researchStatus: {
                    ...state.researchStatus,
                    isResearching: false,
                    status: 'complete',
                    progress: 100,
                    step: 5,
                    thoughts: thoughts as any[]
                },
                // If we found research, ensure we are not in 'entry'
                // Fix: Do NOT transition from 'loading' to 'canvas' here. 
                // Hydration should only move us to canvas from absolute start ('entry').
                phase: state.phase === 'entry' ? 'canvas' : state.phase
            }));

        } catch (e) {
            console.error('❌ Failed to hydrate research:', e);
        }
    },

    setIsCommandCenterOpen: (isCommandCenterOpen) => set({ isCommandCenterOpen }),
    setCommandCenterTab: (commandCenterTab) => set({ commandCenterTab }),
    setPendingInterventions: (interventions) => set((state) => {
        const next = typeof interventions === 'function' ? interventions(state.pendingInterventions) : interventions;
        return { pendingInterventions: next };
    }),

    triggerAssetUpdate: () => set({ lastAssetUpdate: Date.now() }),
    triggerStateUpdate: () => set({ lastStateUpdate: Date.now() }),
    setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
    resetStore: (preservePhase) => set((state) => ({
        ...INITIAL_STATE,
        phase: preservePhase ? state.phase : INITIAL_STATE.phase,
        activeWorkspaceId: state.activeWorkspaceId, // Also preserve the ID we just set
        isHydrated: preservePhase ? state.isHydrated : INITIAL_STATE.isHydrated // Prevent loader flash/lock if already hydrated for this workspace
    })),

    // Snackbar Actions
    addSnackbar: (item) => set((state) => ({
        snackbarQueue: [...state.snackbarQueue, item]
    })),
    removeSnackbar: (id) => set((state) => ({
        snackbarQueue: state.snackbarQueue.filter(s => s.id !== id)
    })),
    clearAllSnackbars: () => set({ snackbarQueue: [] }),
    setFocusedInterventionId: (focusedInterventionId) => set({ focusedInterventionId })
}));

export default useBrandStore;
