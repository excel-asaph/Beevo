
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input: The generated wordmark logo
const INPUT_PATH = path.resolve(__dirname, '../../../client/public/assets/generated_logos/logo_variant_wordmark.png');
// Output: The new test folder
const OUTPUT_DIR = path.resolve(__dirname, '../../../client/public/assets/transparent_logos');
const OUTPUT_FILENAME = 'test_wordmark_transparent.png';
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILENAME);

async function main() {
    console.log("🧪 Starting Transparency V2 Protocol (Debug Mode)...");

    try {
        await fs.access(INPUT_PATH);
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch {
        console.error("❌ Input file not found or cannot create output dir:", INPUT_PATH);
        return;
    }

    const fileBuffer = await fs.readFile(INPUT_PATH);
    const base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;
    console.log(`Payload Size: ${(base64Image.length / 1024).toFixed(2)} KB`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Pipe browser logs to node console
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    console.log(`Loading image into browser context...`);


    // define logic as string to prevent tsx/build tools from injecting helpers
    const browserCode = `
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(null);

                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const width = canvas.width;
                    const height = canvas.height;

                    // === GLOBAL COLOR KEYING (The "Select Color Range" Approach) ===
                    // Iterate every pixel. If it matches the background, erase it.
                    // This handles islands/holes provided the logo doesn't use the background color for paint.

                    // 1. Sample Background from Corners (Robust Average)
                    const corners = [
                        0, 
                        (width - 1) * 4,
                        (width * (height - 1)) * 4,
                        (width * height - 1) * 4 - 4
                    ];

                    let rBg = 0, gBg = 0, bBg = 0, count = 0;
                    for (let i = 0; i < corners.length; i++) {
                        const idx = corners[i];
                        if (data[idx + 3] > 0) {
                            rBg += data[idx];
                            gBg += data[idx + 1];
                            bBg += data[idx + 2];
                            count++;
                        }
                    }

                    if (count > 0) {
                        rBg = Math.round(rBg / count);
                        gBg = Math.round(gBg / count);
                        bBg = Math.round(bBg / count);
                    } else {
                        // Fallback to white
                        rBg = 255; gBg = 255; bBg = 255;
                    }

                    console.log('Browser: Global Key Color: rgb(' + rBg + ',' + gBg + ',' + bBg + ')');

                    const tolerance = 50; // High tolerance for compression artifacts

                    const isClose = (r, g, b) => {
                         // Euclidean distance improved perception, but simple Manhattan is fine for this
                         return Math.abs(r - rBg) < tolerance &&
                                Math.abs(g - gBg) < tolerance &&
                                Math.abs(b - bBg) < tolerance;
                    };

                    let pixelsRemoved = 0;

                    // 2. Scan every single pixel
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        if (isClose(r, g, b)) {
                            data[i + 3] = 0; // Transparent
                            pixelsRemoved++;
                        }
                    }

                    console.log('Browser: Removed ' + pixelsRemoved + ' pixels globally');

                    ctx.putImageData(imageData, 0, 0);
                    resolve({
                        data: canvas.toDataURL('image/png'),
                        removed: pixelsRemoved,
                        bg: 'rgb(' + rBg + ',' + gBg + ',' + bBg + ')'
                    });

                } catch (err) {
                    reject(err.toString());
                }
            };
            img.onerror = (e) => reject("Image load failed");
            img.src = imgSrc;
        });
    `;

    // Create a native function from the string, bypassing tsx transpilation
    // @ts-ignore
    const evaluateFn = new Function('imgSrc', browserCode);

    const processedBase64 = await page.evaluate(evaluateFn, base64Image);

    // @ts-ignore
    if (processedBase64 && processedBase64.data) {
        // @ts-ignore
        const base64Data = processedBase64.data.replace(/^data:image\/png;base64,/, "");
        await fs.writeFile(OUTPUT_PATH, base64Data, 'base64');
        // @ts-ignore
        console.log(`✅ Success! Removed ${processedBase64.removed} pixels. BG Color: ${processedBase64.bg}`);
        console.log(`📁 Test file saved to: ${OUTPUT_PATH}`);
    } else {
        console.error("❌ Failed to process image (No data returned).");
    }

    await browser.close();
}

main().catch(console.error);
