import React, { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Props for the FormOrchestrator component.
 */
interface FormOrchestratorProps {
    /** The type of form to render. */
    type: 'CONTACT' | 'INTENT' | 'OFFER';
    /** Contextual data for the form (e.g., tier details, styling). */
    context?: any;
    /** Callback to close the orchestrator. */
    onClose: () => void;
}

/**
 * Manages the display and submission of dynamic lead generation forms.
 * 
 * Features:
 * - Supports multiple form types (Contact, Intent, Offer).
 * - Dynamic form field rendering based on context.
 * - Styling injection to match the generated site's theme.
 * - Secure submission with state hash integrity check.
 * - Success state handling.
 * 
 * @param {FormOrchestratorProps} props - The component props.
 */
export const FormOrchestrator: React.FC<FormOrchestratorProps> = ({ type, context, onClose }) => {
    const { config } = useConfig();
    const { workspaceId } = useWorkspace();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [selectedTier, setSelectedTier] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            console.log(`[Form] Submitting with integrity hash: ${config?.current_state_hash || 'unknown'}`);

            const response = await fetch('/api/leads/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-workspace-id': workspaceId
                },
                body: JSON.stringify({
                    type,
                    formData,
                    stateHash: config?.current_state_hash || 'unknown'
                }),
            });

            if (response.ok) {
                setIsSubmitted(true);
                setTimeout(onClose, 2000);
            }
        } catch (error) {
            console.error("Lead submission failed:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 text-center">
                <div className="max-w-md w-full animate-in fade-in zoom-in duration-500">
                    <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-white">Access Granted</h2>
                    <p className="text-white/60">Our state coordinator has logged your inquiry. Synchronizing next steps...</p>
                </div>
            </div>
        );
    }

    // Extract styles from context or fallback to default Slate theme
    const bgStyle = context?.styles?.backgroundColor || '#0f172a'; // slate-900
    const textStyle = context?.styles?.color || '#ffffff'; // white
    const accentStyle = context?.styles?.accentColor || '#3b82f6'; // blue-500
    const fontStyle = context?.styles?.fontFamily || 'inherit';

    // Helper for input styles
    const inputStyle = {
        backgroundColor: `${textStyle}10`, // 10% opacity
        borderColor: `${textStyle}20`,
        color: textStyle
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" style={{ fontFamily: fontStyle }}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            <div
                className="max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-3xl p-8 md:p-10 relative shadow-2xl animate-in fade-in zoom-in duration-300 border"
                style={{
                    backgroundColor: bgStyle,
                    color: textStyle,
                    borderColor: `${textStyle}10`
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 transition-colors"
                    style={{ color: `${textStyle}60` }}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentStyle }}>Context: {type}</span>
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: textStyle }}>
                            {context?.form?.title || (type === 'OFFER' ? 'Secure Proposal' : 'Initiate Contact')}
                        </h2>
                        <p className="text-sm leading-relaxed" style={{ color: `${textStyle}80` }}>
                            {context?.form?.subtitle || (type === 'OFFER'
                                ? `Requesting access for ${context?.tierName || 'the selected package'}.`
                                : 'Our agents are ready to coordinate your transformation.')}
                        </p>
                    </div>

                    {/* Tier Selection (ONLY for OFFER type) */}
                    {type === 'OFFER' && context?.form?.tiers && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {context.form.tiers.map((tier: any) => (
                                <button
                                    key={tier.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedTier(tier.id);
                                        setFormData({ ...formData, tier_id: tier.id, tier_name: tier.name });
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col h-full`}
                                    style={{
                                        backgroundColor: selectedTier === tier.id ? accentStyle : `${textStyle}05`,
                                        borderColor: selectedTier === tier.id ? accentStyle : `${textStyle}15`,
                                        color: selectedTier === tier.id ? '#ffffff' : textStyle
                                    }}
                                >
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{tier.badge || 'Plan'}</span>
                                    <span className="text-sm font-bold mb-1">{tier.name}</span>
                                    <span className="text-xl font-black mt-auto">{tier.price}</span>
                                    <span className="text-[10px] opacity-40 uppercase tracking-tighter">{tier.interval}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            {context?.form?.fields ? (
                                context.form.fields.map((field: any) => (
                                    <div key={field.id} className="w-full">
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                required={field.required}
                                                placeholder={field.label}
                                                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                                rows={3}
                                                className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium resize-none input-placeholder-opacity"
                                                style={inputStyle}
                                            />
                                        ) : field.type === 'select' ? (
                                            <select
                                                required={field.required}
                                                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                                className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium appearance-none"
                                                style={inputStyle}
                                            >
                                                <option value="" style={{ backgroundColor: bgStyle }}>{field.label}</option>
                                                {field.options?.map((opt: string) => (
                                                    <option key={opt} value={opt} style={{ backgroundColor: bgStyle }}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'checkbox' ? (
                                            <label className="flex items-center space-x-3 cursor-pointer group" style={{ color: `${textStyle}70` }}>
                                                <input
                                                    type="checkbox"
                                                    required={field.required}
                                                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.checked ? 'true' : 'false' })}
                                                    className="w-5 h-5 rounded focus:ring-0 transition-all"
                                                    style={{
                                                        borderColor: `${textStyle}20`,
                                                        backgroundColor: `${textStyle}05`,
                                                        accentColor: accentStyle
                                                    }}
                                                />
                                                <span className="text-sm group-hover:opacity-100 transition-opacity">{field.label}</span>
                                            </label>
                                        ) : (
                                            <input
                                                required={field.required}
                                                type={field.type}
                                                placeholder={field.label}
                                                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                                className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium input-placeholder-opacity"
                                                style={inputStyle}
                                            />
                                        )}
                                    </div>
                                ))
                            ) : (
                                // Fallback fields
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Full Name"
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium"
                                            style={inputStyle}
                                        />
                                        <input
                                            required
                                            type="email"
                                            placeholder="Corporate Email"
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Specific Directives / Mission Goals"
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={4}
                                        className="w-full p-4 rounded-xl focus:outline-none transition-all font-medium resize-none"
                                        style={inputStyle}
                                    ></textarea>
                                </>
                            )}
                        </div>

                        <button
                            disabled={isSubmitting}
                            className="w-full py-5 font-black uppercase tracking-tighter text-lg transition-all active:scale-[0.98] disabled:opacity-50"
                            style={{
                                backgroundColor: textStyle,
                                color: bgStyle
                            }}
                        >
                            {isSubmitting ? 'Transmitting...' : (context?.form?.submit_text || 'Commit Submission')}
                        </button>
                    </form>

                    <p className="text-[10px] text-center uppercase tracking-widest italic" style={{ color: `${textStyle}20` }}>
                        Secured via State ID: {config?.current_state_hash || 'PENDING'}
                    </p>
                </div>
            </div>
        </div>
    );
};
