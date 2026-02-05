import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Target, Sparkles, Palette, MessageCircle, Users, Heart, type LucideIcon } from 'lucide-react';


// Selection color (Vibrant UI Blue matching reference)
const SELECTION_COLOR = '#3b82f6';

// Icon mapping for different content types
const ICON_MAP: Record<string, LucideIcon> = {
    mission: Target,
    tagline: Sparkles,
    mood: Palette,
    voice: MessageCircle,
    audience: Users,
    values: Heart,
};

export interface InfoCardNodeData {
    title: string;
    content: string | string[];
    icon?: string; // Key from ICON_MAP or emoji
    variant?: 'default' | 'compact';
    displayMode?: 'text' | 'tags'; // 'tags' for pill/badge display
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

const InfoCardNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as InfoCardNodeData;
    const { title, content, icon = 'mission', variant = 'default', displayMode = 'text' } = nodeData;

    // Get the icon component
    const IconComponent = ICON_MAP[icon.toLowerCase()];

    // Determine if content is an array for tags display
    const isArrayContent = Array.isArray(content);
    const shouldShowTags = displayMode === 'tags' && isArrayContent;

    // Format content for text display
    const formattedContent = isArrayContent ? content.join(', ') : content;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: variant === 'compact' ? '12px 16px' : '16px 20px',
                backgroundColor: '#ffffff',
                borderRadius: 24,
                border: selected ? `2px solid ${SELECTION_COLOR}` : '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', // Clean shadow, no focus ring
                minWidth: 220,
                maxWidth: 280,
                cursor: 'default',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
        >
            {/* Icon Container */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    flexShrink: 0,
                    marginTop: 2,
                }}
            >
                {IconComponent ? (
                    <IconComponent size={16} color="#4b5563" strokeWidth={2} />
                ) : (
                    <span style={{ fontSize: 14 }}>{icon}</span>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title */}
                <div
                    style={{
                        fontSize: 13,
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
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                        }}
                    >
                        {(content as string[]).map((item, index) => (
                            <Tag key={index} label={item} />
                        ))}
                    </div>
                ) : (
                    <div
                        style={{
                            fontSize: 13,
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

            {/* Selection handles removed */}
        </motion.div>
    );
};

export const InfoCardNode = memo(InfoCardNodeComponent);
export default InfoCardNode;
