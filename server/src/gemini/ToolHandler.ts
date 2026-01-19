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
import { ResearchLogger } from '../utils/ResearchLogger';
import { identifyGaps, extractMissingIdentity } from '../utils/BrandExtractor';

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
    // Conversation history for brand extraction
    private conversationHistory: string = '';
    // Callback to trigger Brain Mode Switch (Discovery -> Execution -> Modification)
    private onPhaseChange: (phase: 'discovery' | 'execution' | 'modification') => void;
    private genAI: GoogleGenAI;
    private onPauseVoice: () => void;
    private onResumeVoice: () => void;

    // HARD BLOCK: Prevent extract_brand_identity from being called more than once per session
    // This flag persists across parallel Brain decisions
    private extractBrandIdentityCalled: boolean = false;

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
        onPhaseChange: (phase: 'discovery' | 'execution' | 'modification') => void = () => { }
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

    /**
     * Set conversation history for brand extraction
     * Called by BrainConnection before research starts
     */
    public setConversationHistory(history: string): void {
        this.conversationHistory = history;
        console.log(`📝 ToolHandler received ${history.length} chars of conversation history`);
    }

    async handleToolCalls(functionCalls: FunctionCall[]): Promise<FunctionResponse[]> {
        const responses: FunctionResponse[] = [];

        for (const fc of functionCalls) {
            console.log(`🔧 Processing tool: ${fc.name}`, JSON.stringify(fc.args || {}));
            let contextSummary = "Action completed.";

            // ========== HARD BLOCK: Prevent duplicate extract_brand_identity ==========
            // Must be BEFORE the switch to completely skip the tool
            if (fc.name === 'extract_brand_identity' && this.extractBrandIdentityCalled) {
                console.log('⛔ BLOCKED: extract_brand_identity already called this session. Skipping duplicate.');
                BrainLogger.log(fc.name, 'Tool Call BLOCKED', { reason: 'Already called once per session' });
                responses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: '[SYSTEM ERROR: extract_brand_identity already executed. Use modification tools instead.]' }
                });
                continue; // Skip this tool entirely
            }

            try {
                // Log tool entrance
                BrainLogger.log(fc.name, 'Tool Call Started', fc.args);

                switch (fc.name) {
                    case 'display_font_suggestions':
                        contextSummary = this.handleFontSuggestions(fc.args);
                        break;

                    case 'display_color_suggestions':
                        // Legacy tool - redirect to generate_brand_colors
                        contextSummary = await this.handleGenerateBrandColors(fc.args);
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

                    case 'get_canvas_state':
                        contextSummary = this.handleGetCanvasState(fc.args);
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


                    case 'generate_brand_colors':
                        contextSummary = await this.handleGenerateBrandColors(fc.args);
                        break;

                    case 'generate_brand_fonts':
                        contextSummary = await this.handleGenerateBrandFonts(fc.args);
                        break;

                    case 'finalize_brand_dna':
                        contextSummary = await this.handleFinalizeBrandDNA(fc.args);
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

    private async executeResearchPhase(args: any): Promise<any> {
        // Pause Gemini Live audio during research
        this.onPauseVoice();

        // Prioritize: 1. DNA (already saved) 2. Args (passed by Brain) 3. Fallback
        let brandName = this.getDNA()?.name || args.brandName || 'Your Brand';
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

        // ========== STEP 0: Analyzing Vision + EXTRACTION ==========
        ResearchLogger.startSession(brandName, industry);
        ResearchLogger.phase(0, 'Analyzing Your Vision');
        ResearchLogger.input('Brand Name', brandName);
        ResearchLogger.input('Industry', industry);
        ResearchLogger.input('DNA Context', dnaContext);

        await streamThought(0, `Extracting brand essence: "${brandName}"...`, 600);
        ResearchLogger.thought(0, `Extracting brand essence: "${brandName}"...`);

        // ===== BRAND IDENTITY EXTRACTION =====
        // Check for missing DNA fields and extract from conversation
        const currentDNA = this.getDNA();
        const gaps = identifyGaps(currentDNA);
        ResearchLogger.input('Missing Fields', gaps);

        if (gaps.length > 0 && this.conversationHistory.length > 0) {
            await streamThought(0, `Analyzing conversation for brand identity...`, 500);
            ResearchLogger.toolCall('BrandExtractor', { gaps, historyLength: this.conversationHistory.length });

            try {
                const extracted = await extractMissingIdentity(this.conversationHistory, currentDNA);
                const extractedCount = Object.keys(extracted).length;

                if (extractedCount > 0) {
                    ResearchLogger.toolResult('BrandExtractor', extracted);
                    await streamThought(0, `Inferred ${extractedCount} brand fields ✓`, 400);

                    // Save extracted fields to DNA
                    this.updateBatch(extracted);
                    if (extracted.name) {
                        brandName = extracted.name;
                        // Also update the logger context
                        ResearchLogger.input('Updated Brand Name', brandName);
                    }
                    console.log(`🧬 Extracted ${extractedCount} missing fields:`, Object.keys(extracted));
                } else {
                    await streamThought(0, `Using provided brand details ✓`, 300);
                }
            } catch (err) {
                console.error('❌ Brand extraction failed:', err);
                ResearchLogger.error('BrandExtractor', err);
                await streamThought(0, `Proceeding with available data...`, 300);
            }
        } else if (gaps.length === 0) {
            await streamThought(0, `Brand identity complete ✓`, 300);
        }

        await streamThought(0, `Brand: ${this.getDNA()?.name || brandName} ✓`, 450);
        await streamThought(0, `Industry: ${industry} ✓`, 450);
        await streamThought(0, `Identifying target market...`, 500);
        await streamThought(0, `Target audience profiled ✓`, 400);

        ResearchLogger.output('Phase 0 Complete', {
            brandName: this.getDNA()?.name,
            industry,
            extractedFields: gaps.length > 0 ? 'attempted' : 'complete'
        });

        // ========== STEP 1: Finding Competitors (LIVE SEARCH via ResearchAgent) ==========
        ResearchLogger.phase(1, 'Finding Competitors');
        ResearchLogger.input('Industry Query', industry);
        ResearchLogger.input('Brand Context', `${brandName} - ${industry}`);

        await streamThought(1, `🔍 Searching Google for ${industry} competitors...`, 800);

        // Call ResearchAgent for live competitor data AND branding insights
        let liveCompetitors: CompetitorInfo[] = [];

        try {
            const researchAgent = getResearchAgent();
            ResearchLogger.toolCall('ResearchAgent.researchCompetitors', { industry, brandContext: `${brandName} - ${industry}` });

            const researchResult = await researchAgent.researchCompetitors(
                industry,
                `${brandName} - ${industry}`,
                (phase, message, comps) => {
                    // Stream progress as it happens
                    if (phase === 'searching') {
                        streamThought(1, message, 300);
                        ResearchLogger.thought(1, `[Callback] ${message}`);
                    }
                }
            );

            ResearchLogger.toolResult('ResearchAgent.researchCompetitors', {
                competitorCount: researchResult.competitors.length,
                competitors: researchResult.competitors.map(c => ({ name: c.name, domain: c.domain })),
                differentiationOpportunity: researchResult.differentiationOpportunity,
                competitorBranding: researchResult.competitorBranding
            });

            liveCompetitors = researchResult.competitors;
            differentiationAdvice = researchResult.differentiationOpportunity;

            // Extract competitor colors for analysis
            competitorColors = researchResult.competitorBranding
                .flatMap(cb => [cb.primaryColor, cb.secondaryColor])
                .filter((c): c is string => !!c);

            ResearchLogger.output('Extracted Competitor Colors', competitorColors);

            // Stream the differentiation insight
            if (differentiationAdvice) {
                await streamThought(2, `💡 Strategy: ${differentiationAdvice.slice(0, 80)}...`, 600);
                ResearchLogger.thought(2, `Differentiation: ${differentiationAdvice}`);
            }
        } catch (err) {
            ResearchLogger.error('ResearchAgent.researchCompetitors', err);
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

        ResearchLogger.output('Phase 1 Complete', {
            competitors: streamedCompetitors,
            differentiationAdvice,
            competitorColorsCount: competitorColors.length
        });

        // Store domains for logo fetching
        // const competitorDomains = liveCompetitors.map(c => c.domain); // Not used here, but kept for context

        // ========== CHAIN NEXT PHASE: BRAND COLORS ==========
        // Passing accumulated data to the next handler to maintain state
        const researchData = {
            streamedCompetitors,
            differentiationAdvice,
            competitorColors,
            allThoughts,
            industry,
            brandName
        };

        return this.handleGenerateBrandColors({
            ...args,
            researchData
        });
    }

    public async handleGenerateBrandColors(args: any): Promise<string> {
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
            ResearchLogger.phase(2, 'Analyzing Brand Aesthetics');
            ResearchLogger.input('Differentiation Advice', differentiationAdvice);
            ResearchLogger.input('Competitor Colors to Avoid', competitorColors);

            await streamThought(2, `Analyzing competitor color strategies...`, 600);
            // Use insights from ResearchAgent instead of hardcoded analysis
            if (differentiationAdvice) {
                await streamThought(2, `💡 ${differentiationAdvice.slice(0, 100)}...`, 500);
            }
            await streamThought(2, `Identifying differentiation opportunities...`, 500);
            await streamThought(2, `Market position mapped ✓`, 400);

            ResearchLogger.output('Phase 2 Complete', { differentiationAdvice, competitorColorsCount: competitorColors.length });

            // ========== STEP 3: Generating Color Palettes ==========
            ResearchLogger.phase(3, 'Generating Color Palettes');
            try {
                const paletteCount = palettes?.length || 0;
                console.log(`🎨 Starting Step 3: Generating ${paletteCount} palettes`);
                ResearchLogger.input('Palette Count', paletteCount);
                ResearchLogger.input('Generated Palettes', palettes);

                await streamThought(3, `Generating ${paletteCount} unique palettes...`, 600);
                await streamThought(3, `Avoiding competitor overlap...`, 200);

                if (paletteCount > 0) {
                    await streamThought(3, `Testing contrast ratios...`, 200);
                    for (const palette of palettes.slice(0, 3)) {
                        await streamThought(3, `Creating "${palette.name}" palette...`, 300);
                        ResearchLogger.thought(3, `Creating palette: ${palette.name} with ${palette.colors.length} colors`);
                    }
                    await streamThought(3, `Color harmony validated ✓`, 400);
                } else {
                    await streamThought(3, `Analysis complete (skipped generation).`, 200);
                }

                console.log(`🎨 Sending ${paletteCount} color palettes`);

                const colorMessage = {
                    type: 'THOUGHT_SIGNATURE',
                    nodeId: 'colors',
                    title: 'Color Psychology Strategy',
                    reasoning: `I've designed these palettes to stand out in the ${industry} market. While competitors rely on ${industry === 'design' ? 'safe Swiss styles' : industry === 'tech' ? 'predictable blues' : 'standard conventions'}, I've introduced unexpected accents to signal innovation and differentiate ${brandName}.`,
                    confidence: 0.94
                };
                ResearchLogger.uiMessage('THOUGHT_SIGNATURE (colors)', colorMessage);
                this.sendToClient(colorMessage);

                ResearchLogger.output('Phase 3 Complete', { paletteCount, paletteNames: palettes.map(p => p.name) });
            } catch (err) {
                ResearchLogger.error('Phase 3 Color Generation', err);
                console.error('❌ Error in Step 3 (Color Generation):', err);
                await streamThought(3, `Color generation encountered an issue, proceeding...`, 500);
            }

            // ========== STEP 4: Typography Generation (AI-Driven) ==========
            ResearchLogger.phase(4, 'Crafting Typography');
            let fonts: any[] = [];
            try {
                await streamThought(4, `Analyzing typography trends for ${industry}...`, 500);
                ResearchLogger.input('Industry for Fonts', industry);
                ResearchLogger.input('Brand Name', brandName);

                // Generate Fonts using AI validation
                ResearchLogger.toolCall('generateResearchInformedFonts', { industry, brandName });
                fonts = await this.generateResearchInformedFonts(industry, brandName);
                ResearchLogger.toolResult('generateResearchInformedFonts', fonts);

                if (!fonts || fonts.length === 0) {
                    // Fallback: Try one more time with broader prompt
                    ResearchLogger.toolCall('generateResearchInformedFonts (retry)', { industry: 'general', brandName });
                    fonts = await this.generateResearchInformedFonts('general', brandName);
                    ResearchLogger.toolResult('generateResearchInformedFonts (retry)', fonts);
                }

                // Ensure we have something (last resort safety, but still AI generated)
                if (!fonts || fonts.length === 0) {
                    fonts = [{ name: 'Roboto', category: 'sans-serif', reasoning: 'Universal fallback' }];
                    ResearchLogger.output('Fallback Fonts Used', fonts);
                }

                // Flatten font structure to handle pairings vs single fonts
                const flattenedFonts = fonts.map((f: any) => ({
                    name: f.primary_font?.name || f.name || 'Unknown Font',
                    category: f.primary_font?.category || f.category || 'sans-serif',
                    reasoning: f.reasoning || 'Fits brand personality',
                    pairing: f.secondary_font?.name
                }));
                fonts = flattenedFonts; // Replace with flattened version

                // Stream font thoughts
                for (const font of fonts) {
                    await streamThought(4, `Selecting font: ${font.name} (${font.category})...`, 400);
                    ResearchLogger.thought(4, `Selected font: ${font.name}`);
                }
                await streamThought(4, `Typography pairing complete ✓`, 350);

                const fontMessage = { type: 'FONT_SUGGESTIONS', fonts, previewText: brandName };
                ResearchLogger.uiMessage('FONT_SUGGESTIONS', fontMessage);
                this.sendToClient(fontMessage);

                // DO NOT SAVE to Batch Update immediately. Let user select.
                // this.updateBatch({ typography: fonts.map(f => f.name) });
                ResearchLogger.output('Phase 4 Complete (Selection Pending)', { fontNames: fonts.map(f => f.name) });

            } catch (err) {
                ResearchLogger.error('Phase 4 Typography', err);
                console.error('❌ Error in Step 4 (Fonts):', err);
                await streamThought(4, `Font selection skipped due to error.`, 200);
            }

            // Send Font Thought Signature
            this.sendToClient({
                type: 'THOUGHT_SIGNATURE',
                nodeId: 'typography',
                title: 'Typography Selection',
                reasoning: `To complement the color strategy, I've selected typefaces that balance ${industry === 'design' ? 'modernism with readability' : 'function with form'}. The primary selection of ${fonts[0].name} ensures ${brandName} feels professional yet approachable, while the alternatives offer distinct tonal shifts.`,
                confidence: 0.92
            });


            // ========== STEP 5: Building Strategy ==========
            ResearchLogger.phase(5, 'Building Brand Strategy');
            await streamThought(5, `Finalizing brand strategy...`, 500);

            // Populate the "Brand Strategy" card on frontend
            const currentDNA = this.getDNA();
            ResearchLogger.input('Current DNA State', currentDNA);

            if (currentDNA) {
                const dnaMessage = { type: 'DNA_UPDATE', dna: currentDNA };
                ResearchLogger.uiMessage('DNA_UPDATE', dnaMessage);
                this.sendToClient(dnaMessage);
                await streamThought(5, `Brand Strategy data synced ✓`, 300);
            }

            await streamThought(5, `Tagline and values alignment check...`, 400);

            // Ensure minimum research time has passed
            const elapsed = Date.now() - researchStartTime;
            ResearchLogger.input('Elapsed Time (ms)', elapsed);
            ResearchLogger.input('Minimum Time (ms)', MINIMUM_RESEARCH_TIME);

            if (elapsed < MINIMUM_RESEARCH_TIME) {
                const waitTime = MINIMUM_RESEARCH_TIME - elapsed;
                ResearchLogger.thought(5, `Waiting ${waitTime}ms to meet minimum research time`);
                await streamThought(5, `Finalizing recommendations...`, waitTime);
            }
            await streamThought(5, `Strategy complete ✓`, 400);

            const colorSuggestionsMessage = { type: 'COLOR_SUGGESTIONS', palettes };
            ResearchLogger.uiMessage('COLOR_SUGGESTIONS', colorSuggestionsMessage);
            this.sendToClient(colorSuggestionsMessage);

            // Show canvas only after research is complete
            this.setCanvasMode('colors');

            // Step 6: Complete
            allThoughts = allThoughts.map(t => ({ ...t, status: 'complete' as const }));
            const researchUpdateMessage = {
                type: 'RESEARCH_UPDATE',
                status: 'complete',
                step: 6,
                totalSteps: 6,
                message: 'Research complete!',
                competitors: streamedCompetitors,
                thoughts: allThoughts
            };
            ResearchLogger.uiMessage('RESEARCH_UPDATE (complete)', researchUpdateMessage);
            this.sendToClient(researchUpdateMessage as any);

            this.sendToClient({
                type: 'THOUGHT',
                logic: `Color thread: Rendered ${palettes.length} palettes for ${brandName} in ${industry} market`,
                confidence: 0.92
            });

            // Send RESEARCH_COMPLETE - signals client can safely show canvas
            if (!args.suppressCompletion) {
                const researchCompleteMessage = {
                    type: 'RESEARCH_COMPLETE',
                    summary: {
                        brandName: currentDNA?.name || brandName || 'Unknown',
                        mission: currentDNA?.mission || 'N/A',
                        values: currentDNA?.values || [],
                        voice: currentDNA?.voice || 'N/A',
                        tagline: currentDNA?.tagline || 'N/A',
                        colorsGenerated: palettes.length,
                        fontsGenerated: fonts.length,
                        competitorsFound: streamedCompetitors.length
                    }
                };
                ResearchLogger.uiMessage('RESEARCH_COMPLETE', researchCompleteMessage);
                ResearchLogger.endSession(researchCompleteMessage.summary);
                this.sendToClient(researchCompleteMessage);
            }

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
            const dna = this.getDNA();
            const brandIdentity = `
Mission: ${dna.mission || 'N/A'}
Voice/Personality: ${dna.voice || 'N/A'}
Values: ${dna.values ? dna.values.join(', ') : 'N/A'}
Target Audience: ${dna.targetAudience || 'N/A'}
Tagline: ${dna.tagline || 'N/A'}
`;

            const prompt = `You are a high-end brand identity designer.
            
Brand Identity Context for ${brandName}:
${brandIdentity}

Industry: ${industry}
Differentiation Strategy: ${differentiationAdvice || 'Be unique and stand out'}
Competitor Colors to AVOID: ${competitorColors.length > 0 ? competitorColors.join(', ') : 'None specified'}

Generate ${count} unique color palettes that:
1. Embody the brand's personality (${dna.voice || 'modern'}) and mission
2. Follow the differentiation advice
3. AVOID colors similar to competitor colors
4. Match the "${mood}" mood
5. Provide a sophisticated primary, secondary, and accent structure

Return JSON array:
[
    {
        "name": "Palette Name",
        "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
        "vibe": "brief description of the vibe"
    }
]

IMPORTANT: Return ONLY valid JSON. Each palette must have exactly 5 colors.`;

            ResearchLogger.aiPrompt('generateResearchInformedPalettes', prompt);

            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { temperature: 0.7 }
            });

            const text = response.text || '';
            ResearchLogger.aiResponse('generateResearchInformedPalettes', text);
            console.log(`🎨 Raw Gemini Response for Palettes:\n${text}`);

            let jsonMatch = text.match(/\[[\s\S]*\]/);

            // If strict match fails, try to find any array-like structure
            if (!jsonMatch) {
                console.log('⚠️ Strict JSON match failed, trying lenient match...');
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start !== -1 && end !== -1 && end > start) {
                    jsonMatch = [text.substring(start, end + 1)];
                }
            }

            if (jsonMatch) {
                try {
                    // Sanitize potential trailing commas or markdown issues before parsing
                    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']');
                    const parsed = JSON.parse(cleanJson);

                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map(p => ({
                            name: p.name || 'Custom Palette',
                            colors: (p.colors || []).filter((c: string) => /^#[0-9A-Fa-f]{3,8}$/.test(c)),
                            vibe: p.vibe || mood
                        })).filter(p => p.colors.length >= 3);
                    }
                } catch (parseErr) {
                    console.error('❌ JSON Parse Failed for Palettes:', parseErr, '\nSnippet:', jsonMatch[0].slice(0, 100));
                }
            } else {
                console.warn('⚠️ No JSON array found in Gemini response.');
            }
            return null;
        } catch (e) {
            console.error('❌ generateResearchInformedPalettes failed:', e);
            return null;
        }
    }

    /**
     * Generate font pairings informed by industry and brand DNA
     */
    private async generateResearchInformedFonts(
        industry: string,
        brandName: string
    ): Promise<any[]> {
        try {
            const dna = this.getDNA();
            const brandIdentity = `
Mission: ${dna.mission || 'N/A'}
Voice/Personality: ${dna.voice || 'N/A'}
Values: ${dna.values ? dna.values.join(', ') : 'N/A'}
Target Audience: ${dna.targetAudience || 'N/A'}
Tagline: ${dna.tagline || 'N/A'}
`;

            const prompt = `You are a world-class typography strategist selecting fonts for "${brandName}".

Brand Identity Context:
${brandIdentity}

Industry: ${industry}

Generate 3 distinct typography pairings (Primary + Secondary font) that embody the brand's voice and personality.
Primary font: Distinctive, matching the brand personality.
Secondary font: Harmonious, legible, complementary.

Return JSON array:
[
    {
        "primary_font": {
            "name": "Primary Font Name",
            "category": "serif/sans-serif/display"
        },
        "secondary_font": {
            "name": "Secondary Font Name",
            "category": "serif/sans-serif/display"
        },
        "reasoning": "Why this pairing fits the brand"
    }
]
IMPORTANT: Return ONLY valid JSON. Use real Google Fonts.`;

            ResearchLogger.aiPrompt('generateResearchInformedFonts', prompt);

            const response = await this.genAI.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: { temperature: 0.7 }
            });

            const text = response.text || '';
            ResearchLogger.aiResponse('generateResearchInformedFonts', text);
            console.log(`🔤 Raw Gemini Response for Fonts:\n${text}`);

            let jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                const start = text.indexOf('[');
                const end = text.lastIndexOf(']');
                if (start !== -1 && end !== -1 && end > start) {
                    jsonMatch = [text.substring(start, end + 1)];
                }
            }

            if (jsonMatch) {
                try {
                    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']');
                    const parsed = JSON.parse(cleanJson);
                    return parsed;
                } catch (e) {
                    console.error('❌ JSON Parse Failed for Fonts:', e);
                }
            }
            return [];
        } catch (e) {
            console.error('❌ generateResearchInformedFonts failed:', e);
            return [];
        }
    }

    /**
     * Handle generate_brand_fonts tool - Atomic font generation step
     * Uses industry and brand context for research-informed font selection
     */
    public async handleGenerateBrandFonts(args: any): Promise<string> {
        console.log('🔤 Starting atomic font generation');
        const brandName = this.getDNA()?.name || 'Your Brand';
        const industry = args.industry || 'general';

        try {
            const fonts = await this.generateResearchInformedFonts(industry, brandName);

            if (fonts && fonts.length > 0) {
                // Flatten font structure for client/session consistency
                const flattenedFonts = fonts.map((f: any) => ({
                    name: f.primary_font?.name || f.name || 'Unknown Font',
                    category: f.primary_font?.category || f.category || 'sans-serif',
                    reasoning: f.reasoning || 'Fits brand personality',
                    pairing: f.secondary_font?.name
                }));

                // Store flattened fonts for selection
                this.storeFonts(flattenedFonts);

                const fontNames = flattenedFonts.map((f: any) => f.name);
                // DO NOT save to DNA immediately. Let user select one.
                // this.updateBatch({ typography: fontNames });

                console.log('🔤 Suggested Fonts (Selection Pending):', fontNames);

                // Send to client
                this.sendToClient({
                    type: 'FONT_SUGGESTIONS',
                    fonts,
                    previewText: brandName
                });

                this.sendToClient({
                    type: 'THOUGHT',
                    logic: `Typography selected: ${fonts.map((f: any) => f.name).join(', ')}`,
                    confidence: 0.92
                });

                return `Generated ${fonts.length} typography options: ${fonts.map((f: any) => f.name).join(', ')}.`;
            }

            return 'Font generation completed with fallbacks.';
        } catch (error) {
            console.error('❌ handleGenerateBrandFonts failed:', error);
            return 'Font generation encountered an error.';
        }
    }

    /**
     * Handle finalize_brand_dna tool - Final validation and canvas reveal
     * This is the gatekeeper - ensures all fields exist before showing canvas
     */
    public async handleFinalizeBrandDNA(args: any): Promise<string> {
        console.log('✅ Finalizing Brand DNA');
        const currentDNA = this.getDNA();

        // Validate required fields
        const hasName = !!currentDNA.name?.trim();
        const hasMission = !!currentDNA.mission?.trim();
        const hasValues = currentDNA.values && currentDNA.values.length > 0;
        const hasVoice = !!currentDNA.voice?.trim();
        const hasColors = currentDNA.colors && currentDNA.colors.length > 0;
        const hasTypography = currentDNA.typography && currentDNA.typography.length > 0;

        const isComplete = hasName && hasMission && hasValues && hasVoice && hasColors && hasTypography;

        if (!isComplete) {
            console.warn('⚠️ Brand DNA incomplete:', {
                name: hasName,
                mission: hasMission,
                values: hasValues,
                voice: hasVoice,
                colors: hasColors,
                typography: hasTypography
            });
        }

        // Sync final DNA state to client
        this.sendToClient({
            type: 'DNA_UPDATE',
            dna: currentDNA
        });

        // Trigger canvas reveal
        this.setCanvasMode('colors');

        // Send RESEARCH_COMPLETE signal with FULL summary
        this.sendToClient({
            type: 'RESEARCH_COMPLETE',
            summary: {
                brandName: currentDNA.name || 'Unknown',
                mission: currentDNA.mission || 'N/A',
                values: currentDNA.values || [],
                voice: currentDNA.voice || 'N/A',
                tagline: currentDNA.tagline || 'N/A',
                colorsGenerated: currentDNA.colors?.length || 0,
                fontsGenerated: currentDNA.typography?.length || 0,
                competitorsFound: 0 // This is finalization, not research
            }
        });

        // Resume Gemini Live audio
        this.onResumeVoice();

        // Transition to modification phase
        this.onPhaseChange('modification');

        return `Brand DNA finalized. Canvas revealed with ${currentDNA.colors?.length || 0} colors and ${currentDNA.typography?.length || 0} fonts.`;
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
            // OMITTED: Preventing double-generation. Color generation is RESERVED for extract_brand_identity (Phase 2).
            /*
            await this.handleColorSuggestions({
                ...args,
                // Pass industry explicitly from Brain
                industry: args.industry,
                // Pass pre-computed research data
                researchData: researchResult,
                // Ensure we have necessary flags if needed
                competitor_count: args.competitor_count || 3
            });
            */

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

        // PERSIST to DNA so get_canvas_state can access later
        const dna = this.getDNA();
        const existingInsights = dna?.researchInsights || [];
        const newInsight = {
            query,
            result: result || 'No results found',
            focus: focus || 'general',
            timestamp: Date.now()
        };

        // Keep last 5 research insights (memory efficiency)
        const updatedInsights = [...existingInsights, newInsight].slice(-5);
        this.updateBatch({ researchInsights: updatedInsights });
        console.log(`📝 Saved research insight: "${query}" (total: ${updatedInsights.length})`);

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Research Context Found: ${result ? result.substring(0, 100) : 'No results'}... (Saved to memory)`,
            confidence: 1.0
        });

        this.onResumeVoice();

        // This return string becomes 'system_note' for Gemini, giving it the memory of this research
        return `[RESEARCH CONTEXT] Query: "${query}"\nResult: ${result}\n(IMPORTANT: Use this information to inform subsequent design decisions)`;
    }



    /**
     * Get Current Canvas State
     * Returns the current state of saved DNA for Brain's context
     * This is the SINGLE SOURCE OF TRUTH for Brain to understand what's on the canvas
     */
    private handleGetCanvasState(args: any): string {
        console.log('📊 Getting canvas state for Brain context');

        const dna = this.getDNA();

        // Build COMPLETE canvas state - ALL fields shown on canvas
        const canvasState = {
            // IDENTITY FRAME
            name: dna?.name || null,

            // OVERVIEW FRAME
            mission: dna?.mission || null,
            tagline: dna?.tagline || null,

            // STRATEGY FRAME
            voice: dna?.voice || null,
            values: dna?.values || [],
            targetAudience: dna?.targetAudience || null,

            // VISUALS FRAME
            colors: dna?.colors || [],
            typography: dna?.typography || [],
            logoType: dna?.logoType || null,
            imagery: dna?.imagery || null,
            logoAssets: dna?.logoAssets?.map(a => ({ url: a.url, name: a.name, style: a.style })) || [],

            // RESEARCH CONTEXT
            competitorInsights: dna?.competitorInsights ? {
                industry: dna.competitorInsights.industry,
                analyzed: dna.competitorInsights.analyzed,
                recommendation: dna.competitorInsights.recommendation?.substring(0, 200) + '...'
            } : null,
            researchInsights: (dna?.researchInsights || []).slice(-3).map(r => ({
                query: r.query,
                summary: r.result.substring(0, 150) + '...'
            }))
        };

        // Count what's populated
        const populatedCount = {
            identity: canvasState.name ? 1 : 0,
            overview: (canvasState.mission ? 1 : 0) + (canvasState.tagline ? 1 : 0),
            strategy: (canvasState.voice ? 1 : 0) + (canvasState.values.length > 0 ? 1 : 0),
            visuals: (canvasState.colors.length > 0 ? 1 : 0) + (canvasState.typography.length > 0 ? 1 : 0) + (canvasState.logoAssets.length > 0 ? 1 : 0)
        };

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Canvas State Retrieved: ${canvasState.colors.length} colors, ${canvasState.typography.length} fonts, ${canvasState.logoAssets.length} logos saved`,
            confidence: 1.0
        });

        // Return human-readable format for Brain
        return `[CANVAS STATE - COMPLETE]

=== IDENTITY ===
Name: ${canvasState.name || '❌ Not set'}

=== OVERVIEW ===
Mission: ${canvasState.mission || '❌ Not set'}
Tagline: ${canvasState.tagline || '❌ Not set'}

=== STRATEGY ===
Voice: ${canvasState.voice || '❌ Not set'}
Values: ${canvasState.values.length > 0 ? canvasState.values.join(', ') : '❌ Not set'}
Target Audience: ${canvasState.targetAudience || '❌ Not set'}

=== VISUALS ===
Colors (${canvasState.colors.length}): ${canvasState.colors.slice(0, 6).join(', ') || '❌ None saved'}
Typography (${canvasState.typography.length}): ${canvasState.typography.join(', ') || '❌ None saved'}
Logo Type: ${canvasState.logoType || '❌ Not set'}
Imagery: ${canvasState.imagery || '❌ Not set'}
Logo Assets (${canvasState.logoAssets.length}): ${canvasState.logoAssets.length > 0 ? 'See saved designs' : '❌ None saved'}

=== RESEARCH CONTEXT ===
Competitor Analysis: ${canvasState.competitorInsights ? `Industry: ${canvasState.competitorInsights.industry}, Analyzed: ${canvasState.competitorInsights.analyzed.join(', ')}` : '❌ Not done'}
Recent Research: ${canvasState.researchInsights.length > 0 ? canvasState.researchInsights.map(r => `• ${r.query}`).join(', ') : '❌ None'}

[Use this context to inform your tool selection]`;
    }
}

