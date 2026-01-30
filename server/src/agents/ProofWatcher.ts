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
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/proof_block.json');
const STAGING_FILE = path.resolve(__dirname, '../../brain/staging/proof_block_staging.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/proof_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/proof_watcher_decision.json');

// Models

puppeteer.use(StealthPlugin());

export class ProofWatcher {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY || '';
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 ProofWatcher: Capturing block snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });

            // Using standard port for simulation
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
            await page.goto(url, { waitUntil: 'load', timeout: 10000 });

            // Wait for proof block
            await page.waitForSelector('[data-component="proof-block"]', { timeout: 5000 });

            // Give animations time to complete
            await new Promise(r => setTimeout(r, 2000));

            // Focus on the proof block specifically
            const element = await page.$('[data-component="proof-block"]');
            if (!element) throw new Error("Proof block not found");

            const screenshot = await element.screenshot({ encoding: 'binary' });
            await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
            await fs.writeFile(SNAPSHOT_PATH, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Proof Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log("🕵️ Proof Watcher: Waking up...");

        // 1. Load Data
        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(CHALLENGER_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(RESEARCH_FILE, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentProof = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        const variantId = currentProof.id || 'proof_section_v1';
        const data = metricsInfo[variantId];

        const config = await SystemConfigService.getInstance().getConfig();
        const notificationClient = NotificationClient.getInstance();

        // 0. Check Lock
        if (config.locks.proof) {
            console.log("🔒 Proof Section is LOCKED. Skipping optimization.");
            return;
        }

        // 2. Validate Data
        if (!data || (data.views || 0) < config.sections.proof.min_views_data) {
            console.log(`🕵️ Proof Watcher: Not enough data for ${variantId}. Views: ${data?.views || 0}`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        console.log(`📊 PERF: Avg Dwell Time = ${avgDwell.toFixed(0)}ms (Target: ${config.sections.proof.target_dwell_ms}ms+)`);

        if (avgDwell > config.sections.proof.target_dwell_ms) {
            console.log("🏆 STATUS: CHAMPION. Dwell time is optimal. No action.");
            return;
        }

        // 🟢 GATE 1: PRE-APPROVAL
        console.log("🚦 Triggering Pre-Optimization Gate...");
        const preCheck = await notificationClient.requestApproval(
            'Proof Section',
            'PRE_GENERATION',
            `Proof Dwell Time is low (${avgDwell.toFixed(0)}ms vs Target ${config.sections.proof.target_dwell_ms}ms). Optimize?`
        );

        if (!preCheck.approved) {
            console.log("🛑 User rejected optimization. Aborting.");
            return;
        }

        console.log("📉 STATUS: DWELL TIME LOW. Initiating Strategic Mutation...");

        // 3. Prepare Visuals
        const snapshotBuffer = await this.captureSnapshot();

        // 4. Strategic Refinement (Service Call)
        console.log(`🧠 Proof Watcher: Requesting refined visual from NanoBananaService...`);

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
            const combinedFeedback = [config.feedback.proof_directive, preCheck.feedback].filter(Boolean).join('. ');
            const optimization = await this.nanoBanana.refineVisual(currentProof, performance, nanoContext, snapshotBuffer || undefined, combinedFeedback);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > config.sections.proof.watcher_confidence_min) {

                // 🟢 GATE 2: POST-APPROVAL
                const postCheck = await notificationClient.requestApproval(
                    'Proof Section',
                    'POST_GENERATION',
                    `New Proof Strategy Ready (Confidence: ${(optimization as any).confidence}%). Deploy?`,
                    optimization
                );

                if (!postCheck.approved) {
                    console.log("🛑 User rejected deployment. Aborting.");
                    return;
                }

                if (!currentProof.content) {
                    console.error("❌ ProofWatcher: Current proof block has no content section. Aborting.");
                    return;
                }

                const newProof = {
                    ...currentProof,
                    variant_id: `proof_v${Date.now()}`,
                    meta: {
                        ...currentProof.meta,
                        layout_strategy: (optimization as any).changes.layout_strategy || currentProof.meta.layout_strategy
                    },
                    content: {
                        ...currentProof.content,
                        headline: (optimization as any).changes.headline || currentProof.content.headline,
                        subhead: (optimization as any).changes.subhead || currentProof.content.subhead,
                        graphic_caption: (optimization as any).changes.graphic_caption || currentProof.content.graphic_caption,
                        evidence_items: (optimization as any).changes.evidence_items || currentProof.content.evidence_items
                    },
                    graphic_config: {
                        ...currentProof.graphic_config,
                        type: 'generative',
                        visual_code: (optimization as any).changes.visual_code || currentProof.graphic_config.visual_code
                    }
                };

                await fs.mkdir(path.dirname(STAGING_FILE), { recursive: true });
                await fs.writeFile(STAGING_FILE, JSON.stringify(newProof, null, 4));
                await fs.writeFile(DECISION_PATH, JSON.stringify(optimization, null, 4));
                console.log("🚀 Optimization Staged! Proof Section Mutated in staging.");
            }
        } catch (error) {
            console.error("❌ Proof Watcher Failed:", error);
        }
    }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new ProofWatcher().analyzeAndOptimize().catch(console.error);
}
