import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { WS_CONFIG, MODELS } from '../../../shared/constants.js';
import { SystemConfigService } from '../services/SystemConfigService.js';
import { NotificationClient } from '../utils/NotificationClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/social_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/social_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/social_watcher_decision.json');

puppeteer.use(StealthPlugin());

export class SocialWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 SocialWatcher: Capturing testimonials snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
            await page.goto(url, { waitUntil: 'networkidle0' });

            await page.evaluate(() => {
                const el = document.querySelector('[data-component="social-block"]');
                if (el) el.scrollIntoView();
            });

            await new Promise(r => setTimeout(r, 1500));

            const element = await page.$('[data-component="social-block"]');
            if (!element) throw new Error("Social block not found");

            const screenshot = await element.screenshot({ encoding: 'binary' });
            await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
            await fs.writeFile(SNAPSHOT_PATH, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Social Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log("🕵️ SocialWatcher Agent: Waking up...");

        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(CHALLENGER_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(RESEARCH_FILE, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentSocial = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentSocial.id || 'social_section_v1';
        const data = metricsInfo[variantId];

        const config = await SystemConfigService.getInstance().getConfig();
        const notificationClient = NotificationClient.getInstance();

        if (config.locks.social) {
            console.log("🔒 Social Section is LOCKED. Skipping.");
            return;
        }

        // 1. Data Threshold Check
        if (!data || (data.dwell_count || 0) < config.sections.social.min_dwell_events) {
            console.log(`🕵️ SocialWatcher: Not enough data. Dwell events: ${data?.dwell_count || 0}`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        const avgVelocity = data.velocity_sum ? (data.velocity_sum / data.dwell_count) : 0;

        console.log(`📊 PERF: Avg Dwell=${avgDwell.toFixed(0)}ms | Avg Velocity=${avgVelocity.toFixed(0)}px/s`);

        // 2. Trust Signal Logic
        if (avgDwell > config.sections.social.target_dwell_ms && avgVelocity < config.sections.social.max_velocity_px_s) {
            console.log("🏆 STATUS: CHAMPION. Users are reading and pausing on testimonials.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const preCheck = await notificationClient.requestApproval(
            'Social Section',
            'PRE_GENERATION',
            `Social Trust low (Dwell: ${avgDwell.toFixed(0)}ms, Velocity: ${avgVelocity.toFixed(0)}px/s). Optimize?`
        );

        if (!preCheck.approved) return;

        console.log("📉 STATUS: LOW TRUST SIGNAL. Users are scrolling past. Initiating Persona & Imagery Mutation...");

        // 3. Vision Audit
        const snapshot = await this.captureSnapshot();

        try {
            const performance = { avgDwell, avgVelocity };
            const nanoContext = {
                brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
                mission: researchCtx.brandDNA?.mission?.value || "",
                rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
                mood: researchCtx.brandDNA?.mood?.items || [],
                colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
                fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
                imagery: []
            };

            const combinedFeedback = [config.feedback.social_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentSocial, performance, nanoContext, snapshot || undefined, combinedFeedback);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.social.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'Social Section',
                    'POST_GENERATION',
                    `New Social Strategy Ready (Confidence: ${(optimization as any).confidence}%). Deploy & Rebake?`,
                    optimization
                );

                if (!postCheck.approved) return;
                // In social case, if we mutate PERSONAS or PROMPTS, we need to rebake images.
                const newSocial = {
                    ...currentSocial,
                    variant_id: `social_v${Date.now()}`,
                    meta: {
                        ...currentSocial.meta,
                        layout_strategy: (optimization as any).changes.layout_strategy || currentSocial.meta.layout_strategy
                    },
                    content: {
                        ...currentSocial.content,
                        headline: (optimization as any).changes.headline || currentSocial.content.headline,
                        subhead: (optimization as any).changes.subhead || currentSocial.content.subhead,
                        testimonials: (optimization as any).changes.testimonials || currentSocial.content.testimonials
                    },
                    graphic_config: {
                        ...currentSocial.graphic_config,
                        visual_code: (optimization as any).changes.visual_code || currentSocial.graphic_config.visual_code
                    }
                };

                // Check if testimonials changed (implying prompt changes)
                const changed = JSON.stringify(newSocial.content.testimonials) !== JSON.stringify(currentSocial.content.testimonials);

                if (changed) {
                    console.log("🔥 Testimonials mutated. Rebaking headshots...");
                    await this.rebakeHeadshots(newSocial);
                }

                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newSocial, null, 4));
                await fs.writeFile(DECISION_PATH, JSON.stringify(optimization, null, 4));
                console.log("🚀 Optimization Applied! Social Section Evolved.");
            }
        } catch (error) {
            console.error("❌ SocialWatcher Error:", error);
        }
    }

    private async rebakeHeadshots(config: any) {
        const testimonials = config.content.testimonials;
        const ASSETS_DIR = path.resolve(__dirname, '../../../client/public/assets');

        for (let i = 0; i < testimonials.length; i++) {
            const t = testimonials[i];
            const imageName = `testimonial_${i + 1}_challenger.png`;
            const imagePath = path.join(ASSETS_DIR, imageName);

            console.log(`...Re-imaging ${t.name} with prompt: ${t.image_prompt}`);
            try {
                const response = await this.client.models.generateContent({
                    model: MODELS.FORGE_IMAGE,
                    contents: [{
                        parts: [{ text: `Create a high-quality human-like headshot. ${t.image_prompt}. Ensure clear focus and professional lighting.` }]
                    }],
                    config: {
                        // @ts-ignore
                        imageConfig: { aspectRatio: "1:1" }
                    }
                });

                const parts = response.candidates?.[0]?.content?.parts || [];
                let data: string | undefined = undefined;

                for (const part of parts) {
                    if (part.inlineData) {
                        data = part.inlineData.data;
                        break;
                    }
                }

                if (data) {
                    await fs.writeFile(imagePath, Buffer.from(data, 'base64'));
                    console.log(`✅ Headshot Re-baked: ${imageName}`);
                }
            } catch (e) {
                console.error("Rebake failed for persona", i + 1, e);
            }
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new SocialWatcher().analyzeAndOptimize().catch(console.error);
}
