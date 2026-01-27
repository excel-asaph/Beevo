import { InitialHeroGenerator } from '../agents/InitialHeroGenerator';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const rootDir = process.cwd();
const possiblePaths = [
    path.join(rootDir, 'server/.env'),
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local')
];

let loaded = false;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        console.log(`Loading env from: ${p}`);
        dotenv.config({ path: p });
        loaded = true;
        break;
    }
}

if (!loaded) console.warn("WARNING: No .env file found!");

async function main() {
    console.log("🚀 Starting LIVE Initial Phase Generation...");
    console.log("🤖 Model: Gemini 3 Flash Preview");

    try {
        const generator = new InitialHeroGenerator();
        await generator.generate();
        console.log("✅ SUCCESS: hero_block_challenger.json has been generated.");
    } catch (error) {
        console.error("❌ ERROR:", error);
    }
}

main();
