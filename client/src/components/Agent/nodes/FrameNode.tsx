import React, { memo } from 'react';
import { NodeProps, useStore } from '@xyflow/react';
import { motion } from 'framer-motion';

export interface FrameNodeData {
    title: string;
    minWidth?: number;
    minHeight?: number;
    color?: 'default' | 'yellow' | 'blue' | 'green' | 'purple';
}

// Color themes for frames
const FRAME_COLORS = {
    default: {
        border: 'rgba(255, 255, 255, 0.15)',
        bg: 'rgba(255, 255, 255, 0.02)',
        title: '#334155', // Slate-700
    },
    yellow: {
        border: 'rgba(251, 191, 36, 0.3)',
        bg: 'rgba(251, 191, 36, 0.05)',
        title: '#fbbf24',
    },
    blue: {
        border: 'rgba(59, 130, 246, 0.3)',
        bg: 'rgba(59, 130, 246, 0.05)',
        title: '#3b82f6',
    },
    green: {
        border: 'rgba(34, 197, 94, 0.3)',
        bg: 'rgba(34, 197, 94, 0.05)',
        title: '#22c55e',
    },
    purple: {
        border: 'rgba(168, 85, 247, 0.3)',
        bg: 'rgba(168, 85, 247, 0.05)',
        title: '#a855f7',
    },
};

// Hook to calculate frame size based on children
function useFrameSize(frameId: string, minWidth: number, minHeight: number) {
    const nodes = useStore((state) => state.nodes);

    // Find all children of this frame
    const children = nodes.filter((n) => n.parentId === frameId);

    if (children.length === 0) {
        return { width: minWidth, height: minHeight };
    }

    // Calculate bounding box of all children
    let maxRight = 0;
    let maxBottom = 0;

    children.forEach((child) => {
        const childWidth = (child.measured?.width ?? child.width ?? 250) as number;
        const childHeight = (child.measured?.height ?? child.height ?? 150) as number;

        const right = child.position.x + childWidth;
        const bottom = child.position.y + childHeight;

        maxRight = Math.max(maxRight, right);
        maxBottom = Math.max(maxBottom, bottom);
    });

    // Add padding
    const PADDING = 40;
    const TITLE_HEIGHT = 50;

    return {
        width: Math.max(minWidth, maxRight + PADDING),
        height: Math.max(minHeight, maxBottom + PADDING + TITLE_HEIGHT),
    };
}

const FrameNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
    const frameData = data as unknown as FrameNodeData;
    const { title, minWidth = 300, minHeight = 200, color = 'default' } = frameData;
    const theme = FRAME_COLORS[color];

    // Dynamic sizing based on children
    const { width, height } = useFrameSize(id, minWidth, minHeight);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
                width,
                height,
                background: theme.bg,
                border: `2px dashed ${theme.border}`,
                borderRadius: 16,
                position: 'relative',
                transition: 'width 0.3s ease, height 0.3s ease',
            }}
            className={selected ? 'ring-2 ring-white/30' : ''}
        >
            {/* Frame Title */}
            <div
                style={{
                    position: 'absolute',
                    top: -12,
                    left: 20,
                    background: '#ffffff',
                    padding: '4px 16px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.title === '#ffffff' ? '#1e293b' : theme.title, // Default to dark slate if white
                    border: `1px solid ${theme.border}`,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
            >
                {title}
            </div>

            {/* Content Area - children render here via ReactFlow */}
            <div
                style={{
                    position: 'absolute',
                    top: 30,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none', // Children handle their own events
                }}
            />
        </motion.div>
    );
};

export const FrameNode = memo(FrameNodeComponent);
