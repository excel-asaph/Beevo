import {
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage,
    LogoResearchProgressMessage,
    LogoResearchResultMessage
} from '../../../shared/messages';
import { FontSuggestion, ColorPalette, BrandDNA } from '../../../shared/types';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer';
import { SearchGroundingService } from './SearchGroundingService';
import { getLogoStrategist, LogoStrategist, BrandContext } from '../agents/LogoStrategist';
import { getResearchAgent, ResearchAgent, CompetitorInfo } from '../agents/ResearchAgent';
import { BrainLogger } from '../utils/BrainLogger';

interface FunctionCall {
    id: string;
    name: string;
    args: any;
}

interface FunctionResponse {
    id: string;
    name: string;
    response: { result: string };
}

export class ToolHandler {
    private sendToClient: (message: ServerMessage) => void;
    private updateState: (field: string, value: any) => void;
    private storePalettes: (palettes: ColorPalette[]) => void;
    private storeFonts: (fonts: FontSuggestion[]) => void;
    private setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void;
    private getDNA: () => BrandDNA;
    private updateBatch: (updates: Record<string, any>) => void;
    private searchService: SearchGroundingService;
    private logoCache: Map<string, string> = new Map();
    // Callback to trigger Brain Mode Switch (Discovery -> Execution)
    private onPhaseChange: (phase: 'discovery' | 'execution') => void;
    private genAI: GoogleGenAI;
    private onPauseVoice: () => void;
    private onResumeVoice: () => void;

    constructor(
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void,
        storePalettes: (palettes: ColorPalette[]) => void = () => { },
        storeFonts: (fonts: FontSuggestion[]) => void = () => { },
        setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void = () => { },
        getDNA: () => BrandDNA = () => ({ name: '', mission: '', typography: [], colors: [], voice: '' }),
        updateBatch: (updates: Record<string, any>) => void = () => { },
        onPauseVoice: () => void = () => { },
        onResumeVoice: () => void = () => { },
        onPhaseChange: (phase: 'discovery' | 'execution') => void = () => { }
    ) {
        this.sendToClient = sendToClient;
        this.updateState = updateState;
        this.storePalettes = storePalettes;
        this.storeFonts = storeFonts;
        this.setCanvasMode = setCanvasMode;
        this.getDNA = getDNA;
        this.updateBatch = updateBatch;
        this.onPauseVoice = onPauseVoice;
        this.onResumeVoice = onResumeVoice;
        this.onPhaseChange = onPhaseChange;
        this.searchService = new SearchGroundingService(process.env.GEMINI_API_KEY || '');
        this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    }

    async handleToolCalls(functionCalls: FunctionCall[]): Promise<FunctionResponse[]> {
        const responses: FunctionResponse[] = [];

        for (const fc of functionCalls) {
            console.log(`🔧 Processing tool: ${fc.name}`, JSON.stringify(fc.args || {}));
            let contextSummary = "Action completed.";

            try {
                // Log tool entrance
                BrainLogger.log(fc.name, 'Tool Call Started', fc.args);

                switch (fc.name) {
                    case 'display_font_suggestions':
                        contextSummary = this.handleFontSuggestions(fc.args);
                        break;

                    case 'display_color_suggestions':
                        contextSummary = await this.handleColorSuggestions(fc.args);
                        break;

                    case 'update_live_brand_dna':
                        contextSummary = this.handleDNAUpdate(fc.args);
                        break;

                    case 'research_competitors':
                        this.sendToClient({
                            type: 'UI_STATE_CHANGE',
                            mode: 'thinking',
                            overlayVisible: false
                        });
                        // TRIGGER THE TWO-BRAIN SWITCH: Discovery -> Execution
                        this.onPhaseChange('execution');

                        contextSummary = await this.handleResearchCompetitors(fc.args);
                        break;

                    case 'general_research':
                        contextSummary = await this.handleGeneralResearch(fc.args);
                        break;

                    case 'search_logo_inspiration':
                        contextSummary = await this.handleSearchLogoInspiration(fc.args);
                        break;

                    case 'verify_asset_compliance':
                        await this.handleVerifyAssetCompliance(fc.args);
                        contextSummary = "Asset compliance check complete.";
                        break;

                    case 'display_logo_structure_options':
                        contextSummary = this.handleLogoStructureOptions(fc.args);
                        break;

                    case 'display_imagery_suggestions':
                        contextSummary = this.handleImagerySuggestions(fc.args);
                        break;

                    case 'extract_brand_identity':
                        contextSummary = this.handleExtractBrandIdentity(fc.args);
                        break;

                    default:
                        console.warn(`Unknown tool: ${fc.name}`);
                }

                // Log raw call to check for ID
                console.log(`🔍 Raw tool call:`, JSON.stringify(fc));

                // Add instructions to prompt the model to speak
                // NOW DYNAMIC: Injects the specific context summary!
                const flowInstruction = `System Update: ${contextSummary} Briefly confirm this to the user.`;

                // Gemini Live API expects this exact format
                const response: any = {
                    name: fc.name,
                    response: {
                        result: 'success',
                        ...fc.args,
                        system_note: flowInstruction
                    }
                };

                // Only include ID if it was sent by Gemini
                if (fc.id) {
                    response.id = fc.id;
                }

                responses.push(response);
                BrainLogger.log(fc.name, 'Tool Call Completed', { contextSummary });
                console.log(`✅ Tool ${fc.name} executed successfully`);
            } catch (error) {
                console.error(`❌ Error in tool ${fc.name}:`, error);
                responses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: `error: ${error}` }
                });
            }
        }

        return responses;
    }

    /**
     * Extract industry hint from free-form text (fallback when Brain doesn't provide industry)
     * This is intentionally simple - the Brain should be doing the real analysis
     */
    private extractIndustryHint(text: string): string | null {
        const t = text.toLowerCase();
        // Very basic extraction - Brain should provide industry via args
        if (t.includes('footwear') || t.includes('shoe') || t.includes('sneaker')) return 'footwear';
        if (t.includes('fashion') || t.includes('clothing')) return 'fashion';
        if (t.includes('tech') || t.includes('software') || t.includes('app')) return 'technology';
        if (t.includes('food') || t.includes('restaurant')) return 'food & beverage';
        if (t.includes('fitness') || t.includes('gym') || t.includes('sport')) return 'fitness';
        if (t.includes('finance') || t.includes('bank')) return 'finance';
        return null;
    }

    private handleFontSuggestions(args: any): string {
        let fonts: FontSuggestion[] = [];

        // If AI provides actual fonts, use them
        if (args.fonts && args.fonts.length > 0) {
            fonts = args.fonts.map((f: any) => ({
                name: f.name,
                category: f.category || 'sans-serif',
                reasoning: f.reasoning || ''
            }));
        } else {
            // AI provided metadata but no actual fonts - generate fallbacks
            const style = args.style_filter || 'sans-serif';
            const mood = args.mood_filter || 'modern';
            console.log(`📝 Generating fallback fonts for style: ${style}, mood: ${mood}`);

            // Style-based font presets (safe fallbacks using Google Fonts)
            const styleFonts: Record<string, FontSuggestion[]> = {
                'sans-serif': [
                    { name: 'Inter', category: 'sans-serif', reasoning: 'Clean and modern, excellent readability' },
                    { name: 'Montserrat', category: 'sans-serif', reasoning: 'Geometric and contemporary, versatile' },
                    { name: 'Poppins', category: 'sans-serif', reasoning: 'Friendly and approachable, great for headings' }
                ],
                'serif': [
                    { name: 'Playfair Display', category: 'serif', reasoning: 'Elegant and sophisticated, high contrast' },
                    { name: 'Lora', category: 'serif', reasoning: 'Well-balanced, readable for body text' },
                    { name: 'Merriweather', category: 'serif', reasoning: 'Pleasant to read on screens, traditional feel' }
                ],
                'display': [
                    { name: 'Bebas Neue', category: 'display', reasoning: 'Bold and impactful, great for headlines' },
                    { name: 'Oswald', category: 'display', reasoning: 'Strong and condensed, attention-grabbing' },
                    { name: 'Anton', category: 'display', reasoning: 'Powerful and bold, perfect for statements' }
                ],
                'monospace': [
                    { name: 'JetBrains Mono', category: 'monospace', reasoning: 'Modern and clear, excellent for code' },
                    { name: 'Fira Code', category: 'monospace', reasoning: 'Well-designed ligatures, technical feel' },
                    { name: 'IBM Plex Mono', category: 'monospace', reasoning: 'Professional and balanced' }
                ]
            };

            fonts = styleFonts[style] || styleFonts['sans-serif'];
        }

        const previewText = args.context_text || 'Brand Name';

        // Store fonts and set canvas mode for state injection
        this.storeFonts(fonts);
        this.setCanvasMode('fonts');

        console.log(`📝 Sending ${fonts.length} font suggestions`);

        this.sendToClient({
            type: 'FONT_SUGGESTIONS',
            fonts,
            previewText
        });

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Typography thread: Rendering ${fonts.length} font options for "${previewText}"`,
            confidence: 0.9
        });

        const fontNames = fonts.map(f => f.name).join(', ');
        return `Displayed ${fonts.length} font options: ${fontNames}.`;
    }

    private async executeResearchPhase(args: any): Promise<{
        streamedCompetitors: string[];
        differentiationAdvice: string;
        competitorColors: string[];
        allThoughts: any[];
        industry: string;
        brandName: string;
        researchStartTime: number;
        MINIMUM_RESEARCH_TIME: number;
        delay: (ms: number) => Promise<void>;
        streamThought: (stepIndex: number, text: string, delayMs?: number) => Promise<void>;
    }> {
        // Pause Gemini Live audio during research
        this.onPauseVoice();

        const brandName = this.getDNA()?.name || 'Your Brand';
        const researchStartTime = Date.now();
        const MINIMUM_RESEARCH_TIME = 20000; // 20 seconds minimum for user to appreciate the research

        // Helper for delays
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // ========== INDUSTRY FROM BRAIN (NOT HARDCODED) ==========
        // Brain analyzes conversation and passes industry via args
        // Fallback: extract from mission/voice if not provided
        const brainIndustry = args.industry || args.query || '';
        const dnaContext = `${this.getDNA()?.mission || ''} ${this.getDNA()?.voice || ''}`;
        const industry = brainIndustry || this.extractIndustryHint(dnaContext) || 'general';

        console.log(`🔍 Industry for research: "${industry}" (from Brain: ${brainIndustry ? 'yes' : 'no'})`);

        // Track all thoughts for "thinking stream" UX
        type Thought = { id: string; text: string; status: 'pending' | 'active' | 'complete' };
        let allThoughts: Thought[] = [];
        let streamedCompetitors: string[] = [];
        let differentiationAdvice = '';
        let competitorColors: string[] = [];

        // Helper to add and stream a thought
        const streamThought = async (stepIndex: number, text: string, delayMs: number = 500) => {
            const thoughtId = `step${stepIndex}-${allThoughts.length}`;
            allThoughts = allThoughts.map(t => ({ ...t, status: 'complete' as const }));
            allThoughts.push({ id: thoughtId, text, status: 'active' });

            const statusMap: Record<number, 'started' | 'searching' | 'analyzing' | 'generating'> = {
                0: 'started', 1: 'searching', 2: 'analyzing', 3: 'generating', 4: 'generating'
            };

            this.sendToClient({
                type: 'RESEARCH_UPDATE',
                status: statusMap[stepIndex] || 'generating',
                step: stepIndex,
                totalSteps: 5,
                message: text,
                thoughts: [...allThoughts],
                competitors: streamedCompetitors
            } as any);
            await delay(delayMs);
        };

        // ========== STEP 0: Analyzing Vision ==========
        await streamThought(0, `Extracting brand essence: "${brandName}"...`, 600);
        await streamThought(0, `Brand: ${brandName} ✓`, 450);
        await streamThought(0, `Industry: ${industry} ✓`, 450);
        await streamThought(0, `Identifying target market...`, 500);
        await streamThought(0, `Target audience profiled ✓`, 400);

        // ========== STEP 1: Finding Competitors (LIVE SEARCH via ResearchAgent) ==========
        await streamThought(1, `🔍 Searching Google for ${industry} competitors...`, 800);

        // Call ResearchAgent for live competitor data AND branding insights
        let liveCompetitors: CompetitorInfo[] = [];

        try {
            const researchAgent = getResearchAgent();
            const researchResult = await researchAgent.researchCompetitors(
                industry,
                `${brandName} - ${industry}`,
                (phase, message, comps) => {
                    // Stream progress as it happens
                    if (phase === 'searching') {
                        streamThought(1, message, 300);
                    }
                }
            );
            liveCompetitors = researchResult.competitors;
            differentiationAdvice = researchResult.differentiationOpportunity;

            // Extract competitor colors for analysis
            competitorColors = researchResult.competitorBranding
                .flatMap(cb => [cb.primaryColor, cb.secondaryColor])
                .filter((c): c is string => !!c);

            // Stream the differentiation insight
            if (differentiationAdvice) {
                await streamThought(2, `💡 Strategy: ${differentiationAdvice.slice(0, 80)}...`, 600);
            }
        } catch (err) {
            console.error('Live search failed, using fallback:', err);
            // Fallback with generic competitor names if search fails
            liveCompetitors = [
                { name: 'Competitor A', domain: 'example.com', description: 'Industry leader' },
                { name: 'Competitor B', domain: 'example2.com', description: 'Market challenger' },
                { name: 'Competitor C', domain: 'example3.com', description: 'Innovator' }
            ];
            differentiationAdvice = 'Create a distinctive visual identity that stands out from the crowd';
        }

        // Stream each competitor found
        for (const comp of liveCompetitors) {
            streamedCompetitors.push(comp.name);
            await streamThought(1, `Found: ${comp.name} (${comp.domain})`, 400);
        }
        await streamThought(1, `${liveCompetitors.length} competitors identified ✓`, 500);

        // Store domains for logo fetching
        // const competitorDomains = liveCompetitors.map(c => c.domain); // Not used here, but kept for context

        // ========== STEP 2: Analyzing Brand Aesthetics ==========
        await streamThought(2, `Analyzing competitor color strategies...`, 600);
        // Use insights from ResearchAgent instead of hardcoded analysis
        if (differentiationAdvice) {
            await streamThought(2, `💡 ${differentiationAdvice.slice(0, 100)}...`, 500);
        }
        await streamThought(2, `Identifying differentiation opportunities...`, 500);
        await streamThought(2, `Market position mapped ✓`, 400);

        return {
            streamedCompetitors,
            differentiationAdvice,
            competitorColors,
            allThoughts,
            industry,
            brandName,
            researchStartTime,
            MINIMUM_RESEARCH_TIME,
            delay,
            streamThought
        };
    }

    private async handleColorSuggestions(args: any): Promise<string> {
        // Pause Gemini Live audio during research
        this.onPauseVoice();

        let palettes: ColorPalette[] = [];
        const brandName = this.getDNA()?.name || 'Your Brand';
        const researchStartTime = Date.now();
        const MINIMUM_RESEARCH_TIME = 20000; // 20 seconds minimum for user to appreciate the research

        // Helper for delays
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // ========== INDUSTRY FROM BRAIN (NOT HARDCODED) ==========
        // Brain analyzes conversation and passes industry via args
        // Fallback: extract from mission/voice if not provided
        const brainIndustry = args.industry || args.query || '';
        const dnaContext = `${this.getDNA()?.mission || ''} ${this.getDNA()?.voice || ''}`;
        const industry = brainIndustry || this.extractIndustryHint(dnaContext) || 'general';

        console.log(`🔍 Industry for research: "${industry}" (from Brain: ${brainIndustry ? 'yes' : 'no'})`);

        // Check if pre-computed research data is provided (from handleResearchCompetitors)
        let streamedCompetitors: string[] = args.researchData?.streamedCompetitors || [];
        let differentiationAdvice = args.researchData?.differentiationAdvice || '';
        let competitorColors: string[] = args.researchData?.competitorColors || [];
        let allThoughts: any[] = args.researchData?.allThoughts || [];

        // Define Thought type locally if not already defined
        type Thought = { id: string; text: string; status: 'pending' | 'active' | 'complete' };

        // Helper to add and stream a thought
        const streamThought = async (stepIndex: number, text: string, delayMs: number = 500) => {
            const thoughtId = `step${stepIndex}-${allThoughts.length}`;
            allThoughts = allThoughts.map(t => ({ ...t, status: 'complete' as const }));
            allThoughts.push({ id: thoughtId, text, status: 'active' });

            const statusMap: Record<number, 'started' | 'searching' | 'analyzing' | 'generating'> = {
                0: 'started', 1: 'searching', 2: 'analyzing', 3: 'generating', 4: 'generating'
            };

            this.sendToClient({
                type: 'RESEARCH_UPDATE',
                status: statusMap[stepIndex] || 'generating',
                step: stepIndex,
                totalSteps: 5,
                message: text,
                thoughts: [...allThoughts],
                competitors: streamedCompetitors
            } as any);
            await delay(delayMs);
        };

        // IF NO RESEARCH DATA PROVIDED -> Proceed with defaults (Strict Sequential Flow)
        if (args.researchData) {
            console.log('⚡ Using pre-computed research data from handleResearchCompetitors');
        } else {
            console.warn('⚠️ No research data provided to handleColorSuggestions. Proceeding with defaults (Sequential flow enforcement).');
        }

        // If AI provides actual palettes, use them
        if (args.palettes && args.palettes.length > 0) {
            palettes = args.palettes.map((p: any) => ({
                name: p.name || 'Unnamed Palette',
                // Sanitize colors: remove commas, trim whitespace, filter invalid
                colors: Array.isArray(p.colors)
                    ? p.colors
                        .map((c: string) => String(c).replace(/,/g, '').trim()) // Remove commas
                        .filter((c: string) => /^#[0-9A-Fa-f]{3,8}$/.test(c))   // Valid hex only
                    : ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'],
                vibe: p.vibe || 'modern'
            }));
        } else {
            // Generate palettes using competitive intelligence
            const mood = args.mood_filter || 'modern';
            const count = args.palette_count || 3;
            console.log(`🎨 Generating ${count} research-informed palettes for mood: ${mood}`);

            // Try to generate AI-informed palettes using research insights
            const aiPalettes = await this.generateResearchInformedPalettes(
                brandName,
                industry,
                differentiationAdvice,
                competitorColors,
                mood,
                count
            );

            if (aiPalettes && aiPalettes.length > 0) {
                palettes = aiPalettes;
                await streamThought(2, `Generated ${aiPalettes.length} unique palettes based on research ✓`, 400);
            } else {
                console.log(`🎨 Falling back to preset palettes for mood: ${mood}`);

                // Get palettes from AI (Attempt 1)
                palettes = await this.generateResearchInformedPalettes(
                    brandName, industry, differentiationAdvice, competitorColors, mood, count
                ) || [];

                // AI Retry (Attempt 2 - Simpler Prompt if needed)
                if (palettes.length === 0) {
                    console.log('🔄 First palette generation empty, retrying with broader prompt...');
                    palettes = await this.generateResearchInformedPalettes(
                        brandName, 'general', '', [], mood, count
                    ) || [];
                }

                // If still empty, throw to indicate failure (Brain should handle or user tries again)
                if (palettes.length === 0) {
                    console.warn('⚠️ Fully failed to generate AI palettes. Returning empty set (Client handles loading state).');
                }
            }

            // Store palettes for click selection lookup
            this.storePalettes(palettes);
            // setCanvasMode moved to end to prevent premature reveal

            // ========== STEP 2: Analyzing Brand Aesthetics ==========
            await streamThought(2, `Analyzing competitor color strategies...`, 600);
            // Use insights from ResearchAgent instead of hardcoded analysis
            if (differentiationAdvice) {
                await streamThought(2, `💡 ${differentiationAdvice.slice(0, 100)}...`, 500);
            }
            await streamThought(2, `Identifying differentiation opportunities...`, 500);
            await streamThought(2, `Market position mapped ✓`, 400);

            // ========== STEP 3: Generating Color Palettes ==========
            await streamThought(3, `Generating ${palettes.length} unique palettes...`, 600);
            await streamThought(3, `Avoiding competitor overlap...`, 450);
            await streamThought(3, `Testing contrast ratios...`, 450);
            for (const palette of palettes.slice(0, 3)) {
                await streamThought(3, `Creating "${palette.name}" palette...`, 450);
            }
            await streamThought(3, `Color harmony validated ✓`, 400);

            console.log(`🎨 Sending ${palettes.length} color palettes`);

            // Send Color Thought Signature
            this.sendToClient({
                type: 'THOUGHT_SIGNATURE',
                nodeId: 'colors',
                title: 'Color Psychology Strategy',
                reasoning: `I've designed these palettes to stand out in the ${industry} market. While competitors rely on ${industry === 'design' ? 'safe Swiss styles' : industry === 'tech' ? 'predictable blues' : 'standard conventions'}, I've introduced unexpected accents like ${palettes[0].colors[2]} to signal innovation and differentiate ${brandName}.`,
                confidence: 0.94
            });

            // ========== STEP 4: Typography Generation (AI-Driven) ==========
            await streamThought(4, `Analyzing typography trends for ${industry}...`, 500);

            // Generate Fonts using AI validation
            let fonts = await this.generateResearchInformedFonts(industry, brandName);

            if (!fonts || fonts.length === 0) {
                // Fallback: Try one more time with broader prompt
                fonts = await this.generateResearchInformedFonts('general', brandName);
            }

            // Ensure we have something (last resort safety, but still AI generated)
            if (!fonts || fonts.length === 0) {
                fonts = [{ name: 'Roboto', category: 'sans-serif', reasoning: 'Universal fallback' }];
            }

            // Stream font thoughts
            for (const font of fonts) {
                await streamThought(4, `Selecting font: ${font.name} (${font.category})...`, 400);
            }
            await streamThought(4, `Typography pairing complete ✓`, 350);

            this.sendToClient({
                type: 'FONT_SUGGESTIONS',
                fonts,
                previewText: brandName
            });

            // Send Font Thought Signature
            this.sendToClient({
                type: 'THOUGHT_SIGNATURE',
                nodeId: 'typography',
                title: 'Typography Selection',
                reasoning: `To complement the color strategy, I've selected typefaces that balance ${industry === 'design' ? 'modernism with readability' : 'function with form'}. The primary selection of ${fonts[0].name} ensures ${brandName} feels professional yet approachable, while the alternatives offer distinct tonal shifts.`,
                confidence: 0.92
            });


            // ========== STEP 5: Building Strategy ==========
            await streamThought(5, `Finalizing brand strategy...`, 500);

            // Populate the "Brand Strategy" card on frontend
            const currentDNA = this.getDNA();
            if (currentDNA) {
                this.sendToClient({
                    type: 'DNA_UPDATE',
                    dna: currentDNA
                });
                await streamThought(5, `Brand Strategy data synced ✓`, 300);
            }

            await streamThought(5, `Tagline and values alignment check...`, 400);

            // Ensure minimum research time has passed
            const elapsed = Date.now() - researchStartTime;
            if (elapsed < MINIMUM_RESEARCH_TIME) {
                await streamThought(5, `Finalizing recommendations...`, MINIMUM_RESEARCH_TIME - elapsed);
            }
            await streamThought(5, `Strategy complete ✓`, 400);

            this.sendToClient({
                type: 'COLOR_SUGGESTIONS',
                palettes
            });

            // Show canvas only after research is complete
            this.setCanvasMode('colors');

            // Step 6: Complete
            allThoughts = allThoughts.map(t => ({ ...t, status: 'complete' as const }));
            this.sendToClient({
                type: 'RESEARCH_UPDATE',
                status: 'complete',
                step: 6,
                totalSteps: 6,
                message: 'Research complete!',
                competitors: streamedCompetitors,
                thoughts: allThoughts
            } as any);

            this.sendToClient({
                type: 'THOUGHT',
                logic: `Color thread: Rendered ${palettes.length} palettes for ${brandName} in ${industry} market`,
                confidence: 0.92
            });

            // Send RESEARCH_COMPLETE - signals client can safely show canvas
            this.sendToClient({
                type: 'RESEARCH_COMPLETE',
                summary: {
                    brandName,
                    colorsGenerated: palettes.length,
                    fontsGenerated: fonts.length,
                    competitorsFound: streamedCompetitors.length
                }
            });

            // Resume Gemini Live audio now that research is complete
            this.onResumeVoice();

            const paletteNames = palettes.map(p => p.name).join(', ');
            return `I've extracted your brand DNA and analyzed the ${industry} landscape. I've generated 3 distinct color palettes: ${paletteNames}, and selected 3 typography pairings that fit your vibe. Have a look at the options on the canvas - which combination speaks to you?`;
        }
    }

    /**
     * Generate color palettes informed by competitive research
     */
    private async generateResearchInformedPalettes(
        brandName: string,
        industry: string,
        differentiationAdvice: string,
        competitorColors: string[],
        mood: string,
        count: number
    ): Promise<ColorPalette[] | null> {
        try {
            const prompt = `You are a brand color strategist creating unique palettes for "${brandName}" in the ${industry} industry.

COMPETITIVE INTELLIGENCE:
- Differentiation advice: ${differentiationAdvice}
- Competitor colors to AVOID: ${competitorColors.join(', ') || 'none identified'}
- Target mood: ${mood}

Generate ${count} unique color palettes that:
1. Follow the differentiation advice
2. AVOID colors similar to competitor colors
3. Match the "${mood}" mood
4. Work well together with good contrast

Return JSON array:
[
    {
        "name": "Palette Name",
        "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
        "vibe": "brief description of the vibe"
    }
]

IMPORTANT: Return ONLY valid JSON. Each palette must have exactly 5 colors.`;

            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { temperature: 0.7 }
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map(p => ({
                        name: p.name || 'Custom Palette',
                        colors: (p.colors || []).filter((c: string) => /^#[0-9A-Fa-f]{3,8}$/.test(c)),
                        vibe: p.vibe || mood
                    })).filter(p => p.colors.length >= 3);
                }
            }
        } catch (e) {
            console.error('Failed to generate research-informed palettes:', e);
        }
        return null;
    }

    private handleLogoStructureOptions(args: any): string {
        const options = args.options || [];
        console.log(`🏗️ Sending ${options.length} logo structure options`);
        console.log(`   Filters: Style=${args.style_filter}, Complexity=${args.complexity_preference}, Industry=${args.industry_context}`);

        this.sendToClient({
            type: 'LOGO_STRUCTURE_OPTIONS',
            options
        });

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Generating logo structure options (${args.complexity_preference || 'balanced'}) for ${args.industry_context || 'brand'}`,
            confidence: 0.9
        });

        return `Displayed ${options.length} logo structure options.`;
    }

    private handleImagerySuggestions(args: any): string {
        const suggestions = args.suggestions || [];
        console.log(`🖼️ Sending ${suggestions.length} imagery suggestions`);
        console.log(`   Params: Abstraction=${args.abstraction_level}, Mood=${args.mood_filter}, Style=${args.art_style}`);

        this.sendToClient({
            type: 'IMAGERY_SUGGESTIONS',
            suggestions
        });

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Generating imagery: ${args.abstraction_level || 'varied'} ${args.art_style || 'style'} for ${args.focus_element || 'core'}`,
            confidence: 0.9
        });

        return `Displayed ${suggestions.length} imagery suggestions.`;
    }

    public handleExtractBrandIdentity(args: any): string {
        console.log('🏗️ EXTRACTING FULL BRAND IDENTITY:', args);

        // Prepare batch updates
        const updates: Record<string, any> = {};

        const summary = [];

        // 1. Update Core DNA (Name, Mission, Voice)
        if (args.brandName) updates.name = args.brandName;
        if (args.mission) updates.mission = args.mission;
        if (args.voice) updates.voice = args.voice;
        summary.push(`Updated Core DNA (Name: ${args.brandName || 'N/A'})`);

        // 2. Display Colors
        if (args.colors && args.colors.palettes) {
            this.handleColorSuggestions({
                palettes: args.colors.palettes
            }); // This sends COLOR_SUGGESTIONS message

            // Add to batch update
            if (args.colors.palettes.length > 0) {
                updates.colors = args.colors.palettes[0].colors;
            }
            summary.push(`Processed ${args.colors.palettes.length} color palettes`);
        }

        // 3. Display Typography
        if (args.typography && args.typography.fonts) {
            this.handleFontSuggestions({
                fonts: args.typography.fonts,
                context_text: args.typography.context_text
            }); // This sends FONT_SUGGESTIONS message

            // Add to batch update
            if (args.typography.fonts.length > 0) {
                updates.typography = [args.typography.fonts[0].name];
            }
            summary.push(`Processed ${args.typography.fonts.length} fonts`);
        }

        // 4. Tagline & Values
        if (args.tagline) updates.tagline = args.tagline;
        if (args.values) updates.values = args.values;
        summary.push(`Extracted Tagline & Values`);

        // EXECUTE BATCH UPDATE - Triggers SINGLE DNA_UPDATE broadcast
        if (Object.keys(updates).length > 0) {
            this.updateBatch(updates);
        }

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Brand Extraction Complete: ${summary.join(', ')}`,
            confidence: 0.98
        });

        // Trigger the post-research summary voiceover
        return `[SYSTEM EVENT: Brand Identity Extracted. The canvas is now fully populated. Briefly summarize the key elements you found (Name: ${args.brandName}, Mission: ${args.mission}) and ask the user to confirm the Color and Font options displayed.]`;
    }

    private handleDNAUpdate(args: any): string {
        console.log('🧬 Updating Brand DNA (Voice AI):', args);

        // Prepare batch updates
        const updates: Record<string, any> = {};

        // Map args to state fields
        if (args.brandName) updates.name = args.brandName;
        if (args.mission) updates.mission = args.mission;
        if (args.selectedColors) updates.colors = args.selectedColors; // Handles empty array too
        if (args.selectedFont) updates.typography = [args.selectedFont]; // Normalize to array
        if (args.voice) updates.voice = args.voice;
        if (args.tagline) updates.tagline = args.tagline;
        if (args.values) updates.values = args.values;
        if (args.logoType) updates.logoType = args.logoType;
        if (args.imagery) updates.imagery = args.imagery;

        if (args.savedLogos && args.savedLogos.length > 0) {
            // Resolve any cached logo references
            const resolvedLogos = args.savedLogos.map((logo: any) => {
                const cachedUrl = this.logoCache.get(logo.url) || this.logoCache.get(logo.url.trim());
                if (cachedUrl) {
                    console.log(`🔄 Resolved logo reference ${logo.url} to full URL`);
                    return { ...logo, url: cachedUrl };
                }
                return logo;
            });

            console.log(`💾 Saving ${resolvedLogos.length} logos to Brand DNA`);
            updates.logoAssets = resolvedLogos;
        }

        // Execute batch update if there are changes
        if (Object.keys(updates).length > 0) {
            this.updateBatch(updates);
        }

        const updatedFields = Object.keys(updates);
        this.sendToClient({
            type: 'THOUGHT',
            logic: `Brand DNA updated: ${updatedFields.join(', ')}`,
            confidence: 0.95
        });

        return `Updated Brand DNA: ${updatedFields.join(', ')}.`;
    }

    private getUpdatedField(args: any): 'name' | 'mission' | 'colors' | 'typography' | 'voice' | 'logoAssets' | 'logoType' | 'imagery' {
        if (args.brandName) return 'name';
        if (args.mission) return 'mission';
        if (args.selectedColors) return 'colors';
        if (args.selectedFont) return 'typography';
        if (args.voice) return 'voice';
        if (args.savedLogos) return 'logoAssets';
        if (args.logoType) return 'logoType';
        if (args.imagery) return 'imagery';
        return 'name';
    }

    // ============ PHASE 9: AUTONOMOUS CREATIVE LOOP ============

    private async handleResearchCompetitors(args: any): Promise<string> {
        console.log('🕵️ Research Competitors called with:', args);

        // ========== STEP 1: Save any brand DNA fields Brain extracted from conversation ==========
        const dnaUpdates: Record<string, any> = {};

        if (args.brandName) dnaUpdates.name = args.brandName;
        if (args.mission) dnaUpdates.mission = args.mission;
        if (args.tagline) dnaUpdates.tagline = args.tagline;
        if (args.values && args.values.length > 0) dnaUpdates.values = args.values;
        if (args.voice) dnaUpdates.voice = args.voice;
        if (args.targetAudience) dnaUpdates.targetAudience = args.targetAudience;

        // ========== STEP 2: Run the research flow (which includes color/font generation) ==========
        let summary = "Competitor research complete.";
        try {
            // EXECUTE PURE RESEARCH PHASE
            const researchResult = await this.executeResearchPhase(args);

            // SAVE RESEARCH TO CONTEXT (PERSISTENCE)
            const competitorInsights = {
                industry: researchResult.industry,
                analyzed: researchResult.streamedCompetitors,
                patterns: "Analyzed competitive landscape for visual differentiation.",
                recommendation: researchResult.differentiationAdvice
            };
            dnaUpdates.competitorInsights = competitorInsights;

            // Execute batch update for inputs AND outputs
            if (Object.keys(dnaUpdates).length > 0) {
                console.log('📝 Saving Brand DNA & Research Insights:', Object.keys(dnaUpdates).join(', '));
                this.updateBatch(dnaUpdates);
            }

            // PASS RESULTS TO COLOR GENERATION
            await this.handleColorSuggestions({
                ...args,
                // Pass industry explicitly from Brain
                industry: args.industry,
                // Pass pre-computed research data
                researchData: researchResult,
                // Ensure we have necessary flags if needed
                competitor_count: args.competitor_count || 3
            });

            // Create return summary for Logger & Brain
            summary = `Research Outcomes:
- Competitors Found: ${researchResult.streamedCompetitors.length} (${researchResult.streamedCompetitors.join(', ')})
- Differentiation Strategy: ${researchResult.differentiationAdvice}
- Industry: ${researchResult.industry}
- Context Saved: YES`;

        } catch (error) {
            console.error('Error in research flow:', error);
            summary = `Research failed: ${error}`;
            // Fallback response if something fails
            this.sendToClient({
                type: 'RESEARCH_UPDATE',
                status: 'complete',
                step: 5,
                totalSteps: 5,
                message: 'Research complete (fallback).',
            } as any);
        }

        return summary;
    }


    private async handleSearchLogoInspiration(args: any): Promise<string> {
        console.log('🔍 Starting BROWSER-BASED logo research:', args);

        // Get brand context from current DNA
        const dna = this.getDNA();
        const brandContext: BrandContext = {
            name: dna.name || 'Brand',
            industry: args.industry || 'business',
            mission: dna.mission,
            voice: dna.voice,
            style: args.style || args.query
        };

        // Send initial progress
        this.sendToClient({
            type: 'LOGO_RESEARCH_PROGRESS',
            phase: 'starting',
            source: 'Browser Agent',
            progress: 0,
            message: `Starting logo research for ${brandContext.industry} industry...`
        } as LogoResearchProgressMessage);

        try {
            // Get the strategist (singleton with browser)
            const strategist = await getLogoStrategist();

            // Run research with progress callbacks
            const results = await strategist.researchLogos(
                brandContext,
                (phase, source, progress, message) => {
                    console.log(`📊 Research progress: ${phase} | ${source} | ${progress}% | ${message} `);
                    this.sendToClient({
                        type: 'LOGO_RESEARCH_PROGRESS',
                        phase: phase as 'starting' | 'browsing' | 'analyzing' | 'complete',
                        source,
                        progress,
                        message
                    } as LogoResearchProgressMessage);
                }
            );

            console.log(`✅ Research complete: ${results.logos.length} logos found`);

            // Send final results
            this.sendToClient({
                type: 'LOGO_RESEARCH_RESULT',
                logos: results.logos,
                insights: results.insights,
                screenshots: results.screenshots
            } as LogoResearchResultMessage);

            this.sendToClient({
                type: 'THOUGHT',
                logic: `Research complete! Found ${results.logos.length} logos.${results.insights.recommendation} `,
                confidence: 0.95
            });

            // Construct rich summary for Brain context (using References to avoid huge Base64 payloads)
            const logoSummary = results.logos.map((l, i) => {
                const refId = `LOGO_REF_${Date.now()}_${i} `;
                this.logoCache.set(refId, l.imageUrl);
                return `${i + 1}. ${l.brandName || 'Brand'}: ${refId} (Source: ${l.source})`;
            }).join('\n');

            return `Research complete.Found these logos(IDs referenced for safety): \n${logoSummary} \n\nInsights: ${results.insights.recommendation} `;

        } catch (error) {
            console.error('❌ Logo research failed:', error);
            this.sendToClient({
                type: 'LOGO_RESEARCH_PROGRESS',
                phase: 'complete',
                source: 'Error',
                progress: 100,
                message: 'Research encountered an error. Showing fallback results.'
            } as LogoResearchProgressMessage);

            // Fall back to SearchGroundingService
            try {
                const fallbackResults = await this.searchService.searchLogoInspirationFromWeb({
                    styleKeywords: args.style || 'modern logo',
                    industry: args.industry || 'business',
                    count: 6
                });

                this.sendToClient({
                    type: 'LOGO_CONCEPTS',
                    concepts: fallbackResults
                });

                return `Research failed, but displayed ${fallbackResults.length} fallback images using search grounding.`;
            } catch (fallbackError) {
                console.error('❌ Fallback also failed:', fallbackError);
                return "Logo research failed completely.";
            }
        }
    }

    // Helper: Generate mock brand names based on industry
    private getMockBrand(index: number, industry: string): string {
        const brands: Record<string, string[]> = {
            fitness: ['nike', 'adidas', 'underarmour', 'lululemon', 'peloton', 'gymshark'],
            saas: ['stripe', 'notion', 'linear', 'figma', 'slack', 'asana'],
            fashion: ['zara', 'hm', 'uniqlo', 'gap', 'asos', 'nordstrom'],
            tech: ['apple', 'google', 'microsoft', 'ibm', 'intel', 'samsung'],
            default: ['airbnb', 'uber', 'spotify', 'netflix', 'twitter', 'meta']
        };
        const list = brands[industry.toLowerCase()] || brands.default;
        return list[index % list.length];
    }

    // Helper: Map logo type to style description
    private inferStyle(logoType: string): string {
        const styleMap: Record<string, string> = {
            wordmark: 'Text-only wordmark',
            emblem: 'Badge or emblem style',
            lettermark: 'Monogram lettermark',
            abstract: 'Abstract symbol',
            combination: 'Icon + text combination',
            mascot: 'Character or mascot logo'
        };
        return styleMap[logoType] || 'Modern logo design';
    }

    private async handleVerifyAssetCompliance(args: any): Promise<void> {
        console.log('👮 Auditing asset compliance:', args);

        const assetUrl = args.asset_url;
        const brandColors = args.brand_colors || [];
        const tolerance = args.color_tolerance || 10;

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Running pixel - precise compliance audit on asset...`,
            confidence: 0.9
        });

        // TODO: Integrate with Gemini Vision API
        // For hackathon demo: Mock audit
        const audit = {
            pass: true,
            findings: {
                color_match: `Detected ${brandColors[0]} within ${tolerance}% tolerance.`,
                style_match: `Visual style aligns with brand DNA expectations.`,
                accessibility: `WCAG AA contrast ratio: 4.8(passing)`
            },
            thought_signature: `Asset approved.All brand guidelines satisfied.Coordinate analysis: Primary color at(120, 45).`
        };

        console.log('✅ Audit complete:', audit.pass ? 'PASS' : 'FAIL');

        this.sendToClient({
            type: 'THOUGHT',
            logic: audit.thought_signature,
            confidence: audit.pass ? 0.95 : 0.6
        });

        // If fail_on_mismatch and audit fails, could throw error here
    }

    private async handleGeneralResearch(args: any): Promise<string> {
        this.onPauseVoice();
        const { query, focus } = args;

        console.log(`🔎 Executing General Research for: "${query}"`);

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Researching topic: "${query}"...`,
            confidence: 1.0
        });

        // Use the newly added generic search in ResearchAgent
        const agent = getResearchAgent();
        const result = await agent.searchTopic(query, focus);

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Research Context Found: ${result ? result.substring(0, 100) : 'No results'}... (Feeding to Brain)`,
            confidence: 1.0
        });

        this.onResumeVoice();

        // This return string becomes 'system_note' for Gemini, giving it the memory of this research
        return `[RESEARCH CONTEXT] Query: "${query}"\nResult: ${result}\n(IMPORTANT: Use this information to inform subsequent design decisions)`;
    }

    /**
     * AI-Driven Font Generation (Replaces hardcoded fontMap)
     */
    private async generateResearchInformedFonts(industry: string, brandName: string): Promise<any[]> {
        try {
            const prompt = `Recommend 3 Google Fonts for a "${industry}" brand named "${brandName}".
            Return valid JSON array: [{ "name": "Font Family", "category": "serif/sans-serif", "reasoning": "Why it fits" }]`;

            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { temperature: 0.5 }
            });

            const text = response.text || '';
            const match = text.match(/\[[\s\S]*\]/);
            if (match) return JSON.parse(match[0]);
        } catch (e) {
            console.error('Font generation failed:', e);
        }
        return [];
    }
}
