import React, { useRef } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { HeroBlockConfig } from '../../../../shared/types';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Props for the HeroBlock component.
 */
interface HeroBlockProps {
    /** Configuration data for the Hero section. */
    config: HeroBlockConfig;
}

/**
 * Renders the Hero section of the generated landing page.
 * 
 * Features:
 * - Video background support.
 * - Intersection Observer for view tracking.
 * - Retention tracking (3s dwell).
 * - CTA click tracking and form triggering.
 * 
 * @param {HeroBlockProps} props - The component props.
 */
export const HeroBlock: React.FC<HeroBlockProps> = ({ config }) => {
    const { track, isReady } = useTracking(config.id);
    const { resolveAssetUrl } = useWorkspace();
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasTrackedRetention = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasTrackedView = useRef(false);

    // === Impression Tracking (Intersection Observer) ===
    React.useEffect(() => {
        if (!isReady || hasTrackedView.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasTrackedView.current) {
                    console.log("👁️ Hero Section Visible: Tracking View...");
                    track('view_component');
                    hasTrackedView.current = true;
                    observer.disconnect(); // One-shot trigger
                }
            },
            { threshold: 0.1 } // Fire when 10% visible
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [track, isReady]);

    // === Retention Tracking ===
    const handleTimeUpdate = () => {
        if (videoRef.current && !hasTrackedRetention.current) {
            if (videoRef.current.currentTime > 3) {
                console.log("💎 Milestone Reached: 3s Retention (Hero)");
                track('view_3s');
                hasTrackedRetention.current = true;
            }
        }
    };

    // === CTA Click Tracking & Form Trigger ===
    const handleCtaClick = () => {
        const action = config.overlay_content.cta.action_id;
        track('cta_click', { action });

        if (action === 'open_intent_form') {
            window.dispatchEvent(new CustomEvent('open-form', {
                detail: { type: 'INTENT', context: { form: config.forms?.intent } }
            }));
        }
    };

    // Construct Video URL (assuming convention or using the uploaded file directly for cold start)
    // Logic: For Cold Start, we know it's "veo_video_hero_challenger.mp4"
    // Future: config.visual_asset.source_id -> mapped to URL
    const videoSrc = resolveAssetUrl(config.visual_asset?.source_url || '/assets/veo_video_hero_challenger.mp4');

    return (
        <div
            ref={containerRef}
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
            <div
                className="relative z-20 w-full h-full px-6 lg:px-8 flex flex-col items-center justify-center"
                style={config.layout_config.container_styles}
            >
                {/* Logo removed to prevent duplication with NavigationBar */}

                <div className="max-w-7xl w-full mx-auto flex flex-col items-center text-center">
                    <div className="max-w-4xl flex flex-col items-center">
                        <h1
                            className="leading-tight"
                            style={{
                                ...config.overlay_content.headline.styles,
                                textAlign: 'center'
                            }}
                        >
                            {config.overlay_content.headline.text}
                        </h1>

                        <p
                            className="mt-6 leading-relaxed opacity-90"
                            style={{
                                ...config.overlay_content.subhead.styles,
                                textAlign: 'center',
                                marginTop: '1.5rem' // Ensure consistent spacing
                            }}
                        >
                            {config.overlay_content.subhead.text}
                        </p>

                        <button
                            className="transition-transform hover:scale-105 active:scale-95"
                            style={{
                                ...config.overlay_content.cta.styles,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={handleCtaClick}
                        >
                            {config.overlay_content.cta.text}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
