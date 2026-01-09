import {
    ServerMessage,
    FontSuggestionsMessage,
    ColorSuggestionsMessage
} from '../../../shared/messages';
import { FontSuggestion, ColorPalette, BrandDNA } from '../../../shared/types';

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

    constructor(
        sendToClient: (message: ServerMessage) => void,
        updateState: (field: string, value: any) => void,
        storePalettes: (palettes: ColorPalette[]) => void = () => { },
        storeFonts: (fonts: FontSuggestion[]) => void = () => { },
        setCanvasMode: (mode: 'none' | 'fonts' | 'colors') => void = () => { },
        getDNA: () => BrandDNA = () => ({ name: '', mission: '', typography: [], colors: [], voice: '' })
    ) {
        this.sendToClient = sendToClient;
        this.updateState = updateState;
        this.storePalettes = storePalettes;
        this.storeFonts = storeFonts;
        this.setCanvasMode = setCanvasMode;
        this.getDNA = getDNA;
    }

    async handleToolCalls(functionCalls: FunctionCall[]): Promise<FunctionResponse[]> {
        const responses: FunctionResponse[] = [];

        for (const fc of functionCalls) {
            console.log(`🔧 Processing tool: ${fc.name}`, JSON.stringify(fc.args || {}));

            try {
                switch (fc.name) {
                    case 'display_font_suggestions':
                        this.handleFontSuggestions(fc.args);
                        break;

                    case 'display_color_suggestions':
                        this.handleColorSuggestions(fc.args);
                        break;

                    case 'update_live_brand_dna':
                    case 'update_live_brand_dna':
                        this.handleDNAUpdate(fc.args);
                        break;

                    // end_session case REMOVED - was causing false terminations

                    default:
                        console.warn(`Unknown tool: ${fc.name}`);
                }

                // Log raw call to check for ID
                console.log(`🔍 Raw tool call:`, JSON.stringify(fc));

                // Gemini Live API expects this exact format
                const response: any = {
                    name: fc.name,
                    response: { result: 'success', ...fc.args }
                };

                // Only include ID if it was sent by Gemini
                if (fc.id) {
                    response.id = fc.id;
                }

                responses.push(response);
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

    private handleFontSuggestions(args: any): void {
        const fonts: FontSuggestion[] = (args.fonts || []).map((f: any) => ({
            name: f.name,
            category: f.category || 'sans-serif',
            reasoning: f.reasoning || ''
        }));

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
    }

    private handleColorSuggestions(args: any): void {
        const palettes: ColorPalette[] = (args.palettes || []).map((p: any) => ({
            name: p.name || 'Unnamed Palette',
            colors: Array.isArray(p.colors) ? p.colors : ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'],
            vibe: p.vibe || 'modern'
        }));

        // Store palettes for click selection lookup
        this.storePalettes(palettes);
        this.setCanvasMode('colors');

        console.log(`🎨 Sending ${palettes.length} color palettes`);

        this.sendToClient({
            type: 'COLOR_SUGGESTIONS',
            palettes
        });

        this.sendToClient({
            type: 'THOUGHT',
            logic: `Color thread: Rendering ${palettes.length} palette options`,
            confidence: 0.9
        });
    }

    private handleDNAUpdate(args: any): void {
        console.log('🧬 Updating Brand DNA:', args);

        // Update state for each field
        if (args.brandName) {
            this.updateState('name', args.brandName);
        }
        if (args.mission) {
            this.updateState('mission', args.mission);
        }
        if (args.selectedColors && args.selectedColors.length > 0) {
            this.updateState('colors', args.selectedColors);
        }
        if (args.selectedFont) {
            this.updateState('typography', [args.selectedFont]);
        }
        if (args.voice) {
            this.updateState('voice', args.voice);
        }

        // Get the complete updated DNA from the state manager
        const fullDNA = this.getDNA();

        // Send DNA update to client with complete state
        this.sendToClient({
            type: 'DNA_UPDATE',
            dna: fullDNA,
            updatedField: this.getUpdatedField(args)
        });

        const updatedFields = Object.keys(args).filter(k => args[k]);
        this.sendToClient({
            type: 'THOUGHT',
            logic: `Brand DNA updated: ${updatedFields.join(', ')}`,
            confidence: 0.95
        });
    }

    private getUpdatedField(args: any): 'name' | 'mission' | 'colors' | 'typography' | 'voice' {
        if (args.brandName) return 'name';
        if (args.mission) return 'mission';
        if (args.selectedColors) return 'colors';
        if (args.selectedFont) return 'typography';
        if (args.voice) return 'voice';
        return 'name';
    }
}
