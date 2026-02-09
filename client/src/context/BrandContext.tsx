import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BrandDNA, CampaignAsset, Junction, ThoughtSignature } from '@shared/types';


/**
 * The shape of the Brand Context state.
 */
interface BrandContextType {
  /** The current Brand DNA (mission, values, visuals). */
  dna: BrandDNA | null;
  /** Setter for Brand DNA. */
  setDna: React.Dispatch<React.SetStateAction<BrandDNA | null>>;
  /** The current active module/junction (e.g., Strategist, Architect). */
  currentJunction: Junction;
  /** Setter for the active junction. */
  setJunction: (j: Junction) => void;
  /** A stream of AI "thoughts" or logs. */
  thoughtStream: ThoughtSignature[];
  /** Adds a new thought to the stream. */
  addThought: (logic: string, junction: Junction) => void;
  /** Collection of generated assets (images, videos). */
  assets: CampaignAsset[];
  /** Adds a new asset to the collection. */
  addAsset: (asset: CampaignAsset) => void;
  /** Updates the status of an existing asset (e.g., 'approved', 'rejected'). */
  updateAssetStatus: (id: string, status: CampaignAsset['status'], feedback?: string) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

/**
 * specialized context provider for managing Brand State.
 * 
 * Features:
 * - Centralized storage for Brand DNA.
 * - Tracks the user's journey through different "Junctions".
 * - Maintains a log of AI thoughts/decisions.
 * - Manages the lifecycle of generated assets.
 */
export const BrandProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dna, setDna] = useState<BrandDNA | null>(null);
  const [currentJunction, setJunction] = useState<Junction>(Junction.STRATEGIST);
  const [thoughtStream, setThoughtStream] = useState<ThoughtSignature[]>([]);
  const [assets, setAssets] = useState<CampaignAsset[]>([]);

  const addThought = (logic: string, junction: Junction) => {
    setThoughtStream(prev => [{
      id: Date.now().toString(),
      junction,
      timestamp: Date.now(),
      logic,
      confidence: 0.9
    }, ...prev]);
  };

  const addAsset = (asset: CampaignAsset) => {
    setAssets(prev => [asset, ...prev]);
  };

  const updateAssetStatus = (id: string, status: CampaignAsset['status'], feedback?: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, status, feedback } : a));
  };


  return (
    <BrandContext.Provider value={{
      dna, setDna,
      currentJunction, setJunction,
      thoughtStream, addThought,
      assets, addAsset, updateAssetStatus
    }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) throw new Error("useBrand must be used within BrandProvider");
  return context;
};