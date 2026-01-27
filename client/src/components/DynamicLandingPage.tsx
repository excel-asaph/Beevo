import React, { useEffect, useState } from 'react';
import { HeroBlock } from './Blocks/HeroBlock';
import { ProofBlock } from './Blocks/ProofBlock';

export const DynamicLandingPage: React.FC = () => {
    const [configs, setConfigs] = useState<{ hero: any, proof: any }>({ hero: null, proof: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const [heroRes, proofRes] = await Promise.all([
                    fetch('/assets/hero_block_challenger.json'),
                    fetch('/assets/proof_block_challenger.json')
                ]);

                const [heroData, proofData] = await Promise.all([
                    heroRes.ok ? heroRes.json() : null,
                    proofRes.ok ? proofRes.json() : null
                ]);

                setConfigs({ hero: heroData, proof: proofData });
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
        </div>
    );
};
