
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const METRICS_FILE = path.resolve(__dirname, '../../brain/metrics/hero_metrics.json');
const CHALLENGER_FILE = path.resolve(__dirname, '../../../client/public/assets/hero_block_challenger.json');
const RESEARCH_FILE = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const VIDEO_FILE = path.resolve(__dirname, '../../../client/public/assets/veo_video_hero_challenger.mp4');

// Models
const WATCHER_MODEL = 'gemini-3-flash-preview'; // As requested by user

puppeteer.use(StealthPlugin());

export class HeroWatcher {
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }

    async captureSnapshot(): Promise<Buffer | null> {
        console.log("📸 Watcher: Capturing live snapshot...");
        let browser;
        try {
            browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1440, height: 900 });
            await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
            await page.waitForSelector('[data-component="hero-block"]', { timeout: 5000 });
            const screenshot = await page.screenshot({ encoding: 'binary' });
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

        // 2. Validate Data
        if (!data || (data.views || 0) < 10) {
            console.log(`🕵️ Watcher: Not enough data for ${activeVariantId}. Views: ${data?.views || 0}`);
            return;
        }

        const views = data.views;
        const clicks = data.clicks || 0;
        const retention = data.retention_count || 0;
        const ctr = (clicks / views) * 100;
        const retentionRate = (retention / views) * 100;

        console.log(`📊 PERF: CTR=${ctr.toFixed(1)}% | RET=${retentionRate.toFixed(1)}%`);

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
            Video Prompt: "${currentHero.content?.video_prompt}"
            
            **TASK (Deep Think)**:
            1. **Search**: Search for "${researchCtx.industry || 'Modern'} high converting hero sections" to find benchmarks.
            2. **Analyze**: Look at the Snapshot and Video. Why are users failing to click or stay?
            3. **Diagnose**: 
               - If CTR < 25%: Fix the Headline/CTA.
               - If Retention < 40%: Fix the Video (it's boring/irrelevant).
            4. **Mutate**: Propose a Specfic Fix.
            
            **OUTPUT JSON**:
            {
                "thoughts": "Your analysis...",
                "fix_type": "VIDEO" | "COPY" | "VISUAL",
                "changes": {
                    "headline": "New Headline",
                    "subhead": "New Subhead",
                    "cta_text": "New CTA",
                    "video_prompt": "Refined Video Prompt"
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
                    tools: [{ googleSearch: {} }], // Live Grounding
                    responseMimeType: "application/json"
                }
            });

            const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const optimization = JSON.parse(responseText);

            console.log("\n🧠 WATCHER DIAGNOSIS:\n", optimization.thoughts);
            console.log("\n💡 PROPOSED FIX:", optimization.changes);

            // 6. Apply Decision
            if (optimization.confidence > 70) {
                const newHero = {
                    ...currentHero,
                    variant_id: `hero_v${Date.now()}`,
                    content: {
                        ...currentHero.content,
                        headline: optimization.changes.headline,
                        subhead: optimization.changes.subhead,
                        cta: { ...currentHero.content.cta, text: optimization.changes.cta_text },
                        video_prompt: optimization.changes.video_prompt
                    }
                };
                await fs.writeFile(CHALLENGER_FILE, JSON.stringify(newHero, null, 4));
                console.log("🚀 Applied Fix! New Challenger Deployed.");
            } else {
                console.log("⚠️ Confidence too low. No changes made.");
            }

        } catch (error) {
            console.error("❌ Watcher Error:", error);
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new HeroWatcher().analyzeAndOptimize().catch(console.error);
}
