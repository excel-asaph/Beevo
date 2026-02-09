
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { AgentLogger } from '../utils/AgentLogger.js';
import { NanoBananaService } from '../services/NanoBananaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

/**
 * Initial Offer Generator Agent
 * 
 * Responsibilities:
 * - Generates the initial Offer Section based on Brand Research.
 * - Crafts pricing tiers, guarantees, and headlines.
 * - Uses NanoBanana service for high-level strategy and visual coding.
 * - Stages the generated offer block.
 */
export class InitialOfferGenerator {
    private nanoBanana: NanoBananaService;
    private workspaceId: string;

    private researchPath: string;
    private outputPath: string;
    private logger: AgentLogger;

    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseBrainPath, 'staging/offer_block_staging.json');
        this.logger = new AgentLogger('Offer Generator', workspaceId, onLog);
    }

    /**
     * Main execution method.
     * 1. Loads research data.
     * 2. Calls NanoBanana to generate offer strategy and visuals.
     * 3. Assembles the offer component.
     * 4. Stages the result.
     */
    async generate() {
        this.logger.start("Generating Offers", "Analyzing brand value proposition and crafting core offers...");
        this.logger.info("Reading Research", "Parsing brand DNA for industry-specific conversion triggers...");

        const researchRaw = await fs.readFile(this.researchPath, 'utf-8');
        const researchCtx = JSON.parse(researchRaw);

        const context = {
            brandName: researchCtx.brandDNA?.name?.value || "Our Brand",
            mission: researchCtx.brandDNA?.mission?.value || "",
            rationale: researchCtx.brandDNA?.rationale?.value || researchCtx.brandDNA?.rationale || "",
            mood: researchCtx.brandDNA?.mood?.items || [],
            colors: researchCtx.colorPalettes?.palettes?.filter((p: any) => p.isSelected).flatMap((p: any) => p.colors) || [],
            fonts: researchCtx.typographyPairings?.fonts?.filter((f: any) => f.isSelected).map((f: any) => f.name) || [],
            imagery: researchCtx.imagery?.suggestions?.filter((i: any) => i.isSelected) || [],
        };

        this.logger.info("Drafting Offer", "Requesting high-conversion pricing tiers and strategy from NanoBanana...");
        const result = await this.nanoBanana.generateOfferVisual(context);

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

        this.logger.info("Saving", "Writing staged offer block to file...");
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(config, null, 4));
        this.logger.success("Offer Generation Complete", "Final offer tiers and guarantees staged.");
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialOfferGenerator(workspaceId);
    generator.generate()
        .then(() => {
            console.log("✅ Offer Generation Process Finished.");
            process.exit(0);
        })
        .catch(err => {
            console.error("❌ Offer Generation Failed:", err);
            process.exit(1);
        });
}

