import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');

async function simulateTraffic() {
    console.log("🚀 Simulating TRAFFIC for PAS Section...");

    const rawData = await fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}');
    const metrics = JSON.parse(rawData);

    // PAS Section ID
    const sectionId = "pas_section_v1";
    if (!metrics[sectionId]) {
        metrics[sectionId] = {
            variant_id: sectionId,
            views: 0,
            clicks: 0,
            retention_count: 0,
            retention_sum_ms: 0,
            dwell_count: 0,
            dwell_sum_ms: 0,
            last_updated: new Date().toISOString()
        };
    }

    const data = metrics[sectionId];

    // Simulate 5-15 new views
    const newViews = Math.floor(Math.random() * 10) + 5;
    data.views += newViews;

    // Simulate Dwell Time (Dwell emphasis for PAS)
    for (let i = 0; i < newViews; i++) {
        data.dwell_count++;
        // High variation in dwell time (1s to 8s)
        const dwell = Math.floor(Math.random() * 7000) + 1000;
        data.dwell_sum_ms += dwell;

        // If they stay long enough (>3s), count as retention
        if (dwell > 3000) {
            data.retention_count++;
            data.retention_sum_ms += dwell;
        }
    }

    data.last_updated = new Date().toISOString();

    await fs.writeFile(METRICS_FILE, JSON.stringify(metrics, null, 4));
    console.log(`✅ PAS Traffic Simulated: +${newViews} views. Avg Dwell: ${(data.dwell_sum_ms / data.dwell_count).toFixed(0)}ms`);
}

simulateTraffic().catch(console.error);
