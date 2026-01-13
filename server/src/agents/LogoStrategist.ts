// LogoStrategist: Browser-based logo research agent
// Uses Puppeteer with Stealth to browse Dribbble, Behance, and brand sites

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { GoogleGenAI } from '@google/genai';

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

            // Phase 2: Industry leader brands (reliable Logo.dev)
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
            const searchQuery = encodeURIComponent(`${context.industry} logo design inspiration`);
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
                    logos.push({
                        id: `google-${index}`,
                        imageUrl: img.imageUrl,
                        brandName: img.title.slice(0, 50), // Truncate long titles
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

    private async researchIndustryBrands(
        context: BrandContext,
        onProgress: ProgressCallback
    ): Promise<{ logos: LogoFinding[], screenshots: string[] }> {
        // Comprehensive industry-specific brand lists
        const industryBrands: Record<string, string[]> = {
            // Beverages & Drinks
            drink: ['cocacola.com', 'pepsi.com', 'redbull.com', 'monster.com', 'drpepper.com', 'sprite.com'],
            drinks: ['cocacola.com', 'pepsi.com', 'redbull.com', 'monster.com', 'drpepper.com', 'sprite.com'],
            beverage: ['cocacola.com', 'pepsi.com', 'redbull.com', 'monster.com', 'drpepper.com', 'sprite.com'],
            beverages: ['cocacola.com', 'pepsi.com', 'redbull.com', 'monster.com', 'drpepper.com', 'sprite.com'],
            soda: ['cocacola.com', 'pepsi.com', 'sprite.com', 'fanta.com', 'drpepper.com', '7up.com'],
            juice: ['tropicana.com', 'minutemaid.com', 'simplyorangejuice.com', 'oceanspray.com', 'naked.com'],
            energy: ['redbull.com', 'monster.com', 'rockstarenergy.com', 'celsius.com', 'gatorade.com'],
            'energy drink': ['redbull.com', 'monster.com', 'rockstarenergy.com', 'celsius.com', 'gatorade.com'],
            water: ['evian.com', 'perrier.com', 'fiji.com', 'voss.com', 'smartwater.com'],
            // Coffee & Tea
            coffee: ['starbucks.com', 'dunkindonuts.com', 'peets.com', 'bluebottlecoffee.com', 'nespresso.com'],
            tea: ['twinings.com', 'tazo.com', 'bigelowtea.com', 'celestialseasonings.com'],
            // Alcohol
            beer: ['heineken.com', 'budweiser.com', 'corona.com', 'guinness.com', 'stellaartois.com'],
            wine: ['barefoot.com', 'yellowtail.com', 'opus-one.com', 'kendall-jackson.com'],
            spirits: ['jackdaniels.com', 'absolut.com', 'bacardi.com', 'patron.com', 'hendricks.com'],
            // Footwear
            footwear: ['nike.com', 'adidas.com', 'puma.com', 'newbalance.com', 'converse.com', 'vans.com'],
            shoes: ['nike.com', 'adidas.com', 'puma.com', 'newbalance.com', 'converse.com', 'vans.com'],
            sneakers: ['nike.com', 'adidas.com', 'puma.com', 'newbalance.com', 'converse.com', 'vans.com'],
            // Technology
            tech: ['apple.com', 'google.com', 'microsoft.com', 'stripe.com', 'notion.so', 'discord.com'],
            technology: ['apple.com', 'google.com', 'microsoft.com', 'stripe.com', 'notion.so', 'discord.com'],
            software: ['slack.com', 'figma.com', 'notion.so', 'linear.app', 'vercel.com', 'github.com'],
            saas: ['slack.com', 'figma.com', 'notion.so', 'linear.app', 'vercel.com', 'intercom.com'],
            // Food & Restaurant
            food: ['mcdonalds.com', 'starbucks.com', 'chipotle.com', 'sweetgreen.com', 'shake-shack.com'],
            restaurant: ['mcdonalds.com', 'chipotle.com', 'sweetgreen.com', 'shake-shack.com', 'dominos.com'],
            fastfood: ['mcdonalds.com', 'burgerking.com', 'wendys.com', 'tacobell.com', 'chickfila.com'],
            snacks: ['lays.com', 'doritos.com', 'pringles.com', 'oreo.com', 'cheetos.com'],
            // Fashion & Apparel
            fashion: ['gucci.com', 'zara.com', 'hm.com', 'uniqlo.com', 'nike.com', 'gap.com'],
            clothing: ['gucci.com', 'zara.com', 'hm.com', 'uniqlo.com', 'gap.com', 'levis.com'],
            apparel: ['gucci.com', 'zara.com', 'hm.com', 'uniqlo.com', 'gap.com', 'levis.com'],
            luxury: ['gucci.com', 'louisvuitton.com', 'chanel.com', 'hermes.com', 'prada.com'],
            // Health & Fitness
            fitness: ['nike.com', 'underarmour.com', 'lululemon.com', 'gymshark.com', 'peloton.com'],
            health: ['headspace.com', 'calm.com', 'noom.com', 'myfitnesspal.com', 'whoop.com'],
            wellness: ['headspace.com', 'calm.com', 'ritual.com', 'careofvitamins.com'],
            // Beauty & Personal Care
            beauty: ['sephora.com', 'ulta.com', 'glossier.com', 'fenty.com', 'charlotte-tilbury.com'],
            skincare: ['cerave.com', 'theordinary.com', 'drunk-elephant.com', 'laroche-posay.com'],
            cosmetics: ['mac.com', 'maybelline.com', 'nars.com', 'urbandecay.com'],
            // Automotive
            automotive: ['tesla.com', 'bmw.com', 'mercedes-benz.com', 'porsche.com', 'ferrari.com'],
            car: ['tesla.com', 'bmw.com', 'mercedes-benz.com', 'porsche.com', 'ferrari.com'],
            // Travel & Hospitality
            travel: ['airbnb.com', 'booking.com', 'expedia.com', 'marriott.com', 'hilton.com'],
            hotel: ['marriott.com', 'hilton.com', 'hyatt.com', 'fourseasons.com', 'airbnb.com'],
            airline: ['emirates.com', 'united.com', 'delta.com', 'southwest.com', 'britishairways.com'],
            // Finance
            finance: ['stripe.com', 'square.com', 'robinhood.com', 'coinbase.com', 'chime.com'],
            fintech: ['stripe.com', 'square.com', 'robinhood.com', 'coinbase.com', 'plaid.com'],
            banking: ['chase.com', 'bankofamerica.com', 'wellsfargo.com', 'capitalone.com'],
            // Entertainment
            entertainment: ['netflix.com', 'spotify.com', 'disney.com', 'hbo.com', 'youtube.com'],
            gaming: ['playstation.com', 'xbox.com', 'nintendo.com', 'epicgames.com', 'riotgames.com'],
            music: ['spotify.com', 'soundcloud.com', 'tidal.com', 'deezer.com', 'bandcamp.com'],
            // Sports
            sports: ['nike.com', 'adidas.com', 'underarmour.com', 'nba.com', 'nfl.com'],
            athletic: ['nike.com', 'adidas.com', 'underarmour.com', 'puma.com', 'asics.com'],
            // E-commerce & Retail
            ecommerce: ['amazon.com', 'shopify.com', 'etsy.com', 'ebay.com', 'alibaba.com'],
            retail: ['target.com', 'walmart.com', 'costco.com', 'bestbuy.com', 'ikea.com'],
        };

        // Smart industry normalization - find the best matching category
        const normalizedIndustry = this.normalizeIndustry(context.industry.toLowerCase(), industryBrands);
        const brands = industryBrands[normalizedIndustry] || this.getSmartDefault(context);

        console.log(`🏷️ Industry "${context.industry}" normalized to "${normalizedIndustry}", using brands: ${brands.slice(0, 3).join(', ')}...`);

        const logos: LogoFinding[] = [];
        const screenshots: string[] = [];

        // Get logos via Logo.dev (fast, reliable)
        for (let i = 0; i < Math.min(brands.length, 4); i++) {
            const domain = brands[i];
            const brandName = domain.replace('.com', '').replace('.so', '').replace('.app', '');

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

    /**
     * Normalize user-provided industry to a known category
     */
    private normalizeIndustry(industry: string, knownIndustries: Record<string, string[]>): string {
        // Direct match
        if (knownIndustries[industry]) {
            return industry;
        }

        // Check if it contains a known keyword
        const keywords = industry.split(/\s+/);
        for (const keyword of keywords) {
            if (knownIndustries[keyword]) {
                return keyword;
            }
        }

        // Fuzzy matching - check if industry contains or is contained by known category
        for (const category of Object.keys(knownIndustries)) {
            if (industry.includes(category) || category.includes(industry)) {
                return category;
            }
        }

        return 'default';
    }

    /**
     * Generate a smart default based on context clues
     */
    private getSmartDefault(context: BrandContext): string[] {
        // Analyze mission and style for clues
        const contextText = `${context.mission || ''} ${context.voice || ''} ${context.style || ''}`.toLowerCase();

        if (contextText.includes('drink') || contextText.includes('beverage') || contextText.includes('thirst')) {
            return ['cocacola.com', 'pepsi.com', 'redbull.com', 'monster.com'];
        }
        if (contextText.includes('coffee') || contextText.includes('cafe')) {
            return ['starbucks.com', 'dunkindonuts.com', 'peets.com', 'bluebottlecoffee.com'];
        }
        if (contextText.includes('sport') || contextText.includes('athletic') || contextText.includes('fitness')) {
            return ['nike.com', 'adidas.com', 'underarmour.com', 'puma.com'];
        }
        if (contextText.includes('tech') || contextText.includes('software') || contextText.includes('app')) {
            return ['slack.com', 'figma.com', 'notion.so', 'linear.app'];
        }

        // True default - show diverse modern brands
        return ['stripe.com', 'airbnb.com', 'slack.com', 'notion.so'];
    }

    private async inferDesignPrinciples(brandName: string): Promise<string[]> {
        // Quick inference based on known brands
        const principles: Record<string, string[]> = {
            // Beverages & Drinks
            cocacola: ['Iconic', 'Script Typography', 'Timeless Red'],
            pepsi: ['Circular', 'Dynamic', 'Modern'],
            redbull: ['Bold', 'Aggressive', 'Energetic'],
            monster: ['Edgy', 'Bold Typography', 'Dark Theme'],
            drpepper: ['Heritage', 'Distinctive', 'Playful'],
            sprite: ['Fresh', 'Green Accent', 'Clean'],
            fanta: ['Playful', 'Vibrant Colors', 'Fun'],
            gatorade: ['Athletic', 'Lightning Bolt', 'Performance'],
            // Coffee
            starbucks: ['Iconic', 'Circular Emblem', 'Green Accent'],
            dunkindonuts: ['Friendly', 'Warm Colors', 'Approachable'],
            peets: ['Premium', 'Heritage', 'Artisanal'],
            bluebottlecoffee: ['Minimal', 'Clean', 'Craft'],
            nespresso: ['Luxurious', 'Sleek', 'Premium'],
            // Footwear & Sports
            nike: ['Minimal', 'Motion-inspired', 'Bold'],
            adidas: ['Geometric', 'Structured', 'Athletic'],
            puma: ['Dynamic', 'Energetic', 'Fierce'],
            newbalance: ['Heritage', 'Stable', 'Trustworthy'],
            converse: ['Retro', 'Star Icon', 'Youth Culture'],
            vans: ['Skateboard Culture', 'Off the Wall', 'Authentic'],
            underarmour: ['Technical', 'Performance', 'Athletic'],
            // Technology
            apple: ['Minimal', 'Clean', 'Premium'],
            google: ['Colorful', 'Friendly', 'Simple'],
            spotify: ['Modern', 'Vibrant', 'Playful'],
            stripe: ['Clean', 'Professional', 'Tech-forward'],
            notion: ['Minimal', 'Black & White', 'Productivity'],
            slack: ['Colorful', 'Friendly', 'Collaborative'],
            figma: ['Modern', 'Colorful', 'Creative'],
            discord: ['Playful', 'Modern', 'Community'],
            microsoft: ['Grid-based', 'Colorful', 'Enterprise'],
            // Finance
            robinhood: ['Modern', 'Minimal', 'Accessible'],
            coinbase: ['Clean', 'Circular', 'Trustworthy'],
            // Fashion & Luxury
            gucci: ['Luxurious', 'Interlocking G', 'Heritage'],
            zara: ['Minimal', 'Bold Typography', 'Fashion-forward'],
            // Travel
            airbnb: ['Friendly', 'Bélo Symbol', 'Community'],
            // Alcohol
            heineken: ['Star Icon', 'Green', 'Premium'],
            corona: ['Crown', 'Golden', 'Beach Vibes'],
            guinness: ['Harp', 'Heritage', 'Bold'],
            jackdaniels: ['Heritage', 'Black & White', 'Authentic'],
            absolut: ['Bottle Shape', 'Minimal', 'Premium'],
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
