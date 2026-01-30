import React, { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { PASBlockConfig } from '../../../../shared/types';

interface PASBlockProps {
    config: PASBlockConfig;
}

export const PASBlock: React.FC<PASBlockProps> = ({ config }) => {
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

    // === Dwell Time Tracking ===
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    dwellStartTime.current = Date.now();
                    setIsVisible(true);
                } else {
                    if (dwellStartTime.current) {
                        const dwellTime = Date.now() - dwellStartTime.current;
                        if (dwellTime > 500) {
                            track('pas_dwell_summary', { dwell_ms: dwellTime });
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

    return (
        <div
            ref={containerRef}
            data-component="pas-block"
            className="w-full py-24 px-6 lg:px-8 min-h-[60vh] flex flex-col items-center justify-center transition-all duration-700 overflow-hidden"
            style={{
                backgroundColor: config.styles.backgroundColor,
                color: config.styles.color,
                fontFamily: config.styles.fontFamily,
            }}
        >
            <div className={`w-full max-w-7xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
                {config.graphic_config.visual_code && (
                    <>
                        {/* If it looks like raw CSS (contains braces and no tags), wrap it in <style> */}
                        {config.graphic_config.visual_code.includes('{') && !config.graphic_config.visual_code.includes('<') ? (
                            <style dangerouslySetInnerHTML={{ __html: config.graphic_config.visual_code }} />
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: config.graphic_config.visual_code }} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
