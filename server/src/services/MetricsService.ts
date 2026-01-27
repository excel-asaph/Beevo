import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/hero_metrics.json');

interface CampaignMetrics {
    variant_id: string;
    views: number;
    clicks: number;
    retention_count: number;
    retention_sum_ms: number;
    dwell_count: number;
    dwell_sum_ms: number;
    last_updated: string;
}

export class MetricsService {

    // Ensure the DB file exists
    private async ensureFile() {
        try {
            await fs.access(METRICS_FILE);
        } catch {
            await fs.mkdir(path.dirname(METRICS_FILE), { recursive: true });
            await fs.writeFile(METRICS_FILE, '{}', 'utf-8');
        }
    }

    async trackEvent(event: any) {
        await this.ensureFile();

        const raw = await fs.readFile(METRICS_FILE, 'utf-8');
        const db: Record<string, CampaignMetrics> = JSON.parse(raw);

        const variantId = event.componentId || 'unknown';

        if (!db[variantId]) {
            db[variantId] = {
                variant_id: variantId,
                views: 0,
                clicks: 0,
                retention_count: 0,
                retention_sum_ms: 0,
                dwell_count: 0,
                dwell_sum_ms: 0,
                last_updated: new Date().toISOString()
            };
        }

        const metrics = db[variantId];

        switch (event.eventType) {
            case 'view_component':
                metrics.views++;
                break;
            case 'click_cta':
                metrics.clicks++;
                break;
            case 'retention_trigger':
                metrics.retention_count++;
                metrics.retention_sum_ms += (event.duration || 3000);
                break;
            case 'proof_dwell_summary':
                metrics.dwell_count++;
                metrics.dwell_sum_ms += (event.meta?.dwell_ms || 0);
                break;
        }

        metrics.last_updated = new Date().toISOString();

        await fs.writeFile(METRICS_FILE, JSON.stringify(db, null, 4));
        console.log(`[Metrics] Updated ${variantId}: Views=${metrics.views}, Clicks=${metrics.clicks}`);
    }
}
