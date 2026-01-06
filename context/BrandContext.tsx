import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BrandDNA, CampaignAsset, Junction, ThoughtSignature } from '../types';

interface BrandContextType {
  dna: BrandDNA | null;
  setDna: React.Dispatch<React.SetStateAction<BrandDNA | null>>;
  currentJunction: Junction;
  setJunction: (j: Junction) => void;
  thoughtStream: ThoughtSignature[];
  addThought: (logic: string, junction: Junction) => void;
  assets: CampaignAsset[];
  addAsset: (asset: CampaignAsset) => void;
  updateAssetStatus: (id: string, status: CampaignAsset['status'], feedback?: string) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

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