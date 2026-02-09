import { GoogleGenAI, Type } from '@google/genai';
import { MODELS } from '../../../shared/constants.js';

export interface NanoBananaContext {
    brandName: string;
    mission: string;
    rationale: string;
    mood: string[];
    colors: string[];
    fonts: string[];
    imagery: Array<{ concept: string; description: string; visualStyle?: string }>;
}

export interface NanoBananaResult {
    strategy: string;
    layout_strategy: 'SPLIT' | 'CLOUDS' | 'TRIPTYCH' | 'FORENSIC_GRID';
    selected_imagery_concept: string;
    headline: string;
    subhead: string;
    graphic_caption: string;
    evidence_items: Array<{
        id: string;
        label: string;
        value: string | number;
        unit?: string;
        description?: string;
        icon?: string;
        visual_type?: 'chart' | 'stat' | 'icon' | 'mini-trend';
    }>;
    graphic_type: 'generative';
    primary_color: string;
    accent_color: string;
    backgroundColor: string;
    textColor: string;
    visual_code: string; // The full Tailwind/Grid layout logic
}

/**
 * Service for generating high-fidelity visual components using the "Nano Banana" design system.
 * Orchestrates calls to Gemini to create JSON configurations for various section types (Proof, PAS, Spec, etc.).
 */
export class NanoBananaService {
    private client: GoogleGenAI;
    private textModel = MODELS.ARCHITECT_TEXT;

    /**
     * Initializes the NanoBananaService.
     * 
     * @param {string} apiKey - The API key for Google GenAI.
     */
    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    private getOrchestrationGuardrails() {
        return `
            **DYNAMIC LEAD ORCHESTRATION**:
            - All CTA buttons MUST trigger the global FormOrchestrator.
            - Use the following JavaScript pattern in the 'onclick' attribute:
              \`onclick="window.dispatchEvent(new CustomEvent('open-form', { detail: { type: 'CONTACT' | 'OFFER' | 'INTENT', context: { origin: 'SECTION_ID', goal: 'GOAL_TEXT' } } }))"\`
            - For HERO buttons: Use type 'INTENT'.
            - For OFFER buttons: Use type 'OFFER'.
            - For general contact/info: Use type 'CONTACT'.
            - Ensure the buttons look high-fidelity (vibrant, themed, smooth hover).
        `;
    }

    /**
     * Generates a "Proof" visual section (e.g., statistics, executive dashboard).
     * 
     * @param {NanoBananaContext} context - The brand and design context.
     * @returns {Promise<NanoBananaResult>} The generated visual configuration.
     */
    async generateProofVisual(context: NanoBananaContext): Promise<NanoBananaResult> {
        const prompt = `
            You are a 'Data Visualization Architect' specializing in high-fidelity "Nano Banana" style Trust Graphics.
            "Nano Banana" is the NAME OF THE VISUAL STYLE (Minimalist, analytical, high-contrast, forensic). 
            It is NOT the brand name.
            
            **BRAND CONTEXT**:
            - Brand Name: "${context.brandName}"
            - Mission: "${context.mission}"
            - Rationale: "${context.rationale}"
            - Mood: ${context.mood.join(', ')}
            
            **USER IMAGERY CONCEPTS**:
            ${JSON.stringify(context.imagery)}
            
            **DESIGN GUARDRAILS**:
            - **Colors**: ${JSON.stringify(context.colors)} (Primary/Secondary)
            - **Fonts**: ${JSON.stringify(context.fonts)}
            - **Typography Rule**: You MUST apply these specific fonts. If ${JSON.stringify(context.fonts[0])} is provided, use it for all text. Do NOT use generic 'font-mono' or 'font-sans' classes unless requested for a specific aesthetic, but even then, prioritize brand fonts.

            **STRICT CONTENT GUARDRAILS (PROHIBITED)**:
            - **CRITICAL**: The HTML/UI you generate must be "Executive Dashboard" style, NOT "Debug Consoles". Do NOT put "v1.0", "Alpha", or underscores in the UI elements.
            - NO underscores in labels (e.g. "CRM_SYNC_01" -> "Pipeline Synchronization").
            - NO "Dev-Speak" or System IDs (e.g. "Module: Lead_Gen_Alpha" -> "Module: Growth Engine").
            - **NO IMAGES**: This section has NO image capability. DO NOT include <img> tags, DO NOT include image placeholders, and DO NOT use image URLs. This is a schematic/data-driven section only.
            - **NO PERSONAS**: Strictly NO names, NO job titles, and NO human quotes. This is a technical proof block, not a social testimonial block.
            - **EXCEPTION**: You MUST preserve impressive NUMBERS (e.g. "99.9% Uptime", "4.8x ROI"). Keep the stats, but make the labels "Executive-Level Branding".

            **TASK**:
            1. **Layout Strategy**: Choose a grid pattern (SPLIT | CLOUDS | TRIPTYCH | FORENSIC_GRID). 
            2. **Evidence**: Generate 3-6 distinct pieces of evidence (stats, durability claims, performance benchmarks) for the brand "${context.brandName}".
            3. **Generative Layout**: Write a high-fidelity 'visual_code' string. 
               - Use CSS Grid (grid-cols-12) or Flexbox.
               - Ensure it matches the chosen Layout Strategy.
               - Make it responsive (e.g., stacked on mobile, grid on desktop).
               - Include subtle micro-animations (animate-pulse, hover effects).
            4. Return the full structural configuration.

            **DESIGN GUIDELINES**:
            - 'SPLIT': Text on one side (col-span-5), complex visual dashboard on the other (col-span-7).
            - 'CLOUDS': Modular cards in a grid-cols-2 or 3.
            - 'TRIPTYCH': Three balanced vertical columns.
            - Use ACTUAL colors: ${JSON.stringify(context.colors)}.

            **CRITICAL**: 
            - Use ONLY Tailwind classes. No external scripts. 
            - The visual_code is a standalone inner container.
            - **BOUNDARIES**: The code will be rendered inside a 'max-w-7xl' (1280px) centered container.
            - **ALIGNMENT**: For high-impact storytelling, prioritize center-aligned headline structures within the grid.
            - **RESPONSIVENESS**: Always start mobile-first (grid-cols-1) and scale to lg:grid-cols-12.

            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH', 'FORENSIC_GRID'] },
                        selected_imagery_concept: { type: Type.STRING },
                        headline: { type: Type.STRING },
                        subhead: { type: Type.STRING },
                        graphic_caption: { type: Type.STRING },
                        evidence_items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    unit: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    icon: { type: Type.STRING },
                                    visual_type: { type: Type.STRING }
                                },
                                required: ["id", "label", "value"]
                            }
                        },
                        graphic_type: { type: Type.STRING },
                        primary_color: { type: Type.STRING },
                        accent_color: { type: Type.STRING },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING },
                        visual_code: { type: Type.STRING }
                    },
                    required: ["strategy", "layout_strategy", "selected_imagery_concept", "headline", "subhead", "graphic_caption", "evidence_items", "graphic_type", "primary_color", "accent_color", "backgroundColor", "textColor", "visual_code"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("NanoBanana generation failed");
        const result = JSON.parse(text);

        return result;
    }

    /**
     * Generates a "PAS" (Problem-Agitation-Solution) visual section.
     * 
     * @param {NanoBananaContext} context - The brand and design context.
     * @returns {Promise<any>} The generated visual configuration.
     */
    async generatePASVisual(context: NanoBananaContext): Promise<any> {
        const prompt = `
            You are a 'Conversion Copywriter' and 'Layout Architect'.
            Create a "Nano Banana" style PAS (Problem-Agitation-Solution) section.
            
            **BRAND CONTEXT**:
            - Brand Name: "${context.brandName}"
            - Mission: "${context.mission}"
            - Rationale (The Core Strategy): "${context.rationale}"
            - Mood/Tone: ${context.mood.join(', ')}
            
            **VOICE**: Use the Brand DNA voice consistently across all 3 phases.
            
            **TASK**:
            1. **PAS Strategy**: Identify a core PROBLEM childhood athletics/accessibility solves, AGITATE the consequences of inaction, and present "${context.brandName}" as the SOLUTION. Use the "Insane Rationale": "${context.rationale}".
            2. **Layout Strategy**: Choose a grid pattern (SPLIT | CLOUDS | TRIPTYCH).
            3. **Generative Code**: Write 'visual_code' string:
               - **IMPORTANT**: Start the string with a valid HTML tag (e.g. \`<section ...\`). Do NOT omit the opening bracket.
               - Use a high-impact CSS Grid (grid-cols-12).
                - Respect the 1280px (max-w-7xl) container contract.
                - **NO IMAGES**: This section has NO image capability. DO NOT include <img> tags, DO NOT include image placeholders, and DO NOT use image URLs.
                - **NO PERSONAS**: Strictly NO names, job titles, or human testimonials. This is a technical Problem-Agitation-Solution logic block.
             **DESIGN GUARDRAILS**:
            - **Colors**: ${JSON.stringify(context.colors)}
            - **Fonts**: ${JSON.stringify(context.fonts)}
            - **Typography Rule**: Strictly use these fonts: ${JSON.stringify(context.fonts)}. 

            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH'] },
                        headline: { type: Type.STRING },
                        steps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    phase: { type: Type.STRING, enum: ['PROBLEM', 'AGITATION', 'SOLUTION'] },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["id", "phase", "title", "description"]
                            }
                        },
                        closing_statement: { type: Type.STRING },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING },
                        primary_color: { type: Type.STRING },
                        visual_code: { type: Type.STRING }
                    },
                    required: ["strategy", "layout_strategy", "headline", "steps", "closing_statement", "backgroundColor", "textColor", "visual_code"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("PAS generation failed");
        return JSON.parse(text);
    }

    /**
     * Refines an existing visual component based on performance data or user feedback.
     * 
     * @param {any} current - The current component configuration.
     * @param {any} performance - Performance metrics (e.g., dwell time).
     * @param {NanoBananaContext} context - The brand and design context.
     * @param {Buffer} [snapshotBuffer] - Optional snapshot of the current component.
     * @param {string} [userFeedback] - Optional direct user feedback.
     * @param {string} [componentType='generic'] - The type of component being refined.
     * @param {Buffer} [videoBuffer] - Optional video buffer for analysis.
     * @returns {Promise<any>} The refined component configuration.
     */
    async refineVisual(current: any, performance: any, context: NanoBananaContext, snapshotBuffer?: Buffer, userFeedback?: string, componentType: string = 'generic', videoBuffer?: Buffer): Promise<any> {
        const parts: any[] = [];

        if (snapshotBuffer) {
            parts.push({
                inlineData: {
                    data: snapshotBuffer.toString('base64'),
                    mimeType: 'image/png'
                }
            });
        }

        if (videoBuffer) {
            parts.push({
                inlineData: {
                    data: videoBuffer.toString('base64'),
                    mimeType: 'video/mp4'
                }
            });
        }

        const prompt = `
            You are 'Watcher', a Senior UX Architect and Conversion Strategist.
            Optimize this "Nano Banana" ${componentType.toUpperCase()} section by evolving its GRID STRUCTURE.
            
            **CURRENT PERFORMANCE**:
            - Avg Dwell Time: ${performance.avgDwell}ms (Goal: 2000ms+)
            
            **CURRENT CONFIG**:
            ${JSON.stringify(current)}

            **TASK**:
            1. **Analyze**: Look at the provided Snapshot image and the current JSON config.
            2. **Forensic Audit**: Identify conversion killers (poor contrast, cluttered layout, weak hierarchy).
            3. Mutate the Grid Strategy (SPLIT | CLOUDS | TRIPTYCH) if needed.
            4. Rewrite the 'visual_code' to be more immersive or intuitive.
            5. Ensure "${context.brandName}" storytelling remains central.
            6. **ALIGNMENT ALERT**: The Hero section above is strictly center-aligned. Ensure your layout feels balanced—avoid heavy left-side-only weights.
            7. **BOUNDARY CONTRACT**: Your code operates within a 1280px (max-w-7xl) limit.
            8. **DOMAIN ISOLATION**: This is a ${componentType.toUpperCase()} section. Focus purely on ${componentType === 'social' ? 'social proof and testimonials' : 'technical specifications and data'}. 
            ${componentType !== 'social' ? 'STRICTLY NO PERSONAS, NO TESTIMONIALS, and NO HUMAN QUOTES.' : ''}

            ${userFeedback ? `
            **🛑 HIGH PRIORITY USER DIRECTIVE 🛑**:
            The user has explicitly ordered: "${userFeedback}"
            YOU MUST COMPLY WITH THIS ABOVE ALL OTHER STRATEGIC GOALS.
            ` : ''}

            Return JSON.
        `;

        parts.push({ text: prompt });

        // Build STRICT full schema based on componentType to prevent partial JSON loss
        let componentSchema: any = {};
        let requiredComponentFields: string[] = [];

        switch (componentType) {
            case 'hero':
                componentSchema = {
                    variant_id: { type: Type.STRING },
                    overlay_content: {
                        type: Type.OBJECT,
                        properties: {
                            headline: {
                                type: Type.OBJECT,
                                properties: { text: { type: Type.STRING }, styles: { type: Type.OBJECT, properties: { color: { type: Type.STRING } } } },
                                required: ["text"]
                            },
                            subhead: {
                                type: Type.OBJECT,
                                properties: { text: { type: Type.STRING }, styles: { type: Type.OBJECT, properties: { color: { type: Type.STRING } } } },
                                required: ["text"]
                            },
                            cta: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    action_id: { type: Type.STRING },
                                    styles: {
                                        type: Type.OBJECT,
                                        properties: {
                                            backgroundColor: { type: Type.STRING },
                                            color: { type: Type.STRING }
                                        }
                                    }
                                },
                                required: ["text", "action_id"]
                            }
                        },
                        required: ["headline", "subhead", "cta"]
                    },
                    layout_config: {
                        type: Type.OBJECT,
                        properties: {
                            container_styles: {
                                type: Type.OBJECT,
                                properties: {
                                    justifyContent: { type: Type.STRING },
                                    alignItems: { type: Type.STRING },
                                    textAlign: { type: Type.STRING },
                                    padding: { type: Type.STRING },
                                    backdropFilter: { type: Type.STRING }
                                },
                                required: ["justifyContent", "backdropFilter"]
                            },
                            overlay_gradient: { type: Type.STRING }
                        },
                        required: ["container_styles", "overlay_gradient"]
                    },
                    visual_asset: {
                        type: Type.OBJECT,
                        properties: {
                            prompt_signature: { type: Type.STRING },
                            attributes: {
                                type: Type.OBJECT,
                                properties: {
                                    lighting: { type: Type.STRING },
                                    camera_movement: { type: Type.STRING },
                                    subject_focus: { type: Type.STRING },
                                    color_grade: { type: Type.STRING }
                                }
                            }
                        },
                        required: ["prompt_signature"]
                    }
                };
                requiredComponentFields = ["overlay_content", "layout_config", "visual_asset"];
                break;

            case 'proof':
                componentSchema = {
                    layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH', 'FORENSIC_GRID'] },
                    headline: { type: Type.STRING },
                    subhead: { type: Type.STRING },
                    visual_code: { type: Type.STRING },
                    evidence_items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                value: { type: Type.STRING },
                                unit: { type: Type.STRING },
                                description: { type: Type.STRING },
                                icon: { type: Type.STRING },
                                visual_type: { type: Type.STRING }
                            },
                            required: ["id", "label", "value"]
                        }
                    }
                };
                requiredComponentFields = ["layout_strategy", "headline", "visual_code", "evidence_items"];
                break;

            case 'pas':
                componentSchema = {
                    layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH'] },
                    headline: { type: Type.STRING },
                    visual_code: { type: Type.STRING },
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                phase: { type: Type.STRING, enum: ['PROBLEM', 'AGITATION', 'SOLUTION'] },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["id", "phase", "title", "description"]
                        }
                    },
                    closing_statement: { type: Type.STRING }
                };
                requiredComponentFields = ["layout_strategy", "headline", "visual_code", "steps"];
                break;

            case 'spec':
                componentSchema = {
                    layout_strategy: { type: Type.STRING, enum: ['BLUEPRINT', 'NODES', 'TRIPTYCH'] },
                    headline: { type: Type.STRING },
                    subhead: { type: Type.STRING },
                    visual_code: { type: Type.STRING },
                    nodes: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                description: { type: Type.STRING },
                                icon: { type: Type.STRING }
                            },
                            required: ["id", "label", "description"]
                        }
                    }
                };
                requiredComponentFields = ["layout_strategy", "headline", "visual_code", "nodes"];
                break;

            case 'social':
                componentSchema = {
                    layout_strategy: { type: Type.STRING, enum: ['MASONRY', 'GRID', 'STACK'] },
                    headline: { type: Type.STRING },
                    subhead: { type: Type.STRING },
                    visual_code: { type: Type.STRING },
                    testimonials: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                title: { type: Type.STRING },
                                company: { type: Type.STRING },
                                quote: { type: Type.STRING },
                                image_prompt: { type: Type.STRING }
                            },
                            required: ["id", "name", "title", "company", "quote", "image_prompt"]
                        }
                    }
                };
                requiredComponentFields = ["layout_strategy", "headline", "visual_code", "testimonials"];
                break;

            case 'offer':
                componentSchema = {
                    layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH'] },
                    headline: { type: Type.STRING },
                    subhead: { type: Type.STRING },
                    visual_code: { type: Type.STRING },
                    tiers: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                price: { type: Type.STRING },
                                interval: { type: Type.STRING },
                                description: { type: Type.STRING },
                                features: { type: Type.ARRAY, items: { type: Type.STRING } },
                                cta_text: { type: Type.STRING },
                                is_highlighted: { type: Type.BOOLEAN },
                                badge: { type: Type.STRING }
                            },
                            required: ["id", "name", "price", "description", "features", "cta_text"]
                        }
                    }
                };
                requiredComponentFields = ["layout_strategy", "headline", "subhead", "visual_code", "tiers"];
                break;

            default:
                // Fallback for generic
                componentSchema = {
                    visual_code: { type: Type.STRING },
                    headline: { type: Type.STRING }
                };
                requiredComponentFields = ["visual_code"];
        }

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        thoughts: { type: Type.STRING },
                        changes: {
                            type: Type.OBJECT,
                            properties: componentSchema,
                            required: requiredComponentFields
                        },
                        confidence: { type: Type.NUMBER }
                    },
                    required: ["thoughts", "changes", "confidence"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error("❌ NanoBanana: AI returned empty text response");
            throw new Error("NanoBanana refinement failed: Empty response");
        }

        try {
            // Clean up text in case of markdown noise (though responseMimeType should handle it)
            const cleanText = text.trim().replace(/^```json/, '').replace(/```$/, '');
            const result = JSON.parse(cleanText);
            return result;
        } catch (e) {
            console.error("❌ NanoBanana: Failed to parse AI JSON response:", text);
            throw e;
        }
    }

    /**
     * Generates a "Spec" visual section (technical blueprint/features).
     * 
     * @param {NanoBananaContext} context - The brand and design context.
     * @returns {Promise<any>} The generated visual configuration.
     */
    async generateSpecVisual(context: NanoBananaContext): Promise<any> {
        const prompt = `
            You are a 'Technical Product Architect' and 'Interaction Designer'.
            Create a "Nano Banana" style Interactive Spec (The Technical Blueprint) for "${context.brandName}".
            "Nano Banana" is the NAME OF THE VISUAL STYLE (Forensic, blueprint-heavy, high-fidelity). 
            
            **BRAND CONTEXT**:
            - Brand: "${context.brandName}"
            - Strategy: "${context.rationale}"
            - Colors: ${JSON.stringify(context.colors)}
            
            **TASK**:
            1. **Technical Nodes**: Identify 3-5 core technical "Spec Nodes" for the brand (e.g. for Salesack: "CRM Mirroring", "Outreach Engine", "Lead Scoring Logic").
            2. **Layout Strategy**: Choose a grid pattern (BLUEPRINT | NODES | TRIPTYCH).
            3. **INTERACTION ENGINE**: 
               - Write 'visual_code' string using HTML/Tailwind.
               - **REQUIRED**: Use INLINE Vanilla JS (within the HTML string) to handle interactions.
               - use brand colors for hover states: ${JSON.stringify(context.colors)}.
               - Center-align the core schematic.
            
            **DESIGN GUARDRAILS**:
            - **Colors**: ${JSON.stringify(context.colors)}
            - **Fonts**: ${JSON.stringify(context.fonts)}
            - **Typography Rule**: Use ${JSON.stringify(context.fonts[0])} for all labels and descriptions.
            - **NO IMAGES**: This section has NO image capability. DO NOT include <img> tags, DO NOT include image placeholders, and DO NOT use image URLs.
            - **NO PERSONAS**: Strictly NO names, job titles, or quotes from "Operators" or "Architects". This is a clinical technical schematic.
            
            **STRICT CONTENT GUARDRAILS (PROHIBITED)**:
            - **CRITICAL**: The HTML/UI you generate must be "Executive Dashboard" style, NOT "Debug Consoles". Do NOT put "v1.0", "Alpha", or underscores in the UI elements.
            - NO underscores in labels (e.g. "CRM_SYNC_01" -> "Pipeline Synchronization").
            - NO "Dev-Speak" or System IDs (e.g. "Module: Lead_Gen_Alpha" -> "Module: Growth Engine").
            - **EXCEPTION**: You MUST preserve impressive NUMBERS (e.g. "99.9% Uptime", "4.8x ROI"). Keep the stats, but make the labels "Executive-Level Branding".
            - Use a 'Blueprint' feel (thin grid lines, subtle glows, precisely aligned nodes).
            - Ensure it's responsive (Stack on mobile, Blueprint schematic on desktop).
            - Contract: The code will render inside a 'max-w-7xl' container.

            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        layout_strategy: { type: Type.STRING, enum: ['BLUEPRINT', 'NODES', 'TRIPTYCH'] },
                        headline: { type: Type.STRING },
                        subhead: { type: Type.STRING },
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    icon: { type: Type.STRING }
                                },
                                required: ["id", "label", "description"]
                            }
                        },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING },
                        primary_color: { type: Type.STRING },
                        visual_code: { type: Type.STRING }
                    },
                    required: ["strategy", "layout_strategy", "headline", "subhead", "nodes", "backgroundColor", "textColor", "visual_code"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Spec generation failed");
        return JSON.parse(text);
    }

    /**
     * Generates a "Social" visual section (testimonials, social proof).
     * 
     * @param {NanoBananaContext} context - The brand and design context.
     * @returns {Promise<any>} The generated visual configuration.
     */
    async generateSocialVisual(context: NanoBananaContext): Promise<any> {
        const prompt = `
            You are a 'Social Proof Architect'.
            Create a "Nano Banana" style Verified Testimonials section (Section 5).
            
            **BRAND CONTEXT**:
            - Brand Name: "${context.brandName}"
            - Mission: "${context.mission}"
            - Rationale: "${context.rationale}"
            - Colors: ${JSON.stringify(context.colors)}
            - Fonts: ${JSON.stringify(context.fonts)}
            
            **TASK**:
            1. **Testimonials**: Generate 3-6 high-fidelity, professional personas (Full Name, Executive Title, Company Name). Choose the count that best fits your chosen layout.
            2. **Quotes**: Write 1-2 sentence powerful testimonials using the Brand DNA voice. Do NOT use jargon or dev-speak.
            3. **Headshot Prompts**: For EACH persona, write a detailed photography prompt for generating a "Human-like, professional, high-end business portrait" using an image AI. 
            4. **Layout Strategy**: Choose a grid pattern (MASONRY | GRID | STACK).
            5. **Visual Layout**: Write 'visual_code' string:
               - Use the chosen layout strategy.
               - Ensure high contrast and professional executive look.
               - Center-align the section headline.
            
               - **CRITICAL**: Return valid HTML string (e.g. <div class="...">...</div>). DO NOT return CSS rules, style blocks, or markdown.
               - **IMAGES**: You MUST use an <img> tag for the testimonial persona. 
                 - Src Format: src="{id}_url" (e.g. src="testimonial_001_url"). 
                 - Class: rounded-full or similar.
                 - DO NOT use background-image on a div. DO NOT use empty divs for avatars.
            
            **DESIGN GUARDRAILS**:
            - NO underscores in names or titles.
            - NO generic "User 1" names.
            - Contract: max-w-7xl centered container.
            
            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        layout_strategy: { type: Type.STRING, enum: ['MASONRY', 'GRID', 'STACK'] },
                        headline: { type: Type.STRING },
                        subhead: { type: Type.STRING },
                        testimonials: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    company: { type: Type.STRING },
                                    quote: { type: Type.STRING },
                                    image_prompt: { type: Type.STRING }
                                },
                                required: ["id", "name", "title", "company", "quote", "image_prompt"]
                            }
                        },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING },
                        visual_code: { type: Type.STRING }
                    },
                    required: ["strategy", "layout_strategy", "headline", "subhead", "testimonials", "backgroundColor", "textColor", "visual_code"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Social generation failed");
        return JSON.parse(text);
    }

    /**
     * Generates an "Offer" visual section (pricing tiers, CTA).
     * 
     * @param {NanoBananaContext} context - The brand and design context.
     * @returns {Promise<any>} The generated visual configuration.
     */
    async generateOfferVisual(context: NanoBananaContext): Promise<any> {
        const prompt = `
            You are a 'Conversion Rate Optimization (CRO) Expert' and 'Venture Strategist'.
            Create a "Nano Banana" style Offer Section (Final Block) for "${context.brandName}".
            
            **BRAND CONTEXT**:
            - Brand Name: "${context.brandName}"
            - Industry: "${(context as any).brandDNA?.industry?.value || 'General'}"
            - Brand DNA Rationale: "${context.rationale}"
            
            **TASK**:
            1. **Offer Strategy**: Based on the industry and strategy, choose an offer type ('one-time' | 'subscription' | 'lead-gen' | 'custom').
            2. **Tiers**: Generate 1-3 tiers (e.g., "The Starter", "The Pro", "The Enterprise").
            3. **Layout Strategy**: Choose a grid pattern (SPLIT | CLOUDS | TRIPTYCH).
            4. **Visual Layout (STRICT TRACKING)**: Write 'visual_code' string using HTML/Tailwind:
               - Each tier card must have a \`data-tier-id="[tier-id]"\` attribute.
               - Every button or clickable action MUST have a \`data-cta-id="[action-slug]"\` attribute.
               - **OPTIONAL**: You can still include \`onclick="window.track('offer_cta_click', { tierId: '[tier-id]', actionId: '[action-slug]' })"\` for redundancy.
                - The visual code must render the cards, pricing, and features described in the JSON.
                - Ensure absolute adherence to the brand's mood (${context.mood.join(', ')}) and colors (${JSON.stringify(context.colors)}).
                - **NO PERSONAS**: Strictly NO names, NO job titles, and NO human quotes. This is a technical offer block, not a social testimonial block.
            
            **DESIGN GUARDRAILS**:
            - 'Executive Dashboard' aesthetic. No generic landing page templates.
            - Ensure it feels like a "Closing Deal" (High trust, clear value, zero friction).
            - Contract: max-w-7xl centered container.
            
            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.textModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        offer_type: { type: Type.STRING, enum: ['one-time', 'subscription', 'lead-gen', 'custom'] },
                        layout_strategy: { type: Type.STRING, enum: ['SPLIT', 'CLOUDS', 'TRIPTYCH'] },
                        headline: { type: Type.STRING },
                        subhead: { type: Type.STRING },
                        tiers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    price: { type: Type.STRING },
                                    interval: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    features: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    cta_text: { type: Type.STRING },
                                    is_highlighted: { type: Type.BOOLEAN },
                                    badge: { type: Type.STRING }
                                },
                                required: ["id", "name", "price", "description", "features", "cta_text"]
                            }
                        },
                        guarantee_text: { type: Type.STRING },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING },
                        accentColor: { type: Type.STRING },
                        visual_code: { type: Type.STRING }
                    },
                    required: ["strategy", "offer_type", "layout_strategy", "headline", "subhead", "tiers", "backgroundColor", "textColor", "accentColor", "visual_code"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Offer generation failed");
        const result = JSON.parse(text);

        return result;
    }
}

