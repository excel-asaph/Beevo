import React, { memo } from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { LogoStructureCard } from './LogoStructureCard';
import { LogoStructureOption } from '@shared/types';

interface LogoStructureNodeData extends Record<string, unknown> {
    options: LogoStructureOption[];
    onSelect?: (id: string) => void;
}

export const LogoStructureNode = memo(({ data }: NodeProps<Node<LogoStructureNodeData>>) => {
    return (
        <div className="react-flow-node-custom">
            <Handle type="target" position={Position.Top} className="handle-target" />

            <div className="w-[850px]"> {/* Match the width expected by the card layout */}
                <LogoStructureCard
                    options={data.options}
                    onSelect={data.onSelect}
                />
            </div>

            <Handle type="source" position={Position.Bottom} className="handle-source" />
        </div>
    );
});
