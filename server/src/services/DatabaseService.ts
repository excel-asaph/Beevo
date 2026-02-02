import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../brain/beevo_history.db');
const SCHEMA_PATH = path.resolve(__dirname, '../db/schema.sql');

export class DatabaseService {
    private static instance: DatabaseService;
    private db: Database | null = null;

    private constructor() { }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    public async initialize() {
        if (this.db) return;

        // Ensure brain directory exists
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

        this.db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        const schema = await fs.readFile(SCHEMA_PATH, 'utf8');
        await this.db.exec(schema);
        console.log('✅ SQLite History Database Initialized');
    }

    public async savePageState(stateHash: string, sections: any, mediaRefs: any, metrics: any = {}) {
        if (!this.db) await this.initialize();

        await this.db?.run(
            `INSERT OR IGNORE INTO page_states (state_hash, snapshot, media_refs, metrics)
             VALUES (?, ?, ?, ?)`,
            [stateHash, JSON.stringify(sections), JSON.stringify(mediaRefs), JSON.stringify(metrics)]
        );
    }

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
}
