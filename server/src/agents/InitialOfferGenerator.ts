import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
const RESEARCH_PATH = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../brain/staging/offer_block_staging.json');

export class InitialOfferGenerator {
    async generate() {
        console.log("🚀 InitialOfferGenerator: Basking in the Brand DNA...");

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

        const researchRaw = await fs.readFile(RESEARCH_PATH, 'utf-8');
        const researchCtx = JSON.parse(researchRaw);

        const nanoBanana = new NanoBananaService(apiKey);

        const context = {
            brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
            mission: researchCtx.brandDNA?.mission?.value || "",
            rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
            mood: researchCtx.brandDNA?.mood?.items || [],
            colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
            fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
            imagery: researchCtx.imagery?.suggestions?.filter((i: any) => i.isSelected) || [],
            brandDNA: researchCtx.brandDNA // Pass the full DNA for industry detection
        };

        console.log("🧠 Generating High-Conversion Offer Section...");
        const result = await nanoBanana.generateOfferVisual(context);

        const variantId = `offer_v${Date.now()}`;
        const config = {
            id: 'offer_section_v1',
            variant_id: variantId,
            meta: {
                strategy: result.strategy,
                offer_type: result.offer_type,
                layout_strategy: result.layout_strategy,
                tone: researchCtx.brandDNA?.voice?.value || "Professional",
                industry: researchCtx.brandDNA?.industry?.value || "General"
            },
            content: {
                headline: result.headline,
                subhead: result.subhead,
                tiers: result.tiers,
                guarantee_text: result.guarantee_text
            },
            graphic_config: {
                type: 'generative',
                visual_code: result.visual_code
            },
            styles: {
                backgroundColor: result.backgroundColor || "#000000",
                color: result.textColor || "#FFFFFF",
                fontFamily: context.fonts[0] || "serif",
                accentColor: result.accentColor || "#E29578"
            }
        };

        console.log("Saving Staged Offer Block...");
        await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(config, null, 4));

        console.log(`✅ Staged Offer Block Saved: ${OUTPUT_PATH}`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    new InitialOfferGenerator().generate().catch(console.error);
}
