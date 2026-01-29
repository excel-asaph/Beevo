import React, { useState, useEffect } from 'react';
import { Junction } from '@shared/types';
import { useBrand } from '../../context/BrandContext';
import { generateLogoKit } from '../../services/gemini';
import { Button } from '../ui/Button';
import { Download, Hexagon, Layers, Palette, Image as ImageIcon } from 'lucide-react';

export const LogoStudioSidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { dna, setDna, addAsset, addThought } = useBrand();
    const [isGenerating, setIsGenerating] = useState(false);
    const [refinementPrompt, setRefinementPrompt] = useState('Modern, Minimalist, Tech-Forward');
    const [logoKit, setLogoKit] = useState<null | {
        primary: string;
        inverted: string;
        icon: string;
        wordmark: string;
        social: string;
    }>(null);
    const [palette, setPalette] = useState<{ colors: string[]; name: string } | null>(null);

    // Auto-fetch baked logo kit on mount
    useEffect(() => {
        const fetchBakedKit = async () => {
            try {
                const response = await fetch('/assets/logo_kit_challenger.json');
                if (response.ok) {
                    const data = await response.json();
                    console.log("🚀 Baked Logo Kit Found:", data);
                    setLogoKit(data.kit);
                    if (data.palette) setPalette(data.palette);
                    if (data.brandDNA && !dna) {
                        setDna(data.brandDNA);
                        addThought("Logo Studio: Hydrated Brand Context from baked asset.", Junction.LOGO_STUDIO);
                    }
                }
            } catch (error) {
                console.warn("Logo Kit not baked yet. Waiting for generation.");
            }
        };

        fetchBakedKit();
    }, [dna, setDna, addThought]);

    if (!isOpen) return null;

    const handleGenerateKit = async () => {
        // Placeholder implementation for manual generation if needed later
        // Currently relying on baked assets
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
                {/* Brand Context */}
                <div className="space-y-4">
                    <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center">
                        <Layers className="mr-1 w-3 h-3" /> Brand Context
                    </h3>
                    {dna ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800 p-2 rounded">
                                <span className="text-slate-400 block mb-1">Name</span>
                                <span className="text-white font-medium truncate">{dna.name.value}</span>
                            </div>
                            <div className="bg-slate-800 p-2 rounded">
                                <span className="text-slate-400 block mb-1">Voice</span>
                                <span className="text-white font-medium truncate">{dna.voice.value}</span>
                            </div>
                            <div className="bg-slate-800 p-2 rounded col-span-2">
                                <span className="text-slate-400 block mb-1 flex items-center"><Palette className="w-3 h-3 mr-1" /> Palette</span>
                                <div className="flex space-x-1">
                                    {palette?.colors.map(c => (
                                        <div key={c} className="w-4 h-4 rounded-full border border-white/20" style={{ background: c }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-red-400 text-sm">Brand DNA not found. Run Architect first.</div>
                    )}
                </div>

                {/* Results Grid */}
                {logoKit && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xs uppercase tracking-wider text-green-400 font-semibold flex items-center">
                            <ImageIcon className="mr-1 w-3 h-3" /> Generated Assets
                        </h3>

                        {/* Primary & Inverted */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Primary Marks</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="Primary" url={logoKit.primary} dark={false} />
                                <AssetCard title="Inverted" url={logoKit.inverted} dark={true} />
                            </div>
                        </div>

                        {/* Icon & Social */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Digital Assets</span>
                            <div className="grid grid-cols-2 gap-2">
                                <AssetCard title="App Icon" url={logoKit.icon} dark={false} />
                                <AssetCard title="Social Profile" url={logoKit.social} dark={false} />
                            </div>
                        </div>

                        {/* Wordmark */}
                        <div className="space-y-2">
                            <span className="text-xs text-slate-400">Typography</span>
                            <div className="w-full">
                                <div className={`relative group rounded-lg overflow-hidden border bg-white border-slate-200 aspect-video flex items-center justify-center p-4`}>
                                    <img src={logoKit.wordmark} alt="Wordmark" className="max-w-full max-h-full object-contain" />
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1 text-center translate-y-full group-hover:translate-y-0 transition-transform">
                                        <span className="text-[10px] text-white font-medium block truncate">Wordmark</span>
                                    </div>
                                    <a href={logoKit.wordmark} download className="absolute top-1 right-1 bg-black/50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-orange-500">
                                        <Download size={10} />
                                    </a>
                                </div>
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
