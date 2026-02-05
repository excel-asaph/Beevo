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

export class SpecWatcher {
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
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/spec_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/spec_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/spec_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log(`📸 [${this.workspaceId}] SpecWatcher: Capturing technical schematic snapshot...`);
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0' });

            // Scroll to the spec section
            await page.evaluate(() => {
                const el = document.querySelector('[data-component="spec-block"]');
                if (el) el.scrollIntoView();
            });

            await new Promise(r => setTimeout(r, 1000)); // Wait for entry animation

            const element = await page.$('[data-component="spec-block"]');
            if (!element) throw new Error("Spec block not found on page");

            const screenshot = await element.screenshot({ encoding: 'binary' });

            // Save for user visibility
            await fs.mkdir(path.dirname(this.snapshotPath), { recursive: true });
            await fs.writeFile(this.snapshotPath, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log(`🕵️ [${this.workspaceId}] SpecWatcher Agent: Waking up...`);

        // 1. Load Data
        // 1. Data Analysis (Get Config First)
        const config = await SystemConfigFactory.getInstance(this.workspaceId).getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Resolve Live State Path
        const activePath = config.active_assets_path || '';
        const LIVE_FILE = path.join(this.assetsDir, activePath, 'spec_block.json');

        console.log(`📂 SpecWatcher: Loading Live State from ${activePath}`);

        const [metricsRaw, liveRaw, researchRaw] = await Promise.all([
            fs.readFile(this.metricsFile, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.researchFile, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentSpec = JSON.parse(liveRaw);
        const researchCtx = JSON.parse(researchRaw);

        // Interaction Depth Tracking (Mock or real)
        const specMetrics = metricsInfo[currentSpec.id] || { dwell_count: 0, interactions: [] };
        const interactionWeight = (specMetrics.interactions?.length || 0);

        if (config.locks.spec) {
            console.log("🔒 Spec Section is LOCKED.");
            return;
        }

        // VALIDATION
        if (specMetrics.dwell_count < config.sections.spec.min_data_points) {
            console.log(`🕵️ SpecWatcher: Low Data (${specMetrics.dwell_count}). Waiting.`);
            return;
        }

        const interactionRate = (interactionWeight / (specMetrics.dwell_count || 1));
        console.log(`📊 PERF: Interaction Rate=${(interactionRate * 100).toFixed(1)}% | Dwell Count=${specMetrics.dwell_count}`);

        if (interactionRate > config.sections.spec.target_interaction_rate) {
            console.log("🏆 Spec Section is engaging. No action.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const preCheck = await notificationClient.requestApproval(
            'Spec Section',
            'PRE_GENERATION',
            `Spec Interaction Rate Low (${interactionRate.toFixed(1)}% vs Target ${config.sections.spec.target_interaction_rate}%). Optimize schematic?`,
            undefined,
            this.workspaceId
        );

        if (!preCheck.approved) return;

        // 2. Prepare Context
        const selectedPalettes = researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected) || [];
        const validColors = selectedPalettes.flatMap((p: any) => p.colors) || [];
        const context = {
            brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
            mission: researchCtx.brandDNA?.mission?.value || "",
            rationale: typeof researchCtx.brandDNA?.rationale === 'string' ? researchCtx.brandDNA.rationale : (researchCtx.brandDNA?.rationale?.value || ""),
            mood: researchCtx.brandDNA?.mood?.items || [],
            colors: validColors,
            fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
            imagery: []
        };

        // 3. Vision Audit & Refinement
        const snapshot = await this.captureSnapshot();

        console.log("🧠 Mutating Technical Schematic...");
        try {
            const performance = {
                avgDwell: specMetrics.dwell_sum_ms / (specMetrics.dwell_count || 1),
                interactions: specMetrics.interactions || []
            };

            const combinedFeedback = [config.feedback.spec_directive, preCheck.feedback].filter(Boolean).join('. ');
            const result = await this.nanoBanana.refineVisual(currentSpec, performance, context, snapshot || undefined, combinedFeedback);

            // 4. Apply Fix
            if (result.confidence > config.sections.spec.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'Spec Section',
                    'POST_GENERATION',
                    `New Schematic Ready (Confidence: ${result.confidence}%). Deploy?`,
                    result,
                    this.workspaceId
                );

                if (!postCheck.approved) return;
                const newSpec = {
                    ...currentSpec,
                    variant_id: `spec_v${Date.now()}`,
                    content: {
                        ...currentSpec.content,
                        headline: result.changes.headline || currentSpec.content.headline,
                        subhead: result.changes.subhead || currentSpec.content.subhead,
                        nodes: result.changes.nodes || currentSpec.content.nodes
                    },
                    graphic_config: {
                        ...currentSpec.graphic_config,
                        visual_code: result.changes.visual_code
                    }
                };

                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newSpec, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(result, null, 4));

                console.log("🚀 Staged forensic fix! Technical Blueprint Evolved in staging.");
                console.log("\n🧠 WATCHER THOUGHTS:\n", result.thoughts);
            } else {
                console.log("⚠️ Confidence too low. No changes made.");
            }

        } catch (error) {
            console.error("❌ SpecWatcher Error:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    new SpecWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

