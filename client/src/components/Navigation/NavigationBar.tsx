import React, { useEffect, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import { useBrand } from '../../context/BrandContext';

interface NavigationBarProps {
    config: {
        links: Array<{ label: string; action_id: string }>;
        styles?: any;
    };
    brandId: string;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ config, brandId }) => {
    const { dna } = useBrand();
    const { track } = useTracking(brandId + '_nav');
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNavClick = (action: string) => {
        track('nav_click' as any, { action });

        if (action === 'open_intent_form' || action === 'open_contact_form' || action === 'open_offer_form') {
            window.dispatchEvent(new CustomEvent('open-form', {
                detail: {
                    type: action === 'open_intent_form' ? 'INTENT' :
                        action === 'open_offer_form' ? 'OFFER' : 'CONTACT'
                }
            }));
        } else if (action === 'scroll_to_offer') {
            document.getElementById('offer-block')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    if (!config || !config.links) return null;

    return (
        <nav
            className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 px-6 py-4 md:px-12 flex items-center justify-start gap-12 ${isScrolled
                ? 'bg-black/40 backdrop-blur-xl border-b border-white/5 py-3'
                : 'bg-transparent'
                }`}
        >
            {/* Logo Section */}
            <div className="flex items-center">
                {dna?.logoUrl?.value ? (
                    <img
                        src={dna.logoUrl.value}
                        alt="Logo"
                        className="h-8 md:h-10 w-auto object-contain brightness-0 invert opacity-90"
                    />
                ) : (
                    <span className="text-white font-black tracking-tighter text-xl uppercase italic">
                        {dna?.name?.value || 'BEEVO'}
                    </span>
                )}
            </div>

            {/* Links Section */}
            <div className="flex items-center space-x-6 md:space-x-10">
                {config.links.map((link, idx) => {
                    const isOffer = link.label.toLowerCase().includes('offer') || link.action_id === 'open_intent_form' || link.action_id === 'open_offer_form';

                    return (
                        <button
                            key={idx}
                            onClick={() => handleNavClick(link.action_id)}
                            className={`transition-all duration-300 hover:opacity-100 active:scale-95 ${isOffer
                                ? 'bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10'
                                : 'opacity-70'
                                }`}
                            style={{
                                ...config.styles,
                                backgroundColor: isOffer ? undefined : 'transparent'
                            }}
                        >
                            {link.label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
