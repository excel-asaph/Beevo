import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { WS_CONFIG } from '../../../shared/constants.js';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/landing_page_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/spec_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const SNAPSHOT_PATH = path.resolve(__dirname, '../../brain/run_artifacts/spec_watcher_snapshot.png');
const DECISION_PATH = path.resolve(__dirname, '../../brain/run_artifacts/spec_watcher_decision.json');

puppeteer.use(StealthPlugin());

export class SpecWatcher {
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 SpecWatcher: Capturing technical schematic snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            const url = `http://localhost:${WS_CONFIG.CLIENT_PORT || 3000}/?mode=landing_page`;
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
            await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
            await fs.writeFile(SNAPSHOT_PATH, screenshot);

            return Buffer.from(screenshot);
        } catch (e) {
            console.error("❌ Snapshot failed:", e);
            return null;
        } finally {
            if (browser) await browser.close();
        }
    }

    async analyzeAndOptimize() {
        console.log("🕵️ SpecWatcher Agent: Waking up...");

        // 1. Load Data
        const [metricsRaw, challengerRaw, researchRaw] = await Promise.all([
            fs.readFile(METRICS_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(CHALLENGER_FILE, 'utf-8').catch(() => '{}'),
            fs.readFile(RESEARCH_FILE, 'utf-8').catch(() => '{}')
        ]);

        const metricsInfo = JSON.parse(metricsRaw);
        const currentSpec = JSON.parse(challengerRaw);
        const researchCtx = JSON.parse(researchRaw);

        // Interaction Depth Tracking (Mock or real)
        const specMetrics = metricsInfo[currentSpec.id] || { dwell_count: 0, interactions: [] };
        const interactionWeight = (specMetrics.interactions?.length || 0);

        console.log(`📊 PERF: Interaction Depth=${interactionWeight} | Dwell Count=${specMetrics.dwell_count}`);

        // 2. Prepare Context
        const selectedPalettes = researchCtx.colorPalettes.palettes.filter((p: any) => p.isSelected);
        const validColors = selectedPalettes.flatMap((p: any) => p.colors);
        const context = {
            brandName: researchCtx.brandDNA.name.value,
            mission: researchCtx.brandDNA.mission.value,
            rationale: typeof researchCtx.brandDNA.rationale === 'string' ? researchCtx.brandDNA.rationale : researchCtx.brandDNA.rationale.value,
            mood: researchCtx.brandDNA.mood.items,
            colors: validColors,
            fonts: researchCtx.typographyPairings.fonts.filter((f: any) => f.isSelected).map((f: any) => f.name),
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

            const result = await this.nanoBanana.refineVisual(currentSpec, performance, context, snapshot || undefined);

            // 4. Apply Fix
            if (result.confidence > 70) {
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

                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newSpec, null, 4));
                await fs.writeFile(DECISION_PATH, JSON.stringify(result, null, 4));

                console.log("🚀 Applied Forensic Fix! Technical Blueprint Evolved.");
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
    new SpecWatcher().analyzeAndOptimize().catch(console.error);
}
