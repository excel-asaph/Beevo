import { GoogleGenAI, Type } from '@google/genai';

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
    selected_imagery_concept: string;
    headline: string;
    subhead: string;
    graphic_caption: string;
    data_points: Array<{ label: string; value: number; unit?: string }>;
    graphic_type: 'progress' | 'trend' | 'stat';
    primary_color: string;
    accent_color: string;
    backgroundColor: string;
    textColor: string;
}

export class NanoBananaService {
    private client: GoogleGenAI;
    private modelName = 'gemini-3-flash-preview';

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async generateInitialVisual(context: NanoBananaContext): Promise<NanoBananaResult> {
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
            - **Colors**: ${JSON.stringify(context.colors)}
            - **Fonts**: ${JSON.stringify(context.fonts)}

            **TASK**:
            1. Create a "Trust Signature" using data for the brand "${context.brandName}". 
            2. Cross-correlate the data with one of the user's imagery concepts.
            3. Choose a chart type (progress | trend | stat).
            4. Return the visual configuration.

            **CRITICAL**: Do NOT use the phrase "Nano Banana" in the headline or data labels unless the user explicitly requested it in the brand mission.
            Use the actual brand name: "${context.brandName}".

            Return JSON.
        `;

        const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strategy: { type: Type.STRING },
                        selected_imagery_concept: { type: Type.STRING },
                        headline: { type: Type.STRING },
                        subhead: { type: Type.STRING },
                        graphic_caption: { type: Type.STRING },
                        data_points: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    value: { type: Type.NUMBER },
                                    unit: { type: Type.STRING }
                                },
                                required: ["label", "value"]
                            }
                        },
                        graphic_type: { type: Type.STRING, enum: ["progress", "trend", "stat"] },
                        primary_color: { type: Type.STRING },
                        accent_color: { type: Type.STRING },
                        backgroundColor: { type: Type.STRING },
                        textColor: { type: Type.STRING }
                    },
                    required: ["strategy", "selected_imagery_concept", "headline", "subhead", "graphic_caption", "data_points", "graphic_type", "primary_color", "accent_color", "backgroundColor", "textColor"]
                }
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("NanoBanana generation failed");
        return JSON.parse(text);
    }

    async refineVisual(current: any, performance: any, context: NanoBananaContext, snapshotBuffer?: Buffer): Promise<any> {
        const parts: any[] = [];

        if (snapshotBuffer) {
            parts.push({
                inlineData: {
                    data: snapshotBuffer.toString('base64'),
                    mimeType: 'image/png'
                }
            });
        }

        const prompt = `
            You are 'Watcher', optimizing a "Nano Banana" style Proof section.
            
            **CURRENT PERFORMANCE**:
            - Avg Dwell Time: ${performance.avgDwell}ms (Goal: 2000ms+)
            
            **CURRENT CONFIG**:
            ${JSON.stringify(current)}

            **BRAND CONTEXT**:
            - Brand Name: "${context.brandName}"
            - Mission: "${context.mission}"
            - Imagery: ${JSON.stringify(context.imagery)}

            **TASK**:
            1. Analyze the Snapshot (if provided). Why are users scrolling past?
            2. Mutate the strategy to increase informational density or emotional resonance for "${context.brandName}".
            3. Ensure the colors and labels provide high "Stop Power".

            **CRITICAL**: Do NOT use the term "Nano Banana" as the brand or product name. 
            Use "${context.brandName}".

            **OUTPUT JSON**:
            {
                "thoughts": "Detailed forensic diagnosis of why users aren't stopping and what you're changing",
                "changes": {
                    "headline": "String",
                    "subhead": "String",
                    "graphic_caption": "String",
                    "graphic_type": "progress | stat | trend",
                    "primary_color": "Hex",
                    "accent_color": "Hex"
                },
                "confidence": 0-100
            }
        `;

        parts.push({ text: prompt });

        const response = await this.client.models.generateContent({
            model: this.modelName,
            contents: [{ role: 'user', parts }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        thoughts: { type: Type.STRING },
                        changes: {
                            type: Type.OBJECT,
                            properties: {
                                headline: { type: Type.STRING },
                                subhead: { type: Type.STRING },
                                graphic_caption: { type: Type.STRING },
                                graphic_type: { type: Type.STRING },
                                primary_color: { type: Type.STRING },
                                accent_color: { type: Type.STRING }
                            },
                            required: ["headline", "subhead", "graphic_caption", "graphic_type", "primary_color", "accent_color"]
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
            return JSON.parse(cleanText);
        } catch (e) {
            console.error("❌ NanoBanana: Failed to parse AI JSON response:", text);
            throw e;
        }
    }
}
