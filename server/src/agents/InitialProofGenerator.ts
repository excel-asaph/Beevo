
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
    private workspaceId: string;

    private researchPath: string;
    private outputPath: string;

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseBrainPath, 'staging/proof_block_staging.json');
    }

    async generate() {
        console.log(`🚀 [${this.workspaceId}] Initial Proof Generator: Starting...`);
        const rawData = await fs.readFile(this.researchPath, 'utf-8');
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
        const variantId = `proof_v${Date.now()}`;

        let challenger: any = {
            id: "proof_section_v1",
            variant_id: variantId,
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
        console.log("Saving Staged Proof Block...");
        // Ensure staging dir exists
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(challenger, null, 4));
        console.log(`✅ Staged Proof Block Saved: ${this.outputPath}`);
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialProofGenerator(workspaceId);
    generator.generate().catch(console.error);
}

