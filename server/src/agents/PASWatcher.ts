import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { WS_CONFIG } from '../../../shared/constants.js';
import { SystemConfigService } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/pas_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/pas_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/pas_watcher_decision.json');

// Models

puppeteer.use(StealthPlugin());

export class PASWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 PASWatcher: Capturing block snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });

            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
            await page.goto(url, { waitUntil: 'load', timeout: 15000 });

            // Wait for pas block
            await page.waitForSelector('[data-component="pas-block"]', { timeout: 10000 });

            // Give animations time
            await new Promise(r => setTimeout(r, 2000));

            const element = await page.$('[data-component="pas-block"]');
            if (!element) throw new Error("PAS block not found");

            const screenshot = await element.screenshot({ encoding: 'binary' });
            await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
            await fs.writeFile(SNAPSHOT_PATH, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ PAS Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log("🕵️ PAS Watcher: Waking up...");

        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(CHALLENGER_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(RESEARCH_FILE, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentPAS = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentPAS.id || 'pas_section_v1';
        const data = metricsInfo[variantId];

        const config = await SystemConfigService.getInstance().getConfig();
        const notificationClient = NotificationClient.getInstance();

        if (config.locks.pas) {
            console.log("🔒 PAS Section is LOCKED.");
            return;
        }

        if (!data || (data.dwell_count || 0) < config.sections.pas.min_dwell_events) {
            console.log(`🕵️ PAS Watcher: Not enough data for ${variantId}. Dwell events: ${data?.dwell_count || 0}`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        console.log(`📊 PERF: Avg Dwell Time = ${avgDwell.toFixed(0)}ms (Target: ${config.sections.pas.target_dwell_ms}ms+ for RichText)`);

        if (avgDwell > config.sections.pas.target_dwell_ms) {
            console.log("🏆 STATUS: CHAMPION. Narrative is engaging. No action.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const preCheck = await notificationClient.requestApproval(
            'PAS Section',
            'PRE_GENERATION',
            `PAS Engagement Low (${avgDwell.toFixed(0)}ms vs Target ${config.sections.pas.target_dwell_ms}ms). Strengthen narrative?`
        );

        if (!preCheck.approved) return;

        console.log("📉 STATUS: DWELL TIME LOW (User skipping the story). Initiating Semantic Mutation...");

        const snapshotBuffer = await this.captureSnapshot();

        try {
            const nanoContext = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: typeof researchCtx.brandDNA?.rationale === 'string' ? researchCtx.brandDNA?.rationale : researchCtx.brandDNA?.rationale?.value,
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: []
            };

            const performance = { avgDwell };
            // Note: Reuse refineVisual but with PAS-specific prompts if we had a dedicated refinePAS method.
            // For now, NanoBanana handles refinement through its instructions.
            const combinedFeedback = [config.feedback.pas_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentPAS, performance, nanoContext, snapshotBuffer || undefined, combinedFeedback);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.pas.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'PAS Section',
                    'POST_GENERATION',
                    `New PAS Narrative Ready (Confidence: ${(optimization as any).confidence}%). Commit text?`,
                    optimization
                );

                if (!postCheck.approved) return;
                const newPAS = {
                    ...currentPAS,
                    variant_id: `pas_v${Date.now()}`,
                    meta: {
                        ...currentPAS.meta,
                        layout_strategy: (optimization as any).changes.layout_strategy || currentPAS.meta.layout_strategy
                    },
                    content: {
                        ...currentPAS.content,
                        headline: (optimization as any).changes.headline || currentPAS.content.headline,
                        steps: (optimization as any).changes.steps || currentPAS.content.steps,
                        closing_statement: (optimization as any).changes.closing_statement || currentPAS.content.closing_statement
                    },
                    graphic_config: {
                        ...currentPAS.graphic_config,
                        visual_code: (optimization as any).changes.visual_code || currentPAS.graphic_config.visual_code
                    }
                };

                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newPAS, null, 4));
                await fs.writeFile(DECISION_PATH, JSON.stringify(optimization, null, 4));
                console.log("🚀 Optimization Applied! Section 3 Story Mutated.");
            }
        } catch (error) {
            console.error("❌ PAS Watcher Failed:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new PASWatcher().analyzeAndOptimize().catch(console.error);
}
