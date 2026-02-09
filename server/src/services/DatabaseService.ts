import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.resolve(__dirname, '../db/schema.sql');

/**
 * Service to handle SQLite database operations for workspace history and state.
 * Manages database connections, schema initialization, and data persistence.
 */
export class DatabaseService {
    private static instances: Map<string, DatabaseService> = new Map();
    private db: Database | null = null;
    private workspaceId: string;
    private dbPath: string;
    private initializePromise: Promise<void> | null = null;

    private constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        // Independent DB per workspace
        console.log(`📡 [DatabaseService] Constructor called for: ${workspaceId}`);
        this.dbPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}/beevo_history.db`);
    }

    /**
     * Retrieves the singleton instance of the DatabaseService for a specific workspace.
     * 
     * @param {string} [workspaceId='default'] - The workspace identifier.
     * @returns {DatabaseService} The DatabaseService instance.
     */
    public static getInstance(workspaceId: string = 'default'): DatabaseService {
        if (!DatabaseService.instances.has(workspaceId)) {
            DatabaseService.instances.set(workspaceId, new DatabaseService(workspaceId));
        }
        return DatabaseService.instances.get(workspaceId)!;
    }

    /**
     * Terminate the database connection and remove the instance
     */
    public static async cleanup(workspaceId: string): Promise<void> {
        const instance = this.instances.get(workspaceId);
        if (instance) {
            console.log(`🔌 [${workspaceId}] Closing Database Connection...`);
            if (instance.db) {
                await instance.db.close();
                instance.db = null;
            }
            this.instances.delete(workspaceId);
        }
    }

    /**
     * Initializes the database connection and ensures the schema is applied.
     * Use this before performing any database queries.
     * 
     * @returns {Promise<void>}
     */
    public async initialize() {
        if (this.db) return;
        if (this.initializePromise) return this.initializePromise;

        this.initializePromise = (async () => {
            try {
                // Ensure brain/workspace exists
                console.log(`📁 [DatabaseService] ensuring/creating directory: ${path.dirname(this.dbPath)}`);
                await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

                this.db = await open({
                    filename: this.dbPath,
                    driver: sqlite3.Database
                });

                const schema = await fs.readFile(SCHEMA_PATH, 'utf8');
                await this.db.exec(schema);
                console.log(`✅ [${this.workspaceId}] SQLite History Database Initialized`);
            } catch (error) {
                console.error(`❌ [${this.workspaceId}] Database Initialization Failed:`, error);
                this.initializePromise = null;
                throw error;
            }
        })();

        return this.initializePromise;
    }

    /**
     * Saves a snapshot of the page state.
     * 
     * @param {string} stateHash - Unique hash of the state.
     * @param {any} sections - The page sections data.
     * @param {any} mediaRefs - Media references used in the page.
     * @param {any} [metrics={}] - Performance metrics associated with this state.
     */
    public async savePageState(stateHash: string, sections: any, mediaRefs: any, metrics: any = {}) {
        if (!this.db) await this.initialize();

        await this.db?.run(
            `INSERT OR IGNORE INTO page_states (state_hash, snapshot, media_refs, metrics)
             VALUES (?, ?, ?, ?)`,
            [stateHash, JSON.stringify(sections), JSON.stringify(mediaRefs), JSON.stringify(metrics)]
        );
    }

    /**
     * Saves a lead submission linked to a specific page state.
     * 
     * @param {string} type - The type of lead (e.g., 'email', 'contact').
     * @param {any} formData - The submitted form data.
     * @param {string} pageStateHash - The hash of the page state where the submission occurred.
     */
    public async saveLead(type: string, formData: any, pageStateHash: string) {
        if (!this.db) await this.initialize();

        const id = crypto.randomUUID();
        await this.db?.run(
            `INSERT INTO lead_submissions (id, type, form_data, page_state_hash)
             VALUES (?, ?, ?, ?)`,
            [id, type, JSON.stringify(formData), pageStateHash]
        );

        // Increment Lead count in page state metrics
        const state = await this.getState(pageStateHash) as any;
        if (state) {
            const metrics = state.metrics ? JSON.parse(state.metrics) : { views: 0, clicks: 0, leads: 0, component_breakdown: {} };
            metrics.leads = (metrics.leads || 0) + 1;
            await this.updatePageStateMetrics(pageStateHash, metrics);
        }
    }

    public async updatePageStateMetrics(stateHash: string, metrics: any) {
        if (!this.db) await this.initialize();
        await this.db?.run(
            'UPDATE page_states SET metrics = ? WHERE state_hash = ?',
            [JSON.stringify(metrics), stateHash]
        );
    }

    public async getState(stateHash: string) {
        if (!this.db) await this.initialize();
        return await this.get('SELECT * FROM page_states WHERE state_hash = ?', [stateHash]);
    }

    public async get(sql: string, params: any[] = []) {
        if (!this.db) await this.initialize();
        return await this.db?.get(sql, params);
    }

    public async getAllStates() {
        if (!this.db) await this.initialize();
        return await this.db?.all('SELECT * FROM page_states ORDER BY timestamp DESC');
    }

    public async getAllLeads() {
        if (!this.db) await this.initialize();
        return await this.db?.all('SELECT * FROM lead_submissions ORDER BY timestamp DESC');
    }

    public async getLeadsForState(stateHash: string) {
        if (!this.db) await this.initialize();
        return await this.db?.all('SELECT * FROM lead_submissions WHERE page_state_hash = ?', [stateHash]);
    }

    // --- Workspace State Persistence ---

    /**
     * Saves the workspace state (canvas layout, UI state).
     * 
     * @param {string} id - The state identifier (e.g., 'canvas_layout').
     * @param {any} data - The state data to save.
     */
    public async saveWorkspaceState(id: string, data: any) {
        if (!this.db) await this.initialize();
        await this.db?.run(
            `INSERT OR REPLACE INTO workspace_state (id, data, updated_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [id, JSON.stringify(data)]
        );
    }

    public async loadWorkspaceState(id: string) {
        if (!this.db) await this.initialize();
        const row = await this.db?.get('SELECT data FROM workspace_state WHERE id = ?', [id]);
        return row ? JSON.parse(row.data) : null;
    }

    // --- Session History Persistence ---

    /**
     * Saves a chat history entry.
     * 
     * @param {string} role - The role of the message sender ('user', 'model', 'thinking').
     * @param {string} content - The message content.
     * @param {any} [metadata=null] - Additional metadata.
     */
    public async saveHistory(role: string, content: string, metadata: any = null) {
        if (!this.db) await this.initialize();
        await this.db?.run(
            `INSERT INTO session_history (role, content, metadata)
             VALUES (?, ?, ?)`,
            [role, content, metadata ? JSON.stringify(metadata) : null]
        );
    }

    public async loadHistory(limit: number = 50) {
        if (!this.db) await this.initialize();
        const rows = await this.db?.all(
            `SELECT role, content, metadata, timestamp FROM session_history 
             ORDER BY timestamp ASC LIMIT ?`,
            [limit]
        );
        return rows?.map(r => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : null,
            timestamp: new Date(r.timestamp)
        })) || [];
    }
}

