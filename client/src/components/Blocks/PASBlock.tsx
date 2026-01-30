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
            <div
                className={`w-full max-w-7xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                dangerouslySetInnerHTML={{ __html: config.graphic_config.visual_code || '' }}
            />
        </div>
    );
};
