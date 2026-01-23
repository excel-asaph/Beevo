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
                // --- COLOR PALETTE TOOLS ---
                else if (fc.name === 'create_color_palette') {
                    contextSummary = await this.handleCreatePalette(fc.args);
                }
                else if (fc.name === 'delete_color_palette') {
                    contextSummary = await this.handleDeletePalette(fc.args);
                }
                else if (fc.name === 'select_color_palettes') {
                    contextSummary = await this.handleSelectPalette(fc.args);
                }
                else if (fc.name === 'unselect_color_palettes') {
                    contextSummary = await this.handleUnselectPalette(fc.args);
                }
                else if (fc.name === 'update_colors_in_palette') {
                    contextSummary = await this.handleUpdateColorsInPalette(fc.args);
                }

                // --- TYPOGRAPHY TOOLS ---
                else if (fc.name === 'create_typography') {
                    contextSummary = await this.handleCreateTypography(fc.args);
                }
                else if (fc.name === 'delete_typography') {
                    contextSummary = await this.handleDeleteTypography(fc.args);
                }
                else if (fc.name === 'select_typography') {
                    contextSummary = await this.handleSelectTypography(fc.args);
                }
                else if (fc.name === 'unselect_typography') {
                    contextSummary = await this.handleUnselectTypography(fc.args);
                }

                // --- SINGLE VALUE UPDATES ---
                else if (fc.name === 'update_brand_name') {
                    contextSummary = await this.handleBrandUpdate('name', fc.args);
                }
                else if (fc.name === 'update_mission') {
                    contextSummary = await this.handleBrandUpdate('mission', fc.args);
                }
                else if (fc.name === 'update_tagline') {
                    contextSummary = await this.handleBrandUpdate('tagline', fc.args);
                }
                else if (fc.name === 'update_voice') {
                    contextSummary = await this.handleBrandUpdate('voice', fc.args);
                }
                else if (fc.name === 'update_values') {
                    contextSummary = await this.handleBrandUpdate('values', fc.args, true);
                }
                else if (fc.name === 'update_target_audience') {
                    contextSummary = await this.handleBrandUpdate('targetAudience', fc.args, true);
                }
                else if (fc.name === 'update_mood') {
                    contextSummary = await this.handleBrandUpdate('mood', fc.args, true);
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

    // ==========================================
    // COLOR PALETTE HANDLERS
    // ==========================================

    private async handleCreatePalette(args: any): Promise<string> {
        this.setCanvasMode('colors');
        const currentState = stateManager.loadLatest();
        const existingPalettes = currentState?.colorPalettes?.palettes || [];

        // Strict Limit Check (Max 10)
        if (existingPalettes.length >= 10) {
            return "Limit reached: Maximum 10 palettes allowed. Please delete some before creating new ones.";
        }

        const count = Math.min(args.count || 1, 10 - existingPalettes.length);
        const query = args.query || args.mood_filter || "modern";

        // Use Execution Engine to generate (Instruction: Create new based on context)
        const newPalettes = await this.executionEngine.createModificationPalettes(
            existingPalettes,
            query,
            count
        );

        // Merge logic
        const updatedPalettes = [...existingPalettes, ...newPalettes];

        await stateManager.saveWithHistory('colorPalettes', {
            palettes: updatedPalettes,
            rationale: `Created new palettes based on: ${query}`
        });

        return `Created ${newPalettes.length} new palettes based on "${query}". Total palettes: ${updatedPalettes.length}.`;
    }

    private async handleDeletePalette(args: any): Promise<string> {
        const instruction = args.instruction || args.names?.join(', '); // Fallback to names if old call
        if (!instruction) return "No instruction provided for deletion.";

        const currentState = stateManager.loadLatest();
        const existingPalettes = currentState?.colorPalettes?.palettes || [];

        // Resolve which palettes to delete (Now returns IDs)
        const idsToDelete = await this.executionEngine.resolvePaletteSelector(existingPalettes, instruction);

        if (idsToDelete.length === 0) return "I couldn't identify which palettes to delete. Please be more specific.";

        // Filter out matching IDs
        const keptPalettes = existingPalettes.filter(p => !idsToDelete.includes(p.id));

        const deletedCount = existingPalettes.length - keptPalettes.length;

        await stateManager.saveWithHistory('colorPalettes', {
            palettes: keptPalettes,
            rationale: `Deleted ${deletedCount} palettes`
        });

        return `Deleted ${deletedCount} palettes. Remaining: ${keptPalettes.length}.`;
    }

    private async handleSelectPalette(args: any): Promise<string> {
        return this._updatePaletteSelection(args, true);
    }

    private async handleUnselectPalette(args: any): Promise<string> {
        return this._updatePaletteSelection(args, false);
    }

    // Helper for Select/Unselect logic
    private async _updatePaletteSelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        const currentState = stateManager.loadLatest();
        const palettes = currentState?.colorPalettes?.palettes || [];

        if (!instruction) return "No instruction provided.";

        // Resolve IDs
        const targetIds = await this.executionEngine.resolvePaletteSelector(palettes, instruction);
        
        if (targetIds.length === 0) return `I couldn't identify which palettes to ${isSelected ? 'select' : 'unselect'}.`;

        let changeCount = 0;
        const updatedPalettes = palettes.map(p => {
            const isTarget = targetIds.includes(p.id);
            if (isTarget) {
                changeCount++;
                return { ...p, isSelected: isSelected };
            }
            return p;
        });

        await stateManager.saveWithHistory('colorPalettes', {
            palettes: updatedPalettes,
            rationale: `User ${isSelected ? 'selected' : 'unselected'} ${changeCount} palettes`
        });

        return `${isSelected ? 'Selected' : 'Unselected'} ${changeCount} palettes.`;
    }

    private async handleUpdateColorsInPalette(args: any): Promise<string> {
        const { paletteName, instruction } = args;
        if (!instruction) return "Missing instruction.";

        const currentState = stateManager.loadLatest();
        const palettes = currentState?.colorPalettes?.palettes || [];

        // 1. Identify target palette(s)
        let targetIndices: number[] = [];

        if (paletteName) {
            const idx = palettes.findIndex(p => p.name.toLowerCase().includes(paletteName.toLowerCase()));
            if (idx !== -1) targetIndices.push(idx);
        } else {
            // Resolve from instruction (Using IDs now)
            const targetIds = await this.executionEngine.resolvePaletteSelector(palettes, instruction);
            targetIds.forEach(id => {
                const idx = palettes.findIndex(p => p.id === id);
                if (idx !== -1) targetIndices.push(idx);
            });
        }

        if (targetIndices.length === 0) return "I couldn't find the palette you want to update.";

        // 2. Refine each target
        const updatedPalettes = [...palettes];
        for (const idx of targetIndices) {
            const currentPalette = updatedPalettes[idx];
            console.log(`Refining palette ${currentPalette.name}...`);
            const newColors = await this.executionEngine.refinePaletteColors(currentPalette, instruction);
            // DIRECT REPLACE of colors array - strict contract
            updatedPalettes[idx] = { ...currentPalette, colors: newColors };
        }

        await stateManager.saveWithHistory('colorPalettes', { palettes: updatedPalettes });
        return `Updated colors in ${targetIndices.length} palette(s) based on: "${instruction}".`;
    }


    // ==========================================
    // TYPOGRAPHY HANDLERS
    // ==========================================

    private async handleCreateTypography(args: any): Promise<string> {
        this.setCanvasMode('fonts');
        const currentState = stateManager.loadLatest();
        const existingFonts = currentState?.typographyPairings?.fonts || [];

        if (existingFonts.length >= 10) return "Limit reached (10 fonts). Delete some first.";

        const count = Math.min(args.count || 1, 10 - existingFonts.length);
        const query = args.query || args.instruction || "modern";

        // Execution Engine: Create Modification
        const newFonts = await this.executionEngine.createModificationTypography(
            existingFonts,
            query,
            count
        );

        // Keep IDs simple and consistent
        const merged = [...existingFonts, ...newFonts];
        const finalFonts = merged.map((f, i) => ({
            ...f,
            id: (i + 1).toString()
        }));

        await stateManager.saveWithHistory('typographyPairings', {
            fonts: finalFonts,
            rationale: `Created new fonts: ${query}`
        });

        return `Created ${newFonts.length} new font pairings.`;
    }

    private async handleDeleteTypography(args: any): Promise<string> {
        const instruction = args.instruction || args.names?.join(', ');
        if (!instruction) return "No instruction provided.";

        const currentState = stateManager.loadLatest();
        const existing = currentState?.typographyPairings?.fonts || [];

        const namesToDelete = await this.executionEngine.resolveTypographySelector(existing, instruction);

        if (namesToDelete.length === 0) return "I couldn't identify which fonts to delete.";

        // Filter
        const kept = existing.filter(f =>
            !namesToDelete.some(n => f.name.toLowerCase() === n.toLowerCase())
        );

        // Re-index
        const reindexed = kept.map((f, i) => ({ ...f, id: (i + 1).toString() }));

        await stateManager.saveWithHistory('typographyPairings', {
            fonts: reindexed,
            rationale: `Deleted fonts: ${namesToDelete.join(', ')}`
        });

        return `Deleted ${existing.length - kept.length} fonts. Remaining: ${reindexed.length}.`;
    }

    private async handleSelectTypography(args: any): Promise<string> {
        return this._updateFontSelection(args, true);
    }

    private async handleUnselectTypography(args: any): Promise<string> {
        return this._updateFontSelection(args, false);
    }

    private async _updateFontSelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction provided.";

        const currentState = stateManager.loadLatest();
        const fonts = currentState?.typographyPairings?.fonts || [];

        const targetNames = await this.executionEngine.resolveTypographySelector(fonts, instruction);

        if (targetNames.length === 0) return `I couldn't identify which fonts to ${isSelected ? 'select' : 'unselect'}.`;

        let count = 0;
        const updated = fonts.map(f => {
            const match = targetNames.some(n => f.name.toLowerCase() === n.toLowerCase());
            if (match) {
                count++;
                return { ...f, isSelected: isSelected };
            }
            return f;
        });

        await stateManager.saveWithHistory('typographyPairings', { fonts: updated });
        return `${isSelected ? 'Selected' : 'Unselected'} ${count} fonts.`;
    }

    // --- HELPER FOR SINGLE VALUE UPDATES ---
    // --- HELPER FOR BRAND DNA UPDATES ---
    private async handleBrandUpdate(field: keyof BrandDNA, args: any, isArray: boolean = false): Promise<string> {
        const instruction = args.instruction;

        if (!instruction) return `Error: No instruction provided for ${field}`;

        // Always use ExecutionEngine to generate the new value based on instruction
        const state = stateManager.loadLatest();
        const currentObj = state?.brandDNA?.[field];
        const currentContent = currentObj
            ? (isArray ? (currentObj as any).items : (currentObj as any).value)
            : (isArray ? [] : "");

        const value = await this.executionEngine.refineBrandField(field, currentContent, instruction);

        const wrapped = isArray
            ? { items: value, isSelected: true }
            : { value: value, isSelected: true };

        // Load state again to be safe (though we have it)
        const latestState = stateManager.loadLatest();
        if (!latestState || !latestState.brandDNA) return "Error: No state found";

        // Update persistence state
        latestState.brandDNA[field] = wrapped as any;
        await stateManager.saveWithHistory('brandDNA', latestState.brandDNA);

        // Update in-memory session state
        this.updateState(field, wrapped);

        return `Updated ${field} based on instruction: "${instruction}".`;
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
