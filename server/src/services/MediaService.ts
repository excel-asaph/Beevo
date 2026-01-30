import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HISTORY_DIR = path.resolve(__dirname, '../../../client/public/assets/history/');

export class MediaService {
    private static instance: MediaService;

    private constructor() { }

    public static getInstance(): MediaService {
        if (!MediaService.instance) {
            MediaService.instance = new MediaService();
        }
        return MediaService.instance;
    }

    private async ensureDir() {
        await fs.mkdir(HISTORY_DIR, { recursive: true });
    }

    /**
     * Saves a buffer or file to the history directory with a timestamp, organized by variantId.
     * @returns The public URL path for the saved asset.
     */
    public async archiveAsset(filenamePrefix: string, extension: string, data: Buffer, variantId?: string): Promise<string> {
        // If variantId is provided, nest inside history/variantId/
        // Otherwise keep in root history/
        const targetDir = variantId ? path.join(HISTORY_DIR, variantId) : HISTORY_DIR;
        await fs.mkdir(targetDir, { recursive: true });

        const timestamp = Date.now();
        const filename = `${filenamePrefix}_${timestamp}.${extension}`;
        const filePath = path.join(targetDir, filename);

        await fs.writeFile(filePath, data);

        const relativePath = variantId
            ? `/assets/history/${variantId}/${filename}`
            : `/assets/history/${filename}`;

        console.log(`💾 Asset archived: ${relativePath}`);
        return relativePath;
    }

    /**
     * Specialized helper for Gemini file downloads.
     */
    public async archiveGeminiFile(client: any, fileUri: string, filenamePrefix: string, extension: string, variantId?: string): Promise<string> {
        const targetDir = variantId ? path.join(HISTORY_DIR, variantId) : HISTORY_DIR;
        await fs.mkdir(targetDir, { recursive: true });

        const timestamp = Date.now();
        const filename = `${filenamePrefix}_${timestamp}.${extension}`;
        const filePath = path.join(targetDir, filename);

        // @ts-ignore
        await client.files.download({
            file: fileUri,
            downloadPath: filePath,
        });

        const relativePath = variantId
            ? `/assets/history/${variantId}/${filename}`
            : `/assets/history/${filename}`;

        console.log(`💾 Video archived from Gemini: ${relativePath}`);
        return relativePath;
    }
}
