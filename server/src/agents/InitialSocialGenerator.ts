
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { AgentLogger } from '../utils/AgentLogger.js';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { MediaService } from '../services/MediaService.js';
import { SocialBlockConfig } from '../../../shared/types.js';
import { MODELS } from '../../../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

/**
 * Initial Social Generator Agent.
 * 
 * Responsibilities:
 * - Generates Social Proof sections specifically focused on user testimonials.
 * - Synthesizes authentic-sounding reviews based on Brand Voice.
 * - Generates human-like avatar images for testimonials using Forge Image models.
 * - Archives generated assets via MediaService.
 * - Stages the Social block.
 */
export class InitialSocialGenerator {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;
    private workspaceId: string;

    private researchPath: string;
    private outputPath: string;
    private assetsDir: string;
    private logger: AgentLogger;

    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseBrainPath, 'staging/social_block_staging.json');
        this.assetsDir = path.join(baseClientPath, 'assets');
        this.logger = new AgentLogger('Social Generator', workspaceId, onLog);
    }

    /**
     * Main execution method.
     * 1. Loads research data.
     * 2. Calls NanoBanana to generate testimonial content.
     * 3. Iterates through testimonials to generate avatar images.
     * 4. Assembles the Social component.
     * 5. Stages the result.
     */
    async generate() {
        this.logger.start("Generating Social Proof", "Synthesizing authentic testimonials and trust signals...");

        // 1. Read Research
        const rawData = await fs.readFile(this.researchPath, 'utf-8');
        const research = JSON.parse(rawData);

        // 2. Prepare Context
        const selectedPalettes = research.colorPalettes.palettes.filter((p: any) => p.isSelected);
        const validColors = selectedPalettes.flatMap((p: any) => p.colors);
        const selectedFonts = research.typographyPairings.fonts.filter((f: any) => f.isSelected);

        const context = {
            brandName: research.brandDNA.name?.value || "The Brand",
            voice: research.brandDNA.voice?.value || "Professional",
            mission: research.brandDNA.mission.value,
            rationale: typeof research.brandDNA.rationale === 'string' ? research.brandDNA.rationale : research.brandDNA.rationale.value,
            mood: research.brandDNA.mood.items,
            colors: validColors,
            fonts: selectedFonts.map((f: any) => f.name),
            imagery: research.brandDNA.imagerySuggestions?.items?.filter((i: any) => i.isSelected) || []
        };

        // 3. Request Social from NanoBanana
        this.logger.info("Drafting Testimonials", "Synthesizing industry-relevant customer reviews via NanoBanana...");
        const generatedData = await this.nanoBanana.generateSocialVisual(context);

        // 4. Generate Images for Testimonials
        this.logger.info("Baking Headshots", `Generating ${generatedData.testimonials.length} human-like avatars for social proof...`);
        const testimonials = generatedData.testimonials;

        const variantId = `social_v${Date.now()}`;

        for (let i = 0; i < testimonials.length; i++) {
            const t = testimonials[i];
            const imageName = `testimonial_${i + 1}_challenger.png`;
            const imagePath = path.join(this.assetsDir, imageName);

            this.logger.info("Generating Avatar", `Creating headshot for ${t.name}...`);
            // generateImage now returns the relative path from MediaService
            const archivedPath = await this.generateImage(t.image_prompt, imagePath, variantId);
            t.image_url = archivedPath;
        }

        // 5. Transform into SocialBlockConfig
        const challenger: SocialBlockConfig = {
            id: "social_section_v1",
            variant_id: variantId,
            meta: {
                strategy: "Social Proof based on Brand Voice",
                tone: context.voice,
                active_variant: "challenger",
                layout_strategy: generatedData.layout_strategy
            } as any,
            content: {
                headline: generatedData.headline,
                subhead: generatedData.subhead,
                testimonials: testimonials
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

        // 6. Save
        this.logger.info("Saving", "Writing staged Social block to file...");
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(challenger, null, 4));
        this.logger.success("Social Proof Complete", "Authentic testimonial block staged successfully.");
    }

    /**
     * Generates an avatar image for a testimonial.
     * Uses the Forge Image model and archives the result.
     * 
     * @param {string} prompt - The image generation prompt.
     * @param {string} outputPath - The local path (legacy argument, mostly unused now).
     * @param {string} variantId - The variant ID for archiving.
     * @returns {Promise<string>} The relative path to the archived asset.
     */
    private async generateImage(prompt: string, outputPath: string, variantId: string) {
        try {
            this.logger.info("Generating Image", `Requesting Image via generateContent (Model: ${MODELS.FORGE_IMAGE})...`);

            const response = await this.client.models.generateContent({
                model: MODELS.FORGE_IMAGE,
                contents: [{
                    parts: [{ text: `Create a high-quality human-like headshot. ${prompt}. Ensure clear focus and professional lighting.` }]
                }],
                config: {
                    // @ts-ignore - Required for image models in some SDK versions
                    imageConfig: { aspectRatio: "1:1" }
                }
            });

            const parts = response.candidates?.[0]?.content?.parts || [];
            let imageBase64: string | undefined = undefined;

            for (const part of parts) {
                if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                    break;
                }
            }

            if (imageBase64) {
                // CHANGED: Use MediaService to archive timestamped asset
                const mediaService = MediaService.getInstance(this.workspaceId);
                const buffer = Buffer.from(imageBase64, 'base64');

                // We want to return the RELATIVE PATH to the caller so they can put it in the testimonial object
                const filenameBase = `testimonial_${Date.now()}`; // Unique prefix
                const relativePath = await mediaService.archiveAsset(
                    filenameBase,
                    "png",
                    buffer,
                    variantId
                );

                this.logger.success("Image Archived", `Saved via MediaService: ${relativePath}`);
                return relativePath;
            } else {
                throw new Error("No inlineData found in response parts");
            }

        } catch (error) {
            this.logger.error("Avatar Failed", `Headshot generation failed for ${prompt.substring(0, 20)}... Error: ${error}`);
            this.logger.info("Fallback", "Using placeholder for testimonial headshot.");
            return "/assets/placeholders/social_placeholder.png";
        }
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Default workspace for manual CLI run
    const workspaceId = process.argv.find(a => a.startsWith('--workspace='))?.split('=')[1] || 'default';
    const generator = new InitialSocialGenerator(workspaceId);
    generator.generate()
        .then(() => {
            // console.log("✅ Social Generation Process Finished.");
            process.exit(0);
        })
        .catch(err => {
            // console.error("❌ Social Generation Failed:", err);
            process.exit(1);
        });
}

