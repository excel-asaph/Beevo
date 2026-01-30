import React, { useState, useEffect, useRef } from 'react';
import { useTracking } from '../../hooks/useTracking';

interface SpecNode {
    id: string;
    label: string;
    description: string;
    icon: string;
}

interface SpecBlockConfig {
    id: string;
    meta: {
        strategy: string;
        tone: string;
        active_variant: string;
        layout_strategy: string;
    };
    content: {
        headline: string;
        subhead: string;
        nodes: SpecNode[];
    };
    graphic_config: {
        type: string;
        visual_code: string;
    };
    styles: {
        backgroundColor: string;
        color: string;
        fontFamily: string;
    };
}

export const SpecBlock: React.FC<{ config: SpecBlockConfig }> = ({ config }) => {
    const { track } = useTracking(config.id);
    const sectionRef = useRef<HTMLElement>(null);
    const startTimeRef = useRef<number>(Date.now());
    const [hasLogged, setHasLogged] = useState(false);

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

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasLogged) {
                    console.log("👁️ Spec Section observed");
                    setHasLogged(true);
                }

                if (!entry.isIntersecting && hasLogged) {
                    const dwellTime = Date.now() - startTimeRef.current;
                    if (dwellTime > 1000) {
                        track('spec_dwell_summary', {
                            variantId: config.id || 'spec_section_v1',
                            dwellMs: dwellTime
                        });
                    }
                }
            },
            { threshold: 0.5 }
        );

        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [hasLogged, config.id, track]);

    // Handle Internal JS interactions from visual_code
    useEffect(() => {
        if (!sectionRef.current) return;

        const handleInteraction = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('.node') || target.closest('.node-btn')) {
                const nodeId = target.closest('[data-target]')?.getAttribute('data-target');
                track('spec_interaction', {
                    variantId: config.id || 'spec_section_v1',
                    nodeId,
                    action: e.type
                });
            }
        };

        const container = sectionRef.current.querySelector('#blueprint-container');
        if (container) {
            container.addEventListener('click', handleInteraction);
            container.addEventListener('mouseenter', handleInteraction, true);
        }

        return () => {
            if (container) {
                container.removeEventListener('click', handleInteraction);
                container.removeEventListener('mouseenter', handleInteraction, true);
            }
        };
    }, [config.id, track]);

    return (
        <section
            ref={sectionRef}
            data-component="spec-block"
            className="w-full relative py-20 px-4"
            style={{
                backgroundColor: config.styles.backgroundColor,
                color: config.styles.color,
                fontFamily: config.styles.fontFamily
            }}
        >
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="text-center max-w-3xl mx-auto space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">
                        {config.content.headline}
                    </h2>
                    <p className="text-lg opacity-70">
                        {config.content.subhead}
                    </p>
                </div>

                {/* Generative AI Code Injection */}
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
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
        </section>
    );
};


