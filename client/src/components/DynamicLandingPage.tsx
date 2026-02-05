import React, { useEffect, useState } from 'react';
import { useBrand } from '../context/BrandContext';
import { HeroBlock } from './Blocks/HeroBlock';
import { ProofBlock } from './Blocks/ProofBlock';
import { PASBlock } from './Blocks/PASBlock';
import { SpecBlock } from './Blocks/SpecBlock';
import { SocialBlock } from './Blocks/SocialBlock';
import { OfferBlock } from './Blocks/OfferBlock';
import { NavigationBar } from './Navigation/NavigationBar';
import { FormOrchestrator } from './Forms/FormOrchestrator';

import { useConfig } from '../hooks/useConfig';

import { useWorkspace } from '../context/WorkspaceContext';

export const DynamicLandingPage: React.FC = () => {
    const { setDna } = useBrand();
    const { config } = useConfig();
    const { workspaceId } = useWorkspace();
    const [configs, setConfigs] = useState<{ hero: any, proof: any, pas: any, spec: any, social: any, offer: any }>({
        hero: null, proof: null, pas: null, spec: null, social: null, offer: null
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeForm, setActiveForm] = useState<{ type: 'CONTACT' | 'INTENT' | 'OFFER', context?: any } | null>(null);

    // Global listener for dynamic form triggers
    useEffect(() => {
        const handleOpenForm = (e: any) => {
            if (e.detail) {
                const detail = { ...e.detail };
                const type = detail.type;
                let formConfig = null;

                if (type === 'CONTACT') {
                    formConfig = configs.hero?.forms?.contact;
                } else {
                    formConfig = configs.hero?.forms?.intent;
                }

                const isOffer = type === 'OFFER';
                detail.context = {
                    ...detail.context,
                    form: {
                        ...(detail.context?.form || formConfig),
                        ...(isOffer ? {
                            title: "Select Access Plan",
                            subtitle: configs.offer?.content?.guarantee_text || "Secure your position in the pilot.",
                            submit_text: "Get a Quote",
                            fields: [
                                { id: "offer_name", label: "Full Name", type: "text", required: true },
                                { id: "offer_email", label: "Email Address", type: "email", required: true }
                            ]
                        } : {}),
                        tiers: (isOffer && configs.offer?.content?.tiers) ? configs.offer.content.tiers : undefined
                    }
                };
                setActiveForm(detail);
            }
        };
        window.addEventListener('open-form', handleOpenForm);
        return () => window.removeEventListener('open-form', handleOpenForm);
    }, [configs]);

    useEffect(() => {
        // Wait for System Config to know WHERE to fetch assets from
        if (!config) return;

        const fetchConfigs = async () => {
            try {
                // Determine base path (e.g., "states/v_123456" or default to root if missing)
                const basePath = config.active_assets_path ? `/${config.active_assets_path}` : '';

                // Workspace Isolation: If workspaceId is present, try to fetch from workspace folder.
                // However, Vite serving logic for 'public' is straightforward.
                // If the backend generated paths relative to 'workspaces/{id}/assets', we need to match that.
                // The 'getLiveState' script suggests files are in 'client/public/workspaces/{id}/assets/{subpath}'.
                // So the URL should be `/workspaces/${workspaceId}/assets${basePath}`.

                let assetRoot = `/assets${basePath}`;
                if (workspaceId && workspaceId !== 'default') {
                    assetRoot = `/workspaces/${workspaceId}/assets${basePath}`;
                }

                console.log(`[Loader] Fetching page assets from: ${assetRoot}`);

                const fetchJson = async (url: string, label: string) => {
                    const res = await fetch(url);
                    const type = res.headers.get('content-type');
                    if (!res.ok || (type && type.includes('text/html'))) {
                        console.error(`❌ [${label}] Failed: ${url}`, { status: res.status, type });
                        throw new Error(`Invalid JSON response for ${label}`);
                    }
                    console.log(`✅ [${label}] Loaded: ${url}`);
                    return res.json();
                };

                const logoPath = workspaceId && workspaceId !== 'default'
                    ? `/workspaces/${workspaceId}/assets/logo_kit_challenger.json`
                    : `/assets/logo_kit_challenger.json`;

                const [heroData, proofData, pasData, specData, socialData, offerData, logoData] = await Promise.all([
                    fetchJson(`${assetRoot}/hero_block.json`, 'Hero'),
                    fetchJson(`${assetRoot}/proof_block.json`, 'Proof'),
                    fetchJson(`${assetRoot}/pas_block.json`, 'PAS'),
                    fetchJson(`${assetRoot}/spec_block.json`, 'Spec'),
                    fetchJson(`${assetRoot}/social_block.json`, 'Social'),
                    fetchJson(`${assetRoot}/offer_block.json`, 'Offer'),
                    fetchJson(logoPath, 'Logo')
                ]);

                setConfigs({ hero: heroData, proof: proofData, pas: pasData, spec: specData, social: socialData, offer: offerData });

                // Hydrate Brand Context with Logo
                if (logoData && logoData.brandDNA) {
                    setDna({
                        ...logoData.brandDNA,
                        logoUrl: { value: logoData.kit.primary, isSelected: true },
                        logoInvertedUrl: {
                            value: logoData.kit.wordmark_inverted || logoData.kit.inverted,
                            isSelected: true
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to load Landing Page Configs:", err);
                setError("Failed to load page content.");
            } finally {
                setLoading(false);
            }
        };

        fetchConfigs();
    }, [config, setDna, workspaceId]); // Re-run when config or workspace changes

    const hasTrackedPage = useState(false); // Using state ref pattern or just ref to guard

    useEffect(() => {
        // Guard: Only track if we have a config, a hash, and haven't tracked yet
        if (!loading && configs.hero && config?.current_state_hash && !hasTrackedPage[0]) {
            setTimeout(() => {
                const stateHash = config.current_state_hash || 'unknown';
                fetch('http://localhost:3001/api/tracking/event', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-workspace-id': workspaceId
                    },
                    body: JSON.stringify({
                        sessionId: 'manual_session',
                        componentId: 'page_root',
                        eventType: 'view_page',
                        timestamp: Date.now(),
                        stateHash
                    })
                }).then(() => {
                    console.log(`%c 🎯 PAGE VIEW TRACKED [${stateHash}]`, 'color: cyan');
                    hasTrackedPage[1](true); // Mark as tracked
                }).catch(console.error);
            }, 500);
        }
    }, [loading, configs, config, hasTrackedPage, workspaceId]);

    if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading Optimization Engine...</div>;
    if (error) return <div className="h-screen flex items-center justify-center bg-red-900 text-white">{error}</div>;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white">
            {configs.hero && <NavigationBar config={configs.hero.navigation} brandId={configs.hero.id} />}

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

            {/* Modal Layer */}
            {activeForm && (
                <FormOrchestrator
                    type={activeForm.type}
                    context={activeForm.context}
                    onClose={() => setActiveForm(null)}
                />
            )}
        </div>
    );
};
