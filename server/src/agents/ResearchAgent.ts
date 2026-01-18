// ResearchAgent: Uses Gemini 3 Flash with Google Search grounding
// for real-time competitor research

import { GoogleGenAI } from '@google/genai';

export interface CompetitorInfo {
    name: string;
    domain: string;
    description?: string;
}

export interface CompetitorBranding {
    name: string;
    primaryColor?: string;
    secondaryColor?: string;
    brandVibe?: string;
}

export interface ResearchResult {
    competitors: CompetitorInfo[];
    competitorBranding: CompetitorBranding[];  // Color/style analysis of each competitor
    industryInsights: string[];
    colorTrends: string[];
    differentiationOpportunity: string;  // How to stand out from competitors
}

export type ResearchProgressCallback = (
    phase: 'searching' | 'analyzing' | 'complete',
    message: string,
    competitors?: string[]
) => void;

/**
 * ResearchAgent uses Gemini 3 Flash with Google Search grounding
 * to find real competitors and industry insights.
 */
export class ResearchAgent {
    private ai: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        this.ai = new GoogleGenAI({ apiKey });
    }

    /**
     * Research competitors in a given industry using live Google Search
     */
    async researchCompetitors(
        industry: string,
        brandDescription: string,
        onProgress?: ResearchProgressCallback
    ): Promise<ResearchResult> {
        console.log(`🔍 ResearchAgent: Starting live search for "${industry}" competitors...`);

        onProgress?.('searching', `Searching for top ${industry} companies...`);

        try {
            // Use Gemini 3 Flash with Google Search grounding
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are a brand strategist researching competitors.

Industry: ${industry}
Brand context: ${brandDescription}

Using Google Search, find the TOP 5 real companies that are competitors or leaders in this industry. 

For EACH company, provide:
1. Company name (exact official name)
2. Website domain (e.g., "nike.com")
3. Brief description of what they do

Return ONLY a JSON array with this structure:
[
    {
        "name": "Company Name",
        "domain": "company.com",
        "description": "Brief description"
    }
]

IMPORTANT: 
- Only include REAL companies with REAL websites
- The domain must be their actual website
- Focus on well-known brands in this space`,
                config: {
                    tools: [{ googleSearch: {} }],  // Enable Google Search grounding
                    temperature: 0.3,  // Lower temp for factual accuracy
                }
            });

            const text = response.text || '';
            console.log(`📊 ResearchAgent: Raw response length: ${text.length}`);

            // Parse the JSON response
            const competitors = this.parseCompetitors(text);

            onProgress?.('analyzing', 'Analyzing competitor branding...', competitors.map(c => c.name));

            // Get additional insights about the industry
            const insights = await this.getIndustryInsights(industry, competitors);

            onProgress?.('complete', `Found ${competitors.length} competitors`, competitors.map(c => c.name));

            console.log(`✅ ResearchAgent: Found ${competitors.length} competitors:`, competitors.map(c => c.name));

            return {
                competitors,
                competitorBranding: insights.competitorBranding,
                industryInsights: insights.industryInsights,
                colorTrends: insights.colorTrends,
                differentiationOpportunity: insights.differentiationOpportunity
            };

        } catch (error) {
            console.error('❌ ResearchAgent error:', error);

            // Fallback to generic competitors if search fails
            return this.getFallbackCompetitors(industry);
        }
    }

    /**
     * Parse competitor JSON from Gemini response
     */
    private parseCompetitors(text: string): CompetitorInfo[] {
        try {
            // Find JSON array in response
            const jsonMatch = text.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed)) {
                    return parsed.map(c => ({
                        name: c.name || 'Unknown',
                        domain: c.domain || c.website || '',
                        description: c.description || ''
                    })).filter(c => c.name && c.domain);
                }
            }
        } catch (e) {
            console.error('Failed to parse competitors JSON:', e);
        }

        // Try to extract companies manually if JSON parsing fails
        return this.extractCompaniesFromText(text);
    }

    /**
     * Extract company names from unstructured text as fallback
     */
    private extractCompaniesFromText(text: string): CompetitorInfo[] {
        // Look for common patterns like "Company Name (domain.com)"
        const patterns = [
            /([A-Z][a-zA-Z\s]+)\s*(?:\(|-)?\s*([\w-]+\.com)/g,
            /(?:^|\n)\s*\d+\.\s*\*?\*?([A-Z][a-zA-Z\s]+)\*?\*?/gm
        ];

        const found: CompetitorInfo[] = [];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null && found.length < 5) {
                const name = match[1].trim();
                const domain = match[2] || `${name.toLowerCase().replace(/\s+/g, '')}.com`;

                if (name && !found.some(c => c.name === name)) {
                    found.push({ name, domain, description: '' });
                }
            }
        }

        return found;
    }

    /**
     * Get detailed competitive branding analysis
     */
    private async getIndustryInsights(
        industry: string,
        competitors: CompetitorInfo[]
    ): Promise<{
        industryInsights: string[];
        colorTrends: string[];
        competitorBranding: CompetitorBranding[];
        differentiationOpportunity: string;
    }> {
        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are a brand strategist analyzing the ${industry} industry.

Competitors: ${competitors.map(c => c.name).join(', ')}

Analyze each competitor's brand colors and style. Then suggest how a NEW brand can stand out.

Return JSON:
{
    "industryInsights": ["trend1", "trend2", "trend3"],
    "colorTrends": ["e.g. Blues and purples are dominant", "Gradients are common"],
    "competitorBranding": [
        {"name": "CompetitorA", "primaryColor": "#hexcode", "secondaryColor": "#hexcode", "brandVibe": "modern/playful/etc"},
        {"name": "CompetitorB", "primaryColor": "#hexcode", "secondaryColor": "#hexcode", "brandVibe": "..."}
    ],
    "differentiationOpportunity": "Specific advice on colors/style to stand out, e.g. 'Avoid blue - competitors saturate it. Use warm oranges to differentiate.'"
}`,
                config: {
                    temperature: 0.5
                }
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    industryInsights: parsed.industryInsights || [],
                    colorTrends: parsed.colorTrends || [],
                    competitorBranding: parsed.competitorBranding || [],
                    differentiationOpportunity: parsed.differentiationOpportunity || 'Create a unique visual identity'
                };
            }
        } catch (e) {
            console.error('Failed to get industry insights:', e);
        }

        return {
            industryInsights: ['Clean modern design', 'Bold typography', 'Minimalist approach'],
            colorTrends: ['Professional blues', 'Energetic accent colors'],
            competitorBranding: [],
            differentiationOpportunity: 'Create a distinctive visual identity that sets you apart'
        };
    }

    /**
     * Fallback competitors if live search fails
     */
    private getFallbackCompetitors(industry: string): ResearchResult {
        console.log('⚠️ Using fallback competitors for:', industry);

        return {
            competitors: [
                { name: 'Competitor A', domain: 'example.com', description: `Leading company in ${industry}` },
                { name: 'Competitor B', domain: 'example.org', description: `Rising challenger in ${industry}` },
                { name: 'Competitor C', domain: 'example.net', description: `Niche player in ${industry}` }
            ],
            competitorBranding: [
                { name: 'Competitor A', primaryColor: '#333333', secondaryColor: '#AAAAAA', brandVibe: 'Traditional' },
                { name: 'Competitor B', primaryColor: '#0055FF', secondaryColor: '#FFFFFF', brandVibe: 'Modern' }
            ],
            industryInsights: [`${industry} focuses on reliability`, 'Customer-centric designs are trending'],
            colorTrends: ['Blue', 'Green', 'Neutral tones'],
            differentiationOpportunity: 'Create a unique visual identity to disrupt the market standard.'
        };
    }

    /**
     * Perform general research on a topic using Google Search
     */
    async searchTopic(query: string, focus: string = 'general'): Promise<string> {
        console.log(`🔍 ResearchAgent: General search for "${query}" (Focus: ${focus})...`);

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are a research assistant.
Query: ${query}
Focus: ${focus}

Using Google Search, follow these rules:
1. Provide a concise but comprehensive summary (3-5 paragraphs).
2. Focus specifically on: ${focus}.
3. Include key facts, trends, or historical context relevant to design/branding if applicable.

Return ONLY the summary text.`,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.4,
                }
            });

            return response.text || "No results found.";
        } catch (error) {
            console.error('General search failed:', error);
            return `Research failed for "${query}".`;
        }
    }
}

// Singleton instance
let researchAgentInstance: ResearchAgent | null = null;

export function getResearchAgent(): ResearchAgent {
    if (!researchAgentInstance) {
        researchAgentInstance = new ResearchAgent();
    }
    return researchAgentInstance;
}
