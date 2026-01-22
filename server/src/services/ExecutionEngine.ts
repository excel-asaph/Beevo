import { GoogleGenAI } from '@google/genai';
import { ResearchAgent } from '../agents/ResearchAgent';
import { MODELS } from '../../../shared/constants';
import * as fs from 'fs';
import * as path from 'path';
import {
    BrandDNA,
    CompetitorResearch,
    ColorPalettes,
    TypographyPairings,
    ResearchPhaseObject
} from '../../../shared/types';
import { stateManager } from './StateManager';

// ==========================================
// CALLBACK TYPE FOR STREAMING THOUGHTS
// ==========================================

/**
 * Callback for streaming thoughts in real-time during research.
 * @param stepIndex - The step number (0-4) matching ResearchScreen phases
 * @param nodeId - The node ID for Canvas (identity, competitors, colors, typography, strategy)
 * @param title - Short title for the thought
 * @param reasoning - Detailed reasoning text
 */
export type StreamThoughtCallback = (
    stepIndex: number,
    nodeId: string,
    title: string,
    reasoning: string
) => void;

// ==========================================
// EXECUTION ENGINE
// ==========================================

export class ExecutionEngine {
    private genAI: GoogleGenAI;
    private researchAgent: ResearchAgent;
    private artifactsDir: string;

    constructor() {
        this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        this.researchAgent = new ResearchAgent();

        // Ensure artifacts directory exists
        this.artifactsDir = path.join(process.cwd(), 'brain', 'research_artifacts');
        if (!fs.existsSync(this.artifactsDir)) {
            fs.mkdirSync(this.artifactsDir, { recursive: true });
        }
    }

    // ==========================================
    // PHASE 1: EXTRACT BRAND DNA
    // ==========================================
    async extractBrandDNA(conversationHistory: string): Promise<BrandDNA> {
        console.log('🔹 Phase 1: Extracting Brand DNA...');

        const prompt = `
        Analyze this conversation history and extract the Brand DNA.
        
        CONVERSATION:
        ${conversationHistory}
        
        CRITICAL INSTRUCTIONS:
        1. ALL FIELDS ARE MANDATORY. Do not return "Unknown" or empty strings.
        2. IF NOT EXPLICIT in the text, you MUST CREATIVELY INFER valid, professional values based on the context.
        3. For 'tagline', if none exists, generate a catchy, short tagline fitting the brand.
        4. For 'name', if not totally clear, infer the most likely name or use a placeholder like "New Brand".
        
        EXTRACT THE FOLLOWING AS JSON:
        - name: Brand name 
        - mission: Mission statement
        - voice: Brand voice/personality
        - values: List of core values (min 3)
        - tagline: Brand tagline (catchy slogan)
        - industry: Specific industry/niche
        - targetAudience: LIST of target demographics/personas
        - mood: LIST of mood keywords (e.g. ['modern', 'minimalist'])
        - paletteCount: Number of palettes requested (default 3)
        - rationale: Brief Strategic Rationale (1-2 sentences) explaining WHY these values fit the brand info provided.
        
        Return ONLY valid JSON.
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const extracted = JSON.parse(text);

        // Helper to wrap single values
        const toSelectable = (val: string) => ({ value: val || '', isSelected: true });
        // Helper to wrap array values
        const toSelectableArray = (vals: string[]) => ({ items: Array.isArray(vals) ? vals : [], isSelected: true });

        // Map and validate defaults
        const dna: BrandDNA = {
            name: toSelectable(extracted.name || 'Untitled Brand'),
            mission: toSelectable(extracted.mission || 'To define'),

            voice: toSelectable(extracted.voice || 'Professional'),
            values: toSelectableArray(extracted.values),
            tagline: toSelectable(extracted.tagline || 'Building the future'),
            industry: toSelectable(extracted.industry || 'General Business'),
            targetAudience: toSelectableArray(extracted.targetAudience || ['General public']),
            mood: toSelectableArray(extracted.mood || ['Modern']),
            paletteCount: extracted.paletteCount || 3,
            rationale: extracted.rationale || 'Extracted from conversation analysis.',

            // Legacy/Optional initializations
            designGoals: '',
            logoType: '',
            imagery: ''
            // Removed: logoInspiration, logoUsageContexts, competitorInsights, researchInsights, logoAssets
            // to ensure strict adherence to file schema.
        };

        return dna;
    }

    // ==========================================
    // PHASE 2: RESEARCH COMPETITORS
    // ==========================================
    async researchCompetitors(dna: BrandDNA): Promise<CompetitorResearch> {
        const industry = dna.industry?.value || 'General';
        const context = `${dna.name.value} - ${dna.mission.value}`;

        console.log(`🔹 Phase 2: Researching competitors for ${dna.name.value} in ${industry}...`);

        // Use the existing ResearchAgent logic
        const agentResult = await this.researchAgent.researchCompetitors(
            industry,
            context
        );

        return {
            competitors: agentResult.competitors.map(c => ({ ...c, description: c.description || '' })),
            differentiationOpportunity: agentResult.differentiationOpportunity,
            competitorBranding: agentResult.competitorBranding,
            rationale: agentResult.differentiationOpportunity // Use differentiation as the main rationale
        };
    }

    // ==========================================
    // PHASE 3: GENERATE COLORS
    // ==========================================
    // ==========================================
    // PHASE 3: GENERATE COLORS
    // ==========================================
    async generateColorPalettes(
        dna: BrandDNA,
        competitors?: CompetitorResearch,
        count: number = 3,
        mood?: string
    ): Promise<ColorPalettes> {
        console.log(`🔹 Phase 3: Generating ${count} color palettes...`);

        const differentiationContext = competitors
            ? `Differentiation Opportunity: ${competitors.differentiationOpportunity}
               COMPETITORS TO AVOID:
               ${competitors.competitorBranding.map(c => `- ${c.primaryColor}, ${c.secondaryColor}`).join('\n')}`
            : 'Focus on unique brand identity.';

        const prompt = `
        Generate ${count} distinct color palettes for a brand.
        
        BRAND CONTEXT:
        Name: ${dna.name.value}
        Industry: ${dna.industry?.value}
        Mood: ${mood || dna.mood?.items.join(', ')}
        ${differentiationContext}
        
        OUTPUT FORMAT (JSON):
        {
            "palettes": [
                { "name": "Creative Name", "colors": ["#hex", "#hex", ...], "vibe": "Detailed description of the vibe and psychology" }
            ],
            "rationale": "Overall explanation of how these palettes serve the brand strategy."
        }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{"palettes": []}';
        const result = JSON.parse(text);

        // Return raw palettes (IDs handled by ToolHandler), but initialized selection
        const palettes = (result.palettes || []).map((p: any) => ({
            ...p,
            isSelected: false
        }));
        return { palettes, rationale: result.rationale };
    }

    // ==========================================
    // PHASE 4: GENERATE TYPOGRAPHY
    // ==========================================
    async generateTypography(
        dna: BrandDNA,
        count: number = 3,
        style?: string
    ): Promise<TypographyPairings> {
        console.log(`🔹 Phase 4: Generating ${count} typography pairings...`);

        const prompt = `
        Recommend ${count} distinct Google Font pairings for this brand.
        
        BRAND CONTEXT:
        Name: ${dna.name.value}
        Industry: ${dna.industry?.value}
        Voice: ${dna.voice.value}
        Mood/Style: ${style || dna.mood?.items.join(', ')}
        
        OUTPUT FORMAT (JSON):
        {
            "fonts": [
                { 
                    "name": "Primary Font", 
                    "category": "serif/sans-serif", 
                    "pairing": "Secondary Font", 
                    "reasoning": "Detailed explanation of why this pair fits the brand personality" 
                }
            ],
            "rationale": "Strategic explanation of how these typography choices align with the brand voice and industry standards."
        }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{"fonts": []}';
        const result = JSON.parse(text);

        // Return raw fonts (IDs handled by ToolHandler), but initialized selection
        const fonts = (result.fonts || []).map((f: any) => ({
            ...f,
            isSelected: false
        }));
        return { fonts, rationale: result.rationale };
    }

    // ==========================================
    // PHASE 5: FINALIZATION
    // ==========================================
    async finalizeResearch(
        dna: BrandDNA,
        competitors: CompetitorResearch,
        palettes: ColorPalettes,
        fonts: TypographyPairings
    ): Promise<ResearchPhaseObject> {
        console.log('🔹 Phase 5: Finalizing research...');

        // GENERATE VERBOSE SUMMARY
        const summaryPrompt = `
        Write a verbose, professional executive summary (approx 150 words) for this brand research report.
        
        BRAND: ${dna.name.value}
        MISSION: ${dna.mission.value}
        INDUSTRY: ${dna.industry?.value}
        COMPETITORS: ${competitors.competitors.length} found
        STRATEGY: ${competitors.differentiationOpportunity}
        PALETTES: ${palettes.palettes.length} generated
        FONTS: ${fonts.fonts.length} pairs selected
        
        The summary should sound like a high-end agency report. 
        Focus on the strategic direction and the visual identity logic.
        Do not use markdown. Just plain text.
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
        });

        const summary = response.candidates?.[0]?.content?.parts?.[0]?.text || `Research complete for ${dna.name.value}. Found ${competitors.competitors.length} competitors.`;

        const finalObject: ResearchPhaseObject = {
            brandDNA: dna,
            competitorResearch: competitors,
            colorPalettes: palettes,
            typographyPairings: fonts,
            summary,
            timestamp: new Date().toISOString(),
            stateVersion: 1 // Initial version for new research
        };

        // Use StateManager for persistence with version history
        await stateManager.saveFullState(finalObject);

        console.log(`✅ Research saved with StateManager`);

        return finalObject;
    }

    // ==========================================
    // MAIN ENTRY POINT
    // ==========================================

    async runFullResearchCycle(
        conversationHistory: string,
        onStreamThought?: StreamThoughtCallback
    ): Promise<ResearchPhaseObject> {

        // Helper for smooth streaming delays
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const DELAY_MS = 400; // 400ms between thoughts for smooth streaming

        // =========================================
        // PHASE 1: DNA EXTRACTION
        // =========================================
        onStreamThought?.(0, 'identity', 'Analyzing Brand Vision', 'Extracting brand essence from conversation...');
        await sleep(DELAY_MS);

        const dna = await this.extractBrandDNA(conversationHistory);

        onStreamThought?.(0, 'identity', 'Brand Identity Defined', `Identified "${dna.name.value}" in ${dna.industry?.value}`);
        await sleep(DELAY_MS);

        onStreamThought?.(0, 'identity', 'Core Values', `Values: ${dna.values.items.slice(0, 3).join(', ')}`);
        await sleep(DELAY_MS);

        if (dna.rationale) {
            onStreamThought?.(0, 'identity', 'Strategic Insight', dna.rationale);
            await sleep(DELAY_MS);
        }

        // =========================================
        // PHASE 2: COMPETITOR RESEARCH
        // =========================================
        onStreamThought?.(1, 'competitors', 'Market Research', `Searching for ${dna.industry?.value} competitors...`);
        await sleep(DELAY_MS);

        const competitors = await this.researchCompetitors(dna);

        // Stream each competitor found with delay
        for (const comp of competitors.competitors.slice(0, 5)) {
            onStreamThought?.(1, 'competitors', 'Found Competitor', `${comp.name} (${comp.domain})`);
            await sleep(DELAY_MS);
        }

        // Stream the differentiation strategy
        if (competitors.differentiationOpportunity) {
            onStreamThought?.(1, 'competitors', 'Differentiation Strategy', competitors.differentiationOpportunity.slice(0, 150));
            await sleep(DELAY_MS);
        }

        // =========================================
        // PHASE 3: COLOR GENERATION
        // =========================================
        onStreamThought?.(2, 'colors', 'Color Strategy', 'Designing palettes that differentiate from competitors...');
        await sleep(DELAY_MS);

        const palettes = await this.generateColorPalettes(dna, competitors);

        // Stream each palette created with delay
        for (const p of palettes.palettes) {
            onStreamThought?.(2, 'colors', 'Palette Created', `"${p.name}": ${p.vibe?.slice(0, 80) || 'Unique color harmony'}`);
            await sleep(DELAY_MS);
        }

        if (palettes.rationale) {
            onStreamThought?.(2, 'colors', 'Color Psychology', palettes.rationale.slice(0, 150));
            await sleep(DELAY_MS);
        }

        // =========================================
        // PHASE 4: TYPOGRAPHY SELECTION
        // =========================================
        onStreamThought?.(3, 'typography', 'Typography Analysis', `Selecting fonts for ${dna.industry?.value} brand voice...`);
        await sleep(DELAY_MS);

        const fonts = await this.generateTypography(dna);

        // Stream each font pairing with delay
        for (const f of fonts.fonts) {
            onStreamThought?.(3, 'typography', 'Font Pairing', `${f.name} + ${f.pairing}: ${f.reasoning?.slice(0, 60) || 'Professional pairing'}`);
            await sleep(DELAY_MS);
        }

        if (fonts.rationale) {
            onStreamThought?.(3, 'typography', 'Typography Strategy', fonts.rationale.slice(0, 150));
            await sleep(DELAY_MS);
        }

        // =========================================
        // PHASE 5: FINALIZATION
        // =========================================
        onStreamThought?.(4, 'strategy', 'Finalizing', `Compiling brand strategy for ${dna.name.value}...`);
        await sleep(DELAY_MS);

        const result = await this.finalizeResearch(dna, competitors, palettes, fonts);

        onStreamThought?.(4, 'strategy', 'Research Complete', `Brand identity complete: ${dna.name.value}`);

        return result;
    }
}
