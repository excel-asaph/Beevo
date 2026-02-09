/**
 * BrandExtractor - Extracts missing brand identity fields from conversation history
 * Uses Gemini 3 Flash Preview for fast, cost-effective text analysis
 */

import { GoogleGenAI } from '@google/genai';
import { BrandDNA } from '../../../shared/types';
import { MODELS } from '../../../shared/constants';
import { ResearchLogger } from '../utils/ResearchLogger';

/**
 * Interface representing the result of a brand identity extraction.
 */
export interface ExtractionResult {
    name?: string;
    mission?: string;
    values?: string[];
    targetAudience?: string;
    voice?: string;
    tagline?: string;
    industry?: string;
}

// Required fields for a complete brand identity
const REQUIRED_FIELDS = ['name', 'mission', 'values', 'voice', 'tagline', 'targetAudience', 'industry'] as const;

/**
 * Check which required brand identity fields are missing
 */
/**
 * Identifies missing fields in the Brand DNA.
 * 
 * @param {Partial<BrandDNA>} dna - The current Brand DNA.
 * @returns {string[]} An array of missing field names.
 */
export function identifyGaps(dna: Partial<BrandDNA>): string[] {
    const gaps: string[] = [];

    if (!dna.name?.value?.trim()) gaps.push('name');
    if (!dna.mission?.value?.trim()) gaps.push('mission');
    if (!dna.values?.items || dna.values.items.length === 0) gaps.push('values');
    if (!dna.voice?.value?.trim()) gaps.push('voice');
    if (!dna.tagline?.value?.trim()) gaps.push('tagline');
    if (!dna.targetAudience?.items || dna.targetAudience.items.length === 0) gaps.push('targetAudience');
    // Industry is often inferred from context
    if (!dna.industry?.value) gaps.push('industry');

    return gaps;
}

/**
 * Extract missing brand identity fields from conversation history
 * Uses brand-focused analysis, not tone analysis
 */
/**
 * Extracts missing brand identity fields from conversation history using Google GenAI.
 * Focuses on filling identified gaps in the Brand DNA.
 * 
 * @param {string} conversationHistory - The chat history to analyze.
 * @param {Partial<BrandDNA>} currentDNA - The current state of the Brand DNA.
 * @returns {Promise<ExtractionResult>} The extracted fields.
 */
export async function extractMissingIdentity(
    conversationHistory: string,
    currentDNA: Partial<BrandDNA>
): Promise<ExtractionResult> {
    const gaps = identifyGaps(currentDNA);

    // If no gaps, nothing to extract
    if (gaps.length === 0) {
        ResearchLogger.input('BrandExtractor Gaps', []);
        return {};
    }

    ResearchLogger.toolCall('BrandExtractor.extractMissingIdentity', { gaps });

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // Build current state description
    const currentStateDesc = [
        `Name: ${currentDNA.name?.value || 'MISSING'}`,
        `Mission: ${currentDNA.mission?.value || 'MISSING'}`,
        `Values: ${currentDNA.values?.items?.join(', ') || 'MISSING'}`,
        `Voice: ${currentDNA.voice?.value || 'MISSING'}`,
        `Tagline: ${currentDNA.tagline?.value || 'MISSING'}`,
        `Target Audience: ${currentDNA.targetAudience?.items?.join(', ') || 'MISSING'}`,
        `Industry: ${currentDNA.industry?.value || 'MISSING'}`
    ].join('\n');

    // Brand-focused extraction prompt
    const prompt = `Analyze this conversation and extract the brand identity.
Focus on WHAT the user says about their business, and HOW they communicate.

CURRENT STATE (already saved):
${currentStateDesc}

EXTRACT ONLY THE MISSING FIELDS. For each missing field:
- name: The brand name. IMPORTANT: If the user says "I want to call it X" or "How about X?", extract "X". If unsure, look for the most prominent proper noun associated with the business.
- mission: What problem they solve and for whom (1-2 professional sentences)
- values: 3-5 core brand principles (e.g., "Innovation", "Trust", "Quality")
- targetAudience: Who the brand serves (be specific about demographics/needs)
- voice: How the brand should communicate (2-3 adjectives, e.g., "bold, approachable, sophisticated")
- tagline: A memorable phrase that captures the brand essence (generate if not explicitly stated)
- industry: The business category (e.g., "fashion", "technology", "finance")

Guidelines:
- If user didn't state something explicitly, infer from business context
- Make values and mission PROFESSIONAL and brand-appropriate
- Generate a professional tagline if none was provided
- For 'name': catch even tentative mentions like "maybe [Name]" or "thinking of [Name]".

CONVERSATION:
${conversationHistory}

Return ONLY a valid JSON object with the extracted fields. Example:
{"mission": "...", "values": ["...", "..."], "voice": "..."}

If you cannot extract a field with confidence, omit it from the response.`;

    try {
        ResearchLogger.aiPrompt('BrandExtractor', prompt.slice(0, 500) + '...');

        const response = await genAI.models.generateContent({
            model: MODELS.ARCHITECT_TEXT,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.3, // Lower temperature for more consistent extraction
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        ResearchLogger.aiResponse('BrandExtractor', text.substring(0, 500));

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            ResearchLogger.error('BrandExtractor', 'No JSON found in response');
            return {};
        }

        const extracted: ExtractionResult = JSON.parse(jsonMatch[0]);

        // Filter out any fields that are already present in DNA
        const filtered: ExtractionResult = {};
        if (extracted.name && !currentDNA.name?.value?.trim()) filtered.name = extracted.name;
        if (extracted.mission && !currentDNA.mission?.value?.trim()) filtered.mission = extracted.mission;
        if (extracted.values?.length && (!currentDNA.values?.items || currentDNA.values.items.length === 0)) {
            filtered.values = extracted.values;
        }
        if (extracted.voice && !currentDNA.voice?.value?.trim()) filtered.voice = extracted.voice;
        if (extracted.tagline && !currentDNA.tagline?.value?.trim()) filtered.tagline = extracted.tagline;
        if (extracted.targetAudience && (!currentDNA.targetAudience?.items || currentDNA.targetAudience.items.length === 0)) {
            filtered.targetAudience = extracted.targetAudience;
        }
        if (extracted.industry && !currentDNA.industry?.value) {
            filtered.industry = extracted.industry;
        }

        ResearchLogger.toolResult('BrandExtractor', {
            extracted: Object.keys(filtered),
            values: filtered
        });

        return filtered;

    } catch (error) {
        ResearchLogger.error('BrandExtractor', error);
        console.error('❌ BrandExtractor error:', error);
        return {};
    }
}

