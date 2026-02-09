import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MODELS } from '../../../shared/constants';
import dotenv from 'dotenv';
import { AgentLogger } from '../utils/AgentLogger.js';
import { WorkspaceManager } from '../services/StateManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

/**
 * Initial Logo Generator Agent
 * 
 * Responsibilities:
 * - Generates a complete Logo Kit based on Brand Research.
 * - Creates a Primary Logo Anchor.
 * - Derives variations: Dark Mode, Icon, Wordmark, and Social Profile.
 * - Processes and utilizes inspiration images.
 * - Persists the generated kit to the assets directory.
 */
export class InitialLogoGenerator {
    private client: GoogleGenAI;
    private modelName = MODELS.FORGE_IMAGE;
    private workspaceId: string;

    // Dynamic Paths
    private researchPath: string;
    private outputPath: string;
    private inspirationDir: string;
    private generatedDir: string;
    private logger: AgentLogger;

    constructor(workspaceId: string, onLog?: (log: any) => void) {
        this.workspaceId = workspaceId;
        this.logger = new AgentLogger('Logo Generator', workspaceId, onLog);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env.local");
        this.client = new GoogleGenAI({ apiKey });

        // Initialize Dynamic Paths
        const baseBrainPath = path.resolve(__dirname, `../../brain/workspaces/${workspaceId}`);
        const baseClientPath = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}`);

        this.researchPath = path.join(baseBrainPath, 'research_artifacts/complete_research_latest.json');
        this.outputPath = path.join(baseClientPath, 'assets/logo_kit_challenger.json');
        this.inspirationDir = path.join(baseClientPath, 'assets/logo_inspiration');
        this.generatedDir = path.join(baseClientPath, 'assets/generated_logos');
    }

    /**
     * Main execution method.
     * 1. Loads research and processes inspiration images.
     * 2. Generates the Primary Logo.
     * 3. Iteratively generates variations (Icon, Wordmark, etc.) based on the Primary.
     * 4. Saves the final Logo Kit.
     * 
     * @param {string} [additionalContext] - Optional user override instructions.
     */
    async generate(additionalContext?: string) {
        // Log Start
        const startId = `gen-${Date.now()}`;
        // const stateManager = WorkspaceManager.getStateManager(this.workspaceId);

        // PERSISTENCE: Log start of logo generation
        // await stateManager.appendThought({
        //     id: startId,
        //     stepIndex: 5, // Use 5 for "System/Manual" actions
        //     nodeId: 'logo-generator',
        //     title: 'Generating Logos',
        //     content: `Started logo generation process.${additionalContext ? ` Context: ${additionalContext}` : ''}`,
        //     timestamp: new Date().toISOString()
        // });

        this.logger.start("Starting Logo Generation", "Designing the brand anchor and stylistic variants...");

        // Ensure directories exist
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.mkdir(this.inspirationDir, { recursive: true });
        await fs.mkdir(this.generatedDir, { recursive: true });

        const rawData = await fs.readFile(this.researchPath, 'utf-8');
        const research = JSON.parse(rawData);

        // Safety check for critical path
        if (!research.brandDNA?.name?.value) {
            this.logger.error("Missing Data", "CRITICAL: Missing Brand Name in research data");
            throw new Error("Missing Brand Name in research data");
        }

        // 1. Process Inspirations
        const selectedInspirations = research.logoInspirations?.inspirations?.filter((i: any) => i.isSelected) || [];
        const inspirationParts: any[] = [];

        this.logger.info("Processing Inspirations", `Processing ${selectedInspirations.length} inspiration images...`);
        for (const [index, insp] of selectedInspirations.entries()) {
            if (insp.url.startsWith('data:image')) {
                const matches = insp.url.match(/^data:image\/([a-zA-Z]*);base64,([^\"]*)$/);
                if (matches) {
                    const ext = matches[1];
                    const data = matches[2];
                    const buffer = Buffer.from(data, 'base64');
                    // Force inspiration naming convention
                    const filename = `inspiration_${index + 1}.${ext}`;
                    const filePath = path.join(this.inspirationDir, filename);

                    await fs.writeFile(filePath, buffer);
                    this.logger.info("Saved Inspiration", `Saved ${filename}`);

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
        const selectedPalettes = research.colorPalettes?.palettes?.filter((p: any) => p.isSelected) || [];
        const selectedFonts = research.typographyPairings?.fonts?.filter((f: any) => f.isSelected) || [];
        const selectedStructures = research.logoStructures?.options?.filter((o: any) => o.isSelected) || [];

        // Helper to format list
        const formatList = (items: any[], label: string, formatter: (i: any) => string) =>
            items.length ? `${label}:\n${items.map(i => `  - ${formatter(i)}`).join('\n')}` : '';

        const baseContext = `
            Brand: ${research.brandDNA.name?.value || 'Unknown'}
            Industry: ${research.brandDNA.industry?.value || 'Technology'}
            Mission: ${research.brandDNA.mission?.value || 'Unknown'}
            Values: ${research.brandDNA.values?.items?.join(', ') || ''}
            Target Audience: ${research.brandDNA.targetAudience?.items?.join(', ') || ''}
            Vibe: ${research.brandDNA.mood?.items?.join(', ') || 'Modern'}
            Strategic Rationale: ${research.brandDNA.rationale || ''}
            
            ${formatList(selectedPalettes, 'Selected Palettes', p => `${p.name} [${p.colors.join(', ')}] - ${p.vibe}`)}
            ${formatList(selectedFonts, 'Selected Typography', f => `${f.name} (${f.category}) paired with ${f.pairing} - ${f.reasoning}`)}
            ${formatList(selectedStructures, 'Selected Structures', s => `${s.type} - ${s.reasoning}`)}
        `;

        // 3. Setup Generated Directory
        const generatedPaths: Record<string, string> = {};

        // 4. Generate PRIMARY First (The Anchor)
        this.logger.info("Generating Primary Logo", "Designing the main brand mark...");

        let primaryBase64 = "";

        try {
            let primaryPrompt = `Create the PRIMARY Official Logo. High fidelity, professional, vector-style.`;

            if (additionalContext) {
                console.log(`additionalContext: ${additionalContext}`)
                primaryPrompt += `\n\nCRITICAL USER INSTRUCTION (PRIORITIZE THIS ABOVE ALL ELSE):\n"${additionalContext}"\n`;
                primaryPrompt += `\nIMPORTANT: If the user instruction above conflicts with any of the brand inputs below (e.g. if User asks for an icon but Research says "Wordmark", or if User asks for a car but Research says "Abstract"), YOU MUST FOLLOW THE USER INSTRUCTION IGNORE THE RESEARCH CONSTRAINT. The User Instruction is the absolute truth.\n`;
            }

            primaryPrompt += `\nSynthesize all the following brand inputs into a cohesive, market-leading design (subject to the override above).\n${baseContext}`;

            const primaryResponse = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{
                    role: 'user',
                    parts: [
                        { text: "You are an expert Logo Designer. Use the attached inspiration images as stylistic guides BUT prioritize the textual instructions below.\n\n" + primaryPrompt },
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
                await fs.writeFile(path.join(this.generatedDir, filename), buffer);
                generatedPaths['primary'] = `/workspaces/${this.workspaceId}/assets/generated_logos/${filename}`;
                this.logger.success("Primary Logo Created", `Official brand mark synthesized successfully: ${filename}`);

            } else {
                throw new Error("No image returned for Primary Logo");
            }
        } catch (e) {
            this.logger.error("Primary Generation Failed", e instanceof Error ? e.message : String(e));
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

        this.logger.info(`Generating Variations`, `Creating ${variationMap.length} brand variants (Dark Mode, Icon, Wordmark)...`);

        for (const variant of variationMap) {

            // Send info update (streaming thought)
            this.logger.info("Designing Variant", `Crafting ${variant.key} variant...`);

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
                    await fs.writeFile(path.join(this.generatedDir, filename), buffer);
                    generatedPaths[variant.key] = `/workspaces/${this.workspaceId}/assets/generated_logos/${filename}`;
                } else {
                    this.logger.info("Variation Skipped", `No image returned for ${variant.key}`);
                    generatedPaths[variant.key] = generatedPaths['primary'] || ''; // Fallback
                }
            } catch (e) {
                this.logger.error("Variation Failed", `Error generating ${variant.key}: ${e}`);
                generatedPaths[variant.key] = generatedPaths['primary'] || '';
            }
        }

        this.logger.success("Variations Complete", `Generated ${variationMap.length} variations.`);

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

        await fs.writeFile(this.outputPath, JSON.stringify(finalOutput, null, 4));
        this.logger.success("Logo Kit Baked", `Final logo kit saved to: ${this.outputPath}`);

        // PERSISTENCE: Log completion
        // await stateManager.appendThought({
        //     id: `gen-complete-${Date.now()}`,
        //     stepIndex: 5,
        //     nodeId: 'logo-generator',
        //     title: 'Logo Generation Complete',
        //     content: `Successfully generated primary logo and ${variationMap.length} variations.`,
        //     timestamp: new Date().toISOString()
        // });
    }

    private getPlaceholder(text: string): string {
        return "https://placehold.co/600x600/0f172a/ffffff?text=" + encodeURIComponent(text);
    }
}

// Auto-run
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Get workspace from args or default
    const arg = process.argv.find(a => a.startsWith('--workspace='));
    const workspaceId = arg ? arg.split('=')[1] : 'default';

    const generator = new InitialLogoGenerator(workspaceId);
    generator.generate().catch(console.error);
}
