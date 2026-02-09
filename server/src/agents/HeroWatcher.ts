
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { SystemConfigFactory } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';
import { MediaService } from '../services/MediaService.js';
import { AgentLogger } from '../utils/AgentLogger.js';

import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const WATCHER_MODEL = MODELS.ARCHITECT_TEXT;

puppeteer.use(StealthPlugin());

/**
 * HeroWatcher Agent
 * 
 * Responsibilities:
 * - Monitors the performance of the Hero Section (Views, CTR, Retention).
 * - Takes snapshots of the live landing page for visual analysis.
 * - analyzes performance data against configured thresholds.
 * - Proposes optimizations (Copy, Visuals, Video) using AI reasoning.
 * - Interacts with Human-In-The-Loop (HITL) for approval if configured.
 * - Stages approved changes and triggers asset baking (Veo) if needed.
 */
export class HeroWatcher {
    private client: GoogleGenAI;
    private workspaceId: string;
    private nanoBanana: NanoBananaService;
    private logger: AgentLogger;

    // Dynamic Paths
    private metricsFile: string;
    private stagingFile: string;
    private researchFile: string;
    private snapshotPath: string;
    private decisionPath: string;
    private assetsDir: string;
    // activePath and liveFile are determined at runtime via config

    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
        this.logger = new AgentLogger('Hero Watcher', workspaceId, onLog);

        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/hero_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/hero_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/hero_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    /**
     * Captures a visual snapshot of the current live landing page using Puppeteer.
     * @returns {Promise<Buffer | null>} The screenshot buffer or null if failed.
     */
    async captureSnapshot(): Promise<Buffer | null> {
        this.logger.info("Snapshot", "Capturing live landing page snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            // Add workspace param to URL so client knows which workspace to load (if client supports it)
            // Assuming client reads ?workspace=...
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
            await page.waitForSelector('[data-component="hero-block"]', { timeout: 5000 });
            const screenshot = await page.screenshot({ encoding: 'binary' });

            // Save for user visibility
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
     * Main execution loop for the Watcher.
     * 1. Loads configuration and live data.
     * 2. Checks performace thresholds.
     * 3. Triggers HITL pre-approval if enabled.
     * 4. Analyses visual and performance context using AI.
     * 5. Generates optimization proposals.
     * 6. Triggers HITL post-approval if enabled.
     * 7. Stages changes and bakes assets (Veo) if required.
     */
    async analyzeAndOptimize() {
        this.logger.start("Watcher Active", "Hero Watcher analysis started.");

        // 1. Load Data
        const configService = SystemConfigFactory.getInstance(this.workspaceId);
        const config = await configService.getConfig();
        const notificationClient = NotificationClient.getInstance(); // TODO: NotificationClient workspace aware?

        const activePath = config.active_assets_path || '';
        const LIVE_FILE = path.join(this.assetsDir, activePath, 'hero_block.json');

        console.log(`📂 HeroWatcher: Loading Live State from ${activePath} (in ${this.assetsDir})`);

        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(this.metricsFile, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.researchFile, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentHero = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        // Load current video for context
        let videoBuffer = null;
        if (currentHero.visual_asset?.source_url) {
            // Note: Visual assets might be in history or root.
            // If it starts with /workspaces/XYZ, we need to map it to client/public/workspaces/XYZ
            // If it starts with /assets, it might be legacy or mapped to client/public/assets?
            // "source_url" is a public URL path.
            // We need to resolve it to a local file path.

            const sourceUrl = currentHero.visual_asset.source_url;
            let videoPath = '';

            if (sourceUrl.startsWith('/workspaces')) {
                // /workspaces/XYZ/... -> client/public/workspaces/XYZ/...
                videoPath = path.resolve(__dirname, '../../../client/public', sourceUrl.replace(/^\//, ''));
            } else {
                // Fallback to legacy assets or root
                videoPath = path.resolve(__dirname, '../../../client/public', sourceUrl.replace(/^\//, ''));
            }

            videoBuffer = await fs.readFile(videoPath).catch(() => null);
            if (videoBuffer) this.logger.info("Context Loaded", "Current video asset loaded for analysis.");
        }

        const activeVariantId = currentHero.id || 'hero_section_v1';
        const data = metricsInfo[activeVariantId];

        // 0. Check Lock
        if (config.locks.hero) {
            this.logger.info("Skipping", "Hero Section is LOCKED.");
            return;
        }

        // 1. Data Analysis (Threshold Check)
        if (!data || (data.views || 0) < config.sections.hero.min_views_data) {
            this.logger.info("Skipping", `Insufficient data (Views: ${data?.views || 0})`);
            return;
        }

        const views = data.views;
        const clicks = data.clicks || 0;
        const retention = data.retention_count || 0;
        const ctr = (clicks / views);
        const retentionRate = (retention / views);

        this.logger.info("Metrics Analysis", `CTR: ${(ctr * 100).toFixed(1)}% | Retention: ${(retentionRate * 100).toFixed(1)}%`);

        // 2.5 CHECK THRESHOLDS
        if (ctr >= config.sections.hero.target_ctr && retentionRate >= config.sections.hero.target_retention) {
            this.logger.success("Optimization Unnecessary", "Hero is performing above targets.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        // CHECK MASTER SWITCH & PRE-GATE
        const hitlEnabled = config.hitl.enabled;
        const requirePre = config.hitl.require_approval_pre;
        let preCheckFeedback = "";

        if (hitlEnabled && requirePre) {
            this.logger.info("HITL Gate", "Triggering Pre-Optimization Approval...");
            const preCheck = await notificationClient.requestApproval(
                'Hero Section',
                'PRE_GENERATION',
                `Hero metrics are low (CTR: ${ctr.toFixed(1)}% vs Target ${config.sections.hero.target_ctr}%). Attempt optimization?`,
                undefined, // No proposal yet
                this.workspaceId
            );

            if (!preCheck.approved) {
                this.logger.info("Aborted", "User rejected optimization request.");
                return;
            }
            preCheckFeedback = preCheck.feedback || "";
        } else {
            console.log("⏩ HITL Pre-Gate skipped (Auto-Pilot active).");
        }

        // 3. Prepare Visuals (Multi-Modal)
        const parts: any[] = [];

        // A. Snapshot (Client)
        const snapshotBuffer = await this.captureSnapshot();
        if (snapshotBuffer) {
            parts.push({
                inlineData: { data: snapshotBuffer.toString('base64'), mimeType: 'image/png' }
            });
        }

        // B. Video (Context)
        if (videoBuffer) {
            parts.push({
                inlineData: { data: videoBuffer.toString('base64'), mimeType: 'video/mp4' }
            });
        }

        // 4. Construct Prompt
        const prompt = `
            You are 'Watcher', a Senior Conversion Rate Optimizer (CRO) & Video Director.
            
            **METRICS**:
            - Views: ${views}
            - CTR: ${ctr.toFixed(1)}% (Target: 25%)
            - Retention: ${retentionRate.toFixed(1)}% (Target: 40%)
            
            **CONTEXT**:
            Brand: "${researchCtx.brandDNA?.name?.value}"
            Strategy: "${researchCtx.brandDNA?.rationale?.value}"
            Video Prompt: "${currentHero.visual_asset?.prompt_signature}"
            
            **TASK (Deep Think)**:
            1. **Analyze**: Look at the provided Snapshot and Video. 
               - **FORENSIC AUDIT**: Describe what you see in the snapshot.
               - **READABILITY**: Does the text blend into the background? Check contrast (Target: 4.5:1).
               - **RETAIN**: Why are users failing to click or stay based on the video?
            2. **Diagnose**: 
               - If Contrast < 4.5:1: Use a lighter/darker color from palette OR add backdrop blur.
               - If Retention < 40%: Refine the video movement/subject.
            3. **Mutate**: Propose a Specific Fix.
            
            **OUTPUT JSON**:
            {
                "thoughts": "Your analysis of metrics and visual contrast...",
                "fix_type": "VIDEO" | "COPY" | "VISUAL",
                "contrast_audit": "Pass/Fail - Explanation",
                "changes": {
                    "headline": "New Headline",
                    "subhead": "New Subhead",
                    "cta_text": "New CTA",
                    "video_prompt": "Refined Video Prompt",
                    "visual_fixes": {
                        "headline_color": "#Hex picked from palette for contrast",
                        "subhead_color": "#Hex picked from palette for contrast",
                        "container_blur": "blur(8px)" | "none",
                        "overlay_gradient": "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8))"
                    }
                },
                "confidence": 0-100
            }
        `;

        parts.push({ text: prompt });

        // 5. Generate
        this.logger.info("Reasoning", `Thinking with ${WATCHER_MODEL}...`);
        try {
            // REMOVED: Redundant "Zombie" API Call that caused Rate Limiting.
            // We now pass content directly to NanoBananaService.

            // Construct Context Objects for NanoBanana
            const performance = { ctr, retentionRate, views };

            const context = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: researchCtx.imagery?.suggestions?.filter((i: any) => i.isSelected).map((i: any) => ({
                    concept: i.concept,
                    description: i.description,
                    visualStyle: i.visualStyle
                })) || []
            };

            const combinedFeedback = [config.feedback.hero_directive, preCheckFeedback].filter(Boolean).join('. ');

            // Pass videoBuffer as the last argument
            const optimization = await this.nanoBanana.refineVisual(currentHero, performance, context, snapshotBuffer || undefined, combinedFeedback, 'hero', videoBuffer || undefined);

            console.log("\n🧠 WATCHER DIAGNOSIS:\n", optimization.thoughts);
            console.log("\n💡 PROPOSED FIX:", optimization.changes);

            // 6. Apply Decision
            if (optimization.confidence > config.sections.hero.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const requirePost = config.hitl.require_approval_post;

                if (hitlEnabled && requirePost) {
                    this.logger.info("HITL Gate", "Triggering Post-Optimization Approval...");
                    const postCheck = await notificationClient.requestApproval(
                        'Hero Section',
                        'POST_GENERATION',
                        `New Hero Strategy Ready (Confidence: ${optimization.confidence}%). Deploy to Challenger & Bake Video?`,
                        optimization,
                        this.workspaceId
                    );

                    if (!postCheck.approved) {
                        this.logger.info("Aborted", "User rejected deployment.");
                        return;
                    }
                } else {
                    console.log("⏩ HITL Post-Gate skipped (Auto-Pilot active).");
                }

                const newVariantId = `hero_v${Date.now()}`;

                // CRITICAL FIX: Do NOT partial merge. Use the FULL schema from AI.
                // The AI now returns the ENTIRE component structure in `optimization.changes`
                const newHero = {
                    ...currentHero,          // PRESERVE navigation, forms, styles, etc.
                    ...optimization.changes, // OVERWRITE with full AI-generated content
                    id: currentHero.id,      // Preserve System ID
                    variant_id: newVariantId, // New Variant ID
                    meta: currentHero.meta   // Preserve Meta
                };

                // Ensure visual_asset has the source_url from the previous state (initially)
                // The AI returns 'prompt_signature' and 'attributes' but not the file path
                if (!newHero.visual_asset) newHero.visual_asset = {};
                newHero.visual_asset.source_url = currentHero.visual_asset?.source_url;
                newHero.visual_asset.source_id = currentHero.visual_asset?.source_id;

                // Map the video prompt correctly if the AI put it in visual_code (fallback)
                const finalPrompt = newHero.visual_asset.prompt_signature || optimization.changes.visual_code;
                newHero.visual_asset.prompt_signature = finalPrompt;

                // NEW: Write to STAGING instead of Live. 
                // The Coordinator (run_watchers.ts) will "Seal" this change.
                const newHeroWithPrompt = newHero;

                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newHeroWithPrompt, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));
                this.logger.success("Staged", "Proposed changes written to STAGING. Pending Sealing.");

                // NEW: Automatic "Bake" Loop
                let fixType = optimization.fix_type;
                if (!fixType && finalPrompt) {
                    fixType = 'VISUAL';
                    console.log("⚠️ Fix Type missing but visual prompt present. Inferring VISUAL mode.");
                }
                console.log(`🔎 Optimization Fix Type: ${fixType}`);

                if (fixType === 'VIDEO' || fixType === 'VISUAL') {
                    this.logger.info("Baking Asset", "Fix type is VIDEO/VISUAL. Triggering Asset Bake (Veo)...");
                    // Pass the NEW variant ID to bakeVideo so assets are stored in the correct history folder
                    try {
                        await this.bakeVideo(newHeroWithPrompt, newVariantId);
                    } catch (bakeErr) {
                        this.logger.error("Bake Failed", `Critical: ${bakeErr}`);
                    }
                } else {
                    this.logger.info("Text Only", "Running in TEXT-ONLY mode (no video bake).");
                }

            } else {
                this.logger.info("No Change", "Confidence too low.");
            }

        } catch (error) {
            this.logger.error("Watcher Error", `Critical: ${error}`);
        }
    }

    /**
     * Bakes a video asset using Veo based on the generate configuration.
     * Archives the result and updates the staging file.
     * 
     * @param {any} config - The staged hero block configuration.
     * @param {string} variantId - The ID of the new variant.
     */
    private async bakeVideo(config: any, variantId: string) {
        const attrs = config.visual_asset?.attributes || {};
        const prompt = config.visual_asset?.prompt_signature;

        const veoPrompt = `
        Cinematic 4K video.
        Description: ${prompt}
        Lighting: ${attrs.lighting || 'Cinematic'}.
        Movement: ${attrs.camera_movement || 'Steady'}.
        Focus: ${attrs.subject_focus || 'Main subject'}.
        Color: ${attrs.color_grade || '#FFFFFF'}.
        `;

        try {
            this.logger.info("Veo Connectivity", "Connecting to Veo...");
            // @ts-ignore
            let operation = await this.client.models.generateVideos({
                model: MODELS.FORGE_VIDEO_HQ,
                prompt: veoPrompt,
                config: { aspectRatio: '16:9' }
            });

            while (!operation.done) {
                this.logger.info("Generative Process", "Generating Asset (Waiting 5s)...");
                await new Promise((resolve) => setTimeout(resolve, 5000));
                // @ts-ignore
                operation = await this.client.operations.getVideosOperation({ operation });
            }

            const videos = operation.response?.generatedVideos;
            if (!videos || !videos.length) throw new Error("No videos returned.");

            // NEW: Use centralized MediaService with workspaceId
            const browserPath = await MediaService.getInstance(this.workspaceId).archiveGeminiFile(
                this.client,
                (videos[0].video as any).uri,
                'hero_video',
                'mp4',
                variantId // Pass variantId for folder organization
            );

            // Update the STAGING file with the NEW asset path
            const stagingRaw = await fs.readFile(this.stagingFile, 'utf-8').catch(() => '{}');
            const currentStaging = JSON.parse(stagingRaw);
            currentStaging.visual_asset = {
                ...currentStaging.visual_asset,
                source_url: browserPath, // Use the new path returned by MediaService
                source_id: `veo_asset_${variantId}`,
                attributes: attrs,
                prompt_signature: prompt
            };

            await fs.writeFile(this.stagingFile, JSON.stringify(currentStaging, null, 4));
            this.logger.success("Bake Complete", `Staging updated with new video: ${browserPath}`);

        } catch (error) {
            this.logger.error("Bake Failed", `Error: ${error}`);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    new HeroWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

