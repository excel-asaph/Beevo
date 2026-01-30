import React, { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { OfferBlockConfig } from '../../../../shared/types';

interface OfferBlockProps {
    config: OfferBlockConfig;
}

declare global {
    interface Window {
        track: (eventName: any, payload?: any) => void;
    }
}

export const OfferBlock: React.FC<OfferBlockProps> = ({ config }) => {
    const { track } = useTracking(config.id);
    const containerRef = useRef<HTMLDivElement>(null);
    const dwellStartTime = useRef<number | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // === Exposure & Dwell Tracking ===
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    console.log(`👁️ Offer Section observed: Starting Dwell Timer...`);
                    dwellStartTime.current = Date.now();
                    setIsVisible(true);
                    track('view_component');
                } else {
                    if (dwellStartTime.current) {
                        const dwellTime = Date.now() - dwellStartTime.current;
                        if (dwellTime > 500) {
                            console.log(`⏱️ Offer Metrics: Dwell=${dwellTime}ms`);
                            track('offer_dwell_summary', { dwell_ms: dwellTime });
                        }
                        dwellStartTime.current = null;
                        setIsVisible(false);
                    }
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [config.id, track]);

    // === Robust Event Delegation ===
    // This captures ANY click on an element with a tracking attribute,
    // making it resilient even if the AI forgets the 'onclick' handler.
    useEffect(() => {
        if (!containerRef.current) return;

        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const ctaElement = target.closest('[data-cta-id]') || target.closest('button');

            if (ctaElement) {
                const ctaId = ctaElement.getAttribute('data-cta-id') || ctaElement.textContent || 'unknown-btn';
                const tierId = ctaElement.getAttribute('data-tier-id') || ctaElement.closest('[data-tier-id]')?.getAttribute('data-tier-id');

                track('offer_cta_click', {
                    ctaId: ctaId.trim(),
                    tierId: tierId || 'unknown-tier',
                    text: ctaElement.textContent?.trim()
                });
                console.log(`🎯 Global Offer Tracker: Captured ${ctaId} in tier ${tierId}`);

                // Dispatch Global Form Event
                window.dispatchEvent(new CustomEvent('open-form', {
                    detail: { type: 'OFFER', context: { tierId, tierName: ctaElement.getAttribute('data-tier-name') } }
                }));
            }
        };

        const container = containerRef.current;
        container.addEventListener('click', handleGlobalClick);
        return () => container.removeEventListener('click', handleGlobalClick);
    }, [track]);

    // === Global Tracking Bridge (Legacy/Injected) ===
    useEffect(() => {
        window.track = (eventName: any, payload?: any) => {
            console.log(`🎯 Offer Injected Event: ${eventName}`, payload);
            track(eventName as any, payload);
        };
        return () => {
            // @ts-ignore
            delete window.track;
        };
    }, [track]);

    return (
        <div
            ref={containerRef}
            data-component="offer-block"
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
                    <h2 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none">
                        {config.content.headline}
                    </h2>
                    <p className="text-xl lg:text-2xl opacity-80 max-w-3xl mx-auto">
                        {config.content.subhead}
                    </p>
                </div>

                <div
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: config.graphic_config.visual_code || '' }}
                />

                {config.content.guarantee_text && (
                    <div className="mt-16 text-center opacity-50 text-sm uppercase tracking-widest font-bold">
                        {config.content.guarantee_text}
                    </div>
                )}
            </div>
        </div>
    );
};
