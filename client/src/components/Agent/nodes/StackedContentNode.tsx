import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Target, Sparkles, Palette, MessageCircle, Users, Heart, type LucideIcon } from 'lucide-react';

// Selection color (Figma-style blue)
const SELECTION_COLOR = '#0d99ff';

// Icon mapping for different content types
const ICON_MAP: Record<string, LucideIcon> = {
    mission: Target,
    tagline: Sparkles,
    mood: Palette,
    voice: MessageCircle,
    audience: Users,
    values: Heart,
};

export interface ContentItem {
    id: string;
    title: string;
    content: string | string[];
    icon?: string;
    displayMode?: 'text' | 'tags';
}

export interface StackedContentNodeData {
    items: ContentItem[];
    gap?: number; // Gap between items in px
}

// Tag/Pill component for array items
const Tag = ({ label }: { label: string }) => (
    <span
        style={{
            display: 'inline-block',
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: '#374151',
            backgroundColor: '#f3f4f6',
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            whiteSpace: 'nowrap',
        }}
    >
        {label}
    </span>
);

// Single content card (internal component)
const ContentCard = ({ item }: { item: ContentItem }) => {
    const { title, content, icon = 'mission', displayMode = 'text' } = item;
    const IconComponent = ICON_MAP[icon.toLowerCase()];

    const isArrayContent = Array.isArray(content);
    const shouldShowTags = displayMode === 'tags' && isArrayContent;
    const formattedContent = isArrayContent ? content.join(', ') : content;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                backgroundColor: '#ffffff',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
        >
            {/* Icon Container */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    flexShrink: 0,
                    marginTop: 2,
                }}
            >
                {IconComponent ? (
                    <IconComponent size={14} color="#4b5563" strokeWidth={2} />
                ) : (
                    <span style={{ fontSize: 12 }}>{icon}</span>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: shouldShowTags ? 8 : 4,
                        letterSpacing: '0.01em',
                    }}
                >
                    {title}
                </div>

                {/* Body - Text or Tags */}
                {shouldShowTags ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(content as string[]).map((tag, index) => (
                            <Tag key={index} label={tag} />
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: '#6b7280',
                            lineHeight: 1.5,
                            wordWrap: 'break-word',
                        }}
                    >
                        {formattedContent}
                    </div>
                )}
            </div>
        </div>
    );
};

const StackedContentNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as StackedContentNodeData;
    const { items = [], gap = 12 } = nodeData;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: gap,
                minWidth: 240,
                maxWidth: 280,
                cursor: 'default',
                // Selection styling on container
                outline: selected ? `2px solid ${SELECTION_COLOR}` : 'none',
                outlineOffset: 8,
                borderRadius: 12,
            }}
        >
            {items.map((item) => (
                <ContentCard key={item.id} item={item} />
            ))}

            {/* Selection handles */}
            {selected && (
                <>
                    <div style={{ ...handleStyle, top: -4, left: -4 }} />
                    <div style={{ ...handleStyle, top: -4, right: -4 }} />
                    <div style={{ ...handleStyle, bottom: -4, left: -4 }} />
                    <div style={{ ...handleStyle, bottom: -4, right: -4 }} />
                </>
            )}
        </motion.div>
    );
};

// Selection handle style
const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#ffffff',
    border: `2px solid ${SELECTION_COLOR}`,
    borderRadius: '50%',
};

export const StackedContentNode = memo(StackedContentNodeComponent);
export default StackedContentNode;
