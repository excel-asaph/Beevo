
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AgentLogger } from '../utils/AgentLogger.js';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

/**
 * Initial PAS (Problem-Agitation-Solution) Generator Agent.
 * 
 * Responsibilities:
 * - analyzes customer pain points from Brand DNA.
 * - Synthesizes empathetic copy using the PAS framework.
 * - Generates visual metaphors via NanoBanana.
 * - Stages the PAS block for the landing page.
 */
export class InitialPASGenerator {
    private nanoBanana: NanoBananaService;
    private workspaceId: string;

    private researchPath: string;
    private outputPath: string;
    private logger: AgentLogger;


    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseBrainPath, 'staging/pas_block_staging.json');
        this.logger = new AgentLogger('PAS Generator', workspaceId, onLog);
    }

    /**
     * Main execution method.
     * 1. Loads research data.
     * 2. Prepares context with brand mission and pain points.
     * 3. Calls NanoBanana to generate PAS copy and visuals.
     * 4. Assembles the PAS component.
     * 5. Stages the result.
     */
    async generate() {
        this.logger.start("Generating Case Study", "Analyzing customer pain points for Problem-Agitation-Solution framework...");
        this.logger.info("Reading Research", "Identifying core agitation triggers from brand DNA...");

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
            imagery: research.brandDNA.imagerySuggestions?.items?.filter((i: any) => i.isSelected) || []
        };

        // 3. Request PAS from NanoBanana
        this.logger.info("Drafting Story", "Synthesizing empathetic copy and visual metaphors via NanoBanana...");
        const generatedData = await this.nanoBanana.generatePASVisual(context);

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
        this.logger.info("Saving", "Writing staged PAS block to file...");
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(config, null, 4));
        this.logger.success("PAS Generation Complete", "Customer empathy block staged correctly.");
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialPASGenerator(workspaceId);
    generator.generate()
        .then(() => {
            // console.log("✅ PAS Generation Process Finished.");
            process.exit(0);
        })
        .catch(err => {
            // console.error("❌ PAS Generation Failed:", err);
            process.exit(1);
        });
}
