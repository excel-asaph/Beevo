import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Props for the DynamicLandingPage component.
 */
export interface DynamicLandingPageProps {
    /** Whether the page is being viewed in preview mode (e.g., inside an iframe). */
    isPreview?: boolean;
}

const SkeletonBlock = ({ height = "400px", className = "" }) => (
    <div className={`w-full ${className} relative overflow-hidden bg-white/40 backdrop-blur-md border border-white/60 shadow-sm`} style={{ height }}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col gap-6">
            <div className="h-12 w-2/3 bg-white/50 rounded-lg border border-white/30" />
            <div className="h-6 w-1/2 bg-white/50 rounded-lg border border-white/30" />
            <div className="h-40 w-full bg-white/30 rounded-xl mt-8 border border-white/40" />
        </div>
    </div>
);

const SkeletonLoader = () => (
    <div className="min-h-screen bg-gray-50/50">
        <div className="h-16 w-full border-b border-white/40 flex items-center px-6 gap-4 bg-white/60 backdrop-blur-xl sticky top-0 z-10 shadow-sm">
            <div className="h-8 w-8 bg-white/50 rounded-md border border-white/30" />
            <div className="h-4 w-32 bg-white/50 rounded border border-white/30" />
        </div>
        <SkeletonBlock height="600px" />
        <SkeletonBlock height="400px" className="bg-white/20" />
        <SkeletonBlock height="500px" />
    </div>
);

/**
 * The main container for the dynamically generated landing page.
 * 
 * Features:
 * - Fetches and renders all page blocks (Hero, Proof, PAS, Spec, Social, Offer) based on JSON config.
 * - Handles Real-time updates via WebSocket (Signal-Driven Refresh).
 * - Manages global state for forms and dynamic interactions.
 * - Implements a Skeleton Loader for initial data fetching.
 * - Tracks page view events for analytics.
 * 
 * @param {DynamicLandingPageProps} props - The component props.
 */
export const DynamicLandingPage: React.FC<DynamicLandingPageProps> = ({ isPreview: isPreviewProp }) => {
    // Detect isPreview from URL if not provided via prop (for iframe support)
    const isPreview = isPreviewProp || new URLSearchParams(window.location.search).get('isPreview') === 'true';
    const { setDna } = useBrand();
    const { config, loading: configLoading } = useConfig();
    const { workspaceId } = useWorkspace();
    const [refreshKey, setRefreshKey] = useState(0);

    // SIGNAL-DRIVEN REFRESH
    const { connect } = useWebSocket({
        onStateUpdate: () => {
            console.log("♻️ Dynamic Page: State Update Signal -> Refreshing...");
            setLoading(true); // Show skeleton immediately
            setRefreshKey(prev => prev + 1);
        },
        onAssetUpdate: () => {
            console.log("🖼️ Dynamic Page: Asset Update Signal -> Refreshing assets...");
            // Optional: Don't show full skeleton for assets, but we do for safety
            setRefreshKey(prev => prev + 1);
        }
    });

    // Establish WebSocket connection for standalone mode
    useEffect(() => {
        connect();
    }, [connect]);

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
                    },
                    // NEW: Inject Styles
                    styles: isOffer ? configs.offer?.styles : configs.hero?.styles
                };
                setActiveForm(detail);
            }
        };
        window.addEventListener('open-form', handleOpenForm);
        return () => window.removeEventListener('open-form', handleOpenForm);
    }, [configs]);

    useEffect(() => {
        if (configLoading) return;

        if (!config) {
            console.error("System Config failed to load");
            setError("Unable to connect to Optimization Engine. Ensure server is running.");
            setLoading(false);
            return;
        }

        const fetchConfigs = async () => {
            try {
                const basePath = config.active_assets_path ? `/${config.active_assets_path}` : '';
                let assetRoot = `/assets${basePath}`;
                if (workspaceId && workspaceId !== 'default') {
                    assetRoot = `/workspaces/${workspaceId}/assets${basePath}`;
                }

                const fetchJson = async (url: string, label: string) => {
                    const res = await fetch(url);
                    const type = res.headers.get('content-type');
                    if (!res.ok || (type && type.includes('text/html'))) {
                        throw new Error(`Invalid JSON response for ${label}`);
                    }
                    return res.json();
                };

                const logoPath = workspaceId && workspaceId !== 'default'
                    ? `/workspaces/${workspaceId}/assets/logo_kit_challenger.json`
                    : `/assets/logo_kit_challenger.json`;

                const cacheBuster = `?t=${Date.now()}`;
                const [heroData, proofData, pasData, specData, socialData, offerData, logoData] = await Promise.all([
                    fetchJson(`${assetRoot}/hero_block.json${cacheBuster}`, 'Hero'),
                    fetchJson(`${assetRoot}/proof_block.json${cacheBuster}`, 'Proof'),
                    fetchJson(`${assetRoot}/pas_block.json${cacheBuster}`, 'PAS'),
                    fetchJson(`${assetRoot}/spec_block.json${cacheBuster}`, 'Spec'),
                    fetchJson(`${assetRoot}/social_block.json${cacheBuster}`, 'Social'),
                    fetchJson(`${assetRoot}/offer_block.json${cacheBuster}`, 'Offer'),
                    fetchJson(`${logoPath}${cacheBuster}`, 'Logo')
                ]);

                // Minimum load time for premium shimmer effect
                await new Promise(r => setTimeout(r, 800));

                setConfigs({ hero: heroData, proof: proofData, pas: pasData, spec: specData, social: socialData, offer: offerData });

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
                setLoading(false); // Only set loading to false on SUCCESS
            } catch (err) {
                console.error("Failed to load Landing Page Configs (likely generating):", err);
                // DO NOT set error here.
                // DO NOT set loading(false).
                // We keep the skeleton on screen.
                // The WebSocket 'STATE_UPDATE' or 'ASSET_UPDATE' will trigger a re-fetch.

                // Optional: We can set a soft error if it takes too long, but for now PERISTENCE is requested.
            }
        };

        fetchConfigs();
    }, [config, configLoading, setDna, workspaceId, refreshKey]);

    const [hasTracked, setHasTracked] = useState(false);

    useEffect(() => {
        if (!loading && configs.hero && config?.current_state_hash && !hasTracked && !isPreview) {
            const stateHash = config.current_state_hash || 'unknown';
            fetch('/api/tracking/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-workspace-id': workspaceId || 'default'
                },
                body: JSON.stringify({
                    sessionId: 'manual_session',
                    componentId: 'page_root',
                    eventType: 'view_page',
                    timestamp: Date.now(),
                    stateHash
                })
            }).then(() => {
                setHasTracked(true);
            }).catch(console.error);
        }
    }, [loading, configs, config, hasTracked, workspaceId, isPreview]);

    if (loading) return <SkeletonLoader />;
    if (error) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white p-10 text-center">{error}</div>;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 70,
                damping: 20
            } as any
        }
    };

    return (
        <motion.div
            className="min-h-screen bg-zinc-950 text-white selection:bg-blue-500 selection:text-white"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <style>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                
                /* Super Glass Scrollbar - Custom Dark Track */
                ::-webkit-scrollbar {
                    width: 16px;
                }
                ::-webkit-scrollbar-track {
                    background: #525252; /* Custom Dark Gray Track */
                    border-left: 1px solid rgba(255, 255, 255, 0.05); /* Subtle light border */
                }
                ::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.25); /* Glossy light thumb for contrast */
                    border: 4px solid transparent; 
                    background-clip: content-box;
                    border-radius: 99px;
                    box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.1);
                }
                ::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.4);
                }
                ::-webkit-scrollbar-corner {
                    background: transparent;
                }
            `}</style>

            {configs.hero && <NavigationBar config={configs.hero.navigation} brandId={configs.hero.id} />}

            <motion.div variants={itemVariants}>{configs.hero && <HeroBlock config={configs.hero} />}</motion.div>
            <motion.div variants={itemVariants}>{configs.proof && <ProofBlock config={configs.proof} />}</motion.div>
            <motion.div variants={itemVariants}>{configs.pas && <PASBlock config={configs.pas} />}</motion.div>
            <motion.div variants={itemVariants}>{configs.spec && <SpecBlock config={configs.spec} />}</motion.div>
            <motion.div variants={itemVariants}>{configs.social && <SocialBlock config={configs.social} />}</motion.div>
            <motion.div variants={itemVariants}>{configs.offer && <OfferBlock config={configs.offer} />}</motion.div>

            {activeForm && (
                <FormOrchestrator
                    type={activeForm.type}
                    context={activeForm.context}
                    onClose={() => setActiveForm(null)}
                />
            )}
        </motion.div>
    );
};
