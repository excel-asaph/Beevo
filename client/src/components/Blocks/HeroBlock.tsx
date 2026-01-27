import React, { useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';

// Types matching our Schema
interface HeroSchema {
    id: string;
    visual_asset: {
        source_id: string;
        // ... we might use the attributes for debugging, but the source_id maps to the file
    };
    overlay_content: {
        headline: {
            text: string;
            styles: React.CSSProperties;
        };
        subhead: {
            text: string;
            styles: React.CSSProperties;
        };
        cta: {
            text: string;
            action_id: string;
            styles: React.CSSProperties;
        };
    };
    layout_config: {
        container_styles: React.CSSProperties;
        overlay_gradient: string;
    };
}

interface HeroBlockProps {
    config: HeroSchema;
}

export const HeroBlock: React.FC<HeroBlockProps> = ({ config }) => {
    const { track } = useTracking(config.id);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasTrackedRetention, setHasTrackedRetention] = useState(false);

    // === Retention Tracking ===
    const handleTimeUpdate = () => {
        if (videoRef.current && !hasTrackedRetention) {
            if (videoRef.current.currentTime > 3) {
                track('view_3s');
                setHasTrackedRetention(true);
            }
        }
    };

    // === CTA Click Tracking ===
    const handleCtaClick = () => {
        track('cta_click', { action: config.overlay_content.cta.action_id });
        // In a real app, handle the scroll/navigation here
        console.log('Navigating to:', config.overlay_content.cta.action_id);
    };

    // Construct Video URL (assuming convention or using the uploaded file directly for cold start)
    // Logic: For Cold Start, we know it's "veo_video_hero_challenger.mp4"
    // Future: config.visual_asset.source_id -> mapped to URL
    const videoSrc = '/assets/veo_video_hero_challenger.mp4';

    return (
        <div
            data-component="hero-block"
            className="relative w-full h-screen overflow-hidden"
            style={config.layout_config.container_styles} // Flexbox alignment from Schema
        >
            {/* Layer 1: Video Background */}
            <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full object-cover z-0"
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onTimeUpdate={handleTimeUpdate}
            />

            {/* Layer 1.5: Gradient Overlay (for readability) */}
            <div
                className="absolute top-0 left-0 w-full h-full z-10"
                style={{ background: config.layout_config.overlay_gradient }}
            />

            {/* Layer 2: Content Overlay */}
            <div className="relative z-20 max-w-4xl p-8">
                <h1 style={config.overlay_content.headline.styles}>
                    {config.overlay_content.headline.text}
                </h1>

                <h2 style={config.overlay_content.subhead.styles}>
                    {config.overlay_content.subhead.text}
                </h2>

                <button
                    style={{
                        ...config.overlay_content.cta.styles,
                        cursor: 'pointer',
                        marginTop: '2rem' // Ensure some spacing
                    }}
                    onClick={handleCtaClick}
                >
                    {config.overlay_content.cta.text}
                </button>
            </div>
        </div>
    );
};
