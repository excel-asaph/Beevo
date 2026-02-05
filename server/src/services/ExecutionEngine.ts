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
import { WorkspaceManager } from './StateManager';

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
    private workspaceId: string;

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        this.researchAgent = new ResearchAgent();

        // Ensure artifacts directory exists
        this.artifactsDir = path.join(process.cwd(), 'brain', 'workspaces', workspaceId, 'research_artifacts');
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
            rationale: extracted.rationale || 'Extracted from conversation analysis.'
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

        // Return raw palettes initialized with IDs and selection
        // CRITICAL: Assign unique IDs here so they are stable from birth
        const palettes = (result.palettes || []).map((p: any, index: number) => ({
            ...p,
            id: String(index + 1),
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
        const fonts = (result.fonts || []).map((f: any, index: number) => ({
            ...f,
            id: String(index + 1),
            isSelected: false
        }));
        return { fonts, rationale: result.rationale };
    }

    // ==========================================
    // BRAND DNA REFINEMENT (Modification Phase)
    // ==========================================
    async refineBrandField(
        field: string,
        currentContent: string | string[],
        instruction: string
    ): Promise<string | string[]> {
        console.log(`🔹 Refinement: Updating ${field} with instruction: "${instruction}"`);

        const isArray = Array.isArray(currentContent);
        const contentStr = isArray ? (currentContent as string[]).join(', ') : currentContent;

        const prompt = `
        Refine the following Brand Identity element based on the user's instruction.
        
        ELEMENT: ${field}
        CURRENT CONTENT: "${contentStr}"
        USER INSTRUCTION: "${instruction}"
        
        TASK:
        ${isArray
                ? 'Generate a JSON array of strings (["item1", "item2"]) that represents the detailed update.'
                : 'Generate a single string that represents the improved version.'}
        
        CONSTRAINT:
        - Maintain the brand voice.
        - valid JSON output only.
        
        OUTPUT JSON:
        ${isArray ? '{ "items": ["string", "string"] }' : '{ "value": "updated string here" }'}
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        try {
            const json = JSON.parse(text);
            if (isArray) {
                return json.items || currentContent;
            } else {
                return json.value || currentContent;
            }
        } catch (e) {
            console.error("Error parsing refinement response", e);
            return currentContent;
        }
    }

    // ==========================================
    // MODIFICATION PHASE: COLOR PALETTES
    // ==========================================

    // 1. CREATE (Add to existing)
    async createModificationPalettes(
        currentPalettes: any[],
        query: string,
        count: number = 1
    ): Promise<any[]> {
        console.log(`🔹 Mod: Creating ${count} palettes for "${query}"`);
        const prompt = `
        Create ${count} NEW color palettes based on the user's request.
        CONTEXT: Existing palettes are: ${currentPalettes.map(p => p.name).join(', ')}.
        REQUEST: "${query}"
        
        OUTPUT JSON:
        {
            "palettes": [
                { "name": "Creative Name", "colors": ["#hex", "#hex", ...], "vibe": "Description", "isSelected": false }
            ]
        }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const rawPalettes = JSON.parse(text).palettes || [];

        // Assign IDs based on total count
        const startId = currentPalettes.length + 1;
        return rawPalettes.map((p: any, i: number) => ({
            ...p,
            id: String(startId + i),
            isSelected: false
        }));
    }

    // 2. RESOLVE SELECTOR (For Delete/Select/Unselect)
    async resolvePaletteSelector(
        currentPalettes: any[],
        instruction: string
    ): Promise<string[]> {
        console.log(`🔹 Mod: Resolving palette selector for "${instruction}"`);
        const prompt = `
        Identify which palettes match the user's instruction.
        
        PALETTES:
        ${JSON.stringify(currentPalettes.map(p => ({ id: p.id, name: p.name, vibe: p.vibe })))}
        
        INSTRUCTION: "${instruction}"
        
        TASK: Return the IDs of the palettes that the user is referring to.
        OUTPUT JSON: { "ids": ["palette-123", "palette-456"] }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(text).ids || [];
    }

    // 3. REFINE COLORS (Update colors in a palette)
    async refinePaletteColors(
        currentPalette: any,
        instruction: string
    ): Promise<string[]> {
        console.log(`🔹 Mod: Refining colors for ${currentPalette.name} with "${instruction}"`);
        const prompt = `
        Update the colors of this palette based on the instruction.
        
        PALETTE: ${currentPalette.name}
        CURRENT COLORS: ${JSON.stringify(currentPalette.colors)}
        INSTRUCTION: "${instruction}"
        
        OUTPUT JSON: { "colors": ["#hex", "#hex", ...] }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(text).colors || currentPalette.colors;
    }


    // ==========================================
    // MODIFICATION PHASE: FONTS
    // ==========================================

    async createModificationFonts(
        currentFonts: any[],
        query: string,
        count: number = 1
    ): Promise<any[]> {
        console.log(`🔹 Mod: Creating ${count} fonts for "${query}"`);
        const prompt = `
        Recommend ${count} NEW Google Font pairings.
        CONTEXT: Existing fonts: ${currentFonts.map(f => f.name).join(', ')}.
        REQUEST: "${query}"
        
        OUTPUT JSON:
        {
            "fonts": [
                { "name": "Primary Font", "category": "serif/sans", "pairing": "Secondary Font", "reasoning": "...", "isSelected": false }
            ]
        }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(text).fonts || [];
    }

    async resolveFontSelector(
        currentFonts: any[],
        instruction: string
    ): Promise<string[]> {
        console.log(`🔹 Mod: Resolving font selector for "${instruction}"`);
        const prompt = `
        Identify which fonts match the user's instruction.
        
        FONTS:
        ${JSON.stringify(currentFonts.map(f => ({ name: f.name, pairing: f.pairing, reasoning: f.reasoning })))}
        
        INSTRUCTION: "${instruction}"
        
        TASK: Return the NAMES of the Primary Fonts (name field) that the user is referring to.
        OUTPUT JSON: { "names": ["Font Name 1"] }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(text).names || [];
    }

    // ==========================================
    // MODIFICATION PHASE: LOGO STRUCTURES
    // ==========================================
    async createLogoStructures(currentOptions: any[], query: string, count: number = 3): Promise<any[]> {
        console.log(`🔹 Mod: Creating ${count} logo structures for "${query}"`);

        // 1. Efficiently track existing types using a Set for O(1) lookups and correct list management
        const existingTypes = new Set(currentOptions.map((o: any) => o.type));

        const prompt = `
        Recommend ${count} logo structure types (e.g., Wordmark, Monogram, Emblem) for the brand.
        
        REQUEST: "${query}"
        OUTPUT JSON: { "structures": [ { "type": "Wordmark", "suitability": "High", "reasoning": "...", "isSelected": false } ] }
        `;

        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const rawItems = JSON.parse(text).structures || [];

        // 2. Post-processing filter to ensure uniqueness (Code Firewall)
        // We filter out any type that is already present in the existing collection OR earlier in this new batch
        const uniqueItems = rawItems.filter((item: any) => {
            if (existingTypes.has(item.type)) {
                return false;
            }
            // Add to set to prevent duplicates within the *new* batch itself
            existingTypes.add(item.type);
            return true;
        });

        // Calculate new IDs starting after the last existing ID
        const startId = currentOptions.length;

        return uniqueItems.map((item: any, i: number) => ({
            ...item,
            id: String(startId + i + 1), // 1-based indexing continued
            isSelected: false // User rule: Default to false
        }));
    }

    async resolveLogoStructureSelector(current: any[], instruction: string): Promise<string[]> {
        return this.resolveSelectorGeneric(current, instruction, "structures");
    }

    // ==========================================
    // MODIFICATION PHASE: IMAGERY
    // ==========================================
    async createImagerySuggestions(query: string, count: number = 3): Promise<any[]> {
        console.log(`🔹 Mod: Creating ${count} imagery suggestions for "${query}"`);
        const prompt = `
         Suggest ${count} visual imagery concepts/styles for the brand photography/assets.
         REQUEST: "${query}"
         OUTPUT JSON: { "suggestions": [ { "concept": "Urban Life", "description": "...", "visualStyle": "...", "isSelected": false } ] }
         `;
        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const items = JSON.parse(text).suggestions || [];
        return items.map((item: any, i: number) => ({ ...item, id: String(i + 1) }));
    }

    async resolveImagerySelector(current: any[], instruction: string): Promise<string[]> {
        return this.resolveSelectorGeneric(current, instruction, "imagery suggestions");
    }

    // ==========================================
    // MODIFICATION PHASE: LOGO INSPIRATIONS (SEARCH)
    // ==========================================
    async searchLogoInspirations(query: string, count: number = 4): Promise<any[]> {
        // Start with a simulation or "AI curated" list since we don't have real search here yet.
        console.log(`🔹 Mod: Searching (simulated) logo inspirations for "${query}"`);
        // In a real app, this would call a Search API.
        // Here we'll generate concepts and assign placeholder URLs.
        const prompt = `
         Generate ${count} descriptions of existing real-world logo styles that match: "${query}".
         OUTPUT JSON: { "results": [ { "displayName": "Nike-like Minimal", "description": "Simple swoosh..." } ] }
         `;
        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const items = JSON.parse(text).results || [];
        return items.map((item: any, i: number) => ({
            id: String(i + 1),
            displayName: item.displayName,
            url: `https://via.placeholder.com/300x200?text=${encodeURIComponent(item.displayName)}`, // Placeholder
            isSelected: false,
            description: item.description
        }));
    }

    async resolveLogoInspirationSelector(current: any[], instruction: string): Promise<string[]> {
        return this.resolveSelectorGeneric(current, instruction, "inspirations");
    }

    // GENERIC RESOLVER HELPER
    private async resolveSelectorGeneric(currentInfo: any[], instruction: string, itemType: string): Promise<string[]> {
        const prompt = `
        Identify which items match the user's instruction.
        ITEMS: ${JSON.stringify(currentInfo.map(i => ({ id: i.id, name: i.name || i.type || i.concept || i.displayName })))}
        INSTRUCTION: "${instruction}"
        TASK: Return the IDs of the ${itemType} the user is referring to.
        OUTPUT JSON: { "ids": [] }
        `;
        const response = await this.genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(text).ids || [];
    }

    // ==========================================
    // PHASE 5: FINALIZATION
    // ==========================================
    async finalizeResearch(
        dna: BrandDNA,
        competitors: CompetitorResearch,
        palettes: ColorPalettes,
        fonts: TypographyPairings,
        logoStructures: { options: any[] } = { options: [] }
    ): Promise<ResearchPhaseObject> {
        console.log('🔹 Phase 6: Finalizing research...');

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
            // Initialize Modification Phase sections (Logo Structures populated from Phase 5)
            logoStructures: logoStructures,
            logoInspirations: { inspirations: [] },
            imagery: { suggestions: [] },

            summary,
            timestamp: new Date().toISOString(),
            stateVersion: 1 // Initial version for new research
        };

        // Use StateManager for persistence with version history
        const stateManager = WorkspaceManager.getStateManager(this.workspaceId);
        await stateManager.saveFullState(finalObject);

        console.log(`✅ [${this.workspaceId}] Research saved with StateManager`);

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
        // PHASE 5: LOGO STRUCTURE GENERATION
        // =========================================
        onStreamThought?.(4, 'logo', 'Logo Architecture', `Defining logo structure options for ${dna.industry?.value}...`);
        await sleep(DELAY_MS);

        const logoStructures = await this.createLogoStructures([], dna.industry?.value || 'Brand', 3);

        // Stream each structure created with delay
        for (const ls of logoStructures) {
            onStreamThought?.(4, 'logo', 'Structure Option', `${ls.type}: ${ls.reasoning?.slice(0, 50)}...`);
            await sleep(DELAY_MS);
        }

        // =========================================
        // PHASE 6: FINALIZATION
        // =========================================
        onStreamThought?.(5, 'strategy', 'Finalizing', `Compiling brand strategy for ${dna.name.value}...`);
        await sleep(DELAY_MS);

        const result = await this.finalizeResearch(dna, competitors, palettes, fonts, { options: logoStructures });

        onStreamThought?.(5, 'strategy', 'Research Complete', `Brand identity complete: ${dna.name.value}`);

        return result;
    }
}
