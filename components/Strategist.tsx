import React, { useState } from 'react';
import { useBrand } from '../context/BrandContext';
import { runStrategyAnalysis } from '../services/gemini';
import { Button } from './ui/Button';
import { Junction, SWOT } from '../types';
import { Search, TrendingUp, AlertTriangle, Shield, Target } from 'lucide-react';

export const Strategist: React.FC = () => {
  const { addThought, setDna, dna } = useBrand();
  const [brandName, setBrandName] = useState(dna?.name || '');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [swot, setSwot] = useState<SWOT | null>(null);

  const handleResearch = async () => {
    if (!brandName || !query) return;
    setIsLoading(true);
    addThought(`Initiating Antigravity sweep for ${brandName} context: ${query}`, Junction.STRATEGIST);
    
    try {
      const result = await runStrategyAnalysis(brandName, query);
      setSwot(result);
      if (!dna) {
        setDna({ 
          name: brandName, 
          mission: result.strategicGap, // Temporary inference
          colors: [], 
          typography: [], 
          voice: 'Professional' 
        });
      }
      addThought(`SWOT Analysis Complete. Identified Strategic Gap: ${result.strategicGap}`, Junction.STRATEGIST);
    } catch (error) {
      console.error(error);
      addThought("Strategic scan failed due to signal interruption.", Junction.STRATEGIST);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-400">
          <Search className="mr-2" /> The Strategist
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input 
            type="text" 
            placeholder="Brand Name (e.g. Acme Corp)"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input 
            type="text" 
            placeholder="Focus Area (e.g. Q4 Black Friday Trends)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <Button onClick={handleResearch} isLoading={isLoading} className="w-full md:w-auto">
          Deploy Antigravity Agents
        </Button>
      </div>

      {swot && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-emerald-900/20 p-5 rounded-xl border border-emerald-800/50">
            <h3 className="text-emerald-400 font-bold flex items-center mb-3"><Shield className="w-5 h-5 mr-2"/> Strengths</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              {swot.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          
          <div className="bg-amber-900/20 p-5 rounded-xl border border-amber-800/50">
            <h3 className="text-amber-400 font-bold flex items-center mb-3"><AlertTriangle className="w-5 h-5 mr-2"/> Weaknesses</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              {swot.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="bg-blue-900/20 p-5 rounded-xl border border-blue-800/50">
            <h3 className="text-blue-400 font-bold flex items-center mb-3"><TrendingUp className="w-5 h-5 mr-2"/> Opportunities</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              {swot.opportunities.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="bg-rose-900/20 p-5 rounded-xl border border-rose-800/50">
            <h3 className="text-rose-400 font-bold flex items-center mb-3"><Target className="w-5 h-5 mr-2"/> Threats</h3>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              {swot.threats.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-violet-900/50 to-purple-900/50 p-6 rounded-xl border border-violet-700/50">
            <h3 className="text-violet-300 text-lg font-bold mb-2">Strategic Gap Identified</h3>
            <p className="text-white text-xl font-light leading-relaxed">"{swot.strategicGap}"</p>
          </div>
        </div>
      )}
    </div>
  );
};