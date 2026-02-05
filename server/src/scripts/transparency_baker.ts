
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../../../client/public');

async function processImage(page: any, relativePath: string, workspaceId: string): Promise<string | null> {
    const workspaceAssetsDir = path.join(PUBLIC_DIR, `workspaces/${workspaceId}/assets`);
    const outputDir = path.join(workspaceAssetsDir, 'transparent_logos');

    // Ensure output dir exists
    await fs.mkdir(outputDir, { recursive: true });

    // Clean path (remove existing query params)
    const cleanPath = relativePath.split('?')[0];
    // Source is always in workspace generated_logos
    const fullPath = path.join(PUBLIC_DIR, cleanPath);
    const filename = path.basename(cleanPath, path.extname(cleanPath));

    // Output path: workspaces/:id/assets/transparent_logos/[filename]_transparent.png
    const outputFilename = `${filename}_transparent.png`;
    const outputPath = path.join(outputDir, outputFilename);
    const outputRelativePath = `/workspaces/${workspaceId}/assets/transparent_logos/${outputFilename}`;

    try {
        await fs.access(fullPath);
    } catch {
        console.warn(`⚠️ Source file not found: ${fullPath}`);
        return null;
    }

    const fileBuffer = await fs.readFile(fullPath);
    const base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;

    console.log(`Processing: ${cleanPath} -> ${outputRelativePath}`);

    // === BROWSER LOGIC (Global Color Keying) ===
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

                    // 1. Sample Background from Corners
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
                        rBg = 255; gBg = 255; bBg = 255;
                    }

                    const tolerance = 50; 
                    const isClose = (r, g, b) => {
                         return Math.abs(r - rBg) < tolerance &&
                                Math.abs(g - gBg) < tolerance &&
                                Math.abs(b - bBg) < tolerance;
                    };

                    let pixelsRemoved = 0;

                    // 2. Global Scan & Replace
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];

                        if (isClose(r, g, b)) {
                            data[i + 3] = 0;
                            pixelsRemoved++;
                        }
                    }

                    // === 3. AUTO-CROP (Trim empty space) ===
                    // Find the bounding box of the non-transparent content
                    let minX = width, minY = height, maxX = 0, maxY = 0;
                    let hasContent = false;

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = (y * width + x) * 4;
                            if (data[idx + 3] > 0) { // If pixel is not transparent
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                                hasContent = true;
                            }
                        }
                    }

                    if (hasContent) {
                        // Add a tiny bit of padding (optional, e.g. 1px to avoid harsh cuts)
                        const padding = 1;
                        minX = Math.max(0, minX - padding);
                        minY = Math.max(0, minY - padding);
                        maxX = Math.min(width, maxX + padding);
                        maxY = Math.min(height, maxY + padding);

                        const cropWidth = maxX - minX + 1;
                        const cropHeight = maxY - minY + 1;

                        // Create a new canvas for the cropped image
                        const croppedCanvas = document.createElement('canvas');
                        croppedCanvas.width = cropWidth;
                        croppedCanvas.height = cropHeight;
                        const croppedCtx = croppedCanvas.getContext('2d');
                        
                        // Extract specific region from original data
                        // Note: putImageData uses the data array we just modified (with transparency)
                        // but we need to slice it or just draw the modified data to a temp canvas first.
                        // Easier way: Put the modified data back to the original canvas, then draw slicing.
                        
                        ctx.putImageData(imageData, 0, 0); 
                        croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                        
                        resolve({
                            data: croppedCanvas.toDataURL('image/png'),
                            removed: pixelsRemoved,
                            bg: 'rgb(' + rBg + ',' + gBg + ',' + bBg + ')',
                            cropped: true,
                            dims: { w: cropWidth, h: cropHeight }
                        });
                    } else {
                        // Image is empty? Just return original
                        ctx.putImageData(imageData, 0, 0);
                        resolve({
                            data: canvas.toDataURL('image/png'),
                            removed: pixelsRemoved,
                            bg: 'rgb(' + rBg + ',' + gBg + ',' + bBg + ')',
                            cropped: false
                        });
                    }

                } catch (err) {
                    reject(err.toString());
                }
            };
            img.onerror = (e) => reject("Image load failed");
            img.src = imgSrc;
        });
    `;

    // @ts-ignore
    const evaluateFn = new Function('imgSrc', browserCode);

    try {
        const result = await page.evaluate(evaluateFn, base64Image);

        // @ts-ignore
        if (result && result.data) {
            // @ts-ignore
            const base64Data = result.data.replace(/^data:image\/png;base64,/, "");
            await fs.writeFile(outputPath, base64Data, 'base64');
            // @ts-ignore
            console.log(`   ✅ Success. Removed ${result.removed} pixels.`);
            return outputRelativePath;
        }
    } catch (e) {
        console.error(`   ❌ Error processing ${cleanPath}:`, e);
    }

    return null;
}

export async function bakeTransparency(workspaceId: string = 'default') {
    console.log(`🧼 Starting Transparency Production Line for Workspace: ${workspaceId} (V3 - Global Key)...`);

    const kitPath = path.resolve(PUBLIC_DIR, `workspaces/${workspaceId}/assets/logo_kit_challenger.json`);
    const workspaceAssetsDir = path.join(PUBLIC_DIR, `workspaces/${workspaceId}/assets`);
    const transparentOutputDir = path.join(workspaceAssetsDir, 'transparent_logos');

    // Ensure output dir exists
    await fs.mkdir(transparentOutputDir, { recursive: true });

    let kit: any = { kit: {}, brandDNA: {} };
    try {
        const kitRaw = await fs.readFile(kitPath, 'utf-8');
        kit = JSON.parse(kitRaw);
    } catch (e) {
        console.warn(`⚠️ Logo Kit JSON not found at ${kitPath}. Regenerating from source images...`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Process logos
    const logoKeys = ['primary', 'inverted', 'icon', 'icon_inverted', 'wordmark', 'wordmark_inverted', 'social', 'social_inverted'];
    const timestamp = Date.now();

    for (const key of logoKeys) {
        // Enforce Source of Truth: Always look in generated_logos within the workspace
        const sourceRelativePath = `/workspaces/${workspaceId}/assets/generated_logos/logo_variant_${key}.png`;

        console.log(`\n🔍 Logo Key: ${key}`);
        console.log(`   Source: ${sourceRelativePath}`);

        const newPath = await processImage(page, sourceRelativePath, workspaceId);
        if (newPath) {
            kit.kit[key] = `${newPath}?v=${timestamp}`;
            console.log(`   📌 Updated kit.${key} -> ${newPath}`);
        } else {
            console.warn(`   ⚠️ Could not process source for ${key}`);
        }
    }

    await browser.close();

    // Update Brand DNA logo URL to use WORDMARK as requested
    if (kit.kit.wordmark) {
        if (!kit.brandDNA) kit.brandDNA = {};
        if (!kit.brandDNA.logoUrl) kit.brandDNA.logoUrl = {};

        console.log("👑 Setting Primary Brand Logo to Transparent Wordmark (as requested)");
        kit.brandDNA.logoUrl.value = kit.kit.wordmark;
    } else if (kit.kit.primary) {
        // Fallback
        kit.brandDNA.logoUrl.value = kit.kit.primary;
    }

    await fs.writeFile(kitPath, JSON.stringify(kit, null, 4));
    console.log(`✨ Kit updated. Transparent logos saved to ${transparentOutputDir}`);
    return kit;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    bakeTransparency().catch(console.error);
}
