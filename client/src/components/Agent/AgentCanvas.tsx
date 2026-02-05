// Main Agent Canvas - delegates to Canvas component
import React, { useState, useEffect } from 'react';
import { Canvas } from './Canvas';
import { LogoStudioSidebar } from '../LogoStudio/LogoStudioSidebar';
import { Hexagon } from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';
import { debugResearchData } from '../../data/debug_research';
import { ReactFlowProvider } from '@xyflow/react';

interface AgentCanvasProps {
    onBack?: () => void;
}

export const AgentCanvas: React.FC<AgentCanvasProps> = ({ onBack }) => {
    const [isLogoStudioOpen, setIsLogoStudioOpen] = useState(false);

    // Store Actions for Hydration
    const updateDNA = useBrandStore(state => state.updateDNA);
    const setColorOptions = useBrandStore(state => state.setColorOptions);
    const setFontOptions = useBrandStore(state => state.setFontOptions);
    const setLogoOptions = useBrandStore(state => state.setLogoOptions);
    const setPhase = useBrandStore(state => state.setPhase);
    const phase = useBrandStore(state => state.phase);
    const researchStatus = useBrandStore(state => state.researchStatus);

    // Auto-Hydration Effect (Bypass Discovery) - STATIC DEBUG MODE
    // Directly injects data from local file to avoid server roundtrip
    useEffect(() => {
        if (phase === 'onboarding' && researchStatus.status === 'idle') {
            console.log("🔍 [DEBUG] Injecting Static Research Data...");

            const data = debugResearchData;

            // 1. Hydrate DNA
            if (data.brandDNA) updateDNA(data.brandDNA);

            // 2. Hydrate Colors
            if (data.colorPalettes?.palettes) {
                const options = data.colorPalettes.palettes.map((p: any, i: number) => ({
                    id: p.id || `palette-${i}`,
                    name: p.name || `Palette ${i + 1}`,
                    colors: p.colors,
                    reasoning: p.reasoning,
                    isSelected: p.isSelected
                }));
                setColorOptions(options);
            }

            // 3. Hydrate Fonts
            if (data.typographyPairings?.fonts) {
                const options = data.typographyPairings.fonts.map((f: any, i: number) => ({
                    id: f.id || `font-${i}`,
                    name: f.name,
                    category: f.category || 'sans-serif',
                    pairing: f.pairing,
                    reasoning: f.reasoning,
                    isSelected: f.isSelected
                }));
                setFontOptions(options);
            }

            // 4. Hydrate Logo Options
            if (data.logoStructures?.options) {
                setLogoOptions(data.logoStructures.options);
            }

            // 5. Force Phase Switch
            setPhase('canvas');
            console.log("✅ [DEBUG] Hydration Complete: Switched to Canvas Mode");
        }
    }, [phase, researchStatus.status]);

    return (
        <div className="relative w-full h-full">
            <ReactFlowProvider>
                <Canvas onBack={onBack} />
            </ReactFlowProvider>

            {/* Logo Studio Trigger - Floating Action Button */}
            {!isLogoStudioOpen && (
                <button
                    onClick={() => setIsLogoStudioOpen(true)}
                    className="absolute top-4 right-20 z-40 bg-slate-800 hover:bg-slate-700 text-orange-400 p-3 rounded-xl shadow-xl border border-slate-700 transition-all hover:scale-105 flex items-center gap-2 group"
                >
                    <Hexagon size={24} />
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap text-sm font-bold text-white">
                        Logo Studio
                    </span>
                </button>
            )}

            <LogoStudioSidebar
                isOpen={isLogoStudioOpen}
                onClose={() => setIsLogoStudioOpen(false)}
            />
        </div>
    );
};

export default AgentCanvas;
