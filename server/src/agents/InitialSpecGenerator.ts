
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

export class InitialSpecGenerator {
    private nanoBanana: NanoBananaService;
    private workspaceId: string;

    private researchPath: string;
    private outputPath: string;

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseBrainPath, 'staging/spec_block_staging.json');
    }

    async generate() {
        console.log(`🚀 [${this.workspaceId}] Initial Spec Generator: Starting...`);

        // 1. Read Research
        const rawData = await fs.readFile(this.researchPath, 'utf-8');
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
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(config, null, 4));

        console.log(`✅ Staged Spec Block Saved: ${this.outputPath}`);
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialSpecGenerator(workspaceId);
    generator.generate().catch(console.error);
}

