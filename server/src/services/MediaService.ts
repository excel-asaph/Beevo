import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MediaService {
    private static instances: Map<string, MediaService> = new Map();
    private workspaceId: string;
    private historyDir: string;
    private publicPathPrefix: string;

    private constructor(workspaceId: string) {
        this.workspaceId = workspaceId;
        // Physical path: client/public/workspaces/${workspaceId}/assets/history
        this.historyDir = path.resolve(__dirname, `../../../client/public/workspaces/${workspaceId}/assets/history`);
        // URL path: /workspaces/${workspaceId}/assets/history
        this.publicPathPrefix = `/workspaces/${workspaceId}/assets/history`;
    }

    public static getInstance(workspaceId: string = 'default'): MediaService {
        if (!MediaService.instances.has(workspaceId)) {
            MediaService.instances.set(workspaceId, new MediaService(workspaceId));
        }
        return MediaService.instances.get(workspaceId)!;
    }

    private async ensureDir(targetDir: string) {
        await fs.mkdir(targetDir, { recursive: true });
    }

    /**
     * Saves a buffer or file to the history directory with a timestamp, organized by variantId.
     * @returns The public URL path for the saved asset.
     */
    public async archiveAsset(filenamePrefix: string, extension: string, data: Buffer, variantId?: string): Promise<string> {
        // If variantId is provided, nest inside history/variantId/
        // Otherwise keep in root history/
        const targetDir = variantId ? path.join(this.historyDir, variantId) : this.historyDir;
        await this.ensureDir(targetDir);

        const timestamp = Date.now();
        const filename = `${filenamePrefix}_${timestamp}.${extension}`;
        const filePath = path.join(targetDir, filename);

        await fs.writeFile(filePath, data);

        const relativePath = variantId
            ? `${this.publicPathPrefix}/${variantId}/${filename}`
            : `${this.publicPathPrefix}/${filename}`;

        console.log(`💾 [${this.workspaceId}] Asset archived: ${relativePath}`);
        return relativePath;
    }

    /**
     * Specialized helper for Gemini file downloads.
     */
    public async archiveGeminiFile(client: any, fileUri: string, filenamePrefix: string, extension: string, variantId?: string): Promise<string> {
        const targetDir = variantId ? path.join(this.historyDir, variantId) : this.historyDir;
        await this.ensureDir(targetDir);

        const timestamp = Date.now();
        const filename = `${filenamePrefix}_${timestamp}.${extension}`;
        const filePath = path.join(targetDir, filename);

        // @ts-ignore
        await client.files.download({
            file: fileUri,
            downloadPath: filePath,
        });

        const relativePath = variantId
            ? `${this.publicPathPrefix}/${variantId}/${filename}`
            : `${this.publicPathPrefix}/${filename}`;

        console.log(`💾 [${this.workspaceId}] Video archived from Gemini: ${relativePath}`);
        return relativePath;
    }
}

