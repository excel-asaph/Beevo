import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ResearchPhaseObject } from '../../../shared/types';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * StateManager - Handles research state persistence with rolling history
 * 
 * Maintains:
 * - complete_research_latest.json (current state)
 * - complete_research_v1.json through v5.json (5 previous states)
 */
export class StateManager extends EventEmitter {
    private readonly artifactsDir: string;
    private readonly latestFile: string;
    private readonly previousFile: string;
    private readonly thoughtsFile: string;
    private readonly thoughtsPreviousFile: string;
    private workspaceId: string;

    constructor(workspaceId: string) {
        super();
        this.workspaceId = workspaceId;
        // Dynamic path based on workspaceId
        this.artifactsDir = path.join(__dirname, `../../brain/workspaces/${workspaceId}/research_artifacts`);
        this.latestFile = path.join(this.artifactsDir, 'complete_research_latest.json');
        this.previousFile = path.join(this.artifactsDir, 'complete_research_previous.json');
        this.thoughtsFile = path.join(this.artifactsDir, 'research_thoughts.json');
        this.thoughtsPreviousFile = path.join(this.artifactsDir, 'research_thoughts_previous.json');

        // Ensure directory exists
        if (!fs.existsSync(this.artifactsDir)) {
            fs.mkdirSync(this.artifactsDir, { recursive: true });
        }
    }

    /**
     * Load the latest research state
     */
    /**
     * Loads the latest research state from disk.
     * 
     * @returns {ResearchPhaseObject | null} The loaded state or null if not found.
     */
    loadLatest(): ResearchPhaseObject | null {
        try {
            if (fs.existsSync(this.latestFile)) {
                const content = fs.readFileSync(this.latestFile, 'utf-8');
                return JSON.parse(content) as ResearchPhaseObject;
            }
        } catch (error) {
            console.error(`❌ [StateManager:${this.workspaceId}] Failed to load latest state:`, error);
        }
        return null;
    }

    /**
     * Append a thought to the persistent log
     */
    /**
     * Appends a thought to the persistent thought log.
     * 
     * @param {any} thought - The thought object to append.
     */
    async appendThought(thought: any): Promise<void> {
        try {
            let logs: any[] = [];
            if (fs.existsSync(this.thoughtsFile)) {
                const content = fs.readFileSync(this.thoughtsFile, 'utf8');
                try {
                    logs = JSON.parse(content);
                    if (!Array.isArray(logs)) logs = [];
                } catch (e) {
                    // Start fresh if corrupt or invalid JSON
                    logs = [];
                    logs = [];
                }
            }
            logs.push(thought);
            fs.writeFileSync(this.thoughtsFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error(`❌ [StateManager:${this.workspaceId}] Failed to append thought:`, error);
        }
    }

    /**
     * Get all persistent thoughts
     */
    /**
     * Retrieves all persistent thoughts.
     * 
     * @returns {any[]} An array of thought objects.
     */
    getThoughts(): any[] {
        try {
            console.log(`🔍 [StateManager:${this.workspaceId}] Reading thoughts from: ${this.thoughtsFile}`);
            if (fs.existsSync(this.thoughtsFile)) {
                let data;
                try {
                    data = JSON.parse(fs.readFileSync(this.thoughtsFile, 'utf8'));
                } catch (e) {
                    data = [];
                }

                if (!Array.isArray(data)) {
                    console.warn(`⚠️ [StateManager:${this.workspaceId}] Thoughts file was not an array. Recovering.`);
                    return [];
                }

                console.log(`✅ [StateManager:${this.workspaceId}] Loaded ${data.length} thoughts.`);
                return data;
            } else {
                console.warn(`⚠️ [StateManager:${this.workspaceId}] Thoughts file not found.`);
            }
        } catch (error) {
            console.error(`❌ [StateManager:${this.workspaceId}] Failed to read thoughts:`, error);
        }
        return [];
    }

    /**
     * Clear current thoughts (used when starting fresh research)
     */
    clearThoughts(): void {
        if (fs.existsSync(this.thoughtsFile)) {
            try { fs.unlinkSync(this.thoughtsFile); } catch (e) { }
        }
    }

    /**
     * Save state with strict rotation:
     * 1. Latest -> Previous (Overwrite)
     * 2. New -> Latest (Overwrite)
     * No numbered files are kept.
     */
    /**
     * Saves a specific section of the research state, maintaining history.
     * Rotates files before saving.
     * 
     * @param {K} section - The key of the section to update.
     * @param {ResearchPhaseObject[K]} data - The data to save.
     */
    async saveWithHistory<K extends keyof ResearchPhaseObject>(
        section: K,
        data: ResearchPhaseObject[K]
    ): Promise<void> {
        // Load current state
        let currentState = this.loadLatest();

        if (!currentState) {
            console.warn(`⚠️ [StateManager:${this.workspaceId}] No existing state - creating new one`);
            currentState = this.createEmptyState();
        }

        // Step 1: Rotate Latest -> Previous
        this.rotateFiles();

        // Step 2: Update the section
        currentState[section] = data;
        currentState.timestamp = new Date().toISOString();
        currentState.stateVersion = (currentState.stateVersion || 0) + 1;

        // Step 3: Save updated state to Latest
        await this.saveLatest(currentState);

        console.log(`✅ [StateManager:${this.workspaceId}] Saved ${String(section)} (v${currentState.stateVersion})`);
    }

    /**
     * Save the complete state (for full research cycle)
     */
    /**
     * Saves the complete research state object.
     * Rotates files before saving.
     * 
     * @param {ResearchPhaseObject} state - The complete state object.
     */
    async saveFullState(state: ResearchPhaseObject): Promise<void> {
        const currentState = this.loadLatest();

        // Rotate if we have a previous state
        if (currentState) {
            this.rotateFiles();
        }

        state.timestamp = new Date().toISOString();
        state.stateVersion = (currentState?.stateVersion || 0) + 1;

        await this.saveLatest(state);

        console.log(`✅ [StateManager:${this.workspaceId}] Saved full state (v${state.stateVersion})`);
    }

    /**
     * Rotates files: Existing Latest becomes Previous.
     * Also rotates thoughts log to keep history in sync.
     */
    private rotateFiles(): void {
        try {
            // Rotate Main State
            if (fs.existsSync(this.latestFile)) {
                fs.copyFileSync(this.latestFile, this.previousFile);
                console.log(`📦 [StateManager:${this.workspaceId}] Rotated Latest -> Previous`);
            }

            // Rotate Thoughts Log
            if (fs.existsSync(this.thoughtsFile)) {
                fs.copyFileSync(this.thoughtsFile, this.thoughtsPreviousFile);
                console.log(`🧠 [StateManager:${this.workspaceId}] Rotated Thoughts -> Previous`);
            }

        } catch (error) {
            console.error(`❌ [StateManager:${this.workspaceId}] Failed to rotate files:`, error);
        }
    }

    /**
     * Save to the latest file
     */
    private async saveLatest(state: ResearchPhaseObject): Promise<void> {
        fs.writeFileSync(this.latestFile, JSON.stringify(state, null, 2), 'utf-8');
        this.emit('stateUpdated', state);
    }

    /**
     * Create an empty state object
     */
    private createEmptyState(): ResearchPhaseObject {
        return {
            brandDNA: {
                name: { value: '', isSelected: true },
                mission: { value: '', isSelected: true },
                voice: { value: '', isSelected: true },
                tagline: { value: '', isSelected: true },
                values: { items: [], isSelected: true },
                targetAudience: { items: [], isSelected: true },
                mood: { items: [], isSelected: true },
                industry: { value: '', isSelected: true },
                typography: { items: [], isSelected: true },
                colors: { items: [], isSelected: true }
            },
            competitorResearch: {
                competitors: [],
                differentiationOpportunity: '',
                competitorBranding: []
            },
            colorPalettes: {
                palettes: []
            },
            typographyPairings: {
                fonts: []
            },
            summary: '',
            timestamp: new Date().toISOString(),
            stateVersion: 0
        };
    }

    /**
     * Get path to latest file (for external reference)
     */
    getLatestFilePath(): string {
        return this.latestFile;
    }
}

// Global Factory for managing multiple workspace states
export class WorkspaceManager {
    private static instances: Map<string, StateManager> = new Map();

    /**
     * Retrieves or creates a StateManager instance for the specified workspace.
     * 
     * @param {string} workspaceId - The workspace identifier.
     * @returns {StateManager} The StateManager instance.
     */
    static getStateManager(workspaceId: string): StateManager {
        if (!this.instances.has(workspaceId)) {
            console.log(`✨ [WorkspaceManager] Creating StateManager for workspace: ${workspaceId} (Might create dirs if missing)`);
            this.instances.set(workspaceId, new StateManager(workspaceId));
        }
        return this.instances.get(workspaceId)!;
    }

    /**
     * Remove the state manager instance for a workspace
     */
    static cleanup(workspaceId: string): void {
        this.instances.delete(workspaceId);
    }
}

