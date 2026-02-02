import React, { useState, useEffect } from 'react';
import { Junction } from '@shared/types';
import { useBrand } from '../../context/BrandContext';
import { Download, Hexagon } from 'lucide-react';
import { PipelineControl } from './PipelineControl';

export const LogoStudioSidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { dna, setDna, addThought } = useBrand();
    const [logoKit, setLogoKit] = useState<null | {
        primary: string;
        inverted: string;
        icon: string;
        icon_inverted: string;
        wordmark: string;
        wordmark_inverted: string;
        social: string;
        social_inverted: string;
    }>(null);

    const fetchBakedKit = async () => {
        try {
            const response = await fetch('/assets/logo_kit_challenger.json?t=' + Date.now()); // bust cache
            if (response.ok) {
                const data = await response.json();
                console.log("🚀 Baked Logo Kit Found:", data);
                if (data.kit) setLogoKit(data.kit); // Ensure kit exists
                if (data.brandDNA && !dna) {
                    setDna(data.brandDNA);
                    addThought("Logo Studio: Hydrated Brand Context from baked asset.", Junction.LOGO_STUDIO);
                }
            }
        } catch (error) {
            console.warn("Logo Kit not baked yet. Waiting for generation.");
        }
    };

    // Auto-fetch baked logo kit on mount
    useEffect(() => {
        fetchBakedKit();
    }, [dna, setDna, addThought]);

    if (!isOpen) return null;

    const handleGenerate = async (context: string) => {
        try {
            console.log("Generatng with context:", context);
            const res = await fetch('http://localhost:3000/api/logos/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context })
            });
            if (!res.ok) throw new Error('Generation failed');

            // Re-fetch to see non-transparent results (we might want to change this flow to read generated_logos dir directly, 
            // but for now relying on baking being the "view" step or just waiting for finalize)
            // Actually, generateLogoKit usually updates logo_kit_challenger.json at the end, so we can re-fetch.
            await fetchBakedKit();
        } catch (e) {
            console.error("Generation Error:", e);
        }
    };

    const handleFinalize = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/logos/finalize', { method: 'POST' });
            if (!res.ok) throw new Error('Finalization failed');
            const data = await res.json();
            console.log("Finalized Kit:", data);

            // Force refresh to see transparent logos
            await fetchBakedKit();
        } catch (e) {
            console.error("Finalization Error:", e);
        }
    };

    return (
        <div className="fixed right-0 top-0 h-full w-[400px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950">
                <h2 className="text-xl font-bold flex items-center text-orange-400">
                    <Hexagon className="mr-2" size={20} /> Logo Studio
                </h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-8 flex-1">
                <PipelineControl onGenerate={handleGenerate} onFinalize={handleFinalize} />


                {/* Results Grid */}
                {logoKit && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Primary & Inverted */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Primary Marks</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="Primary" url={logoKit.primary} dark={false} />
                                <AssetCard title="Inverted" url={logoKit.inverted} dark={true} />
                            </div>
                        </div>

                        {/* Icon & Icon Inverted */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Icon / Symbol</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="Icon" url={logoKit.icon} dark={false} />
                                <AssetCard title="Icon (Dark)" url={logoKit.icon_inverted} dark={true} />
                            </div>
                        </div>

                        {/* Wordmark & Wordmark Inverted */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Wordmark</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="Wordmark" url={logoKit.wordmark} dark={false} />
                                <AssetCard title="Wordmark (Dark)" url={logoKit.wordmark_inverted} dark={true} />
                            </div>
                        </div>

                        {/* Social & Social Inverted */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Digital / Social</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="Social" url={logoKit.social} dark={false} />
                                <AssetCard title="Social (Dark)" url={logoKit.social_inverted} dark={true} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AssetCard: React.FC<{ title: string; url: string; dark: boolean }> = ({ title, url, dark }) => (
    <div className={`relative group rounded-lg overflow-hidden border ${dark ? 'bg-black border-slate-800' : 'bg-white border-slate-200'} aspect-square flex items-center justify-center p-2`}>
        <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
        <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1 text-center translate-y-full group-hover:translate-y-0 transition-transform">
            <span className="text-[10px] text-white font-medium block truncate">{title}</span>
        </div>
        <a href={url} download className="absolute top-1 right-1 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-orange-500">
            <Download size={10} />
        </a>
    </div>
);
