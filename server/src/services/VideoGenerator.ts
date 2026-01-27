
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

export interface VideoAttributes {
    prompt_signature: string;
    lighting: string;
    camera_movement: string;
    subject_focus: string;
    color_grade: string;
}

export class VideoGenerator {
    private client: GoogleGenAI;
    private modelName = 'veo-3.1-generate-preview';

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async generateVideo(attributes: VideoAttributes, outputPath: string): Promise<string> {
        console.log(`🎥 Starting Veo Generation: ${outputPath}`);

        const veoPrompt = `
        Cinematic 4K video.
        Description: ${attributes.prompt_signature}
        Lighting: ${attributes.lighting}.
        Movement: ${attributes.camera_movement}.
        Focus: ${attributes.subject_focus}.
        Color: ${attributes.color_grade}.
        `;

        try {
            console.log("...Submitting Operation to Veo");
            // @ts-ignore
            let operation = await this.client.models.generateVideos({
                model: this.modelName,
                prompt: veoPrompt,
                config: {
                    aspectRatio: '16:9',
                }
            });

            console.log(`...Operation Started: ${operation.name || 'Unknown ID'}`);

            // Poll for Completion
            while (!operation.done) {
                console.log("...Generating (Waiting 5s)...")
                await new Promise((resolve) => setTimeout(resolve, 5000));

                // @ts-ignore
                operation = await this.client.operations.getVideosOperation({
                    operation: operation,
                });
            }

            console.log("...Generation Complete. Downloading...");

            const videos = operation.response?.generatedVideos;
            if (!videos || !videos.length) {
                throw new Error("No videos returned in operation response.");
            }

            // Ensure directory exists
            await fs.mkdir(path.dirname(outputPath), { recursive: true });

            // @ts-ignore
            await this.client.files.download({
                file: videos[0].video!,
                downloadPath: outputPath,
            });

            console.log(`✅ Video Saved to: ${outputPath}`);
            return path.basename(outputPath);

        } catch (error) {
            console.error("❌ Veo Generation Failed:", error);
            throw error;
        }
    }
}
