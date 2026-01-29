import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
const RESEARCH_PATH = path.join(process.cwd(), 'server/brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.join(process.cwd(), 'client/public/assets/proof_block_challenger.json');

// Interfaces
interface BrandResearch {
    brandDNA: {
        name: { value: string };
        voice: { value: string };
        rationale: { value: string } | string;
        mission: { value: string };
        tagline: { value: string };
        mood: { items: string[] };
    };
    colorPalettes: {
        palettes: Array<{ id: string; isSelected: boolean; colors: string[]; name: string }>;
    };
    typographyPairings: {
        fonts: Array<{ id: string; isSelected: boolean; name: string; category: string }>;
    };
    imagery?: {
        suggestions: Array<{ id: string; concept: string; description: string; visualStyle?: string; isSelected: boolean }>;
    };
}

export class InitialProofGenerator {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async generate() {
        console.log("🚀 Initial Proof Generator: Starting...");
        const rawData = await fs.readFile(RESEARCH_PATH, 'utf-8');
        const research: BrandResearch = JSON.parse(rawData);

        // 1. Extract Constraints & Context
        const selectedPalettes = research.colorPalettes.palettes.filter(p => p.isSelected);
        const selectedFonts = research.typographyPairings.fonts.filter(f => f.isSelected);
        const selectedImagery = research.imagery?.suggestions?.filter(s => s.isSelected) || [];

        if (selectedPalettes.length === 0) throw new Error("No Color Palette Selected");

        const rawRationale = research.brandDNA.rationale;
        const rationaleValue = typeof rawRationale === 'string' ? rawRationale : rawRationale.value;

        const context = {
            brandName: research.brandDNA.name.value,
            voice: research.brandDNA.voice.value,
            rationale: rationaleValue,
            mission: research.brandDNA.mission.value,
            tagline: research.brandDNA.tagline.value,
            mood: research.brandDNA.mood.items,
            colors: selectedPalettes.flatMap(p => p.colors),
            fonts: selectedFonts.map(f => f.name),
            imagery: selectedImagery.map(s => ({ concept: s.concept, description: s.description, visualStyle: s.visualStyle }))
        };

        // === INITIALIZE VARIABLE ===
        let challenger: any = {
            id: "proof_section_v1",
            meta: {
                strategy: "Generating initial proof block based on brand DNA and selected imagery.",
                tone: context.voice,
                active_variant: "challenger"
            },
            content: {},
            graphic_config: {},
            styles: {}
        };

        // === STEP 1: GENERATE STRATEGY & CONTENT (Service Call) ===
        console.log("[Step 1] Requesting Trust Visualization from NanoBananaService...");
        const generatedData = await this.nanoBanana.generateProofVisual(context);

        challenger.meta.strategy = generatedData.strategy;
        challenger.meta.selected_imagery_concept = generatedData.selected_imagery_concept;

        challenger.content = {
            headline: generatedData.headline,
            subhead: generatedData.subhead,
            graphic_caption: generatedData.graphic_caption,
            evidence_items: generatedData.evidence_items
        };

        challenger.meta = {
            ...challenger.meta,
            layout_strategy: generatedData.layout_strategy as any
        };

        challenger.graphic_config = {
            type: generatedData.graphic_type,
            primary_color: generatedData.primary_color,
            accent_color: generatedData.accent_color,
            show_labels: true,
            animation_duration: 1.5,
            visual_code: generatedData.visual_code
        };

        challenger.styles = {
            backgroundColor: generatedData.backgroundColor,
            color: generatedData.textColor,
            fontFamily: context.fonts[0] || 'sans-serif'
        };

        // === OUTPUT ===
        console.log("💾 Saving Proof Challenger v1...");
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(challenger, null, 4));
        console.log("✅ Done.");
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialProofGenerator();
    generator.generate().catch(console.error);
}
