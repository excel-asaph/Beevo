import React, { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { SocialBlockConfig } from '../../../../shared/types';

interface SocialBlockProps {
    config: SocialBlockConfig;
}

export const SocialBlock: React.FC<SocialBlockProps> = ({ config }) => {
    const { track } = useTracking(config.id);
    const containerRef = useRef<HTMLDivElement>(null);
    const dwellStartTime = useRef<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // === Global Utilities for Injected HTML ===
    useEffect(() => {
        // Define 'highlight' in the window scope for AI-generated hover effects
        (window as any).highlight = (el: HTMLElement) => {
            if (!el) return;
            el.style.transition = 'all 0.3s ease';
            el.style.transform = 'translateY(-4px)';
            el.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
            el.onmouseleave = () => {
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
            };
        };

        return () => {
            delete (window as any).highlight;
        };
    }, []);

    // === Trust Signal Tracking (Dwell + Velocity + Milestone) ===
    useEffect(() => {
        let milestoneTimer: NodeJS.Timeout;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    console.log(`👁️ Social Section observed: Starting Dwell Timer...`);
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
            className="w-full relative py-24 px-6 lg:px-8 min-h-[70vh] flex flex-col items-center justify-center transition-all duration-700 overflow-hidden"
            style={{
                backgroundColor: config.styles.backgroundColor,
                color: config.styles.color,
                fontFamily: config.styles.fontFamily,
            }}
        >
            <div
                className={`w-full max-w-7xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
            >
                {/* 
                   AI-GENERATED HTML INJECTION
                   In Social block, the AI generates the entire structure (background, containers, cards)
                   into visual_code once it has the finalized image_urls.
                */}
                {config.graphic_config.visual_code && (
                    <div
                        className="w-full"
                        dangerouslySetInnerHTML={{ __html: config.graphic_config.visual_code }}
                    />
                )}
            </div>
        </div>
    );
};
