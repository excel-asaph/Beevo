// Test script for Puppeteer stealth scraping
// Run with: npx tsx server/src/test-dribbble.ts

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Enable stealth mode
puppeteer.use(StealthPlugin());

async function testDribbbleScraping() {
    console.log('🧪 Testing Dribbble scraping with stealth mode...\n');

    const browser = await puppeteer.launch({
        headless: true,  // Use stealth mode for detection bypass
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    const page = await browser.newPage();

    try {
        // Set realistic viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        });

        // Use the correct path-based URL format
        const searchQuery = 'drink-brand-logo';
        const url = `https://dribbble.com/search/${searchQuery}`;

        console.log(`📍 Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check page title
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Check if we're blocked
        const content = await page.content();
        const isBlocked = content.toLowerCase().includes('blocked') ||
            content.toLowerCase().includes('captcha') ||
            content.toLowerCase().includes('access denied');

        if (isBlocked) {
            console.log('❌ Page appears to be BLOCKED!');
        } else {
            console.log('✅ Page loaded successfully (not blocked)');
        }

        // Try multiple selectors
        const selectors = [
            '[data-testid="shot-thumbnail"]',
            '.shot-thumbnail',
            '.shot-thumbnail-base',
            '[class*="ShotCard"]',
            'li[class*="shot"]',
            'a[href*="/shots/"] img',
            'img[src*="cdn.dribbble.com"]'  // Direct image check
        ];

        console.log('\n🔍 Testing selectors:');
        let foundCount = 0;

        for (const selector of selectors) {
            try {
                const count = await page.$$eval(selector, (els) => els.length);
                if (count > 0) {
                    console.log(`  ✅ ${selector} → Found ${count} elements`);
                    foundCount += count;
                } else {
                    console.log(`  ⚪ ${selector} → 0 elements`);
                }
            } catch (e) {
                console.log(`  ⚪ ${selector} → Error: ${(e as Error).message.slice(0, 50)}`);
            }
        }

        // Try to extract actual image URLs
        console.log('\n🖼️ Extracting images:');
        const images = await page.$$eval('img', (imgs) =>
            imgs.slice(0, 10).map(img => ({
                src: img.src?.slice(0, 80),
                alt: img.alt?.slice(0, 40)
            }))
        );

        if (images.length > 0) {
            images.forEach((img, i) => {
                console.log(`  ${i + 1}. ${img.alt || 'No alt'}`);
                console.log(`     ${img.src}...`);
            });
        } else {
            console.log('  ❌ No images found on page');
        }

        // Save screenshot for visual inspection
        const screenshotPath = 'dribbble-test-screenshot.png';
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`\n📸 Screenshot saved to: ${screenshotPath}`);

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`  - Page loaded: ${title ? 'Yes' : 'No'}`);
        console.log(`  - Blocked: ${isBlocked ? 'YES ❌' : 'No ✅'}`);
        console.log(`  - Elements found: ${foundCount}`);
        console.log(`  - Images found: ${images.length}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
        console.log('\n✅ Browser closed');
    }
}

testDribbbleScraping();
