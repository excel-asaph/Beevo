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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const [heroRes, proofRes, pasRes, specRes, socialRes, offerRes] = await Promise.all([
                    fetch('/assets/hero_block_challenger.json'),
                    fetch('/assets/proof_block_challenger.json'),
                    fetch('/assets/pas_block_challenger.json'),
                    fetch('/assets/spec_block_challenger.json'),
                    fetch('/assets/social_block_challenger.json'),
                    fetch('/assets/offer_block_challenger.json')
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
        <div className="min-h-screen bg-black text-white">
            {/* Block 1: The Hook (Hero) */}
            {configs.hero && <HeroBlock config={configs.hero} />}

            {/* Block 2: The Proof (DataGraphic) */}
            {configs.proof && <ProofBlock config={configs.proof} />}

            {/* Block 3: The Story (PAS) */}
            {configs.pas && <PASBlock config={configs.pas} />}

            {/* Block 4: The Tech (Spec) */}
            {configs.spec && <SpecBlock config={configs.spec} />}

            {/* Block 5: The Truth (Social) */}
            {configs.social && <SocialBlock config={configs.social} />}

            {/* Block 6: The Closer (Offer) */}
            {configs.offer && <OfferBlock config={configs.offer} />}
        </div>
    );
};
