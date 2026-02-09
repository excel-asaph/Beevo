import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Heart, Mic2 } from 'lucide-react';

/**
 * Props for the StrategyCard component.
 */
interface StrategyCardProps {
    /** The brand's mission statement. */
    mission?: string;
    /** List of core brand value keywords. */
    values?: string[];
    /** Description of the brand's voice/tone. */
    voice?: string;
}

/**
 * StrategyCard - Displays Mission, Brand Values, and Voice in the Brand Strategy frame
 */
export const StrategyCard: React.FC<StrategyCardProps> = ({ mission, values, voice }) => {
    const hasContent = mission || (values && values.length > 0) || voice;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="strategy-card"
        >
            {/* Mission Section */}
            <div className="strategy-section">
                <div className="section-header">
                    <Rocket size={16} className="section-icon mission" />
                    <span className="section-title">Mission</span>
                </div>
                <p className="section-content">
                    {mission || 'Define your brand\'s purpose and direction...'}
                </p>
            </div>

            {/* Brand Values Section */}
            <div className="strategy-section">
                <div className="section-header">
                    <Heart size={16} className="section-icon values" />
                    <span className="section-title">Brand Values</span>
                </div>
                <div className="values-container">
                    {values && values.length > 0 ? (
                        values.map((value, index) => (
                            <motion.span
                                key={index}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.1 * index }}
                                className="value-tag"
                            >
                                {value}
                            </motion.span>
                        ))
                    ) : (
                        <span className="placeholder-text">Core values will appear here...</span>
                    )}
                </div>
            </div>

            {/* Brand Voice Section */}
            <div className="strategy-section">
                <div className="section-header">
                    <Mic2 size={16} className="section-icon voice" />
                    <span className="section-title">Brand Voice</span>
                </div>
                <p className="section-content voice-content">
                    {voice || 'Your brand\'s tone and personality...'}
                </p>
            </div>

            <style>{`
                .strategy-card {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding: 24px;
                    background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
                    border-radius: 12px;
                    border: 1px solid #e9d5ff;
                    width: 100%;
                    max-width: 650px;
                }

                .strategy-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .section-icon {
                    width: 16px;
                    height: 16px;
                }

                .section-icon.mission {
                    color: #8b5cf6;
                }

                .section-icon.values {
                    color: #ec4899;
                }

                .section-icon.voice {
                    color: #06b6d4;
                }

                .section-title {
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #64748b;
                }

                .section-content {
                    font-size: 14px;
                    line-height: 1.6;
                    color: #1e293b;
                    margin: 0;
                }

                .voice-content {
                    font-style: italic;
                    color: #475569;
                }

                .values-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .value-tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    background: linear-gradient(135deg, #c084fc 0%, #a855f7 100%);
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                    border-radius: 20px;
                    box-shadow: 0 2px 4px rgba(168, 85, 247, 0.2);
                }

                .placeholder-text {
                    font-size: 13px;
                    color: #94a3b8;
                    font-style: italic;
                }
            `}</style>
        </motion.div>
    );
};

export default StrategyCard;
