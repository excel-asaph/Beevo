import React, { useState } from 'react';
import { Canvas } from './Canvas';
import { LogoStudioSidebar } from '../LogoStudio/LogoStudioSidebar';
import { ReactFlowProvider } from '@xyflow/react';

/**
 * Props for the AgentCanvas component.
 */
interface AgentCanvasProps {
    /** Callback function to handle the "Back" action (e.g., returning to the previous screen). */
    onBack?: () => void;
}

/**
 * The main container for the Agent Canvas experience.
 * 
 * This component wraps the core `Canvas` logic with the necessary providers (`ReactFlowProvider`)
 * and layout elements (full-screen container). It also manages the visibility of the `LogoStudioSidebar`.
 * 
 * @param {AgentCanvasProps} props - The component props.
 */
export const AgentCanvas: React.FC<AgentCanvasProps> = ({ onBack }) => {
    const [isLogoStudioOpen, setIsLogoStudioOpen] = useState(false);

    return (
        <div className="relative w-full h-full">
            <ReactFlowProvider>
                <Canvas onBack={onBack} />
            </ReactFlowProvider>


            <LogoStudioSidebar
                isOpen={isLogoStudioOpen}
                onClose={() => setIsLogoStudioOpen(false)}
            />
        </div>
    );
};

export default AgentCanvas;
