import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { SystemConfigFactory } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';
import { AgentLogger } from '../utils/AgentLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

puppeteer.use(StealthPlugin());

/**
 * Proof Watcher Agent.
 * 
 * Responsibilities:
 * - Monitors the performance of the Proof section (dwell time).
 * - Captures snapshots of the live proof block.
 * - analyzes metrics against thresholds.
 * - Triggers optimization via NanoBanana to improve trust signaling.
 * - Manages HITL approval gates.
 * - Stages optimized proof blocks.
 */
export class ProofWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;
    private workspaceId: string;
    private logger: AgentLogger;
    private paths: {
        metrics: string;
        staging: string;
        research: string;
        snapshot: string;
        decision: string;
        assetsDir: string;
    };

    constructor(workspaceId: string = 'default', onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
        this.logger = new AgentLogger('Proof Watcher', workspaceId, onLog);

        // Initialize Dynamic Paths
        const baseBrain = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClient = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.paths = {
            metrics: path.join(baseBrain, 'metrics/landing_page_metrics.json'),
            staging: path.join(baseBrain, 'staging/proof_block_staging.json'),
            research: path.join(baseBrain, 'research_artifacts/complete_research_latest.json'),
            snapshot: path.join(baseBrain, 'run_artifacts/proof_watcher_snapshot.png'),
            decision: path.join(baseBrain, 'run_artifacts/proof_watcher_decision.json'),
            assetsDir: path.join(baseClient, 'assets')
        };
    }

    /**
     * Captures a screenshot of the live proof block.
     * 
     * @returns {Promise<Buffer | null>} The screenshot buffer or null if failed.
     */
    async captureSnapshot(): Promise<Buffer | null> {
        this.logger.info("Snapshot", "Capturing block snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });

            // Pass workspaceId to frontend via URL
            const clientBaseUrl = process.env.CLIENT_URL || `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}`;
            const url = `${clientBaseUrl}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Wait for proof block
            await page.waitForSelector('[data-component="proof-block"]', { timeout: 10000 });

            // Give animations time to complete
            await new Promise(r => setTimeout(r, 2000));

            // Focus on the proof block specifically
            const element = await page.$('[data-component="proof-block"]');
            if (!element) throw new Error("Proof block not found");

            const screenshot = await element.screenshot({ encoding: 'binary' });
            await fs.mkdir(path.dirname(this.paths.snapshot), { recursive: true });
            await fs.writeFile(this.paths.snapshot, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            this.logger.error("Snapshot Failed", `Error: ${e}`);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * Analyzes performance metrics and optimizes the Proof section if needed.
     * 1. Checks lock status and data sufficiency.
     * 2. Evals dwell time.
     * 3. Triggers HITL pre-optimization gate.
     * 4. Calls NanoBanana to refine the proof visual.
     * 5. Triggers HITL post-optimization gate.
     * 6. Stages the new proof block.
     */
    async analyzeAndOptimize() {
        this.logger.start("Watcher Active", "Proof Watcher waking up...");

        // 1. Data Analysis (Get Config First)
        // Use Factory for workspace-specific config
        const configService = SystemConfigFactory.getInstance(this.workspaceId);
        const config = await configService.getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Resolve Live State Path
        const activePath = config.active_assets_path || '';
        const LIVE_FILE = path.join(this.paths.assetsDir, activePath, 'proof_block.json');

        console.log(`📂 ProofWatcher: Loading Live State from ${LIVE_FILE}`);

        const [metricsRaw, liveRaw, researchRaw] = await Promise.all([
            fs.readFile(this.paths.metrics, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.paths.research, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentProof = JSON.parse(liveRaw);
        const researchCtx = JSON.parse(researchRaw);

        if (!currentProof.id) {
            this.logger.error("Error", "No valid live proof block found. Aborting.");
            return;
        }

        const variantId = currentProof.id;
        const data = metricsInfo[variantId];

        // 0. Check Lock
        if (config.locks.proof) {
            this.logger.info("Skipping", "Proof Section is LOCKED.");
            return;
        }

        // 2. Validate Data
        if (!data || (data.views || 0) < config.sections.proof.min_views_data) {
            this.logger.info("Skipping", `Not enough data for ${variantId}. Views: ${data?.views || 0}`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        this.logger.info("Metrics Analysis", `Avg Dwell Time = ${avgDwell.toFixed(0)}ms (Target: ${config.sections.proof.target_dwell_ms}ms+)`);

        if (avgDwell > config.sections.proof.target_dwell_ms) {
            this.logger.success("Optimization Unnecessary", "Dwell time is optimal.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const hitlEnabled = config.hitl.enabled;
        const requirePre = config.hitl.require_approval_pre;
        let preCheckFeedback = "";

        if (hitlEnabled && requirePre) {
            this.logger.info("HITL Gate", "Triggering Pre-Optimization Gate...");
            const preCheck = await notificationClient.requestApproval(
                'Proof Section',
                'PRE_GENERATION',
                `Proof Dwell Time is low (${avgDwell.toFixed(0)}ms vs Target ${config.sections.proof.target_dwell_ms}ms). Optimize?`,
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

        this.logger.info("Reasoning", "Dwell Time Low. Initiating Strategic Mutation...");

        // 3. Prepare Visuals
        const snapshotBuffer = await this.captureSnapshot();

        // 4. Strategic Refinement (Service Call)
        this.logger.info("Analysis", "Requesting refined visual from NanoBananaService...");

        try {
            // Mapping research context for service
            const nanoContext = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: researchCtx.imagery?.suggestions?.filter((s: any) => s.isSelected).map((s: any) => ({
                    concept: s.concept,
                    description: s.description,
                    visualStyle: s.visualStyle
                })) || []
            };

            const performance = { avgDwell };
            const combinedFeedback = [config.feedback.proof_directive, preCheckFeedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentProof, performance, nanoContext, snapshotBuffer || undefined, combinedFeedback, 'proof');

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.proof.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const requirePost = config.hitl.require_approval_post;

                if (hitlEnabled && requirePost) {
                    this.logger.info("HITL Gate", "Triggering Post-Optimization Approval...");
                    const postCheck = await notificationClient.requestApproval(
                        'Proof Section',
                        'POST_GENERATION',
                        `New Proof Strategy Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
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
                const newProof = {
                    ...currentProof, // Keep foundational ID/Metadata structure
                    ...optimization.changes, // OVERWRITE all content with full AI schema
                    id: currentProof.id,
                    variant_id: `proof_v${Date.now()}`,
                    meta: {
                        ...currentProof.meta,
                        layout_strategy: optimization.changes.layout_strategy || currentProof.meta.layout_strategy
                    }
                };

                // Map flat AI schema back to nested store structure
                // AI Schema: layout_strategy, headline, subhead, visual_code, evidence_items
                // Store Structure: content: { headline, subhead, evidence_items ... }, graphic_config: { ... }

                newProof.content = {
                    headline: optimization.changes.headline,
                    subhead: optimization.changes.subhead,
                    graphic_caption: currentProof.content.graphic_caption, // AI doesn't generate this yet, preserve old
                    evidence_items: optimization.changes.evidence_items
                };

                newProof.graphic_config = {
                    ...currentProof.graphic_config,
                    type: 'generative',
                    visual_code: optimization.changes.visual_code
                };

                // Cleanup flat fields
                delete newProof.headline;
                delete newProof.subhead;
                delete newProof.evidence_items;
                delete newProof.visual_code;

                await fs.mkdir(path.dirname(this.paths.staging), { recursive: true });
                await fs.writeFile(this.paths.staging, JSON.stringify(newProof, null, 4));
                await fs.writeFile(this.paths.decision, JSON.stringify(optimization, null, 4));
                this.logger.success("Staged", "Proof Section Mutated in staging.");
            }
        } catch (error) {
            this.logger.error("Watcher Error", `Critical: ${error}`);
        }
    }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Parse CLI NameArgs
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    new ProofWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}
