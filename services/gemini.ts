import { GoogleGenAI, Type, FunctionDeclaration, Schema, LiveServerMessage, Modality } from "@google/genai";
import { MODELS, SYSTEM_INSTRUCTIONS } from "../constants";

// Helper to get AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Strategist Service ---
/**
 * Executes a strategic analysis for a brand and query.
 * Conducts a SWOT analysis and identifies a strategic gap using Google GenAI.
 * 
 * @param {string} brandName - The name of the brand.
 * @param {string} query - The research query.
 * @returns {Promise<any>} The SWOT analysis results.
 */
export const runStrategyAnalysis = async (brandName: string, query: string): Promise<any> => {
  const ai = getAI();

  const swotSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
      opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
      threats: { type: Type.ARRAY, items: { type: Type.STRING } },
      strategicGap: { type: Type.STRING, description: "The unique market position identified." },
    },
    required: ["strengths", "weaknesses", "opportunities", "threats", "strategicGap"],
  };

  const response = await ai.models.generateContent({
    model: MODELS.STRATEGIST,
    contents: `Analyze the brand "${brandName}" and the query: "${query}". Conduct a SWOT analysis based on real-time web data.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: swotSchema,
      systemInstruction: SYSTEM_INSTRUCTIONS.STRATEGIST,
    },
  });

  return JSON.parse(response.text || "{}");
};

// --- Architect Service (Text Fallback / Analysis) ---
/**
 * Analyzes a transcript to extract Brand DNA fields.
 * Extracts name, mission, colors, typography, and voice using Google GenAI.
 * 
 * @param {string} transcript - The interview transcript or text.
 * @returns {Promise<any>} The extracted Brand DNA.
 */
export const analyzeBrandDNA = async (transcript: string): Promise<any> => {
  const ai = getAI();
  const dnaSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      mission: { type: Type.STRING },
      colors: { type: Type.ARRAY, items: { type: Type.STRING } },
      typography: { type: Type.ARRAY, items: { type: Type.STRING } },
      voice: { type: Type.STRING },
    },
    required: ["name", "colors", "voice"],
  };

  const response = await ai.models.generateContent({
    model: MODELS.ARCHITECT_TEXT,
    contents: `Extract the Brand DNA from this interview transcript: ${transcript}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: dnaSchema,
      systemInstruction: SYSTEM_INSTRUCTIONS.ARCHITECT,
    },
  });

  return JSON.parse(response.text || "{}");
};

// --- Forge Service ---
/**
 * Generates a campaign image based on a prompt and brand context.
 * 
 * @param {string} prompt - The campaign visual prompt.
 * @param {string} brandContext - Contextual information about the brand.
 * @returns {Promise<string | null>} The base64 encoded image or null if failed.
 */
export const generateCampaignImage = async (prompt: string, brandContext: string): Promise<string | null> => {
  const ai = getAI();
  const fullPrompt = `Create a high-quality advertising image. 
  Brand Context: ${brandContext}
  Campaign Prompt: ${prompt}
  Ensure the image has a clear central focal point and leaves margin for social media UI overlays (Safe Zones).`;

  const response = await ai.models.generateContent({
    model: MODELS.FORGE_IMAGE,
    contents: {
      parts: [{ text: fullPrompt }]
    },
    config: {
      imageConfig: { aspectRatio: "1:1" }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

/**
 * Generates a campaign video using Google GenAI (Veo model).
 * 
 * @param {string} prompt - The video generation prompt.
 * @returns {Promise<{ videoUri: string | undefined, operation: any }>} The video URI and operation details.
 */
export const generateCampaignVideo = async (prompt: string): Promise<{ videoUri: string | undefined, operation: any }> => {
  // Always create new instance for Veo to ensure fresh key if needed (though key is injected in env)
  // For Veo, we rely on the injected key after selection.
  const ai = getAI();

  let operation = await ai.models.generateVideos({
    model: MODELS.FORGE_VIDEO,
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  return { videoUri: operation.response?.generatedVideos?.[0]?.video?.uri, operation };
};

/**
 * Checks the status of a video generation operation.
 * 
 * @param {any} operation - The operation object returned by generateVideos.
 * @returns {Promise<any>} The current state of the operation.
 */
export const checkVideoStatus = async (operation: any): Promise<any> => {
  const ai = getAI();
  return await ai.operations.getVideosOperation({ operation });
};


// --- Guardian Service ---
/**
 * Audits a visual asset against the Brand DNA.
 * Checks for brand alignment and identifies issues using Google GenAI (Guardian model).
 * 
 * @param {string} assetBase64 - The base64 encoded image asset.
 * @param {string} brandContext - Contextual information about the brand.
 * @returns {Promise<any>} The audit results (pass/fail and issues).
 */
export const auditAsset = async (assetBase64: string, brandContext: string): Promise<any> => {
  const ai = getAI();

  // Clean base64 header if present
  const data = assetBase64.split(',')[1] || assetBase64;

  const response = await ai.models.generateContent({
    model: MODELS.GUARDIAN,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: data
          }
        },
        { text: `Audit this asset against Brand DNA: ${brandContext}. Return JSON with pass/fail and issues.` }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS.GUARDIAN,
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || "{}");
};
