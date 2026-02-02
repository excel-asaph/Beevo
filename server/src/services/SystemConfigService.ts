import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SystemConfig } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../../brain/system_config.json');

export class SystemConfigService {
    private static instance: SystemConfigService;
    private cache: SystemConfig | null = null;

    private constructor() { }

    public static getInstance(): SystemConfigService {
        if (!SystemConfigService.instance) {
            SystemConfigService.instance = new SystemConfigService();
        }
        return SystemConfigService.instance;
    }

    async getConfig(): Promise<SystemConfig> {
        // PERMANENT FIX: Always read from disk to sync with external "cli" updates (Atomic Deployment)
        // if (this.cache) return this.cache; 

        try {
            const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
            this.cache = JSON.parse(raw);
            return this.cache!;
        } catch (error) {
            console.error("❌ Failed to load SystemConfig:", error);
            // Return a safe fallback or throw
            throw new Error("SystemConfig missing");
        }
    }

    async updateConfig(partial: Partial<SystemConfig>): Promise<SystemConfig> {
        const current = await this.getConfig();
        const updated = { ...current, ...partial };

        // Deep merge logic might be needed for nested objects if partial isn't full structure
        // For now, simpler: user usually sends full sub-objects or we manually handle sections

        this.cache = updated;
        await fs.writeFile(CONFIG_PATH, JSON.stringify(updated, null, 4));
        console.log("💾 SystemConfig saved.");
        return updated;
    }

    // Helper to update a single section specifically (avoiding full overwrite risks)
    async updateSection(sectionName: keyof SystemConfig['sections'], values: any) {
        const current = await this.getConfig();
        current.sections[sectionName] = { ...current.sections[sectionName], ...values };
        return this.updateConfig(current);
    }

    async updateFeedback(directive: keyof SystemConfig['feedback'], value: string) {
        const current = await this.getConfig();
        current.feedback[directive] = value;
        return this.updateConfig(current);
    }

    async setLock(section: keyof SystemConfig['locks'], isLocked: boolean) {
        const current = await this.getConfig();
        current.locks[section] = isLocked;
        return this.updateConfig(current);
    }
}
