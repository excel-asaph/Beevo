import { BrandDNA, ProgressItem } from '../../../shared/types';
import { ServerMessage, DNAUpdateMessage } from '../../../shared/messages';

export class BrandStateManager {
    private sessionId: string;
    private dna: BrandDNA;
    private progress: ProgressItem[] = [];
    private stateHistory: { dna: BrandDNA; timestamp: number }[] = [];
    private readonly MAX_HISTORY = 5;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.dna = {
            name: { value: '', isSelected: false },
            mission: { value: '', isSelected: false },
            colors: { items: [], isSelected: false },
            typography: { items: [], isSelected: false },
            values: { items: [], isSelected: false },
            voice: { value: '', isSelected: false },
            tagline: { value: '', isSelected: false },
            targetAudience: { items: [], isSelected: false },
            mood: { items: [], isSelected: false }
        };
        this.saveSnapshot(); // Initial state
    }

    private saveSnapshot(): void {
        this.stateHistory.unshift({
            dna: JSON.parse(JSON.stringify(this.dna)),
            timestamp: Date.now()
        });
        if (this.stateHistory.length > this.MAX_HISTORY) {
            this.stateHistory.pop();
        }
    }

    getHistory(): { dna: BrandDNA; timestamp: number }[] {
        return [...this.stateHistory];
    }

    getDNA(): BrandDNA {
        return { ...this.dna };
    }

    getProgress(): ProgressItem[] {
        return [...this.progress];
    }

    update(field: string, value: any): void {
        const valueStr = value === undefined ? 'undefined' : JSON.stringify(value);
        console.log(`📝 State update - ${field}:`, (valueStr || 'null').substring(0, 100));

        // Helper to ensure structure
        const ensureStructure = (val: any, isArray: boolean) => {
            if (val && typeof val === 'object' && ('value' in val || 'items' in val)) return val;
            return isArray
                ? { items: Array.isArray(val) ? val : [val], isSelected: true }
                : { value: val, isSelected: true };
        };

        switch (field) {
            case 'name':
                this.dna.name = ensureStructure(value, false);
                this.updateProgress('name', this.dna.name.value);
                break;

            case 'mission':
                this.dna.mission = ensureStructure(value, false);
                this.updateProgress('mission', this.dna.mission.value);
                break;

            case 'colors':
                this.dna.colors = ensureStructure(value, true);
                this.updateProgress('colors', this.dna.colors.items);
                break;

            case 'typography':
                this.dna.typography = ensureStructure(value, true);
                this.updateProgress('font', this.dna.typography.items[0]);
                break;

            case 'voice':
                this.dna.voice = ensureStructure(value, false);
                this.updateProgress('voice', this.dna.voice.value);
                break;

            case 'tagline':
                this.dna.tagline = ensureStructure(value, false);
                break;

            case 'values':
                this.dna.values = ensureStructure(value, true);
                break;

            case 'targetAudience':
                this.dna.targetAudience = ensureStructure(value, true);
                break;

            case 'mood':
                this.dna.mood = ensureStructure(value, true);
                break;

            case 'logoUrl':
                if (this.dna.logoUrl) {
                    this.dna.logoUrl = { ...this.dna.logoUrl, value: value.value || value };
                } else {
                    this.dna.logoUrl = { value: value.value || value, isSelected: true };
                }
                break;

            // Phase 9: Logo & Competitive Intelligence (Legacy/Future fields)
            case 'logoStyle':
                this.dna.logoStyle = value;
                break;

            case 'logoMood':
                this.dna.logoMood = value;
                break;

            case 'logoInspiration':
                this.dna.logoInspiration = value;
                break;

            case 'logoUsageContexts':
                this.dna.logoUsageContexts = Array.isArray(value) ? value : [value];
                break;

            case 'competitorInsights':
                this.dna.competitorInsights = value;
                break;

            case 'logoAssets':
                this.dna.logoAssets = value;
                break;

            default:
                console.warn(`Unknown field: ${field}`);
        }
        this.saveSnapshot();
    }

    updateBatch(updates: Record<string, any>): void {
        console.log('📝 Batch state update:', Object.keys(updates));
        Object.entries(updates).forEach(([field, value]) => {
            this.update(field, value);
        });
    }

    private updateProgress(field: ProgressItem['field'], value: any): void {
        const existingIndex = this.progress.findIndex(p => p.field === field);

        const progressItem: ProgressItem = {
            field,
            value,
            finalized: false, // User must explicitly finalize
            timestamp: Date.now()
        };

        if (existingIndex >= 0) {
            this.progress[existingIndex] = progressItem;
        } else {
            this.progress.push(progressItem);
        }
    }

    finalize(field: ProgressItem['field']): boolean {
        const item = this.progress.find(p => p.field === field);
        if (item) {
            item.finalized = true;
            return true;
        }
        return false;
    }

    unfinalizeForEdit(field: ProgressItem['field']): boolean {
        const item = this.progress.find(p => p.field === field);
        if (item) {
            item.finalized = false;
            return true;
        }
        return false;
    }

    isComplete(): boolean {
        const requiredFields: ProgressItem['field'][] = ['name', 'font', 'colors'];
        return requiredFields.every(field =>
            this.progress.some(p => p.field === field && p.finalized)
        );
    }

    toJSON(): object {
        return {
            sessionId: this.sessionId,
            dna: this.dna,
            progress: this.progress,
            isComplete: this.isComplete()
        };
    }
}
