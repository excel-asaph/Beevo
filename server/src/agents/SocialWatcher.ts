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
import { MediaService } from '../services/MediaService.js';
import { AgentLogger } from '../utils/AgentLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

puppeteer.use(StealthPlugin());

/**
 * Social Watcher Agent.
 * 
 * Responsibilities:
 * - Monitors the performance of the Social/Testimonial section (dwell time, scroll velocity).
 * - Captures snapshots of the live social block.
 * - Triggers optimization via NanoBanana to improve trust.
 * - Rebakes testimonial headshots if content changes.
 * - Manages HITL approval gates.
 * - Stages optimized social blocks.
 */
export class SocialWatcher {
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
        this.logger = new AgentLogger('Social Watcher', workspaceId, onLog);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.metricsFile = path.join(baseBrainPath, 'metrics/landing_page_metrics.json');
        this.stagingFile = path.join(baseBrainPath, 'staging/social_block_staging.json');
        this.researchFile = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.snapshotPath = path.join(baseBrainPath, 'run_artifacts/social_watcher_snapshot.png');
        this.decisionPath = path.join(baseBrainPath, 'run_artifacts/social_watcher_decision.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
    }

    /**
     * Captures a screenshot of the live social block.
     * Waited specifically for component visibility to ensure hydration.
     * 
     * @returns {Promise<Buffer | null>} The screenshot buffer or null if failed.
     */
    async captureSnapshot(): Promise<Buffer | null> {
        this.logger.info("Snapshot", "Capturing testimonials snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const clientBaseUrl = process.env.CLIENT_URL || `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}`;
            const url = `${clientBaseUrl}/?mode=landing_page&workspace=${this.workspaceId}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            await page.evaluate(() => {
                const el = document.querySelector('[data-component="social-block"]');
                if (el) el.scrollIntoView();
            });

            // Wait specifically for the component to be rendered and visible
            await page.waitForSelector('[data-component="social-block"]', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000)); // Extra buffer for hydration

            const element = await page.$('[data-component="social-block"]');
            if (!element) throw new Error("Social block not found");

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
     * Analyzes performance metrics and optimizes the Social section if needed.
     * 1. Checks lock status and data sufficiency.
     * 2. Evals dwell time and scroll velocity.
     * 3. Triggers HITL pre-optimization gate.
     * 4. Calls NanoBanana to refine testimonials and visuals.
     * 5. Triggers HITL post-optimization gate.
     * 6. Stages the new social block (and rebakes headshots if needed).
     */
    async analyzeAndOptimize() {
        this.logger.start("Watcher Active", "Social Watcher analysis started...");

        const config = await SystemConfigFactory.getInstance(this.workspaceId).getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Resolve Live State Path (Atomic Deployment)
        const activePath = config.active_assets_path || ''; // e.g., 'states/HASH'
        const LIVE_FILE = path.join(this.assetsDir, activePath, 'social_block.json');

        console.log(`📂 SocialWatcher: Loading Live State from ${activePath}`);

        const [metricsRaw, liveRaw, researchRaw] = await Promise.all([
            fs.readFile(this.metricsFile, 'utf-8').catch(() => '{}'),
            fs.readFile(LIVE_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(this.researchFile, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentSocial = JSON.parse(liveRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentSocial.id || 'social_section_v1';
        const data = metricsInfo[variantId];

        if (config.locks.social) {
            this.logger.info("Skipping", "Social Section is LOCKED.");
            return;
        }

        // 1. Data Threshold Check
        if (!data || (data.dwell_count || 0) < config.sections.social.min_dwell_events) {
            this.logger.info("Skipping", `Insufficient data (Dwell events: ${data?.dwell_count || 0})`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        const avgVelocity = data.velocity_sum ? (data.velocity_sum / data.dwell_count) : 0;

        this.logger.info("Metrics Analysis", `Avg Dwell=${avgDwell.toFixed(0)}ms | Avg Velocity=${avgVelocity.toFixed(0)}px/s`);

        // 2. Trust Signal Logic
        if (avgDwell > config.sections.social.target_dwell_ms && avgVelocity < config.sections.social.max_velocity_px_s) {
            this.logger.success("Optimization Unnecessary", "Users are reading and pausing on testimonials.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        const hitlEnabled = config.hitl.enabled;
        const requirePre = config.hitl.require_approval_pre;
        let preCheckFeedback = "";

        if (hitlEnabled && requirePre) {
            this.logger.info("HITL Gate", "Triggering Pre-Optimization Approval...");
            const preCheck = await notificationClient.requestApproval(
                'Social Section',
                'PRE_GENERATION',
                `Social Trust low (Dwell: ${avgDwell.toFixed(0)}ms, Velocity: ${avgVelocity.toFixed(0)}px/s). Optimize?`,
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

        this.logger.info("Reasoning", "Low Trust Signal detected. Initiating Persona & Imagery Mutation...");

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

            const socialGuardrails = `
                **STRICT IMAGE CONTRACT**: 
                - Use the EXACT placeholder format 'testimonial_{index}_url' with 3-digit zero-padded index (e.g., 'testimonial_001_url', 'testimonial_002_url', 'testimonial_003_url', 'testimonial_004_url') for the 'src' attribute of images in your 'visual_code'. 
                - The frontend Hydrator will replace these placeholders with headshot URLs.
                - DO NOT use curly braces or template literal syntax like '{t1}_url'.
                - DO NOT use the 'image_url' property value directly in the HTML.
                - CRITICAL: Always use 3 digits (001, 002, 003...), never 2 digits (01, 02).
            `;

            const combinedFeedback = [config.feedback.social_directive, socialGuardrails, preCheckFeedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentSocial, performance, nanoContext, snapshot || undefined, combinedFeedback, 'social');

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.social.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const requirePost = config.hitl.require_approval_post;

                if (hitlEnabled && requirePost) {
                    this.logger.info("HITL Gate", "Triggering Post-Optimization Approval...");
                    const postCheck = await notificationClient.requestApproval(
                        'Social Section',
                        'POST_GENERATION',
                        `New Social Strategy Ready (Confidence: ${(optimization as any).confidence}%). Deploy & Rebake?`,
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

                // CRITICAL FIX: Do NOT partial merge. Use the FULL schema from AI.
                const newSocial = {
                    ...currentSocial, // Keep existing ID/Metadata structure foundation
                    ...optimization.changes, // OVERWRITE all content fields with full AI schema
                    id: currentSocial.id, // Preserve System ID
                    variant_id: `social_v${Date.now()}`,
                    meta: {
                        ...currentSocial.meta,
                        layout_strategy: optimization.changes.layout_strategy || currentSocial.meta.layout_strategy
                    }
                };

                // Explicitly map content if the schema has nested objects (Hero has nested overlay_content/layout_config)
                // Social flat schema: layout_strategy, headline, subhead, visual_code, testimonials
                // We need to map these back to the `content` and `graphic_config` structure expected by the frontend/store
                // IF the frontend Expects `content: { ... }` and `graphic_config: { ... }`

                // Wait, checking `SocialWatcher.ts` L110: `const currentSocial = JSON.parse(liveRaw);`
                // And L222: `content: { headline, ... }`

                // The AI schema returns flat fields: `headline`, `subhead`, `testimonials`, `visual_code`
                // But the `currentSocial` object has structure: `content: { ... }`, `graphic_config: { ... }`

                // RE-MAPPING TO STORE STRUCTURE:
                newSocial.content = {
                    headline: optimization.changes.headline,
                    subhead: optimization.changes.subhead,
                    testimonials: optimization.changes.testimonials
                };

                // Normalize visual_code: Convert any 2-digit testimonial placeholders to 3-digit format
                // e.g., testimonial_01_url → testimonial_001_url
                let normalizedVisualCode = optimization.changes.visual_code || '';
                normalizedVisualCode = normalizedVisualCode.replace(
                    /testimonial_(\d{1,2})_url/g,
                    (_match: string, index: string) => `testimonial_${index.padStart(3, '0')}_url`
                );

                newSocial.graphic_config = {
                    visual_code: normalizedVisualCode
                };

                // Remove flat fields from root to keep JSON clean (optional but good hygiene)
                delete newSocial.headline;
                delete newSocial.subhead;
                delete newSocial.testimonials;
                delete newSocial.visual_code;

                // Check if testimonials changed (implying prompt changes)
                const newTestimonials = newSocial.content?.testimonials || [];
                const oldTestimonials = currentSocial.content?.testimonials || [];
                const changed = JSON.stringify(newTestimonials) !== JSON.stringify(oldTestimonials);

                // Write to STAGING instead of live
                await fs.mkdir(path.dirname(this.stagingFile), { recursive: true });
                await fs.writeFile(this.stagingFile, JSON.stringify(newSocial, null, 4));
                await fs.writeFile(this.decisionPath, JSON.stringify(optimization, null, 4));

                if (changed) {
                    this.logger.info("Testimonials Mutated", "Rebaking headshots and updating staging...");
                    await this.rebakeHeadshots(newSocial);
                }

                this.logger.success("Staged", "Social Section Evolved in staging.");
            } else {
                this.logger.info("No Change", "Confidence too low.");
            }
        } catch (error) {
            this.logger.error("Watcher Error", `critical: ${error}`);
        }
    }

    /**
     * Regenerates headshots for testimonials if content has changed.
     * Uses Forge Image model and archives assets via MediaService.
     * 
     * @param {any} config - The social block configuration.
     */
    private async rebakeHeadshots(config: any) {
        const testimonials = config.content.testimonials;
        const mediaService = MediaService.getInstance(this.workspaceId);

        for (let i = 0; i < testimonials.length; i++) {
            const t = testimonials[i];
            this.logger.info("Re-Imaging", `Creating new headshot for ${t.name}...`);
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
                    const browserPath = await mediaService.archiveAsset(
                        `testimonial_${i + 1}`,
                        'png',
                        Buffer.from(data, 'base64'),
                        config.variant_id // Organize by variant
                    );

                    // Update the reference in the config passed to this function
                    t.image_url = browserPath;
                    this.logger.success("Headshot Updated", `Archive: ${browserPath}`);
                }
            } catch (e) {
                this.logger.error("Rebake Failed", `Persona ${i + 1}: ${e}`);
            }
        }

        // Finalize state in staging after all headshots are baked
        await fs.writeFile(this.stagingFile, JSON.stringify(config, null, 4));
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const workspaceArg = args.find(a => a.startsWith('--workspace='));
    const workspaceId = workspaceArg ? workspaceArg.split('=')[1] : 'default';

    new SocialWatcher(workspaceId).analyzeAndOptimize().catch(console.error);
}

