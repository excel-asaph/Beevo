
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const WATCHER_MODEL = MODELS.ARCHITECT_TEXT;

puppeteer.use(StealthPlugin());

export class HeroWatcher {
    private client: GoogleGenAI;
    private workspaceId: string;

    // Dynamic Paths
    private metricsFile: string;
    private stagingFile: string;
    private researchFile: string;
    private snapshotPath: string;
    private decisionPath: string;
    private assetsDir: string;
    // activePath and liveFile are determined at runtime via config

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/hero_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/hero_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/hero_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log(`📸 [${this.workspaceId}] Hero Watcher: Capturing live snapshot...`);
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
            console.error("❌ Snapshot failed (Is Client Running?):", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log(`🕵️ [${this.workspaceId}] Hero Watcher Agent: Waking up...`);

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
            if (videoBuffer) console.log("📺 HeroWatcher: Contextual Video Loaded.");
        }

        const activeVariantId = currentHero.id || 'hero_section_v1';
        const data = metricsInfo[activeVariantId];

        // 0. Check Lock
        if (config.locks.hero) {
            console.log("🔒 Hero Section is LOCKED. Skipping optimization.");
            return;
        }

        // 1. Data Analysis (Threshold Check)
        if (!data || (data.views || 0) < config.sections.hero.min_views_data) {
            console.log(`🕵️ Hero Watcher: Not enough data for ${activeVariantId}. Views: ${data?.views || 0}`);
            return;
        }

        const views = data.views;
        const clicks = data.clicks || 0;
        const retention = data.retention_count || 0;
        const ctr = (clicks / views);
        const retentionRate = (retention / views);

        console.log(`📊 PERF: CTR=${(ctr * 100).toFixed(1)}% | RET=${(retentionRate * 100).toFixed(1)}%`);

        // 2.5 CHECK THRESHOLDS
        if (ctr >= config.sections.hero.target_ctr && retentionRate >= config.sections.hero.target_retention) {
            console.log("🏆 Hero is performing above targets. No action needed.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        console.log("🚦 Triggering Pre-Optimization Gate...");
        const preCheck = await notificationClient.requestApproval(
            'Hero Section',
            'PRE_GENERATION',
            `Hero metrics are low (CTR: ${ctr.toFixed(1)}% vs Target ${config.sections.hero.target_ctr}%). Attempt optimization?`,
            undefined, // No proposal yet
            this.workspaceId
        );

        if (!preCheck.approved) {
            console.log("🛑 User rejected optimization. Aborting.");
            return;
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
            3. **Diagnose**: 
               - If Contrast < 4.5:1: Use a lighter/darker color from palette OR add backdrop blur.
               - If Retention < 40%: Refine the video movement/subject.
            4. **Mutate**: Propose a Specific Fix.
            
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
        console.log(`🧠 Thinking with ${WATCHER_MODEL}...`);
        try {
            const result = await this.client.models.generateContent({
                model: WATCHER_MODEL,
                contents: [{ role: 'user', parts }],
                config: {
                    responseMimeType: "application/json"
                }
            });

            const combinedFeedback = [config.feedback.hero_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentHero, performance, context, snapshotBuffer || undefined, combinedFeedback, 'hero');
            console.log("\n🧠 WATCHER DIAGNOSIS:\n", optimization.thoughts);
            console.log("\n💡 PROPOSED FIX:", optimization.changes);

            // 6. Apply Decision
            if (optimization.confidence > config.sections.hero.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                console.log("🚦 Triggering Post-Optimization Gate...");
                const postCheck = await notificationClient.requestApproval(
                    'Hero Section',
                    'POST_GENERATION',
                    `New Hero Strategy Ready (Confidence: ${optimization.confidence}%). Deploy to Challenger & Bake Video?`,
                    optimization,
                    this.workspaceId
                );

                if (!postCheck.approved) {
                    console.log("🛑 User rejected deployment. Aborting.");
                    return;
                }

                const newHero = {
                    ...currentHero,
                    variant_id: `hero_v${Date.now()}`,
                    overlay_content: {
                        ...currentHero.overlay_content,
                        headline: {
                            ...(currentHero.overlay_content?.headline || {}),
                            text: optimization.changes.headline,
                            styles: {
                                ...(currentHero.overlay_content?.headline?.styles || {}),
                                color: optimization.changes.visual_fixes?.headline_color || currentHero.overlay_content?.headline?.styles?.color || '#ffffff'
                            }
                        },
                        subhead: {
                            ...(currentHero.overlay_content?.subhead || {}),
                            text: optimization.changes.subhead,
                            styles: {
                                ...(currentHero.overlay_content?.subhead?.styles || {}),
                                color: optimization.changes.visual_fixes?.subhead_color || currentHero.overlay_content?.subhead?.styles?.color || '#ffffff'
                            }
                        },
                        cta: {
                            ...currentHero.overlay_content.cta,
                            text: optimization.changes.cta_text
                        }
                    },
                    layout_config: {
                        ...currentHero.layout_config,
                        overlay_gradient: optimization.changes.visual_fixes?.overlay_gradient || currentHero.layout_config.overlay_gradient,
                        container_styles: {
                            ...currentHero.layout_config.container_styles,
                            backdropFilter: optimization.changes.visual_fixes?.container_blur || currentHero.layout_config.container_styles.backdropFilter
                        }
                    },
                    visual_asset: {
                        ...currentHero.visual_asset,
                        prompt_signature: optimization.changes.video_prompt
                    }
                };

                // NEW: Write to STAGING instead of Live. 
                // The Coordinator (run_watchers.ts) will "Seal" this change.
                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newHero, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));
                console.log("🚀 Proposed changes written to STAGING. Pending Sealing.");

                // NEW: Automatic "Bake" Loop
                if (optimization.fix_type === 'VIDEO' || optimization.fix_type === 'VISUAL') {
                    console.log("🔥 Fix type is VIDEO/VISUAL. Triggering Asset Bake (Veo)...");
                    await this.bakeVideo(newHero, newHero.variant_id);
                }

            } else {
                console.log("⚠️ Confidence too low. No changes made.");
            }

        } catch (error) {
            console.error("❌ Watcher Error:", error);
        }
    }

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
            console.log("🎥 Connecting to Veo...");
            // @ts-ignore
            let operation = await this.client.models.generateVideos({
                model: MODELS.FORGE_VIDEO_HQ,
                prompt: veoPrompt,
                config: { aspectRatio: '16:9' }
            });

            while (!operation.done) {
                console.log("...Generating Asset (Waiting 5s)...")
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
                source_url: browserPath
            };
            await fs.writeFile(this.stagingFile, JSON.stringify(currentStaging, null, 4));

            console.log(`✅ Success! Video baked and staging updated: ${browserPath}`);
        } catch (error) {
            console.error("❌ Video Bake Failed:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    new HeroWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

