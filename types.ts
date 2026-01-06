export enum Junction {
  STRATEGIST = 'STRATEGIST',
  ARCHITECT = 'ARCHITECT',
  FORGE = 'FORGE',
  GUARDIAN = 'GUARDIAN'
}

export interface BrandDNA {
  name: string;
  mission: string;
  colors: string[];
  typography: string[];
  voice: string;
  logoUrl?: string;
}

export interface SWOT {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  strategicGap: string;
}

export interface CampaignAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  status: 'pending' | 'completed' | 'failed';
  feedback?: string; // Guardian feedback
}

export interface ThoughtSignature {
  id: string;
  junction: Junction;
  timestamp: number;
  logic: string;
  confidence: number;
}

// Window augmentation for Veo key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}