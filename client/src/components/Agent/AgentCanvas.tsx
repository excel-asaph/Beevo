// Main Agent Canvas - delegates to Canvas component
import React from 'react';
import { Canvas } from './Canvas';

interface AgentCanvasProps {
    onBack?: () => void;
}

export const AgentCanvas: React.FC<AgentCanvasProps> = ({ onBack }) => {
    return <Canvas onBack={onBack} />;
};

export default AgentCanvas;
