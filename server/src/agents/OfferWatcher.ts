import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG } from '../../../shared/constants.js';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SystemConfigFactory } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';
import { AgentLogger } from '../utils/AgentLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

puppeteer.use(StealthPlugin());

/**
 * Offer Watcher Agent.
 * 
 * Responsibilities:
 * - Monitors the performance of the Offer section (conversion rate, dwell time).
 * - Captures snapshots of the live offer block.
 * - analyzes metrics against thresholds.
 * - Triggers optimization via NanoBanana if performance is low.
 * - Manages HITL (Human-In-The-Loop) approval gates.
 * - Stages optimized offer blocks.
 */
export class OfferWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;
    private workspaceId: string;
    private logger: AgentLogger;

    // Dynamic Paths
    private metricsFile: string;
    private stagingFile: string;
    private researchFile: string;
    private snapshotPath: string;
    private decisionPath: string;
    private assetsDir: string;

    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
        this.logger = new AgentLogger('Offer Watcher', workspaceId, onLog);

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

    /**
     * Captures a screenshot of the live offer block using Puppeteer.
     * 
     * @returns {Promise<Buffer | null>} The screenshot buffer or null if failed.
     */
    async captureSnapshot(): Promise<Buffer | null> {
        this.logger.info("Snapshot", "Capturing live order block snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const clientBaseUrl = process.env.CLIENT_URL || `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}`;
            const url = `${clientBaseUrl}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

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
            this.logger.error("Snapshot Failed", `Error: ${e}`);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * Analyzes performance metrics and optimizes the Offer section if needed.
     * 1. Checks lock status and data sufficiency.
     * 2. Evals conversion rate and dwell time.
     * 3. Triggers HITL pre-optimization gate if configured.
     * 4. Calls NanoBanana to refine the offer visual and content.
     * 5. Triggers HITL post-optimization gate if configured.
     * 6. Stages the new offer block.
     */
    async analyzeAndOptimize() {
        this.logger.start("Watcher Active", "Offer Watcher analysis started...");

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
            this.logger.info("Skipping", "Offer Section is LOCKED.");
            return;
        }

        // 1. Data Threshold Check
        if (!data || (data.views || 0) < config.sections.offer.min_views_data) {
            this.logger.info("Skipping", `Insufficient data (Views: ${data?.views || 0})`);
            return;
        }

        const conversionRate = (data.clicks / data.views);
        const avgDwell = data.dwell_count ? (data.dwell_sum_ms / data.dwell_count) : 0;

        this.logger.info("Metrics Analysis", `CR=${(conversionRate * 100).toFixed(1)}% | Avg Dwell=${avgDwell.toFixed(0)}ms`);

        // 2. Forensic Decision
        if (conversionRate > config.sections.offer.target_conversion_rate) {
            this.logger.success("Optimization Unnecessary", "Conversion rate is healthy.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const hitlEnabled = config.hitl.enabled;
        const requirePre = config.hitl.require_approval_pre;
        let preCheckFeedback = "";

        if (hitlEnabled && requirePre) {
            this.logger.info("HITL Gate", "Triggering Pre-Optimization Approval...");
            const preCheck = await notificationClient.requestApproval(
                'Offer Section',
                'PRE_GENERATION',
                `Offer Conversion Low (${conversionRate.toFixed(1)}% vs Target ${config.sections.offer.target_conversion_rate}%). Optimize deal structure?`,
                undefined,
                this.workspaceId
            );

            if (!preCheck.approved) {
                this.logger.info("Aborted", "User rejected optimization request.");
                return;
            }
            preCheckFeedback = preCheck.feedback || "";
        } else {
            console.log("⏩ HITL Pre-Gate skipped.");
        }

        this.logger.info("Reasoning", "Low Conversion detected. Initiating Offer Mutation...");

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

            const combinedFeedback = [config.feedback.offer_directive, preCheckFeedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentOffer, performance, nanoContext, snapshot || undefined, combinedFeedback, 'offer');

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.offer.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const requirePost = config.hitl.require_approval_post;

                if (hitlEnabled && requirePost) {
                    this.logger.info("HITL Gate", "Triggering Post-Optimization Approval...");
                    const postCheck = await notificationClient.requestApproval(
                        'Offer Section',
                        'POST_GENERATION',
                        `New Offer Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
                        optimization,
                        this.workspaceId
                    );

                    if (!postCheck.approved) {
                        this.logger.info("Aborted", "User rejected deployment.");
                        return;
                    }
                } else {
                    console.log("⏩ HITL Post-Gate skipped.");
                }
                // CRITICAL FIX: Do NOT partial merge.
                // Reconstruct the full object from the AI's complete schema in `optimization.changes`
                // while preserving system metadata.
                const newOffer = {
                    ...currentOffer, // Keep foundational ID/Metadata structure
                    ...optimization.changes, // OVERWRITE all content with full AI schema
                    id: currentOffer.id,
                    variant_id: `offer_v${Date.now()}`,
                    meta: {
                        ...currentOffer.meta,
                        layout_strategy: optimization.changes.layout_strategy || currentOffer.meta.layout_strategy
                    }
                };

                // Map flat AI schema back to nested store structure
                // AI Schema: layout_strategy, headline, subhead, visual_code, tiers
                // Store Structure: content: { headline, subhead, tiers ... }, graphic_config: { ... }

                newOffer.content = {
                    headline: optimization.changes.headline,
                    subhead: optimization.changes.subhead,
                    tiers: optimization.changes.tiers
                };

                newOffer.graphic_config = {
                    ...currentOffer.graphic_config,
                    visual_code: optimization.changes.visual_code
                };

                // Cleanup flat fields
                delete newOffer.headline;
                delete newOffer.subhead;
                delete newOffer.tiers;
                delete newOffer.visual_code;

                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newOffer, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));
                this.logger.success("Staged", "Offer Evolved in staging.");
            } else {
                this.logger.info("No Change", "Confidence too low.");
            }
        } catch (error) {
            this.logger.error("Watcher Error", `critical: ${error}`);
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

