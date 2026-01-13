// Test script for Google Images scraping
// Run with: npx tsx server/src/test-google-images.ts

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

// Enable stealth mode
puppeteer.use(StealthPlugin());

async function testGoogleImages() {
    console.log('🧪 Testing Google Images scraping...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const searchQuery = encodeURIComponent('drink brand logo design inspiration');
        const url = `https://www.google.com/search?q=${searchQuery}&tbm=isch`;

        console.log(`📍 Navigating to: ${url.slice(0, 80)}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for images
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check page title
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Extract images
        const images = await page.$$eval('img', (imgs) => {
            return imgs
                .filter(img => {
                    const src = img.src || '';
                    const isDataUrl = src.startsWith('data:image');
                    const isGoogleCdn = src.includes('encrypted-tbn');
                    const hasGoodSize = img.width > 50 && img.height > 50;
                    return (isDataUrl || isGoogleCdn) && hasGoodSize;
                })
                .slice(0, 8)
                .map((img, index) => ({
                    url: img.src,
                    alt: img.alt || `Logo Design ${index + 1}`,
                    width: img.width,
                    height: img.height
                }));
        });

        console.log(`\n=== Found ${images.length} images ===\n`);

        // Create HTML file with embedded images
        let html = `<!DOCTYPE html>
<html>
<head>
    <title>Google Images Results - Logo Inspiration</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card img { width: 100%; height: auto; border-radius: 4px; }
        .card p { margin: 10px 0 0; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <h1>🎨 Drink Brand Logo Design Inspiration</h1>
    <p>Found ${images.length} images from Google Images</p>
    <div class="grid">`;

        images.forEach((img, i) => {
            console.log(`${i + 1}. "${img.alt}" (${img.width}x${img.height})`);
            html += `
        <div class="card">
            <img src="${img.url}" alt="${img.alt}" />
            <p><strong>${i + 1}.</strong> ${img.alt}</p>
        </div>`;
        });

        html += `
    </div>
</body>
</html>`;

        // Save HTML file
        fs.writeFileSync('logo-results.html', html);
        console.log(`\n📄 Created: logo-results.html`);
        console.log(`🌐 Open in browser: file:///${process.cwd().replace(/\\/g, '/')}/logo-results.html`);

        // Save screenshot
        await page.screenshot({ path: 'google-images-test.png' });
        console.log('📸 Screenshot saved to: google-images-test.png');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
        console.log('\n✅ Browser closed');
    }
}

testGoogleImages();
