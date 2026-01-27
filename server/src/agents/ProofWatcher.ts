import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { WS_CONFIG } from '../../../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/hero_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/proof_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/proof_watcher_snapshot.png');

// Models
const WATCHER_MODEL = 'gemini-3-flash-preview';

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

        // 2. Validate Data
        if (!data || (data.views || 0) < 10) {
            console.log(`🕵️ Proof Watcher: Not enough data for ${variantId}. Views: ${data?.views || 0}`);
            return;
        }

        const avgDwell = data.dwell_sum_ms / data.dwell_count;
        console.log(`📊 PERF: Avg Dwell Time = ${avgDwell.toFixed(0)}ms (Target: 2000ms+)`);

        if (avgDwell > 2000) {
            console.log("🏆 STATUS: CHAMPION. Dwell time is optimal. No action.");
            return;
        }

        console.log("📉 STATUS: DWELL TIME LOW. Initiating Strategic Mutation...");

        // 3. Prepare Visuals
        const snapshotBuffer = await this.captureSnapshot();
        const parts: any[] = [];
        if (snapshotBuffer) {
            parts.push({
                inlineData: { data: snapshotBuffer.toString('base64'), mimeType: 'image/png' }
            });
        }

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
            const optimization = await this.nanoBanana.refineVisual(currentProof, performance, nanoContext, snapshotBuffer || undefined);

            console.log("\n🕵️ WATCHER ANALYSIS:\n", (optimization as any).thoughts);

            if ((optimization as any).confidence > 70) {
                const newProof = {
                    ...currentProof,
                    variant_id: `proof_v${Date.now()}`,
                    content: {
                        ...currentProof.content,
                        headline: (optimization as any).changes.headline || currentProof.content.headline,
                        subhead: (optimization as any).changes.subhead || currentProof.content.subhead,
                        graphic_caption: (optimization as any).changes.graphic_caption || currentProof.content.graphic_caption
                    },
                    graphic_config: {
                        ...currentProof.graphic_config,
                        type: (optimization as any).changes.graphic_type || currentProof.graphic_config.type,
                        primary_color: (optimization as any).changes.primary_color || currentProof.graphic_config.primary_color,
                        accent_color: (optimization as any).changes.accent_color || currentProof.graphic_config.accent_color
                    }
                };

                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newProof, null, 4));
                console.log("🚀 Optimization Applied! Section 2 Mutated.");
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
