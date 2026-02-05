import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';


// Selection color (Vibrant UI Blue matching reference)
const SELECTION_COLOR = '#3b82f6';

export type TextNodeVariant = 'headline' | 'title' | 'body' | 'caption';

export interface TextNodeData {
    text: string;
    subtitle?: string;
    variant?: TextNodeVariant;
    align?: 'left' | 'center' | 'right';
}

// Typography styles matching industry standards (Figma, Miro, Lovart)
const variantStyles: Record<TextNodeVariant, { fontSize: number; fontWeight: number; lineHeight: number }> = {
    headline: {
        fontSize: 48,
        fontWeight: 700,
        lineHeight: 1.1,
    },
    title: {
        fontSize: 32,
        fontWeight: 600,
        lineHeight: 1.2,
    },
    body: {
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
    },
    caption: {
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.4,
    },
};

const TextNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
    const nodeData = data as unknown as TextNodeData;
    const { text, subtitle, variant = 'headline', align = 'left' } = nodeData;
    const styles = variantStyles[variant];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                position: 'relative',
                padding: '16px 20px',
                borderRadius: 24,
                cursor: 'default',
                // Selection styling
                outline: selected ? `2px solid ${SELECTION_COLOR}` : 'none',
                outlineOffset: 4,
                backgroundColor: selected ? 'rgba(59, 130, 246, 0.04)' : 'transparent', // #3b82f6 with opacity
                transition: 'background-color 0.15s ease, outline 0.15s ease',
            }}
        >
            {/* Main Text (Headline/Title) */}
            <div
                style={{
                    fontSize: styles.fontSize,
                    fontWeight: styles.fontWeight,
                    lineHeight: styles.lineHeight,
                    color: '#1a1a1a',
                    textAlign: align,
                    letterSpacing: variant === 'headline' ? '-0.02em' : '0',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
            >
                {text}
            </div>

            {/* Subtitle (optional) */}
            {subtitle && (
                <div
                    style={{
                        marginTop: variant === 'headline' ? 12 : 8,
                        fontSize: 14,
                        fontWeight: 400,
                        lineHeight: 1.5,
                        color: '#666666',
                        textAlign: align,
                        maxWidth: 400,
                    }}
                >
                    {subtitle}
                </div>
            )}

            {/* Selection handles removed */}
        </motion.div>
    );
};

export const TextNode = memo(TextNodeComponent);
export default TextNode;
