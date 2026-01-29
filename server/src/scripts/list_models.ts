import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.list();
    const models = (response as any).models || response;

    console.log("All Available Models:");
    if (models && typeof models[Symbol.iterator] === 'function') {
        for (const m of models) {
            console.log(`- ${m.name} [${m.supportedMethods.join(', ')}]`);
        }
    } else {
        console.log("Could not iterate models. Raw response:", JSON.stringify(response));
    }
}

listModels().catch(console.error);
