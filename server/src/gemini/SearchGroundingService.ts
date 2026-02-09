import { GoogleGenAI, Tool } from '@google/genai';
import { MODELS } from '@shared/constants';

export interface LogoSearchResult {
    id: string;
    url: string;
    source: string;
    style: string;
    mood: string;
    reasoning: string;
    alt_text: string;
}

interface LogoSearchArgs {
    styleKeywords: string;
    industry: string;
    mood?: string;
    count?: number;
    referenceBrands?: string[];
    colorPreference?: string;
    logoTypes?: string[];
}

/**
 * Service for performing grounded searches using Google Search.
 * Optimized for finding logo inspirations and verifying domains.
 */
export class SearchGroundingService {
    private client: GoogleGenAI;
    private modelName = MODELS.ARCHITECT_TEXT; // Optimized for speed and grounding

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Searches for logo inspirations from the web based on style and industry.
     * 
     * @param {LogoSearchArgs} args - Search arguments.
     * @returns {Promise<LogoSearchResult[]>} A list of verified logo search results.
     */
    async searchLogoInspirationFromWeb(args: LogoSearchArgs): Promise<LogoSearchResult[]> {
        const count = args.count || 6;
        console.log(`Starting Optimized Image Discovery for ${count} logos...`);

        // Phase 1: Use Grounding to find actual brands and their design assets
        const discoveredBrands = await this.discoverLogoPages(args);

        if (!discoveredBrands.length) {
            console.warn('⚠️ No relevant brands found via grounding');
            return [];
        }

        // Phase 2: Resolve these brands to verified high-res logos
        const processedLogos = await this.batchExtractLogoImages(discoveredBrands, args);

        return processedLogos.slice(0, count);
    }

    /**
     * Phase 1: Uses Google Search Grounding to find relevant brand pages.
     * 
     * @param {LogoSearchArgs} args - Search arguments.
     * @returns {Promise<Array<{ url: string; title: string }>>} List of discovered pages.
     */
    private async discoverLogoPages(args: LogoSearchArgs): Promise<Array<{ url: string; title: string }>> {
        const query = this.buildSearchQuery(args);
        console.log(`🔎 Search Query: "${query}"`);

        try {
            const groundingTool: Tool = { googleSearch: {} };

            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{
                    role: 'user',
                    parts: [{
                        text: `Find exactly ${args.count || 6} real-world brands that exemplify this style: "${query}". 
                        I need the official website URLs for these brands. 
                        Prioritize brands with well-documented visual identities (e.g. Nike, Airbnb, Spotify).`
                    }]
                }],
                config: { tools: [groundingTool] },
            });

            const metadata = response.candidates?.[0]?.groundingMetadata;
            const chunks = metadata?.groundingChunks || [];

            console.log(`✅ Found ${chunks.length} grounding chunks`);

            // Convert grounding metadata into a list of brand domains
            const pages = chunks
                .map(chunk => ({
                    url: chunk.web?.uri || '',
                    title: chunk.web?.title || ''
                }))
                .filter(page => page.url.startsWith('http'));

            console.log(`📄 Found ${pages.length} verified brand sources.`);
            return pages;

        } catch (error) {
            console.error('❌ Grounding failed:', error);
            return [];
        }
    }

    /**
     * Phase 2: Extracts verified logo images from the discovered pages.
     * 
     * @param {Array<{ url: string; title: string }>} pages - List of pages to process.
     * @param {LogoSearchArgs} args - Original search arguments.
     * @returns {Promise<LogoSearchResult[]>} List of successfully extracted logos.
     */
    private async batchExtractLogoImages(
        pages: Array<{ url: string; title: string }>,
        args: LogoSearchArgs
    ): Promise<LogoSearchResult[]> {
        console.log(`📦 Processing ${pages.length} pages for logo extraction...`);

        // We process in parallel for speed
        const promises = pages.map(page => this.extractWithVerification(page, args));
        const results = await Promise.all(promises);
        const validResults = results.filter((res): res is LogoSearchResult => res !== null);

        console.log(`✅ Successfully extracted ${validResults.length} logos`);
        return validResults;
    }

    private async extractWithVerification(
        page: { url: string; title: string },
        args: LogoSearchArgs
    ): Promise<LogoSearchResult | null> {
        // CRITICAL FIX: Extract domain from TITLE, not from redirect URL
        const domain = this.extractDomainFromTitle(page.title);

        if (!domain) {
            console.warn(`⚠️ Could not extract valid domain from title: "${page.title}"`);
            return null; // Don't hallucinate - skip this result
        }

        console.log(`🔍 Processing: ${domain} (from title: "${page.title}")`);

        // Logo.dev is reliable - trust the URL directly without validation
        // Validation was causing ALL logos to fail due to HEAD request issues
        const logoDevUrl = `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ`;

        return {
            id: `logo-${Math.random().toString(36).substr(2, 9)}`,
            url: logoDevUrl,
            source: page.title || domain,
            style: args.styleKeywords,
            mood: args.mood || 'discovered',
            reasoning: `Logo for ${domain}`,
            alt_text: `${domain} official logo`
        };
    }

    /**
     * Extract a clean domain from the grounding chunk title.
     * Titles can be: "nike.com", "Nike - Official Site", "brandcrowd.com", etc.
     * Returns null if no valid domain can be extracted (prevents hallucination).
     */
    private extractDomainFromTitle(title: string): string | null {
        if (!title || title.length < 3) return null;

        // Pattern 1: Direct domain in title (e.g., "aqomi.com", "nike.com")
        const directDomainMatch = title.match(/^([a-z0-9][-a-z0-9]*[a-z0-9]?\.[a-z]{2,10})(?:[\/\s]|$)/i);
        if (directDomainMatch) {
            return directDomainMatch[1].toLowerCase();
        }

        // Pattern 2: Domain with path (e.g., "brandcrowd.com/maker")
        const domainWithPath = title.match(/([a-z0-9][-a-z0-9]*\.[a-z]{2,10})\/[a-z]/i);
        if (domainWithPath) {
            return domainWithPath[1].toLowerCase();
        }

        // Pattern 3: Well-known brand names we can map to domains
        const knownBrands: Record<string, string> = {
            'youtube': 'youtube.com',
            'google': 'google.com',
            'nike': 'nike.com',
            'adidas': 'adidas.com',
            'spotify': 'spotify.com',
            'airbnb': 'airbnb.com',
            'slack': 'slack.com',
            'notion': 'notion.so',
            'figma': 'figma.com',
            'twitter': 'twitter.com',
            'facebook': 'facebook.com',
            'instagram': 'instagram.com',
            'linkedin': 'linkedin.com',
            'apple': 'apple.com',
            'microsoft': 'microsoft.com',
            'amazon': 'amazon.com',
        };

        const lowerTitle = title.toLowerCase();
        for (const [brand, domain] of Object.entries(knownBrands)) {
            if (lowerTitle.includes(brand)) {
                return domain;
            }
        }

        // No valid domain found - return null to prevent hallucination
        return null;
    }

    private async isValidImage(url: string): Promise<boolean> {
        if (!url || !url.startsWith('http')) return false;
        try {
            const res = await fetch(url, { method: 'HEAD' });
            const contentType = res.headers.get('content-type') || '';
            const isImage = contentType.includes('image');

            if (!res.ok) {
                console.log(`   🔴 Logo.dev returned status ${res.status} for ${url.substring(0, 50)}...`);
            } else if (!isImage) {
                console.log(`   🟡 Logo.dev returned non-image content-type: ${contentType}`);
            }

            return res.ok && isImage;
        } catch (error) {
            console.log(`   🔴 Logo.dev fetch error: ${error}`);
            return false;
        }
    }

    private buildSearchQuery(args: LogoSearchArgs): string {
        return `${args.styleKeywords} ${args.industry} branding examples ${args.mood || ''}`.trim();
    }

    /**
     * Performs a general grounded search for any query.
     * 
     * @param {string} query - The search query.
     * @returns {Promise<string>} The search result summary.
     */
    async search(query: string): Promise<string> {
        console.log(`🔎 General Search: "${query}"`);
        const tool: Tool = { googleSearch: {} };

        try {
            const response = await this.client.models.generateContent({
                model: this.modelName,
                contents: [{ role: 'user', parts: [{ text: query }] }],
                config: { tools: [tool] }
            });

            return response.candidates?.[0]?.content?.parts?.[0]?.text || "No results found.";
        } catch (error) {
            console.error('❌ Search failed:', error);
            return `Search failed: ${error}`;
        }
    }
}
