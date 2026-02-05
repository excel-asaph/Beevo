import React, { useState } from 'react';
import { Canvas } from './Canvas';
import { LogoStudioSidebar } from '../LogoStudio/LogoStudioSidebar';
import { Hexagon } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';

interface AgentCanvasProps {
    onBack?: () => void;
}

export const AgentCanvas: React.FC<AgentCanvasProps> = ({ onBack }) => {
    const [isLogoStudioOpen, setIsLogoStudioOpen] = useState(false);

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
