
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { DatabaseService } from '../services/DatabaseService.js';
import { SystemConfigService } from '../services/SystemConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STAGING_DIR = path.resolve(__dirname, '../../brain/staging');
const ASSETS_DIR = path.resolve(__dirname, '../../../client/public/assets');
const HISTORY_DIR = path.resolve(__dirname, '../../brain/history');

export class StateCoordinator {
    private static instance: StateCoordinator;

    private constructor() { }

    public static getInstance(): StateCoordinator {
        if (!StateCoordinator.instance) {
            StateCoordinator.instance = new StateCoordinator();
        }
        return StateCoordinator.instance;
    }

    private async getDirectoryHash(dir: string): Promise<string> {
        const files = await fs.readdir(dir).catch(() => []);
        const hashes: string[] = [];

        for (const file of files) {
            if (file.endsWith('.json') || file.endsWith('.mp4') || file.endsWith('.png')) {
                const content = await fs.readFile(path.join(dir, file));
                hashes.push(crypto.createHash('sha256').update(content).digest('hex'));
            }
        }

        return crypto.createHash('sha256').update(hashes.sort().join('')).digest('hex').substring(0, 12);
    }

    public async sealState(message: string = "Sealed by State Coordinator") {
        console.log("\n🛡️ State Coordinator: Sealing Page State...");

        // 1. Check for staged changes
        const stagedFiles = await fs.readdir(STAGING_DIR).catch(() => []);
        if (stagedFiles.length === 0) {
            console.log("ℹ️ No staged changes to seal.");
            // If strictly sealing existing state (like Initial Run), proceed to hash check
        } else {
            // 2. Atomic Move to Live (with History Backup)
            await fs.mkdir(HISTORY_DIR, { recursive: true });

            for (const file of stagedFiles) {
                const liveName = file.replace('_staging', '');
                const livePath = path.join(ASSETS_DIR, liveName);

                // A. Backup existing live file if it exists
                try {
                    const existingContent = await fs.readFile(livePath);
                    const fileHash = crypto.createHash('sha256').update(existingContent).digest('hex').substring(0, 8);
                    const timestamp = Date.now();
                    const ext = path.extname(liveName);
                    const base = path.basename(liveName, ext);

                    const backupName = `${base}_${timestamp}_${fileHash}${ext}`;
                    await fs.copyFile(livePath, path.join(HISTORY_DIR, backupName));
                    console.log(`📜 Archived: ${liveName} -> history/${backupName}`);
                } catch (e) {
                    // File might not exist yet (first run), ignore
                }

                // B. Overwrite with Staging
                await fs.copyFile(path.join(STAGING_DIR, file), livePath);
                await fs.unlink(path.join(STAGING_DIR, file));
                console.log(`✅ Committed: ${liveName}`);
            }
        }

        // 3. Calculate New Global Hash
        const hash = await this.getDirectoryHash(ASSETS_DIR);
        console.log(`🔗 New State Hash: ${hash}`);

        // 4. Archive in Database
        const db = DatabaseService.getInstance();
        const config = await SystemConfigService.getInstance().getConfig();

        // NEW: Load all active block content for forensic storage
        const blockFiles = await fs.readdir(ASSETS_DIR).catch(() => []);
        const activeBlocks: any = {};

        for (const file of blockFiles) {
            if (file.endsWith('_block.json')) {
                try {
                    const content = await fs.readFile(path.join(ASSETS_DIR, file), 'utf-8');
                    const name = file.replace('_block.json', '');
                    activeBlocks[name] = JSON.parse(content);
                } catch (e) {
                    console.warn(`⚠️ Failed to capture block content for ${file}`);
                }
            }
        }

        const fullSnapshot = {
            system_config: config,
            active_blocks: activeBlocks
        };

        await db.savePageState(
            hash,
            fullSnapshot, // Now contains config + actual block content
            blockFiles, // media_refs
            { timestamp: Date.now(), message } // metrics/meta
        );

        // 5. Update System Config with active hash
        await SystemConfigService.getInstance().updateConfig({ current_state_hash: hash });

        console.log("✨ Page State Sealed and Archived.");
        return hash;
    }
}
