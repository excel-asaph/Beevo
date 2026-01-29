// LogoStrategist: Browser-based logo research agent
// Uses Puppeteer with Stealth to browse Dribbble, Behance, and brand sites

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { GoogleGenAI } from '@google/genai';
import { MODELS } from '@shared/constants';
import { LogoBlockConfig } from '@shared/types';

// Enable stealth mode to bypass bot detection
puppeteer.use(StealthPlugin());

export interface BrandContext {
    name: string;
    industry: string;
    mission?: string;
    voice?: string;
    style?: string;
}

export interface LogoResearchResult {
    logos: LogoFinding[];
    insights: ResearchInsights;
    screenshots: string[];
}

export interface LogoFinding {
    id: string;
    imageUrl: string;
    brandName: string;
    source: string;
    style: string;
    designPrinciples: string[];
}

export interface ResearchInsights {
    dominantStyles: string[];
    commonPatterns: string[];
    recommendation: string;
}

export type ProgressCallback = (phase: string, source: string, progress: number, message: string) => void;

export class LogoStrategist {
    private browser: Browser | null = null;
    private ai: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        this.ai = new GoogleGenAI({ apiKey });
    }

    async initialize(): Promise<void> {
        if (!this.browser) {
            console.log('🌐 Launching STEALTH browser for logo research...');
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            }) as Browser;
            console.log('✅ Stealth browser launched successfully');
        }
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async researchLogos(
        context: BrandContext,
        onProgress: ProgressCallback
    ): Promise<LogoResearchResult> {
        await this.initialize();

        const allLogos: LogoFinding[] = [];
        const screenshots: string[] = [];

        try {
            // Phase 1: Google Images - Most reliable source for logo inspiration
            onProgress('browsing', 'Google Images', 10, `Searching for ${context.industry} logo inspiration...`);
            const googleResults = await this.searchGoogleImages(context);
            allLogos.push(...googleResults.logos);
            if (googleResults.screenshot) screenshots.push(googleResults.screenshot);
            console.log(`📊 Google Images: Found ${googleResults.logos.length} logos`);

            // Phase 2: Analyze findings with Gemini 3 (moved up since Phase 2 is gone)
            onProgress('analyzing', 'Gemini 3', 80, 'Analyzing patterns and generating insights...');
            const insights = await this.analyzeWithGemini(allLogos, context);

            onProgress('complete', 'Done', 100, `Found ${allLogos.length} logo inspirations!`);

            return {
                logos: allLogos,
                insights,
                screenshots
            };

        } catch (error) {
            console.error('❌ Logo research error:', error);
            throw error;
        }
    }

    /**
     * Search Google Images for logo inspiration
     * More reliable than Dribbble/Behance which rate-limit aggressively
     */
    private async searchGoogleImages(context: BrandContext): Promise<{ logos: LogoFinding[], screenshot?: string }> {
        if (!this.browser) throw new Error('Browser not initialized');

        const page = await this.browser.newPage();
        const logos: LogoFinding[] = [];
        let screenshot: string | undefined;

        try {
            // Set realistic viewport and user agent
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Build search query for logo inspiration
            // Strict user rule: Query must be based on industry from DNA
            const industry = context.industry || 'Business';
            const searchQuery = encodeURIComponent(`${industry} logo design inspiration`);
            const url = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;

            console.log(`🔍 Google Images: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for images to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Take screenshot for debugging
            screenshot = await page.screenshot({ encoding: 'base64' }) as string;

            // Extract image results from Google Images
            const images = await page.$$eval('img', (imgs) => {
                return imgs
                    .filter(img => {
                        // Filter for actual image results (not icons/UI elements)
                        const src = img.src || '';
                        const isDataUrl = src.startsWith('data:image');
                        const isGoogleCdn = src.includes('encrypted-tbn');
                        const hasGoodSize = img.width > 50 && img.height > 50;
                        return (isDataUrl || isGoogleCdn) && hasGoodSize;
                    })
                    .slice(0, 8)
                    .map((img, index) => ({
                        imageUrl: img.src || '',
                        title: img.alt || `Logo Design ${index + 1}`,
                        width: img.width,
                        height: img.height
                    }));
            });

            console.log(`📊 Found ${images.length} Google Images results`);

            images.forEach((img, index) => {
                if (img.imageUrl) {
                    // Generate a clean, handle-able name for the user to reference
                    // User requested simple "logo_n" format
                    const cleanName = `logo_${index + 1}`;

                    logos.push({
                        id: String(index + 1),
                        imageUrl: img.imageUrl,
                        brandName: cleanName,
                        source: 'Google Images',
                        style: 'Design Inspiration',
                        designPrinciples: ['Discovered', 'Trending']
                    });
                }
            });

            console.log(`✅ Google Images: Found ${logos.length} logo inspirations`);

        } catch (error) {
            console.error('❌ Google Images search error:', error);
        } finally {
            await page.close();
        }

        return { logos, screenshot };
    }

    private async analyzeWithGemini(
        logos: LogoFinding[],
        context: BrandContext
    ): Promise<ResearchInsights> {
        try {
            const prompt = `Analyze these logo search results for a ${context.industry} brand called "${context.name}":

Logos found:
${logos.map(l => `- ${l.brandName} (${l.source})`).join('\n')}

Brand context:
- Industry: ${context.industry}
- Mission: ${context.mission || 'Not specified'}
- Voice: ${context.voice || 'Not specified'}

Provide analysis in JSON format:
{
    "dominantStyles": ["style1", "style2", "style3"],
    "commonPatterns": ["pattern1", "pattern2", "pattern3"],
    "recommendation": "A specific recommendation for their logo based on analysis"
}`;

            const result = await this.ai.models.generateContent({
                model: MODELS.ARCHITECT_TEXT,
                contents: prompt
            });

            const text = result.text || '';

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback insights
            return {
                dominantStyles: ['Minimal', 'Modern', 'Bold'],
                commonPatterns: ['Single-color marks', 'Geometric shapes', 'Clean lines'],
                recommendation: `Based on search results, consider a minimal, dynamic mark for ${context.industry}.`
            };

        } catch (error) {
            console.error('Gemini analysis error:', error);
            return {
                dominantStyles: ['Minimal', 'Modern'],
                commonPatterns: ['Clean design', 'Bold shapes'],
                recommendation: 'Consider a minimal, memorable mark that scales well across applications.'
            };
        }
    }
}

// Singleton instance
let strategistInstance: LogoStrategist | null = null;

export async function getLogoStrategist(): Promise<LogoStrategist> {
    if (!strategistInstance) {
        strategistInstance = new LogoStrategist();
    }
    return strategistInstance;
}
