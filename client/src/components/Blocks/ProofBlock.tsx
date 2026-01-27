import React, { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { ProofBlockConfig } from '../../../../shared/types';

interface ProofBlockProps {
    config: ProofBlockConfig;
}

export const ProofBlock: React.FC<ProofBlockProps> = ({ config }) => {
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
                        if (dwellTime > 500) { // Only track meaningful "stops" (>0.5s)
                            track('proof_dwell_summary', { dwell_ms: dwellTime });
                        }
                        dwellStartTime.current = null;
                        setIsVisible(false);
                    }
                }
            },
            { threshold: 0.1 } // Lower threshold for more reliable activation
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [config.id, track]);

    // === Render Logic ===
    const dataPoint = config.content.data_points[0];

    return (
        <div
            ref={containerRef}
            data-component="proof-block"
            className="w-full py-24 px-8 flex flex-col items-center justify-center transition-all duration-700"
            style={{
                backgroundColor: config.styles.backgroundColor,
                color: config.styles.color,
                fontFamily: config.styles.fontFamily,
            }}
        >
            <div className="max-w-4xl w-full text-center">
                <h2 className="text-5xl font-bold mb-6" style={{ letterSpacing: '-0.02em' }}>
                    {config.content.headline}
                </h2>
                <p className="text-xl opacity-80 mb-12 max-w-2xl mx-auto leading-relaxed">
                    {config.content.subhead}
                </p>

                {/* --- Nano Banana Visualization Area --- */}
                <div className="relative py-12 px-6 rounded-2xl bg-white bg-opacity-5 backdrop-blur-md border border-white border-opacity-10 shadow-2xl">

                    {/* Progress Bar (Example Visualization) */}
                    {config.graphic_config.type === 'progress' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm uppercase tracking-widest font-semibold opacity-60">
                                    {dataPoint.label}
                                </span>
                                <span className="text-4xl font-black" style={{ color: config.graphic_config.primary_color }}>
                                    {dataPoint.value}{dataPoint.unit}
                                </span>
                            </div>
                            <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-1000"
                                    style={{
                                        width: isVisible ? `${dataPoint.value}%` : '0%',
                                        backgroundColor: config.graphic_config.primary_color,
                                        boxShadow: `0 0 20px ${config.graphic_config.primary_color}44`,
                                        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Stat Variant */}
                    {config.graphic_config.type === 'stat' && (
                        <div className="py-8">
                            <div className="text-8xl font-black mb-2" style={{ color: config.graphic_config.primary_color }}>
                                {dataPoint.value}{dataPoint.unit}
                            </div>
                            <div className="text-lg opacity-60 font-medium">
                                {dataPoint.label}
                            </div>
                        </div>
                    )}

                    {/* Trend Variant (Multi-Point) */}
                    {config.graphic_config.type === 'trend' && (
                        <div className="flex items-end justify-between gap-4 h-48 mt-4 px-4 overflow-hidden">
                            {config.content.data_points.map((pt, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center group">
                                    <div className="relative w-full flex flex-col items-center h-40">
                                        {/* Value Label */}
                                        <div
                                            className="mb-2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ color: config.graphic_config.primary_color }}
                                        >
                                            {pt.value}{pt.unit}
                                        </div>
                                        {/* Bar */}
                                        <div
                                            className="w-full rounded-t-lg transition-all duration-1000"
                                            style={{
                                                height: isVisible ? `${pt.value}%` : '0%',
                                                backgroundColor: config.graphic_config.primary_color,
                                                opacity: 0.3 + (i / config.content.data_points.length) * 0.7,
                                                boxShadow: `0 0 15px ${config.graphic_config.primary_color}33`,
                                                transitionDelay: `${i * 100}ms`,
                                                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                                            }}
                                        />
                                    </div>
                                    <div className="mt-4 text-[10px] uppercase tracking-tighter font-black opacity-40 whitespace-nowrap">
                                        {pt.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-white border-opacity-5 italic opacity-50 text-sm">
                        "{config.content.graphic_caption}"
                    </div>
                </div>
            </div>
        </div>
    );
};
