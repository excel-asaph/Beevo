import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SystemConfigFactory } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

puppeteer.use(StealthPlugin());

export class OfferWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;
    private workspaceId: string;

    // Dynamic Paths
    private metricsFile: string;
    private stagingFile: string;
    private researchFile: string;
    private snapshotPath: string;
    private decisionPath: string;
    private assetsDir: string;

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/offer_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/offer_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/offer_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log(`📸 [${this.workspaceId}] OfferWatcher: Capturing order block snapshot...`);
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0' });

            await page.evaluate(() => {
                const el = document.querySelector('[data-component="offer-block"]');
                if (el) el.scrollIntoView();
            });

            await new Promise(r => setTimeout(r, 1500));

            const element = await page.$('[data-component="offer-block"]');
            if (!element) throw new Error("Offer block not found");

            const screenshot = await element.screenshot({ encoding: 'binary' });
            await fs.mkdir(path.dirname(this.snapshotPath), { recursive: true });
            await fs.writeFile(this.snapshotPath, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Offer Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log(`🕵️ [${this.workspaceId}] OfferWatcher Agent: Waking up...`);

        const config = await SystemConfigFactory.getInstance(this.workspaceId).getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Resolve Live State Path
        const activePath = config.active_assets_path || '';
        const LIVE_FILE = path.join(this.assetsDir, activePath, 'offer_block.json');

        console.log(`📂 OfferWatcher: Loading Live State from ${activePath}`);

        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(this.metricsFile, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.researchFile, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentOffer = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentOffer.id || 'offer_section_v1';
        const data = metricsInfo[variantId];

        if (config.locks.offer) {
            console.log("🔒 Offer Section is LOCKED.");
            return;
        }

        // 1. Data Threshold Check
        if (!data || (data.views || 0) < config.sections.offer.min_views_data) {
            console.log(`🕵️ OfferWatcher: Not enough data. Views: ${data?.views || 0}`);
            return;
        }

        const conversionRate = (data.clicks / data.views);
        const avgDwell = data.dwell_count ? (data.dwell_sum_ms / data.dwell_count) : 0;

        console.log(`📊 PERF: CR=${(conversionRate * 100).toFixed(1)}% | Avg Dwell=${avgDwell.toFixed(0)}ms`);

        // 2. Forensic Decision
        if (conversionRate > config.sections.offer.target_conversion_rate) {
            console.log("🏆 STATUS: CHAMPION. Conversion rate is healthy.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const preCheck = await notificationClient.requestApproval(
            'Offer Section',
            'PRE_GENERATION',
            `Offer Conversion Low (${conversionRate.toFixed(1)}% vs Target ${config.sections.offer.target_conversion_rate}%). Optimize deal structure?`,
            undefined,
            this.workspaceId
        );

        if (!preCheck.approved) return;

        console.log("📉 STATUS: LOW CONVERSION. Initiating Offer Mutation...");

        // 3. Vision Audit
        const snapshot = await this.captureSnapshot();

        try {
            const performance = { conversionRate, avgDwell };
            const nanoContext = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: [],
                brandDNA: researchCtx.brandDNA
            };

            const combinedFeedback = [config.feedback.offer_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentOffer, performance, nanoContext, snapshot || undefined, combinedFeedback);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.offer.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'Offer Section',
                    'POST_GENERATION',
                    `New Offer Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
                    optimization,
                    this.workspaceId
                );

                if (!postCheck.approved) return;
                const newOffer = {
                    ...currentOffer,
                    variant_id: `offer_v${Date.now()}`,
                    meta: {
                        ...currentOffer.meta,
                        layout_strategy: (optimization as any).changes.layout_strategy || currentOffer.meta.layout_strategy
                    },
                    content: {
                        ...currentOffer.content,
                        headline: (optimization as any).changes.headline || currentOffer.content.headline,
                        subhead: (optimization as any).changes.subhead || currentOffer.content.subhead,
                        tiers: (optimization as any).changes.tiers || currentOffer.content.tiers
                    },
                    graphic_config: {
                        ...currentOffer.graphic_config,
                        visual_code: (optimization as any).changes.visual_code || currentOffer.graphic_config.visual_code
                    }
                };

                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newOffer, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));
                console.log("🚀 Optimization Staged! Offer Evolved in staging.");
            }
        } catch (error) {
            console.error("❌ OfferWatcher Error:", error);
        }
    }
}

// Arg parsing for CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    new OfferWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

