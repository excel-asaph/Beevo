
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AgentLogger } from '../utils/AgentLogger.js';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SpecBlockConfig } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

/**
 * Initial Spec Generator Agent.
 * 
 * Responsibilities:
 * - Generates "Technical Specifications" or "Feature Breakdown" sections.
 * - Analyzes Brand Mission to create interactive node maps or feature lists.
 * - Synthesizes technical copy.
 * - Stages the Spec block.
 */
export class InitialSpecGenerator {
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
        this.outputPath = path.join(baseBrainPath, 'staging/spec_block_staging.json');
        this.logger = new AgentLogger('Spec Generator', workspaceId, onLog);
    }

    /**
     * Main execution method.
     * 1. Loads research data.
     * 2. Calls NanoBanana to generate feature blueprint and layout.
     * 3. Assembles the Spec component.
     * 4. Stages the result.
     */
    async generate() {
        this.logger.start("Generating Technical Blueprint", "Analyzing brand mission for functional specifications and interactive node maps...");
        this.logger.info("Reading Research", "Extracting key features and functional mood from brand DNA...");

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
        this.logger.info("Designing Nodes", "Requesting interactive feature blueprint and layout via NanoBanana...");
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
        this.logger.info("Saving Staged Spec Block...", `Writing generated spec to ${this.outputPath}`);
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(config, null, 4));
        this.logger.success("Spec Generation Complete", "Interactive blueprint staged successfully.");
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialSpecGenerator(workspaceId);
    generator.generate()
        .then(() => {
            // console.log("✅ Spec Generation Process Finished.");
            process.exit(0);
        })
        .catch(err => {
            // console.error("❌ Spec Generation Failed:", err);
            process.exit(1);
        });
}

