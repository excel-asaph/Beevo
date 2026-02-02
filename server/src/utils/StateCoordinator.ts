
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

    private async calculateHashFromContent(files: Map<string, string>): Promise<string> {
        const sortedKeys = Array.from(files.keys()).sort();
        const hashes: string[] = [];
        for (const key of sortedKeys) {
            const content = files.get(key) || '';
            hashes.push(crypto.createHash('sha256').update(content).digest('hex'));
        }
        return crypto.createHash('sha256').update(hashes.join('')).digest('hex').substring(0, 12);
    }

    public async sealState(message: string = "Sealed by State Coordinator") {
        console.log("\n🛡️ State Coordinator: Sealing Page State (Atomic)...");

        // 0. Get Current "Base" State
        const configService = SystemConfigService.getInstance();
        const currentConfig = await configService.getConfig();

        // Define baseDir: Where are the Current Live files?
        // If system_config has 'active_assets_path', use that.
        // Else (first run or migration), use ASSETS_DIR root.
        let baseDir = ASSETS_DIR;

        // Check if active_assets_path is defined and essentially not root
        // If active_assets_path is "states/abcdef", we look in ASSETS_DIR/states/abcdef
        if (currentConfig.active_assets_path && currentConfig.active_assets_path !== 'root') {
            // currentConfig.active_assets_path is relative to public/assets, e.g. "states/abc"
            baseDir = path.join(ASSETS_DIR, currentConfig.active_assets_path);
        }

        // 1. Load "Base" Files (The files currently Live)
        const fileContentMap = new Map<string, string>();

        try {
            // Check if baseDir exists
            await fs.access(baseDir);

            const baseFiles = await fs.readdir(baseDir);
            for (const file of baseFiles) {
                // We only care about the Block JSONs and specialized assets that define the state
                if (file.endsWith('_block.json')) {
                    const content = await fs.readFile(path.join(baseDir, file), 'utf-8');
                    fileContentMap.set(file, content);
                }
            }
        } catch (e) {
            console.warn(`⚠️ No accessible base state found at ${baseDir} (or first run). Starting clean.`);
        }

        // 2. Overlay Staged Files (The New Changes)
        // This ensures that if we only generated a new "Hero", we keep the old "Review" and "Offer"
        const stagedFiles = await fs.readdir(STAGING_DIR).catch(() => []);

        if (stagedFiles.length > 0) {
            for (const file of stagedFiles) {
                // Normalize filenames
                // hero_block_staging.json -> hero_block.json

                let targetName = file;
                if (targetName.includes('_staging')) targetName = targetName.replace('_staging', '');
                // Removed legacy _challenger logic as we standardized on _block_staging.json

                // Only process JSONs for now as they are the state definitions
                if (targetName.endsWith('.json')) {
                    const content = await fs.readFile(path.join(STAGING_DIR, file), 'utf-8');
                    fileContentMap.set(targetName, content);
                    console.log(`📦 Staged Change: ${file} -> ${targetName}`);
                }
            }
        } else {
            console.log("ℹ️ No staged changes. Re-sealing current state (or Initial sealing).");
        }

        // 3. Calculate New Hash (V_HASH)
        // Hash relies on the CONTENT of the blocks. 
        const newHash = await this.calculateHashFromContent(fileContentMap);
        console.log(`🔗 Generated State Hash: ${newHash}`);

        // 4. Create Immutable State Folder
        const statesDir = path.join(ASSETS_DIR, 'states');
        const newStateDir = path.join(statesDir, newHash);

        await fs.mkdir(newStateDir, { recursive: true });

        // 5. Write All Files to New Folder (The Bridge)
        for (const [fileName, content] of fileContentMap.entries()) {
            await fs.writeFile(path.join(newStateDir, fileName), content);
        }

        // Clear Staging
        for (const file of stagedFiles) {
            await fs.unlink(path.join(STAGING_DIR, file)).catch(() => { });
        }

        // 6. Archive in Database
        const db = DatabaseService.getInstance();

        // Convert Map to Object for Snapshot
        const activeBlocks: any = {};
        for (const [key, val] of fileContentMap.entries()) {
            try { activeBlocks[key.replace('_block.json', '')] = JSON.parse(val); } catch { }
        }

        const relativePath = `states/${newHash}`;

        const fullSnapshot = {
            system_config: { ...currentConfig, active_assets_path: relativePath },
            active_blocks: activeBlocks
        };

        const fileNamesList = Array.from(fileContentMap.keys());

        await db.savePageState(
            newHash,
            fullSnapshot,
            fileNamesList,
            { timestamp: Date.now(), message }
        );

        // 7. Update System Config (Atomic Switch)
        await configService.updateConfig({
            current_state_hash: newHash,
            active_assets_path: relativePath
        });

        console.log(`✨ Page State Sealed: ${newHash} -> /assets/${relativePath}`);

        // 8. Prune Old States (Keep Limit)
        await this.pruneOldStates();

        return newHash;
    }

    private async pruneOldStates() {
        try {
            const KEEP_COUNT = 5;
            const db = DatabaseService.getInstance();
            const allStates = await db.getAllStates(); // [{ state_hash: '...', timestamp: ... }] sorted DESC

            if (!allStates || allStates.length <= KEEP_COUNT) return;

            // 1. Identify "Keepers" (The N most recent hashes from DB)
            const keepers = new Set(allStates.slice(0, KEEP_COUNT).map((s: any) => s.state_hash));

            // 2. Scan Filesystem
            const statesDir = path.join(ASSETS_DIR, 'states');
            // Ensure dir exists
            try { await fs.access(statesDir); } catch { return; }

            const folders = await fs.readdir(statesDir);

            // 3. Delete "Ghosts"
            let prunedCount = 0;
            for (const folder of folders) {
                // Skip if it's one of the keepers
                if (keepers.has(folder)) continue;

                // Otherwise, it's an old state. Delete it.
                const folderPath = path.join(statesDir, folder);
                await fs.rm(folderPath, { recursive: true, force: true }).catch(() => { });
                console.log(`🗑️ Pruned old state: ${folder}`);
                prunedCount++;
            }

            if (prunedCount > 0) {
                console.log(`🧹 Cleanup: Removed ${prunedCount} old states. Keeping last ${KEEP_COUNT}.`);
            }

        } catch (error) {
            console.warn("⚠️ State Pruning warning:", error);
        }
    }
}
