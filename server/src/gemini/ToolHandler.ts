import {
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage,
    DNAUpdateMessage,
    LogoResearchProgressMessage,
    LogoResearchResultMessage,
    LogoConceptsMessage
} from '../../../shared/messages';
import { FontSuggestion, ColorPalette, BrandDNA, LogoStructureOption, ImagerySuggestion, LogoInspiration } from '../../../shared/types';
import { GoogleGenAI } from '@google/genai';
import { SearchGroundingService } from './SearchGroundingService';
import { getLogoStrategist, BrandContext } from '../agents/LogoStrategist';
import { BrainLogger } from '../utils/BrainLogger';
import { ResearchLogger } from '../utils/ResearchLogger';
import { ExecutionEngine } from '../services/ExecutionEngine';
import { WorkspaceManager } from '../services/StateManager';

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
    private workspaceId: string;

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
            mood: { items: [], isSelected: true },
            industry: { value: '', isSelected: true },
            typography: { fonts: [], rationale: '' },
            colors: { palettes: [], rationale: '' }
        } as any as BrandDNA),
        updateBatch: (updates: Record<string, any>) => void = () => { },
        onPauseVoice: () => void = () => { },
        onResumeVoice: () => void = () => { },
        onPhaseChange: (phase: 'discovery' | 'execution' | 'modification') => void = () => { },
        workspaceId: string = 'default'
    ) {
        this.workspaceId = workspaceId;
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
        this.executionEngine = new ExecutionEngine(workspaceId);
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
                        // Fix for Hallucination: Use the 'summary' from Brain args as the primary context
                        const contextString = fc.args.summary || this.conversationHistory || "Brand: Unknown";
                        console.log(`🧠 [ToolHandler] Starting research with context: "${contextString.substring(0, 100)}..."`);

                        const researchResult = await this.executionEngine.runFullResearchCycle(
                            contextString,
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
                        const manager = WorkspaceManager.getStateManager(this.workspaceId);
                        await manager.saveFullState(researchResult);

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

                // --- FONT TOOLS ---
                else if (fc.name === 'create_fonts') {
                    contextSummary = await this.handleCreateFonts(fc.args);
                }
                else if (fc.name === 'delete_fonts') {
                    contextSummary = await this.handleDeleteFonts(fc.args);
                }
                else if (fc.name === 'select_fonts') {
                    contextSummary = await this.handleSelectFonts(fc.args);
                }
                else if (fc.name === 'unselect_fonts') {
                    contextSummary = await this.handleUnselectFonts(fc.args);
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
                else if (fc.name === 'create_logo_structures') {
                    contextSummary = await this.handleCreateLogoStructures(fc.args);
                }
                else if (fc.name === 'select_logo_structures') {
                    contextSummary = await this.handleSelectLogoStructures(fc.args);
                }
                else if (fc.name === 'unselect_logo_structures') {
                    contextSummary = await this.handleUnselectLogoStructures(fc.args);
                }
                else if (fc.name === 'delete_logo_structures') {
                    contextSummary = await this.handleDeleteLogoStructures(fc.args);
                }
                // MODIFICATION: Imagery
                else if (fc.name === 'create_imagery_suggestions') {
                    contextSummary = await this.handleCreateImagerySuggestions(fc.args);
                }
                else if (fc.name === 'select_imagery_suggestions') {
                    contextSummary = await this.handleSelectImagerySuggestions(fc.args);
                }
                else if (fc.name === 'unselect_imagery_suggestions') {
                    contextSummary = await this.handleUnselectImagerySuggestions(fc.args);
                }
                else if (fc.name === 'delete_imagery_suggestions') {
                    contextSummary = await this.handleDeleteImagerySuggestions(fc.args);
                }
                // MODIFICATION: Logo Inspiration
                else if (fc.name === 'create_logo_inspirations') {
                    contextSummary = await this.handleCreateLogoInspirations(fc.args);
                }
                else if (fc.name === 'select_logo_inspirations') {
                    contextSummary = await this.handleSelectLogoInspirations(fc.args);
                }
                else if (fc.name === 'unselect_logo_inspirations') {
                    contextSummary = await this.handleUnselectLogoInspirations(fc.args);
                }
                else if (fc.name === 'delete_logo_inspirations') {
                    contextSummary = await this.handleDeleteLogoInspirations(fc.args);
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
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
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

        await manager.saveWithHistory('colorPalettes', {
            palettes: updatedPalettes,
            rationale: `Created new palettes based on: ${query}`
        });

        return `Created ${newPalettes.length} new palettes based on "${query}". Total palettes: ${updatedPalettes.length}.`;
    }

    private async handleDeletePalette(args: any): Promise<string> {
        const instruction = args.instruction || args.names?.join(', '); // Fallback to names if old call
        if (!instruction) return "No instruction provided for deletion.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
        const existingPalettes = currentState?.colorPalettes?.palettes || [];

        // Resolve which palettes to delete (Now returns IDs)
        const idsToDelete = await this.executionEngine.resolvePaletteSelector(existingPalettes, instruction);

        if (idsToDelete.length === 0) return "I couldn't identify which palettes to delete. Please be more specific.";

        // Filter out matching IDs
        const keptPalettes = existingPalettes.filter(p => !idsToDelete.includes(p.id));

        const deletedCount = existingPalettes.length - keptPalettes.length;

        await manager.saveWithHistory('colorPalettes', {
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
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
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

        await manager.saveWithHistory('colorPalettes', {
            palettes: updatedPalettes,
            rationale: `User ${isSelected ? 'selected' : 'unselected'} ${changeCount} palettes`
        });

        return `${isSelected ? 'Selected' : 'Unselected'} ${changeCount} palettes.`;
    }

    private async handleUpdateColorsInPalette(args: any): Promise<string> {
        const { paletteName, instruction } = args;
        if (!instruction) return "Missing instruction.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
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

        await manager.saveWithHistory('colorPalettes', { palettes: updatedPalettes });
        return `Updated colors in ${targetIndices.length} palette(s) based on: "${instruction}".`;
    }


    // ==========================================
    // FONT HANDLERS
    // ==========================================

    private async handleCreateFonts(args: any): Promise<string> {
        this.setCanvasMode('fonts');
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
        const existingFonts = currentState?.typographyPairings?.fonts || [];

        if (existingFonts.length >= 10) return "Limit reached (10 fonts). Delete some first.";

        const count = Math.min(args.count || 1, 10 - existingFonts.length);
        const query = args.query || args.instruction || "modern";

        // Execution Engine: Create Modification
        const newFonts = await this.executionEngine.createModificationFonts(
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

        await manager.saveWithHistory('typographyPairings', {
            fonts: finalFonts,
            rationale: `Created new fonts: ${query}`
        });

        return `Created ${newFonts.length} new font pairings.`;
    }

    private async handleDeleteFonts(args: any): Promise<string> {
        const instruction = args.instruction || args.names?.join(', ');
        if (!instruction) return "No instruction provided.";

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
        const existing = currentState?.typographyPairings?.fonts || [];

        const namesToDelete = await this.executionEngine.resolveFontSelector(existing, instruction);

        if (namesToDelete.length === 0) return "I couldn't identify which fonts to delete.";

        // Filter
        const kept = existing.filter((f: any) =>
            !namesToDelete.some((n: string) => f.name.toLowerCase() === n.toLowerCase())
        );

        // Re-index
        const reindexed = kept.map((f: any, i: number) => ({ ...f, id: (i + 1).toString() }));

        await manager.saveWithHistory('typographyPairings', {
            fonts: reindexed,
            rationale: `Deleted fonts: ${namesToDelete.join(', ')}`
        });

        return `Deleted ${existing.length - kept.length} fonts. Remaining: ${reindexed.length}.`;
    }

    private async handleSelectFonts(args: any): Promise<string> {
        return this._updateFontSelection(args, true);
    }

    private async handleUnselectFonts(args: any): Promise<string> {
        return this._updateFontSelection(args, false);
    }

    private async _updateFontSelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction provided.";

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const currentState = manager.loadLatest();
        const fonts = currentState?.typographyPairings?.fonts || [];

        const targetNames = await this.executionEngine.resolveFontSelector(fonts, instruction);

        if (targetNames.length === 0) return `I couldn't identify which fonts to ${isSelected ? 'select' : 'unselect'}.`;

        let count = 0;
        const updated = fonts.map((f: any) => {
            const match = targetNames.some((n: string) => f.name.toLowerCase() === n.toLowerCase());
            if (match) {
                count++;
                return { ...f, isSelected: isSelected };
            }
            return f;
        });

        await manager.saveWithHistory('typographyPairings', { fonts: updated });
        return `${isSelected ? 'Selected' : 'Unselected'} ${count} fonts.`;
    }

    // --- HELPER FOR SINGLE VALUE UPDATES ---
    // --- HELPER FOR BRAND DNA UPDATES ---
    private async handleBrandUpdate(field: keyof BrandDNA, args: any, isArray: boolean = false): Promise<string> {
        // Direct value check (User-requested schema)
        // args[field] might be 'name', 'mission', 'voice', etc.
        let directValue = args[field];
        const instruction = args.instruction;

        let finalValue: any = null;

        if (directValue !== undefined && directValue !== null) {
            // CASE 1: Direct Value Provided (Brain did the work)
            finalValue = directValue;
        } else if (instruction) {
            // CASE 2: Instruction Provided (Execution Engine does the work)
            const manager = WorkspaceManager.getStateManager(this.workspaceId);
            const state = manager.loadLatest();
            const currentObj = state?.brandDNA?.[field];
            const currentContent = currentObj
                ? (isArray ? (currentObj as any).items : (currentObj as any).value)
                : (isArray ? [] : "");

            finalValue = await this.executionEngine.refineBrandField(field, currentContent, instruction);
        } else {
            return `Error: No value or instruction provided for ${field}`;
        }

        const wrapped = isArray
            ? { items: finalValue, isSelected: true }
            : { value: finalValue, isSelected: true };

        // Load state again to be safe
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const latestState = manager.loadLatest();
        if (!latestState || !latestState.brandDNA) return "Error: No state found";

        // Update persistence state
        latestState.brandDNA[field] = wrapped as any;
        await manager.saveWithHistory('brandDNA', latestState.brandDNA);

        // Update in-memory session state
        this.updateState(field, wrapped);

        return `Updated ${field}.`;
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

            const manager = WorkspaceManager.getStateManager(this.workspaceId);
            await manager.saveWithHistory('logoStructures', {
                options,
                rationale: 'User updated logo structure selection'
            });

            // Removed redundant sendToClient
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

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        await manager.saveWithHistory('logoStructures', {
            options,
            rationale: args.rationale || 'AI-generated logo structure options'
        });

        // Removed redundant sendToClient

        const typeList = options.map(o => o.type).join(', ');
        return `Processed ${options.length} logo options: ${typeList}. [SYSTEM: The logo structures are now on the board. Ask the user if they want to review them.]`;
    }

    private async handleCreateImagerySuggestions(args: any): Promise<string> {
        this.setCanvasMode('none' as any); // Imagery mode technically exists on client but maybe not in TS types
        const count = args.count || 3;
        const query = args.query;
        const suggestions = await this.executionEngine.createImagerySuggestions(query, count);
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        await manager.saveWithHistory('imagery', {
            suggestions,
            rationale: `Generated imagery concepts: ${query}`
        });
        // Removed redundant sendToClient - relies on StateManager broadcast
        return `Created ${suggestions.length} imagery suggestions.`;
    }

    private async handleSelectImagerySuggestions(args: any): Promise<string> {
        return this._updateImagerySelection(args, true);
    }

    private async handleUnselectImagerySuggestions(args: any): Promise<string> {
        return this._updateImagerySelection(args, false);
    }

    private async handleDeleteImagerySuggestions(args: any): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.imagery?.suggestions || [];
        const ids = await this.executionEngine.resolveImagerySelector(current, instruction);
        if (ids.length === 0) return "Could not find items to delete.";
        const kept = current.filter((s: any) => !ids.includes(s.id));
        await manager.saveWithHistory('imagery', { suggestions: kept });
        // Removed redundant sendToClient - relies on StateManager broadcast
        return `Deleted ${current.length - kept.length} items.`;
    }

    private async _updateImagerySelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.imagery?.suggestions || [];
        const ids = await this.executionEngine.resolveImagerySelector(current, instruction);
        if (ids.length === 0) return "Could not identify items.";
        const updated = current.map((s: any) => {
            if (ids.includes(s.id)) return { ...s, isSelected: isSelected };
            return s;
        });
        await manager.saveWithHistory('imagery', { suggestions: updated });
        // Removed redundant sendToClient - relies on StateManager broadcast
        return `${isSelected ? 'Selected' : 'Unselected'} ${ids.length} items.`;
    }

    private async handleCreateLogoInspirations(args: any): Promise<string> {
        console.log('🔍 Starting BROWSER-BASED logo research:', args);
        this.setCanvasMode('none' as any);

        const query = args.query || 'modern logo';
        const manager = WorkspaceManager.getStateManager(this.workspaceId);

        // Get brand context - Prefer latest state from file
        const state = manager.loadLatest();
        const dna = state?.brandDNA || this.getDNA();

        const brandContext: BrandContext = {
            name: dna.name?.value || 'Brand',
            industry: dna.industry?.value || 'business',
            mission: dna.mission?.value || '',
            voice: dna.voice?.value || '',
            style: query
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
                    console.log(`📊 Research progress: ${phase} | ${source} | ${progress}% | ${message}`);
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

            // Backward compatibility
            this.sendToClient({
                type: 'LOGO_CONCEPTS',
                concepts: results.logos.map(logo => ({
                    id: logo.id,
                    url: logo.imageUrl,
                    source: logo.source,
                    style: logo.style,
                    mood: 'discovered',
                    reasoning: logo.designPrinciples.join(', '),
                    alt_text: `${logo.brandName} logo`
                }))
            });

            // Save to State Manager
            const inspirations: LogoInspiration[] = results.logos.map(l => ({
                id: l.id,
                displayName: l.brandName,
                url: l.imageUrl,
                isSelected: false
            }));

            await manager.saveWithHistory('logoInspirations', {
                inspirations,
                rationale: `Searched for: ${query}. Insights: ${results.insights.recommendation}`
            });

            this.sendToClient({ type: 'LOGO_INSPIRATION_RESULTS', results: inspirations } as any);

            return `Research complete! Found ${results.logos.length} logos. ${results.insights.recommendation}`;

        } catch (error) {
            console.error('❌ Logo research failed:', error);

            this.sendToClient({
                type: 'LOGO_RESEARCH_PROGRESS',
                phase: 'complete',
                source: 'Error',
                progress: 100,
                message: 'Research encountered an error. showing fallback.'
            } as LogoResearchProgressMessage);

            // Fallback to SearchGroundingService (Simulated/API)
            // Search Logic via Execution Engine (Original Logic)
            try {
                const count = args.count || 4;
                const inspirations = await this.executionEngine.searchLogoInspirations(query, count);
                await manager.saveWithHistory('logoInspirations', {
                    inspirations,
                    rationale: `Fallback search for: ${query}`
                });
                this.sendToClient({ type: 'LOGO_INSPIRATION_RESULTS', results: inspirations } as any);
                return `Browser agent failed, but I found ${inspirations.length} simulated logo inspirations.`;
            } catch (e) {
                return "Failed to search for logos.";
            }
        }
    }

    private async handleSelectLogoInspirations(args: any): Promise<string> {
        return this._updateInspirationSelection(args, true);
    }

    private async handleUnselectLogoInspirations(args: any): Promise<string> {
        return this._updateInspirationSelection(args, false);
    }

    private async handleDeleteLogoInspirations(args: any): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.logoInspirations?.inspirations || [];
        const ids = await this.executionEngine.resolveLogoInspirationSelector(current, instruction);
        if (ids.length === 0) return "Could not find items to delete.";
        const kept = current.filter((i: any) => !ids.includes(i.id));
        await manager.saveWithHistory('logoInspirations', { inspirations: kept });
        this.sendToClient({ type: 'LOGO_INSPIRATIONS', inspirations: kept } as any);
        return `Deleted ${current.length - kept.length} items.`;
    }

    private async _updateInspirationSelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";
        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.logoInspirations?.inspirations || [];
        const ids = await this.executionEngine.resolveLogoInspirationSelector(current, instruction);
        if (ids.length === 0) return "Could not identify items.";
        const updated = current.map((item: any) => {
            if (ids.includes(item.id)) return { ...item, isSelected: isSelected };
            return item;
        });
        await manager.saveWithHistory('logoInspirations', { inspirations: updated });
        this.sendToClient({ type: 'LOGO_INSPIRATIONS', inspirations: updated } as any);
        return `${isSelected ? 'Selected' : 'Unselected'} ${ids.length} items.`;
    }

    private async handleGeneralResearch(args: any): Promise<string> {
        const query = args.query;
        // Simple Google Search via SearchService
        const results = await this.searchService.search(query);

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        // Save to state with history (append to existing queries)
        const currentState = manager.loadLatest();
        const existingQueries = currentState?.generalResearch?.queries || [];

        const newQuery = {
            id: `research-${existingQueries.length + 1}`,
            query,
            result: results.slice(0, 500),
            timestamp: new Date().toISOString()
        };

        await manager.saveWithHistory('generalResearch', {
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
    private async handleCreateLogoStructures(args: any): Promise<string> {
        this.setCanvasMode('none' as any);
        const count = args.count || 3;
        const query = args.query;

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        // Load current state to append to existing list
        const currentState = manager.loadLatest();
        const currentOptions = currentState?.logoStructures?.options || [];

        // Create new structures (engine handles ID generation based on currentOptions length)
        const newStructures = await this.executionEngine.createLogoStructures(currentOptions, query, count);

        // Append new structures to the existing list
        const updatedOptions = [...currentOptions, ...newStructures];

        await manager.saveWithHistory('logoStructures', {
            options: updatedOptions,
            rationale: `Created ${newStructures.length} new logo structures for: ${query}`
        });

        // Removed sendToClient to rely on StateManager full state broadcast (Architecture/FullSync)
        return `Created ${newStructures.length} new logo structure options. Total: ${updatedOptions.length}.`;
    }

    private async handleSelectLogoStructures(args: any): Promise<string> {
        return this._updateStructureSelection(args, true);
    }

    private async handleUnselectLogoStructures(args: any): Promise<string> {
        return this._updateStructureSelection(args, false);
    }

    private async handleDeleteLogoStructures(args: any): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.logoStructures?.options || [];

        const targetIds = await this.executionEngine.resolveLogoStructureSelector(current, instruction);

        if (targetIds.length === 0) return "Could not find structures to delete.";

        const kept = current.filter((s: any) => !targetIds.includes(s.id));

        // Re-index IDs to ensure sequential order (1..N) preventing collisions on next create
        // This matches the Typography implementation (handleDeleteFonts)
        const reindexed = kept.map((s: any, i: number) => ({ ...s, id: String(i + 1) }));

        await manager.saveWithHistory('logoStructures', {
            options: reindexed,
            rationale: `Deleted ${targetIds.length} structures`
        });

        // No need to send specific message, StateManager broadcast handles it
        return `Deleted ${current.length - kept.length} structures. Remaining: ${reindexed.length}.`;
    }

    private async _updateStructureSelection(args: any, isSelected: boolean): Promise<string> {
        const instruction = args.instruction;
        if (!instruction) return "No instruction.";

        const manager = WorkspaceManager.getStateManager(this.workspaceId);
        const state = manager.loadLatest();
        const current = state?.logoStructures?.options || [];

        const targetIds = await this.executionEngine.resolveLogoStructureSelector(current, instruction);

        if (targetIds.length === 0) return "Could not identify structures.";

        let changeCount = 0;
        const updated = current.map((s: any) => {
            if (targetIds.includes(s.id)) {
                changeCount++;
                return { ...s, isSelected: isSelected };
            }
            return s;
        });

        await manager.saveWithHistory('logoStructures', {
            options: updated,
            rationale: `User ${isSelected ? 'selected' : 'unselected'} ${changeCount} logo structures`
        });

        // No need to send specific message, StateManager broadcast handles it
        return `${isSelected ? 'Selected' : 'Unselected'} ${changeCount} structures.`;
    }


}
