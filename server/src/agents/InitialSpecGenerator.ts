import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SpecBlockConfig } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
// Paths
const RESEARCH_PATH = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../brain/staging/spec_block_staging.json');

export class InitialSpecGenerator {
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async generate() {
        console.log("🚀 Initial Spec Generator: Starting...");

        // 1. Read Research
        const rawData = await fs.readFile(RESEARCH_PATH, 'utf-8');
        const research = JSON.parse(rawData);

        // 2. Prepare Context
        const selectedPalettes = research.colorPalettes.palettes.filter((p: any) => p.isSelected);
        const validColors = selectedPalettes.flatMap((p: any) => p.colors);
        const selectedFonts = research.typographyPairings.fonts.filter((f: any) => f.isSelected);

        const context = {
            brandName: research.brandDNA.name?.value || "The Brand",
            mission: research.brandDNA.mission.value,
            rationale: typeof research.brandDNA.rationale === 'string' ? research.brandDNA.rationale : research.brandDNA.rationale.value,
            mood: research.brandDNA.mood.items,
            colors: validColors,
            fonts: selectedFonts.map((f: any) => f.name),
            imagery: [] // Not used for blueprint
        };

        // 3. Request Spec from NanoBanana
        console.log("[Step 1] Requesting Interactive Spec Blueprint from NanoBananaService...");
        const generatedData = await this.nanoBanana.generateSpecVisual(context);

        // 4. Transform into SpecBlockConfig
        const variantId = `spec_v${Date.now()}`;
        const config: SpecBlockConfig = {
            id: "spec_section_v1",
            variant_id: variantId,
            meta: {
                strategy: generatedData.strategy,
                tone: research.brandDNA.voice?.value || "Professional",
                active_variant: "challenger",
                layout_strategy: generatedData.layout_strategy
            },
            content: {
                headline: generatedData.headline,
                subhead: generatedData.subhead,
                nodes: generatedData.nodes
            },
            graphic_config: {
                type: 'generative',
                visual_code: generatedData.visual_code
            },
            styles: {
                backgroundColor: generatedData.backgroundColor,
                color: generatedData.textColor,
                fontFamily: context.fonts[0] || 'Inter'
            }
        };

        // 5. Save
        console.log("Saving Staged Spec Block...");
        await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(config, null, 4));

        console.log(`✅ Staged Spec Block Saved: ${OUTPUT_PATH}`);
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialSpecGenerator();
    generator.generate().catch(console.error);
}
