
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { SystemConfigService } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/hero_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const VIDEO_FILE = path.resolve(__dirname, '../../../client/public/assets/veo_video_hero_challenger.mp4');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/hero_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/hero_watcher_decision.json');

// Models


const WATCHER_MODEL = MODELS.ARCHITECT_TEXT;

puppeteer.use(StealthPlugin());

export class HeroWatcher {
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 Hero Watcher: Capturing live snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.waitForSelector('[data-component="hero-block"]', { timeout: 5000 });
            const screenshot = await page.screenshot({ encoding: 'binary' });

            // Save for user visibility
            await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
            await fs.writeFile(SNAPSHOT_PATH, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Snapshot failed (Is Client Running?):", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log("🕵️ Watcher Agent: Waking up...");

        // 1. Load Data
        const [metricsRaw, challengerRaw, researchRaw, videoBuffer] = await Promise.all([
            fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(CHALLENGER_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(RESEARCH_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(VIDEO_FILE).catch(() => null)
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentHero = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        const activeVariantId = currentHero.id || 'hero_section_v1';
        const data = metricsInfo[activeVariantId];

        const config = await SystemConfigService.getInstance().getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Check Lock
        if (config.locks.hero) {
            console.log("🔒 Hero Section is LOCKED. Skipping optimization.");
            return;
        }

        // 1. Data Analysis (Threshold Check)
        if (!data || (data.views || 0) < config.sections.hero.min_views_data) {
            console.log(`🕵️ Watcher: Not enough data for ${activeVariantId}. Views: ${data?.views || 0}`);
            return;
        }

        const views = data.views;
        const clicks = data.clicks || 0;
        const retention = data.retention_count || 0;
        const ctr = (clicks / views) * 100;
        const retentionRate = (retention / views) * 100;

        console.log(`📊 PERF: CTR=${ctr.toFixed(1)}% | RET=${retentionRate.toFixed(1)}%`);

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
            `Hero metrics are low (CTR: ${ctr.toFixed(1)}% vs Target ${config.sections.hero.target_ctr}%). Attempt optimization?`
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

        // B. Video (Asset)
        if (videoBuffer && videoBuffer.length < 20 * 1024 * 1024) { // Limit to ~20MB for inline
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
            1. **Analyze**: Look at the Snapshot and Video. 
               - **READABILITY**: Does the text blend into the background? Check contrast (Target: 4.5:1).
               - **RETAIN**: Why are users failing to click or stay?
            3. **Diagnose**: 
               - If Contrast < 4.5:1: Use a lighter/darker color from palette OR add backdrop blur.
               - If Retention < 40%: Refine the video movement/subject.
            4. **Mutate**: Propose a Specific Fix.

            ${(config.feedback.hero_directive || preCheck.feedback) ? `
            **🛑 HIGH PRIORITY USER DIRECTIVE 🛑**:
            The user has explicitly ordered: "${[config.feedback.hero_directive, preCheck.feedback].filter(Boolean).join('. ')}"
            YOU MUST COMPLY WITH THIS ABOVE ALL OTHER STRATEGIC GOALS.
            ` : ''}
            
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
                        "overlay_gradient": "e.g. linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8))"
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

            const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const optimization = JSON.parse(responseText);

            // Save for user visibility
            await fs.writeFile(DECISION_PATH, JSON.stringify(optimization, null, 4));

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
                    optimization
                );

                if (!postCheck.approved) {
                    console.log("🛑 User rejected deployment. Aborting.");
                    return;
                }

                const newHero = {
                    ...currentHero,
                    // ... (rest of logic matches)
                    variant_id: `hero_v${Date.now()}`,
                    overlay_content: {
                        ...currentHero.overlay_content,
                        headline: {
                            ...currentHero.overlay_content.headline,
                            text: optimization.changes.headline,
                            styles: {
                                ...currentHero.overlay_content.headline.styles,
                                color: optimization.changes.visual_fixes?.headline_color || currentHero.overlay_content.headline.styles.color
                            }
                        },
                        subhead: {
                            ...currentHero.overlay_content.subhead,
                            text: optimization.changes.subhead,
                            styles: {
                                ...currentHero.overlay_content.subhead.styles,
                                color: optimization.changes.visual_fixes?.subhead_color || currentHero.overlay_content.subhead.styles.color
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
                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newHero, null, 4));
                console.log("🚀 Applied Fix! New Challenger Deployed.");

                // NEW: Automatic "Bake" Loop
                if (optimization.fix_type === 'VIDEO' || optimization.fix_type === 'VISUAL') {
                    console.log("🔥 Fix type is VIDEO/VISUAL. Triggering Asset Bake (Veo)...");
                    await this.bakeVideo(newHero);
                }

            } else {
                console.log("⚠️ Confidence too low. No changes made.");
            }

        } catch (error) {
            console.error("❌ Watcher Error:", error);
        }
    }

    private async bakeVideo(config: any) {
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

            // @ts-ignore
            await this.client.files.download({
                file: videos[0].video!,
                downloadPath: VIDEO_FILE,
            });

            console.log(`✅ Success! Video baked directly to assets: ${VIDEO_FILE}`);
        } catch (error) {
            console.error("❌ Video Bake Failed:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new HeroWatcher().analyzeAndOptimize().catch(console.error);
}
