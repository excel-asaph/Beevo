import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SystemConfig } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SystemConfigService {
    private cache: SystemConfig | null = null;
    private workspaceId: string;
    private configPath: string;

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        this.configPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}/system_config.json`);
    }

    async getConfig(): Promise<SystemConfig> {
        // PERMANENT FIX: Always read from disk to sync with external "cli" updates (Atomic Deployment)
        // if (this.cache) return this.cache; 

        try {
            await this.ensureConfigExists();
            const raw = await fs.readFile(this.configPath, 'utf-8');
            this.cache = JSON.parse(raw);
            return this.cache!;
        } catch (error) {
            console.error(`❌ [Config:${this.workspaceId}] Failed to load SystemConfig:`, error);
            // Return a safe fallback or throw
            throw new Error("SystemConfig missing");
        }
    }

    private async ensureConfigExists() {
        // If config doesn't exist, maybe copy from default or create new?
        // For now, let's assume if the directory exists, we might need a default config.
        try {
            await fs.access(this.configPath);
        } catch {
            // Config missing. Create default or copy global template?
            // Let's create a basic default structure if missing
            const dir = path.dirname(this.configPath);
            await fs.mkdir(dir, { recursive: true });

            // Try to copy from global template if available
            const globalPath = path.resolve(__dirname, '../../brain/system_config.json');
            try {
                await fs.copyFile(globalPath, this.configPath);
                console.log(`[Config:${this.workspaceId}] Initialized from global template.`);
            } catch {
                console.warn(`[Config:${this.workspaceId}] Global template not found. Creating empty default.`);
                // Fallback default
                const defaultConfig: SystemConfig = {
                    sections: {},
                    client_tracking: {},
                    hitl: { enabled: true, require_approval_pre: false, require_approval_post: false, auto_proceed_delay_m: 0 },
                    locks: {},
                    feedback: {},
                    active_assets_path: "root"
                } as any;
                await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 4));
            }
        }
    }

    async updateConfig(partial: Partial<SystemConfig>): Promise<SystemConfig> {
        const current = await this.getConfig();
        const updated = { ...current, ...partial };

        this.cache = updated;
        await fs.writeFile(this.configPath, JSON.stringify(updated, null, 4));
        console.log(`💾 [Config:${this.workspaceId}] SystemConfig saved.`);
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

// Factory for managing workspace configs
export class SystemConfigFactory {
    private static instances: Map<string, SystemConfigService> = new Map();

    static getInstance(workspaceId: string): SystemConfigService {
        if (!this.instances.has(workspaceId)) {
            this.instances.set(workspaceId, new SystemConfigService(workspaceId));
        }
        return this.instances.get(workspaceId)!;
    }
}

