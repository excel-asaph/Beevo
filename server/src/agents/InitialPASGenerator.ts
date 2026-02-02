import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
// Paths
const RESEARCH_PATH = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../brain/staging/pas_block_staging.json');

export class InitialPASGenerator {
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async generate() {
        console.log("🚀 Initial PAS Generator: Starting...");

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
            imagery: research.brandDNA.imagerySuggestions?.items?.filter((i: any) => i.isSelected) || []
        };

        // 3. Request PAS from NanoBanana
        console.log("[Step 1] Requesting PAS Visualization from NanoBananaService...");
        const generatedData = await this.nanoBanana.generatePASVisual(context);

        // 4. Transform into PASBlockConfig
        // 4. Transform into PASBlockConfig
        const variantId = `pas_v${Date.now()}`;
        const config: any = {
            id: "pas_section_v1",
            variant_id: variantId,
            meta: {
                strategy: generatedData.strategy,
                tone: research.brandDNA.voice.value,
                active_variant: "challenger",
                layout_strategy: generatedData.layout_strategy
            },
            content: {
                headline: generatedData.headline,
                steps: generatedData.steps,
                closing_statement: generatedData.closing_statement
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
        console.log("Saving Staged PAS Block...");
        await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(config, null, 4));

        console.log(`✅ Staged PAS Block Saved: ${OUTPUT_PATH}`);
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialPASGenerator();
    generator.generate().catch(console.error);
}
