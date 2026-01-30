import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SystemConfigService } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/pas_block.json');
const STAGING_FILE = path.resolve(__dirname, '../../brain/staging/pas_block_staging.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/pas_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/pas_watcher_decision.json');

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
        console.log("📸 PASWatcher: Capturing persuasion snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
            await page.goto(url, { waitUntil: 'networkidle0' });

            await page.evaluate(() => {
                const el = document.querySelector('[data-component="pas-block"]');
                if (el) el.scrollIntoView();
            });

            await new Promise(r => setTimeout(r, 1500));

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
        console.log("🕵️ PASWatcher Agent: Waking up...");

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

        // 1. Data Threshold Check
        if (!data || (data.views || 0) < config.sections.pas.min_views_data) {
            console.log(`🕵️ PASWatcher: Not enough data. Views: ${data?.views || 0}`);
            return;
        }

        const scrollDepth = data.scroll_depth_avg || 0;
        const dwellTime = data.dwell_count ? (data.dwell_sum_ms / data.dwell_count) : 0;

        console.log(`📊 PERF: Avg Scroll=${scrollDepth.toFixed(0)}% | Avg Dwell=${dwellTime.toFixed(0)}ms`);

        // 2. Persuasion Logic
        if (scrollDepth > config.sections.pas.target_scroll_depth && dwellTime > config.sections.pas.target_dwell_ms) {
            console.log("🏆 STATUS: CHAMPION. Section is persuasive.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const preCheck = await notificationClient.requestApproval(
            'PAS Section',
            'PRE_GENERATION',
            `PAS Engagement Low (Scroll: ${scrollDepth.toFixed(0)}%, Dwell: ${dwellTime.toFixed(0)}ms). Optimize logic?`
        );

        if (!preCheck.approved) return;

        console.log("📉 STATUS: LOW ENGAGEMENT. Initiating Logical Mutation...");

        // 3. Vision Audit
        const snapshot = await this.captureSnapshot();

        try {
            const performance = { scrollDepth, dwellTime };
            const nanoContext = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: []
            };

            const combinedFeedback = [config.feedback.pas_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentPAS, performance, nanoContext, snapshot || undefined, combinedFeedback);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.pas.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'PAS Section',
                    'POST_GENERATION',
                    `New PAS Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
                    optimization
                );

                if (!postCheck.approved) return;

                // Content validation
                if (!currentPAS.content) {
                    console.error("❌ PASWatcher: Current PAS block has no content section. Aborting.");
                    return;
                }

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

                await fs.mkdir(path.dirname(STAGING_FILE), { recursive: true });
                await fs.writeFile(STAGING_FILE, JSON.stringify(newPAS, null, 4));
                await fs.writeFile(DECISION_PATH, JSON.stringify(optimization, null, 4));
                console.log("🚀 Optimization Staged! PAS Section Evolved in staging.");
            }
        } catch (error) {
            console.error("❌ PASWatcher Error:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new PASWatcher().analyzeAndOptimize().catch(console.error);
}
