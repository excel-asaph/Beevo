import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { NanoBananaService } from '../services/NanoBananaService.js';
import { SocialBlockConfig } from '../../../shared/types.js';
import { MODELS } from '../../../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
const RESEARCH_PATH = path.join(process.cwd(), 'server/brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.join(process.cwd(), 'client/public/assets/social_block_challenger.json');
const ASSETS_DIR = path.join(process.cwd(), 'client/public/assets');

export class InitialSocialGenerator {
    private client: GoogleGenAI;
    private nanoBanana: NanoBananaService;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.client = new GoogleGenAI({ apiKey });
        this.nanoBanana = new NanoBananaService(apiKey);
    }

    async generate() {
        console.log("🚀 Initial Social Generator: Starting...");

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

        // 3. Request Social from NanoBanana
        console.log("[Step 1] Requesting Social Visualization from NanoBananaService...");
        const generatedData = await this.nanoBanana.generateSocialVisual(context);

        // 4. Generate Images for Testimonials
        console.log("[Step 2] Generating Human-like Headshots for Testimonials...");
        const testimonials = generatedData.testimonials;

        for (let i = 0; i < testimonials.length; i++) {
            const t = testimonials[i];
            const imageName = `testimonial_${i + 1}_challenger.png`;
            const imagePath = path.join(ASSETS_DIR, imageName);

            console.log(`...Baking Headshot for ${t.name} (${t.title})`);
            await this.generateImage(t.image_prompt, imagePath);
            t.image_url = `/assets/${imageName}`;
        }

        // 5. Transform into SocialBlockConfig
        const challenger: SocialBlockConfig = {
            id: "social_section_v1",
            variant_id: `social_v${Date.now()}`,
            meta: {
                strategy: generatedData.strategy,
                tone: research.brandDNA.voice?.value || "Professional",
                active_variant: "challenger",
                layout_strategy: generatedData.layout_strategy
            },
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
        console.log("💾 Saving Social Challenger v1...");
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(challenger, null, 4));
        console.log("✅ Done.");
    }

    private async generateImage(prompt: string, outputPath: string) {
        try {
            console.log(`🎨 Requesting Image via generateContent (Model: ${MODELS.FORGE_IMAGE})...`);

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
                await fs.writeFile(outputPath, Buffer.from(imageBase64, 'base64'));
                console.log(`✅ Image Saved: ${outputPath}`);
            } else {
                throw new Error("No inlineData found in response parts");
            }

        } catch (error) {
            console.error(`❌ Image generation failed for prompt: ${prompt}`, error);
            console.warn("Using placeholder for testimonial headshot.");
        }
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialSocialGenerator();
    generator.generate().catch(console.error);
}
