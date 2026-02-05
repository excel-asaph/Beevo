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
    private workspaceId: string;

    constructor(workspaceId: string) {
        super();
        this.workspaceId = workspaceId;
        // Dynamic path based on workspaceId
        this.artifactsDir = path.join(__dirname, `../../brain/workspaces/${workspaceId}/research_artifacts`);
        this.latestFile = path.join(this.artifactsDir, 'complete_research_latest.json');
        this.previousFile = path.join(this.artifactsDir, 'complete_research_previous.json');

        // Ensure directory exists
        if (!fs.existsSync(this.artifactsDir)) {
            fs.mkdirSync(this.artifactsDir, { recursive: true });
        }
    }

    /**
     * Load the latest research state
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
     * Save state with strict rotation:
     * 1. Latest -> Previous (Overwrite)
     * 2. New -> Latest (Overwrite)
     * No numbered files are kept.
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
     */
    private rotateFiles(): void {
        try {
            if (fs.existsSync(this.latestFile)) {
                fs.copyFileSync(this.latestFile, this.previousFile);
                console.log(`📦 [StateManager:${this.workspaceId}] Rotated Latest -> Previous`);
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
                mood: { items: [], isSelected: true }
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

    static getStateManager(workspaceId: string): StateManager {
        if (!this.instances.has(workspaceId)) {
            console.log(`✨ Creating StateManager for workspace: ${workspaceId}`);
            this.instances.set(workspaceId, new StateManager(workspaceId));
        }
        return this.instances.get(workspaceId)!;
    }
}

