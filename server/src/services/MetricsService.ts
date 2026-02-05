import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseService } from './DatabaseService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CampaignMetrics {
    variant_id: string;
    views: number;
    clicks: number;
    retention_count: number;
    retention_sum_ms: number;
    dwell_count: number;
    dwell_sum_ms: number;
    velocity_sum?: number;
    last_updated: string;
}

export class MetricsService {
    private static instances: Map<string, MetricsService> = new Map();
    private lock = false;
    private queue: (() => Promise<void>)[] = [];
    private workspaceId: string;
    private metricsFile: string;
    private syntheticMetricsFile: string;

    private constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        const baseMetricsPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}/metrics`);
        this.metricsFile = path.join(baseMetricsPath, 'landing_page_metrics.json');
        this.syntheticMetricsFile = path.join(baseMetricsPath, 'landing_page_metrics_synthetic.json');
    }

    public static getInstance(workspaceId: string = 'default'): MetricsService {
        if (!MetricsService.instances.has(workspaceId)) {
            MetricsService.instances.set(workspaceId, new MetricsService(workspaceId));
        }
        return MetricsService.instances.get(workspaceId)!;
    }

    private async acquireLock() {
        if (this.lock) {
            return new Promise<void>(resolve => {
                this.queue.push(async () => {
                    resolve();
                });
            });
        }
        this.lock = true;
    }

    private releaseLock() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            // Don't release lock, pass it to next
            if (next) next();
        } else {
            this.lock = false;
        }
    }

    private async ensureFile(filePath: string) {
        try {
            await fs.access(filePath);
        } catch {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, '{}', 'utf-8');
        }
    }

    async trackEvent(event: any) {
        // Simple Mutex to prevent race conditions (JSON Corruption)
        await this.acquireLock();

        try {
            const isSynthetic = event.sessionType === 'synthetic';
            const targetFile = isSynthetic ? this.syntheticMetricsFile : this.metricsFile;

            await this.ensureFile(targetFile);

            // Debug Log
            console.log(`[Metrics ${this.workspaceId}] Received ${isSynthetic ? '🤖 SYNTHETIC' : '👤 ORGANIC'} Event: ${event.eventType}`, {
                variant: event.componentId || event.blockId,
                state: event.stateHash
            });

            // 1. Update JSON Storage (Target specific file)
            let db: Record<string, CampaignMetrics> = {};
            try {
                const raw = await fs.readFile(targetFile, 'utf-8');
                db = raw ? JSON.parse(raw) : {};
            } catch (e) {
                db = {};
            }

            // Robust ID resolution
            const variantId = event.componentId || event.blockId || 'unknown';
            const stateHash = event.stateHash || 'unknown';

            if (!db[variantId]) {
                db[variantId] = {
                    variant_id: variantId,
                    views: 0,
                    clicks: 0,
                    retention_count: 0,
                    retention_sum_ms: 0,
                    dwell_count: 0,
                    dwell_sum_ms: 0,
                    velocity_sum: 0,
                    last_updated: new Date().toISOString()
                };
            }

            const metrics = db[variantId];

            switch (event.eventType) {
                case 'view_page':
                    // Strict: Only increments if specific page view event
                    metrics.views++;
                    break;
                case 'view_component':
                    // Strict: Only increments Component View
                    metrics.views++;
                    break;
                case 'view_3s':
                case 'retention_trigger': // Normalize both event names
                    metrics.retention_count++;
                    metrics.retention_sum_ms += (event.duration || 3000); // Assume 3s or custom duration
                    break;
                case 'proof_dwell_summary':
                case 'pas_dwell_summary':
                case 'spec_dwell_summary':
                case 'social_dwell_summary':
                case 'offer_dwell_summary':
                    metrics.dwell_count++;
                    metrics.dwell_sum_ms += (event.meta?.dwell_ms || event.meta?.dwellMs || 0);
                    break;
                case 'offer_cta_click':
                case 'click_cta':     // Restored Hero CTA
                case 'cta_click':     // Restored generic CTA
                    metrics.clicks++;
                    break;
                case 'social_scroll_velocity':
                    metrics.velocity_sum = (metrics.velocity_sum || 0) + (event.meta?.velocity || 0);
                    break;
            }

            metrics.last_updated = new Date().toISOString();

            // Atomic Write Strategy: Write to .tmp -> Rename
            // This guarantees no partial writes or corruption.
            const tempFile = `${targetFile}.tmp`;
            try {
                await fs.writeFile(tempFile, JSON.stringify(db, null, 4));
                await fs.rename(tempFile, targetFile);
            } catch (writeErr) {
                console.error("METRICS ATOMIC WRITE ERROR:", writeErr);
                // Last ditch effort: cleanup temp if exists
                try { await fs.unlink(tempFile); } catch { }
            }

            // 2. Update SQLite Page State Metrics (ORGANIC ONLY)
            // We prevent synthetic data from polluting the business leaderboard
            if (!isSynthetic && stateHash !== 'unknown' && stateHash !== 'undefined') {
                const dbService = DatabaseService.getInstance(this.workspaceId);
                try {
                    const state = await dbService.getState(stateHash) as any;

                    if (state) {
                        const stateMetrics = state.metrics ? JSON.parse(state.metrics) : {
                            views: 0,
                            clicks: 0,
                            leads: 0,
                            component_breakdown: {}
                        };

                        // Initialize Breakdown if missing
                        if (!stateMetrics.component_breakdown) stateMetrics.component_breakdown = {};

                        // STRICT SEPARATION: No cross-contamination between Page and Components
                        if (event.eventType === 'view_page') {
                            stateMetrics.views = (stateMetrics.views || 0) + 1;
                        }

                        if (event.eventType === 'cta_click' || event.eventType === 'click_cta' || event.eventType === 'offer_cta_click') {
                            // "Clicks" on the state level usually implies meaningful engagement (Offer/Primary CTA)
                            // We can aggregate them or keep them strict. For now, aggregate strictly.
                            stateMetrics.clicks = (stateMetrics.clicks || 0) + 1;
                        }

                        // Update component breakdown
                        if (!stateMetrics.component_breakdown[variantId]) {
                            stateMetrics.component_breakdown[variantId] = { views: 0, clicks: 0, dwells: 0 };
                        }
                        const comp = stateMetrics.component_breakdown[variantId];

                        // Safety init
                        comp.views = comp.views || 0;
                        comp.clicks = comp.clicks || 0;
                        comp.dwells = comp.dwells || 0;

                        if (event.eventType === 'view_component' || event.eventType === 'view_page') comp.views++;
                        // view_3s REMOVED from view increment
                        if (event.eventType === 'cta_click' || event.eventType === 'click_cta') comp.clicks++;
                        if (event.eventType.includes('dwell')) comp.dwells++;

                        await dbService.updatePageStateMetrics(stateHash, stateMetrics);
                        console.log(`[Metrics ${this.workspaceId}] DB Updated for State=${stateHash}`);
                    } else {
                        console.warn(`[Metrics ${this.workspaceId}] State not found in DB: ${stateHash}`);
                    }
                } catch (dbErr) {
                    console.error("[Metrics] SQLite Update Failed:", dbErr);
                }
            }
        } catch (error) {
            console.error("CRITICAL METRICS SERVICE ERROR:", error);
            throw error; // Rethrow to return 500 to client
        } finally {
            this.releaseLock();
        }
    }
}

