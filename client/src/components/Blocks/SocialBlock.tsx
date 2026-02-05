import React, { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { SocialBlockConfig } from '../../../../shared/types';
import { useWorkspace } from '../../context/WorkspaceContext';

interface SocialBlockProps {
    config: SocialBlockConfig;
}

export const SocialBlock: React.FC<SocialBlockProps> = ({ config }) => {
    const { track } = useTracking(config.id);
    const { resolveAssetUrl } = useWorkspace();
    const containerRef = useRef<HTMLDivElement>(null);
    const dwellStartTime = useRef<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const hasViewedRef = useRef(false);

    // === Trust Signal Tracking (Dwell + Velocity + Milestone) ===
    useEffect(() => {
        let milestoneTimer: NodeJS.Timeout;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    console.log(`👁️ Social Section observed: Starting Dwell Timer...`);

                    if (!hasViewedRef.current) {
                        track('view_component'); // Unique View
                        hasViewedRef.current = true;
                    }

                    dwellStartTime.current = Date.now();
                    setIsVisible(true);

                    // 3s Retention Milestone
                    milestoneTimer = setTimeout(() => {
                        console.log(`💎 Social Milestone Reached: 3s Retention`);
                        track('view_3s'); // Standardized retention event
                    }, 3000);

                } else {
                    if (milestoneTimer) clearTimeout(milestoneTimer);

                    if (dwellStartTime.current) {
                        const dwellTime = Date.now() - dwellStartTime.current;
                        const sectionHeight = containerRef.current?.offsetHeight || 1;
                        const velocity = (sectionHeight / dwellTime) * 1000; // pixels per second

                        if (dwellTime > 500) {
                            console.log(`⏱️ Social Metrics: Dwell=${dwellTime}ms | Velocity=${velocity.toFixed(0)}px/s`);
                            track('social_dwell_summary', { dwell_ms: dwellTime });
                            track('social_scroll_velocity', { velocity: velocity });
                        }
                        dwellStartTime.current = null;
                        setIsVisible(false);
                    }
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => {
            observer.disconnect();
            if (milestoneTimer) clearTimeout(milestoneTimer);
        };
    }, [config.id, track]);

    return (
        <div
            ref={containerRef}
            data-component="social-block"
            className="w-full py-24 px-6 lg:px-8 min-h-[70vh] flex flex-col items-center justify-center transition-all duration-700 overflow-hidden"
            style={{
                backgroundColor: config.styles.backgroundColor,
                color: config.styles.color,
                fontFamily: config.styles.fontFamily,
            }}
        >
            <div
                className={`w-full max-w-7xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            >
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter uppercase italic">
                        {config.content.headline}
                    </h2>
                    <p className="text-xl lg:text-2xl opacity-80 max-w-3xl mx-auto">
                        {config.content.subhead}
                    </p>
                </div>

                <div
                    className="w-full"
                    dangerouslySetInnerHTML={{
                        __html: (() => {
                            let html = config.graphic_config.visual_code || '';
                            // Hydrate images
                            if (config.content.testimonials) {
                                config.content.testimonials.forEach(t => {
                                    // Replace placeholders 'image_url_ID' with actual URL
                                    // The generator seems to output 'image_url_t1' etc.
                                    const resolvedUrl = resolveAssetUrl(t.image_url);
                                    html = html.replace(`image_url_${t.id}`, resolvedUrl);
                                    // Also try replacing just the ID if the generator format varies, purely defensive
                                    html = html.replace(`'${t.id}'`, `'${resolvedUrl}'`);
                                    html = html.replace(`"${t.id}"`, `"${resolvedUrl}"`);
                                });
                            }
                            return html;
                        })()
                    }}
                />
            </div>
        </div>
    );
};
