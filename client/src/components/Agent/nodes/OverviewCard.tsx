import React from 'react';
import { motion } from 'framer-motion';
import { Target, MessageSquareQuote } from 'lucide-react';
import { useBrandStore } from '../../../stores/useBrandStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * OverviewCard - Displays Mission and Tagline in the Overview frame
 * Reads directly from the Zustand store
 */
export const OverviewCard: React.FC = () => {
    const { mission, tagline } = useBrandStore(
        useShallow((state) => ({
            mission: state.dna.mission,
            tagline: state.dna.tagline,
        }))
    );

    const hasContent = mission || tagline;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="overview-card"
        >
            {/* Mission Section */}
            <div className="overview-section">
                <div className="section-header">
                    <Target size={16} className="section-icon" />
                    <span className="section-title">Mission</span>
                </div>
                <p className="section-content">
                    {mission?.value || 'Your mission will appear here once extracted...'}
                </p>
            </div>

            {/* Tagline Section */}
            <div className="overview-section">
                <div className="section-header">
                    <MessageSquareQuote size={16} className="section-icon" />
                    <span className="section-title">Tagline</span>
                </div>
                <p className="section-content tagline">
                    {tagline?.value ? `"${tagline.value}"` : 'Your tagline will appear here...'}
                </p>
            </div>

            <style>{`
                .overview-card {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 20px;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    min-width: 280px;
                    max-width: 320px;
                }

                .overview-section {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .section-icon {
                    color: #6366f1;
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
                    line-height: 1.5;
                    color: #1e293b;
                    margin: 0;
                }

                .section-content.tagline {
                    font-style: italic;
                    color: #6366f1;
                    font-weight: 500;
                }
            `}</style>
        </motion.div>
    );
};

export default OverviewCard;
