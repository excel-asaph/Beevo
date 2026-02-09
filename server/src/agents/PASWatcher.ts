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
 * PAS (Problem-Agitation-Solution) Watcher Agent.
 * 
 * Responsibilities:
 * - Monitors the performance of the PAS section (scroll depth, dwell time).
 * - Captures snapshots of the live PAS block.
 * - analyzes metrics against thresholds.
 * - Triggers optimization via NanoBanana to improve persuasion.
 * - Manages HITL approval gates.
 * - Stages optimized PAS blocks.
 */
export class PASWatcher {
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
        this.logger = new AgentLogger('PAS Watcher', workspaceId, onLog);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/pas_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/pas_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/pas_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    /**
     * Captures a screenshot of the live PAS block.
     * 
     * @returns {Promise<Buffer | null>} The screenshot buffer or null if failed.
     */
    async captureSnapshot(): Promise<Buffer | null> {
        this.logger.info("Snapshot", "Capturing persuasion snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const clientBaseUrl = process.env.CLIENT_URL || `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}`;
            const url = `${clientBaseUrl}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            await page.evaluate(() => {
                const el = document.querySelector('[data-component="pas-block"]');
                if (el) el.scrollIntoView();
            });

            await new Promise(r => setTimeout(r, 1500));

            const element = await page.$('[data-component="pas-block"]');
            if (!element) throw new Error("PAS block not found");

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
     * Analyzes performance metrics and optimizes the PAS section if needed.
     * 1. Checks lock status and data sufficiency.
     * 2. Evals scroll depth and dwell time.
     * 3. Triggers HITL pre-optimization gate.
     * 4. Calls NanoBanana to refine the PAS logic and visual.
     * 5. Triggers HITL post-optimization gate.
     * 6. Stages the new PAS block.
     */
    async analyzeAndOptimize() {
        this.logger.start("Watcher Active", "PAS Watcher analysis started...");

        const config = await SystemConfigFactory.getInstance(this.workspaceId).getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Resolve Live State Path
        const activePath = config.active_assets_path || '';
        const LIVE_FILE = path.join(this.assetsDir, activePath, 'pas_block.json');

        console.log(`📂 PASWatcher: Loading Live State from ${activePath}`);

        const [metricsRaw, liveRaw, researchRaw] = await Promise.all([
            fs.readFile(this.metricsFile, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.researchFile, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentPAS = JSON.parse(liveRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentPAS.id || 'pas_section_v1';
        const data = metricsInfo[variantId];

        if (config.locks.pas) {
            this.logger.info("Skipping", "PAS Section is LOCKED.");
            return;
        }

        // 1. Data Threshold Check
        if (!data || (data.views || 0) < config.sections.pas.min_views_data) {
            this.logger.info("Skipping", `Insufficient data (Views: ${data?.views || 0})`);
            return;
        }

        const scrollDepth = data.scroll_depth_avg || 0;
        const dwellTime = data.dwell_count ? (data.dwell_sum_ms / data.dwell_count) : 0;

        this.logger.info("Metrics Analysis", `Avg Scroll=${scrollDepth.toFixed(0)}% | Avg Dwell=${dwellTime.toFixed(0)}ms`);

        // 2. Persuasion Logic
        if (scrollDepth > config.sections.pas.target_scroll_depth && dwellTime > config.sections.pas.target_dwell_ms) {
            this.logger.success("Optimization Unnecessary", "Section is persuasive.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const hitlEnabled = config.hitl.enabled;
        const requirePre = config.hitl.require_approval_pre;
        let preCheckFeedback = "";

        if (hitlEnabled && requirePre) {
            this.logger.info("HITL Gate", "Triggering Pre-Optimization Approval...");
            const preCheck = await notificationClient.requestApproval(
                'PAS Section',
                'PRE_GENERATION',
                `PAS Engagement Low (Scroll: ${scrollDepth.toFixed(0)}%, Dwell: ${dwellTime.toFixed(0)}ms). Optimize logic?`,
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

        this.logger.info("Reasoning", "Low Engagement detected. Initiating Logical Mutation...");

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

            const combinedFeedback = [config.feedback.pas_directive, preCheckFeedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentPAS, performance, nanoContext, snapshot || undefined, combinedFeedback, 'pas');

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.pas.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const requirePost = config.hitl.require_approval_post;

                if (hitlEnabled && requirePost) {
                    this.logger.info("HITL Gate", "Triggering Post-Optimization Approval...");
                    const postCheck = await notificationClient.requestApproval(
                        'PAS Section',
                        'POST_GENERATION',
                        `New PAS Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
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
                const newPAS = {
                    ...currentPAS, // Keep foundational ID/Metadata structure
                    ...optimization.changes, // OVERWRITE all content with full AI schema
                    id: currentPAS.id,
                    variant_id: `pas_v${Date.now()}`,
                    meta: {
                        ...currentPAS.meta,
                        layout_strategy: optimization.changes.layout_strategy || currentPAS.meta.layout_strategy
                    }
                };

                // Map flat AI schema back to nested store structure
                // AI Schema: layout_strategy, headline, visual_code, steps, closing_statement
                // Store Structure: content: { headline, steps, closing_statement ... }, graphic_config: { ... }

                newPAS.content = {
                    headline: optimization.changes.headline,
                    steps: optimization.changes.steps,
                    closing_statement: optimization.changes.closing_statement
                };

                newPAS.graphic_config = {
                    ...currentPAS.graphic_config,
                    visual_code: optimization.changes.visual_code
                };

                // Cleanup flat fields
                delete newPAS.headline;
                delete newPAS.steps;
                delete newPAS.closing_statement;
                delete newPAS.visual_code;

                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newPAS, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));
                this.logger.success("Staged", "PAS Section Evolved in staging.");
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

    new PASWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

