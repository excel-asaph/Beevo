import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { LogoStructureCard } from './LogoStructureCard';
import { LogoStructureOption } from '@shared/types';

/**
 * Data structure for the LogoStructureNode.
 */
interface LogoStructureNodeData extends Record<string, unknown> {
    /** List of logo structure options to display. */
    options: LogoStructureOption[];
    /** Callback triggered when an option is selected. */
    onSelect?: (id: string) => void;
}

/**
 * A custom Node component for ReactFlow that wraps the LogoStructureCard.
 * 
 * Acts as a container adapter to render the card within the ReactFlow canvas.
 * 
 * @param {NodeProps} props - The node props provided by ReactFlow.
 */
export const LogoStructureNode = memo(({ data }: NodeProps<Node<LogoStructureNodeData>>) => {
    return (
        <div className="react-flow-node-custom">
            <div className="w-[850px]"> {/* Match the width expected by the card layout */}
                <LogoStructureCard
                    options={data.options}
                    onSelect={data.onSelect}
                />
            </div>
        </div>
    );
});
