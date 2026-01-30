import React, { useEffect, useState } from 'react';
import { HeroBlock } from './Blocks/HeroBlock';
import { ProofBlock } from './Blocks/ProofBlock';
import { PASBlock } from './Blocks/PASBlock';
import { SpecBlock } from './Blocks/SpecBlock';
import { SocialBlock } from './Blocks/SocialBlock';
import { OfferBlock } from './Blocks/OfferBlock';

export const DynamicLandingPage: React.FC = () => {
    const [configs, setConfigs] = useState<{ hero: any, proof: any, pas: any, spec: any, social: any, offer: any }>({
        hero: null, proof: null, pas: null, spec: null, social: null, offer: null
    });
    const [loading, setLoading] = useState(true);

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
    const [error, setError] = useState<string | null>(null);
    // const [activeForm, setActiveForm] = useState<{ type: 'CONTACT' | 'INTENT' | 'OFFER', context?: any } | null>(null);

    useEffect(() => {
        // Global listener for dynamic form triggers from "visual_code" or CTAs
        /*
        const handleOpenForm = (e: any) => {
            if (e.detail) setActiveForm(e.detail);
        };
        window.addEventListener('open-form', handleOpenForm);
        return () => window.removeEventListener('open-form', handleOpenForm);
        */
    }, []);

    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const [heroRes, proofRes, pasRes, specRes, socialRes, offerRes] = await Promise.all([
                    fetch('/assets/hero_block.json'),
                    fetch('/assets/proof_block.json'),
                    fetch('/assets/pas_block.json'),
                    fetch('/assets/spec_block.json'),
                    fetch('/assets/social_block.json'),
                    fetch('/assets/offer_block.json')
                ]);

                const [heroData, proofData, pasData, specData, socialData, offerData] = await Promise.all([
                    heroRes.ok ? heroRes.json() : null,
                    proofRes.ok ? proofRes.json() : null,
                    pasRes.ok ? pasRes.json() : null,
                    specRes.ok ? specRes.json() : null,
                    socialRes.ok ? socialRes.json() : null,
                    offerRes.ok ? offerRes.json() : null
                ]);

                setConfigs({ hero: heroData, proof: proofData, pas: pasData, spec: specData, social: socialData, offer: offerData });
            } catch (err) {
                console.error("Failed to load Landing Page Configs:", err);
                setError("Failed to load page content.");
            } finally {
                setLoading(false);
            }
        };

        fetchConfigs();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading Optimization Engine...</div>;
    if (error) return <div className="h-screen flex items-center justify-center bg-red-900 text-white">{error}</div>;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white">

            {/* Block 1: The Hook (Hero) */}
            <div id="hero-block">
                {configs.hero && <HeroBlock config={configs.hero} />}
            </div>

            {/* Block 2: The Proof (DataGraphic) */}
            <div id="proof-block">
                {configs.proof && <ProofBlock config={configs.proof} />}
            </div>

            {/* Block 3: The Story (PAS) */}
            <div id="pas-block">
                {configs.pas && <PASBlock config={configs.pas} />}
            </div>

            {/* Block 4: The Tech (Spec) */}
            <div id="spec-block">
                {configs.spec && <SpecBlock config={configs.spec} />}
            </div>

            {/* Block 5: The Truth (Social) */}
            <div id="social-block">
                {configs.social && <SocialBlock config={configs.social} />}
            </div>

            {/* Block 6: The Closer (Offer) */}
            <div id="offer-block">
                {configs.offer && <OfferBlock config={configs.offer} />}
            </div>
        </div>
    );
};
