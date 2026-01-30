import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { MODELS } from '../../../shared/constants.js';
import { MediaService } from '../services/MediaService.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
const RESEARCH_PATH = path.join(process.cwd(), 'server/brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.join(process.cwd(), 'server/brain/staging/hero_block_staging.json');

// Interfaces
interface BrandResearch {
    brandDNA: {
        voice: { value: string };
        rationale: { value: string } | string; // Handle both formats
        mission: { value: string };
        tagline: { value: string };
        mood: { items: string[] };
    };
    colorPalettes: {
        palettes: Array<{ id: string; isSelected: boolean; colors: string[] }>;
    };
    typographyPairings: {
        fonts: Array<{ id: string; isSelected: boolean; name: string; category: string }>;
    };
}

export class InitialHeroGenerator {
    private client: GoogleGenAI;
    private modelName = MODELS.ARCHITECT_TEXT;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        this.client = new GoogleGenAI({ apiKey });
    }

    async generate() {
        console.log("Reading Brand Research...");
        const rawData = await fs.readFile(RESEARCH_PATH, 'utf-8');
        const research: BrandResearch = JSON.parse(rawData);

        // 1. Extract Constraints & Context
        const selectedPalettes = research.colorPalettes.palettes.filter(p => p.isSelected);
        const selectedFonts = research.typographyPairings.fonts.filter(f => f.isSelected);

        if (selectedPalettes.length === 0) throw new Error("No Color Palette Selected");

        // Robust Rationale Extraction
        const rawRationale = research.brandDNA.rationale;
        const rationaleValue = typeof rawRationale === 'string' ? rawRationale : rawRationale.value;

        // Flatten colors from all selected palettes
        const validColors = selectedPalettes.flatMap(p => p.colors);

        const context = {
            voice: research.brandDNA.voice.value,
            rationale: rationaleValue,
            mission: research.brandDNA.mission.value,
            tagline: research.brandDNA.tagline.value,
            mood: research.brandDNA.mood.items,
            colors: validColors,
            fonts: selectedFonts.map(f => f.name)
        };
        console.log("DEBUG CONTEXT RATIONALE:", context.rationale);

        // === INITIALIZE VARIABLE (The Challenger) ===
        // Define variant ID early for folder organization
        const variantId = `hero_v${Date.now()}`;

        // 2. Meta Injection (Direct Copy)
        let challenger: any = {
            id: "hero_section_v1",
            variant_id: variantId, // ADDED: Consistent variant ID
            meta: {
                strategy: context.rationale,
                tone: context.voice,
                active_variant: "challenger"
            },
            visual_asset: {},
            overlay_content: {},
            layout_config: {}
        };
        console.log(`[Step 1] Meta Attributes Injected. Variant ID: ${variantId}`);


        // === STEP 2: VIDEO GENERATION (Real AI Call) ===
        console.log("[Step 2] Thinking about Video Attributes...");
        const videoAttributes = await this.generateVideoAttributes(context);

        // === STEP 2.5: GENERATE ACTUAL VIDEO FILE (Veo) ===
        console.log("[Step 2.5] Requesting Video from Veo AI...");
        // Pass variantId to generateVideoAsset
        const videoSourceId = await this.generateVideoAsset(videoAttributes, variantId);

        challenger.visual_asset = {
            type: "video",
            url: videoSourceId,
            source_id: "generated_veo_asset",
            prompt_signature: videoAttributes.prompt_signature,
            attributes: {
                lighting: videoAttributes.lighting,
                camera_movement: videoAttributes.camera_movement,
                subject_focus: videoAttributes.subject_focus,
                color_grade: videoAttributes.color_grade
            }
        };


        // === STEP 3: OVERLAY CONTENT (Real AI Call) ===
        console.log("[Step 3] Drafting Overlay Content...");
        const overlayData = await this.generateOverlayContent(context);

        challenger.overlay_content = {
            headline: {
                text: overlayData.headline.text,
                styles: {
                    color: overlayData.headline.color,
                    fontFamily: overlayData.headline.font,
                    fontSize: overlayData.headline.size,
                    fontWeight: overlayData.headline.weight,
                    textShadow: overlayData.headline.shadow
                }
            },
            subhead: {
                text: overlayData.subhead.text,
                styles: {
                    color: overlayData.subhead.color,
                    fontFamily: overlayData.subhead.font,
                    fontSize: overlayData.subhead.size,
                    marginTop: "1rem"
                }
            },
            cta: {
                text: overlayData.cta.text,
                action_id: "scroll_to_offer",
                styles: {
                    backgroundColor: overlayData.cta.bgColor,
                    color: overlayData.cta.color,
                    fontFamily: overlayData.cta.font,
                    padding: "12px 24px",
                    borderRadius: "4px"
                }
            }
        };


        // === STEP 4: LAYOUT CONFIG (Fixed Injection) ===
        // Standard centering template. No AI here.
        challenger.layout_config = {
            container_styles: {
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center",
                padding: "40px"
            },
            overlay_gradient: "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))"
        };
        console.log("[Step 4] Layout Template Injected.");


        // === OUTPUT ===
        console.log("Saving Staged Hero Block...");
        await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
        await fs.writeFile(OUTPUT_PATH, JSON.stringify(challenger, null, 4));
        console.log("Done.");
    }


    private async generateVideoAsset(attributes: any, variantId: string) {
        console.log("🎥 Connecting to Veo...");

        const veoPrompt = `
        Cinematic 4K video.
        Description: ${attributes.prompt_signature}
        Lighting: ${attributes.lighting}.
        Movement: ${attributes.camera_movement}.
        Focus: ${attributes.subject_focus}.
        Color: ${attributes.color_grade}.
        `;

        try {
            console.log("...Submitting Operation");
            // 1. Submit Generation Request
            // @ts-ignore - The SDK types might lag behind the bleeding edge methods
            let operation = await this.client.models.generateVideos({
                model: MODELS.FORGE_VIDEO_HQ,
                prompt: veoPrompt,
                config: {
                    aspectRatio: '16:9', // Optional but good for Hero
                }
            });

            console.log(`...Operation Started: ${operation.name || 'Unknown ID'}`);

            // 2. Poll for Completion
            while (!operation.done) {
                console.log("...Generating (Waiting 5s)...")
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // @ts-ignore
                operation = await this.client.operations.getVideosOperation({
                    operation: operation,
                });
            }

            console.log("...Generation Complete. Downloading...");

            // 3. Download Result
            const videos = operation.response?.generatedVideos;
            if (!videos || !videos.length) {
                throw new Error("No videos returned in operation response.");
            }

            // 4. Archive using MediaService 
            // Assuming import is added at top
            const mediaService = MediaService.getInstance();

            // Use specialized helper for direct Gemini download -> History
            const relativePath = await mediaService.archiveGeminiFile(
                this.client,
                videos[0].video!.uri || "", // Pass empty string if undefined (should not happen if video exists)
                "hero_video",
                "mp4",
                variantId // PASS VARIANT ID
            );

            console.log(`✅ Video Archived via MediaService: ${relativePath}`);
            return relativePath; // Returns /assets/history/[variant_id]/hero_video_timestamp.mp4

        } catch (error) {
            console.error("❌ Veo Generation Failed:", error);
            console.warn("Using placeholder video due to generation error.");
            return "/assets/placeholders/hero_placeholder.mp4"; // Ensure fallback exists or use a robust default
        }
    }

    // Call this in generate()
    /* 
       // === STEP 2.5: GENERATE ACTUAL VIDEO FILE ===
       console.log("[Step 2.5] Generating Video File with Veo...");
       await this.generateVideoAsset(videoAttributes);
    */

    private async generateVideoAttributes(context: any) {
        const prompt = `
        You are an expert Video Director.
        BRAND CONTEXT:
        - Mood: ${context.mood.join(', ')}
        - Tone: ${context.voice}
        - Strategy: ${context.rationale}
        - Valid Colors for Color Grade: ${JSON.stringify(context.colors)}

        TASK: Generate 5 video attributes for a high-end commercial.
        1. prompt_signature: Detailed description for a 4s video generation model.
        2. lighting: Cinematic lighting style.
        3. camera_movement: Camera motion.
        4. subject_focus: Main subject.
        5. color_grade: Pick ONE hex code from the Valid Colors provided to set the tint.

        Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt_signature: { type: Type.STRING },
                        lighting: { type: Type.STRING },
                        camera_movement: { type: Type.STRING },
                        subject_focus: { type: Type.STRING },
                        color_grade: { type: Type.STRING, description: "Must be one of the hex codes provided in context." }
                    },
                    required: ["prompt_signature", "lighting", "camera_movement", "subject_focus", "color_grade"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Failed to generate video attributes");
        return JSON.parse(text);
    }

    private async generateOverlayContent(context: any) {
        const prompt = `
        You are an expert UI Copywriter and Designer.
        BRAND CONTEXT:
        - Tagline: ${context.tagline}
        - Mission: ${context.mission}
        - Rationale: ${context.rationale}
        - Valid Colors: ${JSON.stringify(context.colors)}
        - Valid Fonts: ${JSON.stringify(context.fonts)}

        TASK: Generate copy and select styles from the valid lists.
        1. Headline: 3-5 word robust headline. Pick Font & Color (High Contrast).
        2. Subhead: Supporting sentence. Pick Font & Color.
        3. CTA: Action button text. Pick Background Color & Text Color.

        Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        headline: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                font: { type: Type.STRING },
                                color: { type: Type.STRING },
                                size: { type: Type.STRING, enum: ["3rem", "4rem", "5rem"] },
                                weight: { type: Type.STRING },
                                shadow: { type: Type.STRING }
                            },
                            required: ["text", "font", "color", "size", "weight", "shadow"]
                        },
                        subhead: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                font: { type: Type.STRING },
                                color: { type: Type.STRING },
                                size: { type: Type.STRING }
                            },
                            required: ["text", "font", "color", "size"]
                        },
                        cta: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                font: { type: Type.STRING },
                                bgColor: { type: Type.STRING },
                                color: { type: Type.STRING }
                            },
                            required: ["text", "font", "bgColor", "color"]
                        }
                    },
                    required: ["headline", "subhead", "cta"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Failed to generate overlay content");
        return JSON.parse(text);
    }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialHeroGenerator();
    generator.generate().catch(console.error);
}
