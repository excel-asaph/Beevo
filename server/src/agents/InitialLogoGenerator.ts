import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MODELS } from '../../../shared/constants';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Paths
// Paths - Resolved relative to this file (server/src/agents)
const RESEARCH_PATH = path.resolve(__dirname, '../../brain/research_artifacts/complete_research_latest.json');
const OUTPUT_PATH = path.resolve(__dirname, '../../../client/public/assets/logo_kit_challenger.json');
const INSPIRATION_DIR = path.resolve(__dirname, '../../../client/public/assets/logo_inspiration');
const GENERATED_DIR = path.resolve(__dirname, '../../../client/public/assets/generated_logos');

export class InitialLogoGenerator {
    private client: GoogleGenAI;
    private modelName = MODELS.FORGE_IMAGE;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env.local");
        this.client = new GoogleGenAI({ apiKey });
    }

    async generate(additionalContext?: string) {
        console.log("🚀 Starting Logo Generator...");
        const rawData = await fs.readFile(RESEARCH_PATH, 'utf-8');
        const research = JSON.parse(rawData);

        // 1. Process Inspirations
        await fs.mkdir(INSPIRATION_DIR, { recursive: true });
        const selectedInspirations = research.logoInspirations.inspirations.filter((i: any) => i.isSelected);
        const inspirationParts: any[] = [];

        console.log(`📂 Processing ${selectedInspirations.length} inspiration images...`);
        for (const [index, insp] of selectedInspirations.entries()) {
            if (insp.url.startsWith('data:image')) {
                const matches = insp.url.match(/^data:image\/([a-zA-Z]*);base64,([^\"]*)$/);
                if (matches) {
                    const ext = matches[1];
                    const data = matches[2];
                    const buffer = Buffer.from(data, 'base64');
                    // Force inspiration naming convention
                    const filename = `inspiration_${index + 1}.${ext}`;
                    const filePath = path.join(INSPIRATION_DIR, filename);

                    await fs.writeFile(filePath, buffer);
                    console.log(`   - Saved ${filename}`);

                    inspirationParts.push({
                        inlineData: {
                            mimeType: `image/${ext}`,
                            data: data
                        }
                    });
                }
            }
        }

        // 2. Extract Context (FILTERING all selected)
        const selectedPalettes = research.colorPalettes.palettes.filter((p: any) => p.isSelected);
        const selectedFonts = research.typographyPairings.fonts.filter((f: any) => f.isSelected);
        const selectedStructures = research.logoStructures.options.filter((o: any) => o.isSelected);

        // Helper to format list
        const formatList = (items: any[], label: string, formatter: (i: any) => string) =>
            items.length ? `${label}:\n${items.map(i => `  - ${formatter(i)}`).join('\n')}` : '';

        const baseContext = `
            Brand: ${research.brandDNA.name.value}
            Industry: ${research.brandDNA.industry.value}
            Mission: ${research.brandDNA.mission.value}
            Vibe: ${research.brandDNA.mood.items.join(', ')}
            
            ${formatList(selectedPalettes, 'Selected Palettes', p => `${p.name} [${p.colors.join(', ')}] - ${p.vibe}`)}
            ${formatList(selectedFonts, 'Selected Typography', f => `${f.name} (${f.category}) paired with ${f.pairing} - ${f.reasoning}`)}
            ${formatList(selectedStructures, 'Selected Structures', s => `${s.type} - ${s.reasoning}`)}
        `;

        // 3. Setup Generated Directory
        await fs.mkdir(GENERATED_DIR, { recursive: true });
        const generatedPaths: Record<string, string> = {};

        // 4. Generate PRIMARY First (The Anchor)
        console.log(`🎨 Step 1: Generating PRIMARY Logo...`);
        let primaryBase64 = "";

        try {
            let primaryPrompt = `Create the PRIMARY Official Logo. High fidelity, professional, vector-style. 
            Synthesize all the following brand inputs into a cohesive, market-leading design.
            ${baseContext}`;

            if (additionalContext) {
                primaryPrompt += `\n\nUSER OVERRIDE / ADDITIONAL CONTEXT:\n"${additionalContext}"\nPlease prioritize this instruction.`;
            }

            const primaryResponse = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: "You are an expert Logo Designer. Use the attached inspiration images as stylistic guides. " + primaryPrompt },
                        ...inspirationParts
                    ]
                }],
                config: {
                    // @ts-ignore
                    imageConfig: { aspectRatio: "1:1", numberOfImages: 1 }
                }
            });

            const parts = primaryResponse.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find((p: any) => p.inlineData);

            if (imagePart && imagePart.inlineData) {
                primaryBase64 = imagePart.inlineData.data || '';
                const buffer = Buffer.from(primaryBase64, 'base64');
                const filename = `logo_variant_primary.png`;
                await fs.writeFile(path.join(GENERATED_DIR, filename), buffer);
                generatedPaths['primary'] = `/assets/generated_logos/${filename}`;
                console.log(`   ✅ Primary Generated & Saved to ${filename}`);
            } else {
                throw new Error("No image returned for Primary Logo");
            }
        } catch (e) {
            console.error("❌ Critical: Primary Generation Failed", e);
            return; // Cannot proceed without primary
        }

        // 5. Generate Variations based on PRIMARY
        const variationMap = [
            { key: 'inverted', prompt: "Create a Dark Mode / Inverted version of this logo. White/Light on dark background. Keep shape identical." },
            { key: 'icon', prompt: "Create an App Icon / Favicon based on this logo. Isolate the symbol/mark. High legibility. No text." },
            { key: 'icon_inverted', prompt: "Create a Dark Mode / Inverted App Icon. White symbol on dark background. No text." },
            { key: 'wordmark', prompt: "Create a Wordmark / Logotype version. Focus on the brand name typography. Clean, modern." },
            { key: 'wordmark_inverted', prompt: "Create a Dark Mode / Inverted Wordmark. White typography on dark background." },
            { key: 'social', prompt: "Create a Social Media Profile Picture. Center the logo on a brand color background." },
            { key: 'social_inverted', prompt: "Create a Dark Mode Social Profile Picture. Center the white logo on a dark background." }
        ];

        console.log(`🎨 Step 2: Generating ${variationMap.length} Variations...`);

        for (const variant of variationMap) {
            console.log(`   - Generating ${variant.key}...`);
            try {
                const response = await this.client.models.generateContent({
                    model: this.modelName,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: `Based on the attached PRIMARY logo, generate this variation: ${variant.prompt}. Maintain strict brand consistency.` },
                            { inlineData: { mimeType: 'image/png', data: primaryBase64 } }
                        ]
                    }],
                    config: {
                        // @ts-ignore
                        imageConfig: { aspectRatio: "1:1", numberOfImages: 1 }
                    }
                });

                const parts = response.candidates?.[0]?.content?.parts || [];
                const imagePart = parts.find((p: any) => p.inlineData);

                if (imagePart && imagePart.inlineData && imagePart.inlineData.data) {
                    const data = imagePart.inlineData.data;
                    const buffer = Buffer.from(data, 'base64');
                    const filename = `logo_variant_${variant.key}.png`;
                    await fs.writeFile(path.join(GENERATED_DIR, filename), buffer);
                    generatedPaths[variant.key] = `/assets/generated_logos/${filename}`;
                } else {
                    console.warn(`     ⚠️ No image returned for ${variant.key}`);
                    generatedPaths[variant.key] = generatedPaths['primary'] || ''; // Fallback
                }
            } catch (e) {
                console.error(`     ❌ Error generating ${variant.key}:`, e);
                generatedPaths[variant.key] = generatedPaths['primary'] || '';
            }
        }

        const representativePalette = selectedPalettes[0] || { name: 'Unknown', colors: [] };

        const finalKit = {
            primary: generatedPaths.primary,
            inverted: generatedPaths.inverted,
            icon: generatedPaths.icon,
            icon_inverted: generatedPaths.icon_inverted,
            wordmark: generatedPaths.wordmark,
            wordmark_inverted: generatedPaths.wordmark_inverted,
            social: generatedPaths.social,
            social_inverted: generatedPaths.social_inverted
        };

        const finalOutput = {
            metadata: {
                generated_at: new Date().toISOString(),
                brand_name: research.brandDNA.name.value,
                palette_used: representativePalette.name
            },
            kit: finalKit,
            palette: representativePalette,
            brandDNA: research.brandDNA
        };

        await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalOutput, null, 4));
        console.log(`✅ Logo Kit Baked to: ${OUTPUT_PATH}`);
    }

    private getPlaceholder(text: string): string {
        return "https://placehold.co/600x600/0f172a/ffffff?text=" + encodeURIComponent(text);
    }
}

// Auto-run
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const generator = new InitialLogoGenerator();
    generator.generate().catch(console.error);
}
