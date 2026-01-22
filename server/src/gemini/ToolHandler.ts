import {
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage,
    DNAUpdateMessage
} from '../../../shared/messages';
import { FontSuggestion, ColorPalette, BrandDNA, LogoStructureOption, ImagerySuggestion, LogoInspiration } from '../../../shared/types';
import { GoogleGenAI } from '@google/genai';
import { SearchGroundingService } from './SearchGroundingService';
import { BrainLogger } from '../utils/BrainLogger';
import { ResearchLogger } from '../utils/ResearchLogger';
import { ExecutionEngine } from '../services/ExecutionEngine';
import { stateManager } from '../services/StateManager';

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
    private conversationHistory: string = '';
    private onPhaseChange: (phase: 'discovery' | 'execution' | 'modification') => void;
    private executionEngine: ExecutionEngine;
    private researchCycleCompleted: boolean = false;
    private onPauseVoice: () => void;
    private onResumeVoice: () => void;

    constructor(
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void,
        storePalettes: (palettes: ColorPalette[]) => void = () => { },
        storeFonts: (fonts: FontSuggestion[]) => void = () => { },
        setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void = () => { },
        getDNA: () => BrandDNA = () => ({
            name: { value: '', isSelected: true },
            mission: { value: '', isSelected: true },

            values: { items: [], isSelected: true },
            voice: { value: '', isSelected: true },
            tagline: { value: '', isSelected: true },
            targetAudience: { items: [], isSelected: true },
            mood: { items: [], isSelected: true }
        } as BrandDNA),
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
        this.onPhaseChange = onPhaseChange;
        this.onPauseVoice = onPauseVoice;
        this.onResumeVoice = onResumeVoice;
        this.searchService = new SearchGroundingService(process.env.GEMINI_API_KEY || '');
        this.executionEngine = new ExecutionEngine();
    }

    public setConversationHistory(history: string): void {
        this.conversationHistory = history;
        console.log(`📝 ToolHandler received ${history.length} chars of conversation history`);
    }

    async handleToolCalls(functionCalls: FunctionCall[]): Promise<FunctionResponse[]> {
        const responses: FunctionResponse[] = [];

        for (const fc of functionCalls) {
            console.log(`🔧 Processing tool: ${fc.name}`, JSON.stringify(fc.args || {}));
            let contextSummary = "Action completed.";

            try {
                // START RESEARCH HANDLER
                if (fc.name === 'start_brand_research') {
                    if (this.researchCycleCompleted) {
                        contextSummary = "Research already completed.";
                    } else {
                        this.researchCycleCompleted = true;

                        // Switch to EXECUTION phase (blocks user input if UI follows this)
                        this.onPhaseChange('execution');

                        // Notify client of start
                        this.sendToClient({
                            type: 'RESEARCH_UPDATE',
                            status: 'started',
                            message: 'Starting comprehensive brand research...',
                            step: 0,
                            totalSteps: 5
                        });

                        // Mute voice immediately as requested
                        this.onPauseVoice();

                        // Run 5-Phase Execution Engine with REAL-TIME thought streaming
                        const researchResult = await this.executionEngine.runFullResearchCycle(
                            this.conversationHistory,
                            // NEW: Real-time streaming callback (replaces batch replay)
                            (stepIndex, nodeId, title, reasoning) => {
                                // Send THOUGHT_SIGNATURE for each step as it happens
                                this.sendToClient({
                                    type: 'THOUGHT_SIGNATURE',
                                    nodeId: nodeId,
                                    title: title,
                                    reasoning: reasoning,
                                    confidence: 0.90
                                });
                                // Also send RESEARCH_UPDATE for step progress
                                this.sendToClient({
                                    type: 'RESEARCH_UPDATE',
                                    status: stepIndex < 4 ? 'searching' : 'complete',
                                    message: title,
                                    step: stepIndex,  // 0-indexed to match thought IDs (step0-, step1-, etc.)
                                    totalSteps: 5
                                });
                            }
                        );

                        // ---------------------------------------------------------
                        // DATA POPULATION (no delays - data is sent once available)
                        // ---------------------------------------------------------

                        // ---------------------------------------------------------

                        // Save FULL state - this triggers SessionManager to broadcast FULL_STATE_UPDATE
                        await stateManager.saveFullState(researchResult);

                        // Send Competitors list (Keep this as UI notification for now, or could depend on full state)
                        // Actually, client likely parses competitors from Full State if we add it there.
                        // But keeping RESEARCH_UPDATE "complete" status is good for loading bars.
                        this.sendToClient({
                            type: 'RESEARCH_UPDATE',
                            status: 'complete',
                            message: 'Research complete!',
                            step: 5,
                            totalSteps: 5,
                            competitors: researchResult.competitorResearch.competitors.map(c => c.name)
                        });

                        // Resume voice for modification phase
                        this.onResumeVoice();

                        // Switch to MODIFICATION phase
                        this.onPhaseChange('modification');

                        contextSummary = `Research complete. Generated ${researchResult.colorPalettes.palettes.length} palettes and ${researchResult.typographyPairings.fonts.length} fonts. Canvas updated with AI reasoning.`;
                    }
                }
                // MODIFICATION: Typography
                else if (fc.name === 'display_typography_options') {
                    contextSummary = await this.handleTypographyOptions(fc.args);
                }
                // MODIFICATION: Colors
                else if (fc.name === 'display_palette_options') {
                    contextSummary = await this.handlePaletteOptions(fc.args);
                }

                // --- SINGLE VALUE UPDATES ---
                else if (fc.name === 'update_brand_name') {
                    contextSummary = await this.updateSingleValue('name', fc.args.name);
                }
                else if (fc.name === 'update_mission') {
                    contextSummary = await this.updateSingleValue('mission', fc.args.mission);
                }
                else if (fc.name === 'update_tagline') {
                    contextSummary = await this.updateSingleValue('tagline', fc.args.tagline);
                }
                else if (fc.name === 'update_voice') {
                    contextSummary = await this.updateSingleValue('voice', fc.args.voice);
                }
                else if (fc.name === 'update_values') {
                    contextSummary = await this.updateSingleValue('values', fc.args.values, true);
                }
                else if (fc.name === 'update_target_audience') {
                    contextSummary = await this.updateSingleValue('targetAudience', fc.args.targetAudience, true);
                }
                else if (fc.name === 'update_mood') {
                    contextSummary = await this.updateSingleValue('mood', fc.args.mood, true);
                }

                // MODIFICATION: Logo Structure
                else if (fc.name === 'display_logo_structure_options') {
                    contextSummary = await this.handleLogoStructureOptions(fc.args);
                }
                // MODIFICATION: Imagery
                else if (fc.name === 'display_imagery_suggestions') {
                    contextSummary = await this.handleImagerySuggestions(fc.args);
                }
                // MODIFICATION: Logo Inspiration
                else if (fc.name === 'display_logo_inspirations') {
                    contextSummary = await this.handleLogoInspirations(fc.args);
                }
                // GENERAL
                else if (fc.name === 'general_research') {
                    contextSummary = await this.handleGeneralResearch(fc.args);
                }

                // COMPLIANCE
                else if (fc.name === 'verify_asset_compliance') {
                    await this.handleVerifyAssetCompliance(fc.args);
                    contextSummary = "Compliance check running in background.";
                }
                else {
                    console.warn(`Unknown tool: ${fc.name}`);
                    contextSummary = `Tool ${fc.name} not implemented or removed.`;
                }

                responses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: contextSummary }
                });

            } catch (error) {
                console.error(`❌ Error in tool ${fc.name}:`, error);
                responses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: `Error executing ${fc.name}: ${error instanceof Error ? error.message : String(error)}` }
                });
            }
        }
        return responses;
    }

    // ==========================================
    // MODIFICATION PHASE HANDLERS
    // ==========================================

    private async handleTypographyOptions(args: any): Promise<string> {
        this.setCanvasMode('fonts');



        // CASE 2: GENERATE (New options request)
        // If specific 'generate' op or just context, we might generate.
        // But for robust CRUD, we usually want to UPDATE based on LLM's full view.

        // However, if args.fonts IS provided, that IS the new state (CRUD/Select result).
        if (args.fonts && Array.isArray(args.fonts)) {
            let newFonts: FontSuggestion[] = args.fonts;

            // Enforce Limit
            if (newFonts.length > 10) newFonts = newFonts.slice(0, 10);

            // Re-index IDs to be stable numeric strings "1", "2", "3"...
            newFonts = newFonts.map((f, index) => ({
                ...f,
                id: (index + 1).toString(), // STABLE NUMERIC ID
                isSelected: !!f.isSelected
            }));

            // Count selected
            const selectedCount = newFonts.filter(f => f.isSelected).reduce((acc, _) => acc + 1, 0);

            // Save State
            await stateManager.saveWithHistory('typographyPairings', {
                fonts: newFonts,
                rationale: 'User updated typography (CRUD/Select)'
            });

            return `Updated fonts. State is now saved with ${newFonts.length} fonts. ${selectedCount} are selected.`;
        }

        // GENERATE MODE (If no list provided)
        const currentState = stateManager.loadLatest();
        const dna = currentState?.brandDNA || this.getDNA();
        const existingFonts = currentState?.typographyPairings?.fonts || [];

        if (existingFonts.length >= 10) return "Limit reached (10 fonts). Please delete some to generate more.";

        const countToGenerate = Math.min(args.font_count || 3, 10 - existingFonts.length);

        const result = await this.executionEngine.generateTypography(
            dna,
            countToGenerate,
            args.style_filter || dna.mission.value
        );

        // Append and Re-index
        const mergedFonts = [...existingFonts, ...result.fonts];
        const finalFonts = mergedFonts.map((f, index) => ({
            ...f,
            id: (index + 1).toString(),
            isSelected: !!f.isSelected
        }));

        await stateManager.saveWithHistory('typographyPairings', {
            fonts: finalFonts,
            rationale: result.rationale || 'Generated new fonts'
        });

        return `Generated ${result.fonts.length} new fonts. Total: ${finalFonts.length}.`;
    }

    private async handlePaletteOptions(args: any): Promise<string> {
        this.setCanvasMode('colors');

        // CASE 1: UPDATE / SELECT (List provided)
        if (args.palettes && Array.isArray(args.palettes)) {
            const palettes: ColorPalette[] = args.palettes;
            const selectedCount = palettes.filter(p => p.isSelected).length;

            // Save State
            await stateManager.saveWithHistory('colorPalettes', {
                palettes,
                rationale: 'User updated palette selection'
            });

            if (selectedCount > 0) return `Updated palettes. ${selectedCount} palette(s) are now selected. [SYSTEM: Confirm these choices with the user.]`;
            return `Updated palette options. No palettes are currently selected. [SYSTEM: Ask the user to pick a palette.]`;
        }

        // CASE 2: GENERATE (New options requested)
        const currentState = stateManager.loadLatest();
        const dna = currentState?.brandDNA || this.getDNA();
        const competitors = currentState?.competitorResearch;
        const existingPalettes = currentState?.colorPalettes?.palettes || [];

        // STRICT LIMIT: Max 10 palettes total
        if (existingPalettes.length >= 10) {
            return "Limit reached: You already have 10 color palettes. Please DELETE some before generating more. [SYSTEM: Suggest deleting unwanted palettes first.]";
        }

        const countToGenerate = Math.min(args.palette_count || 3, 10 - existingPalettes.length);

        const result = await this.executionEngine.generateColorPalettes(
            dna,
            competitors, // Pass competitors (optional but good context)
            countToGenerate,
            args.mood_filter || dna.mission.value
        );

        // MERGE: Append new palettes to existing list
        const updatedPalettes = [...existingPalettes, ...result.palettes];

        // Save
        await stateManager.saveWithHistory('colorPalettes', {
            palettes: updatedPalettes,
            rationale: result.rationale || `Generated new palettes for mood: ${args.mood_filter || 'general'}`
        });

        // NOTE: Removed manual sendToClient - StateManager listener handles broadcast

        const paletteNames = result.palettes.map(p => p.name).join(', ');
        return `Generated ${result.palettes.length} new palettes: ${paletteNames}. [SYSTEM: The new palettes are now visible on the Brand Board. Ask the user if they want to review them now, or if you should describe the colors.]`;
    }

    // --- HELPER FOR SINGLE VALUE UPDATES ---
    private async updateSingleValue(field: keyof BrandDNA, value: any, isArray: boolean = false): Promise<string> {
        if (value === undefined || value === null) return `Error: No value provided for ${field}`;

        const wrapped = isArray
            ? { items: value, isSelected: true }
            : { value: value, isSelected: true };

        // Load state
        const state = stateManager.loadLatest();
        if (!state || !state.brandDNA) return "Error: No state found";

        // Update persistence state
        state.brandDNA[field] = wrapped as any;
        // NOTE: StateManager.saveWithHistory emits 'stateUpdated' which SessionManager
        // listens to and broadcasts DNA_UPDATE to all clients automatically.
        await stateManager.saveWithHistory('brandDNA', state.brandDNA);

        // Update in-memory session state (for simple access)
        this.updateState(field, wrapped);

        // Broadcast removed: StateManager listener handles it

        return `Updated ${field} to ${isArray ? (value as string[]).join(', ') : value}.`;
    }

    // --- HELPER FOR SELECTIONS ---
    // (Deprecated/Unused but keeping for safety for now, or could remove)
    private async selectOptions(
        section: 'colorPalettes' | 'typographyPairings' | 'logoStructures' | 'logoInspirations' | 'imagery',
        arrayField: string,
        selectedIds: string[],
        itemName: string
    ): Promise<string> {
        return "Tool deprecated. Use display_* tools with isSelected=true instead.";
    }

    private async handleLogoStructureOptions(args: any): Promise<string> {
        // CASE 1: UPDATE / SELECT
        if (args.options && Array.isArray(args.options)) {
            const options: LogoStructureOption[] = args.options;
            const selectedCount = options.filter(o => o.isSelected).length;

            await stateManager.saveWithHistory('logoStructures', {
                options,
                rationale: 'User updated logo structure selection'
            });

            this.sendToClient({ type: 'LOGO_STRUCTURE_OPTIONS', options } as any);
            this.sendToClient({ type: 'LOGO_STRUCTURE_OPTIONS', options } as any);
            return `Updated logo structures. ${selectedCount} selected. [SYSTEM: Confirm the update and ask the user if they want to review the structures on the board.]`;
        }

        // CASE 2: GENERATE
        // Assuming we rely on simple generation here as ExecutionEngine might not have this method yet,
        // or we check if ExecutionEngine has it. The original code did manual mapping. 
        // Let's keep the manual mapping logic but ensure it's triggered correctly.
        // Actually, for consistency, let's just use the manual logic here as previous.

        // Transform AI output to match our schema (old simple logic)
        // Wait, if this tool serves "Generate" and args.options is missing, what generates?
        // The Brain calls this tool with proposed options in AI-thought, or expects internal generation?
        // The previous implementation utilized args passed FROM the Brain (which generated them).
        // So `args.options` IS the generated list.
        // BUT wait, if Brain generates, it passes `options`. If Brain wants to select, it passes `options` with isSelected.
        // So the logic is uniform! "Process these options".

        // The only distinction is whether we are overwriting IDs or preserving them?
        // If IDs exist, preserve. If not, generate.

        const rawOptions = args.options || [];
        const options: LogoStructureOption[] = rawOptions.map((opt: any, i: number) => ({
            id: opt.id || `logo-structure-${Date.now()}-${i + 1}`,
            type: opt.type || 'wordmark',
            reasoning: opt.reasoning || '',
            suitability: opt.suitability || 'Medium',
            isSelected: !!opt.isSelected
        }));

        await stateManager.saveWithHistory('logoStructures', {
            options,
            rationale: args.rationale || 'AI-generated logo structure options'
        });

        this.sendToClient({ type: 'LOGO_STRUCTURE_OPTIONS', options } as any);

        const typeList = options.map(o => o.type).join(', ');
        return `Processed ${options.length} logo options: ${typeList}. [SYSTEM: The logo structures are now on the board. Ask the user if they want to review them.]`;
    }

    private async handleImagerySuggestions(args: any): Promise<string> {
        // Uniform logic: args.suggestions holds the state (new or updated)
        const rawSuggestions = args.suggestions || [];

        const suggestions: ImagerySuggestion[] = rawSuggestions.map((s: any, i: number) => ({
            id: s.id || `imagery-${Date.now()}-${i + 1}`,
            concept: s.concept || '',
            description: s.description || '',
            isSelected: !!s.isSelected
        }));

        await stateManager.saveWithHistory('imagery', {
            suggestions,
            rationale: args.rationale || 'AI-generated imagery suggestions'
        });

        this.sendToClient({ type: 'IMAGERY_SUGGESTIONS', suggestions } as any);

        const conceptList = suggestions.slice(0, 3).map(s => s.concept).join(', ');
        return `Processed ${suggestions.length} imagery suggestions including ${conceptList}. [SYSTEM: Imagery concepts are now on the board. Ask the user's opinion on them.]`;
    }

    private async handleLogoInspirations(args: any): Promise<string> {
        // CASE 1: SEARCH (Generate/Append)
        if (args.search_query) {
            // Use SearchService
            const results = await this.searchService.searchLogoInspirationFromWeb({
                styleKeywords: args.search_query,
                industry: 'branding'
            });

            // Load existing to append to
            const currentState = stateManager.loadLatest();
            const existing = currentState?.logoInspirations?.inspirations || [];
            const nextIndex = existing.length + 1;

            // Transform to schema
            const newInspirations: LogoInspiration[] = results.map((r, i) => ({
                id: `logo_${nextIndex + i}`,
                displayName: `logo_${nextIndex + i}`,
                url: r.url,
                isSelected: false
            }));

            const combined = [...existing, ...newInspirations];

            // Save
            await stateManager.saveWithHistory('logoInspirations', {
                inspirations: combined,
                rationale: `Added ${newInspirations.length} results for "${args.search_query}"`
            });

            // Send full list
            this.sendToClient({
                type: 'LOGO_INSPIRATION_RESULTS',
                results: combined
            } as any);

            return `I found ${newInspirations.length} new logo inspirations for "${args.search_query}". Total ${combined.length} items available. [SYSTEM: Tell the user you found new logos. Ask if they want to see the "Mood Board" on the canvas.]`;
        }

        // CASE 2: MANAGE (Update/Select/Delete)
        if (args.inspirations) {
            const newInspirations: LogoInspiration[] = args.inspirations;
            const selectedCount = newInspirations.filter(i => i.isSelected).length;

            // Save
            await stateManager.saveWithHistory('logoInspirations', {
                inspirations: newInspirations,
                rationale: 'User updated logo inspiration selection'
            });

            // Send update
            this.sendToClient({
                type: 'LOGO_INSPIRATION_RESULTS',
                results: newInspirations
            } as any);

            return `Updated logo inspirations. ${selectedCount} items are currently selected. [SYSTEM: Confirm the selection. Ask if they want to search for more.]`;
        }

        return "No action taken. Please provide search_query or inspirations list.";
    }

    private async handleGeneralResearch(args: any): Promise<string> {
        const query = args.query;
        // Simple Google Search via SearchService
        const results = await this.searchService.search(query);

        // Save to state with history (append to existing queries)
        const currentState = stateManager.loadLatest();
        const existingQueries = currentState?.generalResearch?.queries || [];

        const newQuery = {
            id: `research-${existingQueries.length + 1}`,
            query,
            result: results.slice(0, 500),
            timestamp: new Date().toISOString()
        };

        await stateManager.saveWithHistory('generalResearch', {
            queries: [...existingQueries, newQuery]
        });

        // Speech-friendly summary for Live to read
        const briefResult = results.slice(0, 150).replace(/\n/g, ' ');
        return `I researched ${query} for you. Here's what I found: ${briefResult}. The full results are saved for reference.`;
    }

    private async handleVerifyAssetCompliance(args: any): Promise<void> {
        console.log('Verify asset compliance triggered', args);
        // Implementation placeholder - likely involves vision check
    }
}

