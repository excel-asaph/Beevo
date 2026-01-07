import { BrandDNA, ProgressItem } from '../../../shared/types';
import { ServerMessage, DNAUpdateMessage } from '../../../shared/messages';

export class BrandStateManager {
    private sessionId: string;
    private dna: BrandDNA;
    private progress: ProgressItem[] = [];

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.dna = {
            name: '',
            mission: '',
            colors: [],
            typography: [],
            voice: 'Professional'
        };
    }

    getDNA(): BrandDNA {
        return { ...this.dna };
    }

    getProgress(): ProgressItem[] {
        return [...this.progress];
    }

    update(field: string, value: any): void {
        console.log(`📝 State update - ${field}:`, value);

        switch (field) {
            case 'name':
                this.dna.name = value;
                this.updateProgress('name', value);
                break;

            case 'mission':
                this.dna.mission = value;
                this.updateProgress('mission', value);
                break;

            case 'colors':
                this.dna.colors = Array.isArray(value) ? value : [value];
                this.updateProgress('colors', this.dna.colors);
                break;

            case 'typography':
                this.dna.typography = Array.isArray(value) ? value : [value];
                this.updateProgress('font', this.dna.typography[0]);
                break;

            case 'voice':
                this.dna.voice = value;
                this.updateProgress('voice', value);
                break;

            case 'logoUrl':
                this.dna.logoUrl = value;
                break;

            default:
                console.warn(`Unknown field: ${field}`);
        }
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
