// LogoStrategist: Browser-based logo research agent
// Uses Puppeteer to browse Dribbble, Behance, and brand sites

import puppeteer, { Browser, Page } from 'puppeteer';
import { GoogleGenAI } from '@google/genai';

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
            console.log('🌐 Launching browser for logo research...');
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
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
            // Phase 1: Dribbble research
            onProgress('browsing', 'Dribbble', 10, `Searching for ${context.industry} logos on Dribbble...`);
            const dribbbleResults = await this.searchDribbble(context);
            allLogos.push(...dribbbleResults.logos);
            if (dribbbleResults.screenshot) screenshots.push(dribbbleResults.screenshot);

            // Phase 2: Behance research
            onProgress('browsing', 'Behance', 30, `Exploring ${context.industry} branding on Behance...`);
            const behanceResults = await this.searchBehance(context);
            allLogos.push(...behanceResults.logos);
            if (behanceResults.screenshot) screenshots.push(behanceResults.screenshot);

            // Phase 3: Industry leader brands
            onProgress('browsing', 'Industry Leaders', 50, `Analyzing logos from leading ${context.industry} brands...`);
            const brandResults = await this.researchIndustryBrands(context, onProgress);
            allLogos.push(...brandResults.logos);
            screenshots.push(...brandResults.screenshots);

            // Phase 4: Analyze findings with Gemini 3
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

    private async searchDribbble(context: BrandContext): Promise<{ logos: LogoFinding[], screenshot?: string }> {
        if (!this.browser) throw new Error('Browser not initialized');

        const page = await this.browser.newPage();
        const logos: LogoFinding[] = [];
        let screenshot: string | undefined;

        try {
            await page.setViewport({ width: 1280, height: 800 });

            // Search Dribbble for industry + logo
            const searchQuery = encodeURIComponent(`${context.industry} logo minimalist`);
            const url = `https://dribbble.com/search?q=${searchQuery}`;

            console.log(`🔍 Dribbble: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for shots to load
            await page.waitForSelector('.shot-thumbnail-base', { timeout: 10000 }).catch(() => { });

            // Take screenshot
            screenshot = await page.screenshot({ encoding: 'base64' }) as string;

            // Extract logo shots
            const shots = await page.$$eval('.shot-thumbnail-base', (elements) => {
                return elements.slice(0, 6).map((el, index) => {
                    const img = el.querySelector('img');
                    const link = el.querySelector('a');
                    return {
                        imageUrl: img?.src || '',
                        title: img?.alt || `Dribbble Design ${index + 1}`,
                        href: link?.href || ''
                    };
                });
            });

            shots.forEach((shot, index) => {
                if (shot.imageUrl) {
                    logos.push({
                        id: `dribbble-${index}`,
                        imageUrl: shot.imageUrl,
                        brandName: shot.title,
                        source: 'Dribbble',
                        style: 'Design Community',
                        designPrinciples: ['Creative', 'Modern']
                    });
                }
            });

            console.log(`✅ Dribbble: Found ${logos.length} logos`);

        } catch (error) {
            console.error('Dribbble search error:', error);
        } finally {
            await page.close();
        }

        return { logos, screenshot };
    }

    private async searchBehance(context: BrandContext): Promise<{ logos: LogoFinding[], screenshot?: string }> {
        if (!this.browser) throw new Error('Browser not initialized');

        const page = await this.browser.newPage();
        const logos: LogoFinding[] = [];
        let screenshot: string | undefined;

        try {
            await page.setViewport({ width: 1280, height: 800 });

            const searchQuery = encodeURIComponent(`${context.industry} branding logo`);
            const url = `https://www.behance.net/search/projects?search=${searchQuery}`;

            console.log(`🔍 Behance: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for projects to load
            await page.waitForSelector('[class*="ProjectCover"]', { timeout: 10000 }).catch(() => { });

            // Take screenshot
            screenshot = await page.screenshot({ encoding: 'base64' }) as string;

            // Extract project covers
            const projects = await page.$$eval('img[class*="ProjectCover"]', (imgs) => {
                return imgs.slice(0, 6).map((img, index) => ({
                    imageUrl: img.src || '',
                    title: img.alt || `Behance Project ${index + 1}`
                }));
            });

            projects.forEach((project, index) => {
                if (project.imageUrl) {
                    logos.push({
                        id: `behance-${index}`,
                        imageUrl: project.imageUrl,
                        brandName: project.title,
                        source: 'Behance',
                        style: 'Professional Branding',
                        designPrinciples: ['Professional', 'Brand-focused']
                    });
                }
            });

            console.log(`✅ Behance: Found ${logos.length} logos`);

        } catch (error) {
            console.error('Behance search error:', error);
        } finally {
            await page.close();
        }

        return { logos, screenshot };
    }

    private async researchIndustryBrands(
        context: BrandContext,
        onProgress: ProgressCallback
    ): Promise<{ logos: LogoFinding[], screenshots: string[] }> {
        // Industry-specific brand lists
        const industryBrands: Record<string, string[]> = {
            footwear: ['nike.com', 'adidas.com', 'puma.com', 'newbalance.com', 'converse.com', 'vans.com'],
            shoes: ['nike.com', 'adidas.com', 'puma.com', 'newbalance.com', 'converse.com', 'vans.com'],
            tech: ['apple.com', 'google.com', 'spotify.com', 'stripe.com', 'notion.so', 'discord.com'],
            technology: ['apple.com', 'google.com', 'spotify.com', 'stripe.com', 'notion.so', 'discord.com'],
            food: ['mcdonalds.com', 'starbucks.com', 'chipotle.com', 'sweetgreen.com'],
            fashion: ['gucci.com', 'zara.com', 'hm.com', 'uniqlo.com'],
            default: ['apple.com', 'nike.com', 'spotify.com', 'airbnb.com']
        };

        const industry = context.industry.toLowerCase();
        const brands = industryBrands[industry] || industryBrands.default;

        const logos: LogoFinding[] = [];
        const screenshots: string[] = [];

        // Get logos via Logo.dev (fast, reliable)
        for (let i = 0; i < Math.min(brands.length, 4); i++) {
            const domain = brands[i];
            const brandName = domain.replace('.com', '').replace('.', '');

            onProgress('browsing', brandName, 50 + (i * 10), `Analyzing ${brandName} logo...`);

            const logoUrl = `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ`;

            logos.push({
                id: `brand-${i}`,
                imageUrl: logoUrl,
                brandName: brandName.charAt(0).toUpperCase() + brandName.slice(1),
                source: 'Official Brand',
                style: 'Industry Leader',
                designPrinciples: await this.inferDesignPrinciples(brandName)
            });
        }

        return { logos, screenshots };
    }

    private async inferDesignPrinciples(brandName: string): Promise<string[]> {
        // Quick inference based on known brands
        const principles: Record<string, string[]> = {
            nike: ['Minimal', 'Motion-inspired', 'Bold'],
            adidas: ['Geometric', 'Structured', 'Athletic'],
            puma: ['Dynamic', 'Energetic', 'Fierce'],
            apple: ['Minimal', 'Clean', 'Premium'],
            spotify: ['Modern', 'Vibrant', 'Playful'],
            google: ['Colorful', 'Friendly', 'Simple']
        };

        return principles[brandName.toLowerCase()] || ['Professional', 'Modern'];
    }

    private async analyzeWithGemini(
        logos: LogoFinding[],
        context: BrandContext
    ): Promise<ResearchInsights> {
        try {
            const prompt = `Analyze these logo findings for a ${context.industry} brand called "${context.name}":

Logos found:
${logos.map(l => `- ${l.brandName} (${l.source}): ${l.designPrinciples.join(', ')}`).join('\n')}

Brand context:
- Industry: ${context.industry}
- Mission: ${context.mission || 'Not specified'}
- Voice: ${context.voice || 'Not specified'}
- Desired style: ${context.style || 'Not specified'}

Provide analysis in JSON format:
{
    "dominantStyles": ["style1", "style2", "style3"],
    "commonPatterns": ["pattern1", "pattern2", "pattern3"],
    "recommendation": "A specific recommendation for their logo based on analysis"
}`;

            const result = await this.ai.models.generateContent({
                model: 'gemini-2.0-flash',
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
                recommendation: `Based on your ${context.industry} brand, consider a minimal, dynamic mark that conveys energy and movement.`
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
