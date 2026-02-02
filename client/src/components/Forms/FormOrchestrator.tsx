import React, { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';

interface FormOrchestratorProps {
    type: 'CONTACT' | 'INTENT' | 'OFFER';
    context?: any;
    onClose: () => void;
}

export const FormOrchestrator: React.FC<FormOrchestratorProps> = ({ type, context, onClose }) => {
    const { config } = useConfig();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [selectedTier, setSelectedTier] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            console.log(`[Form] Submitting with integrity hash: ${config?.current_state_hash || 'unknown'}`);

            const response = await fetch('http://localhost:3001/api/leads/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl p-8 md:p-10 relative shadow-2xl animate-in fade-in zoom-in duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Context: {type}</span>
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white">
                            {context?.form?.title || (type === 'OFFER' ? 'Secure Proposal' : 'Initiate Contact')}
                        </h2>
                        <p className="text-white/50 text-sm leading-relaxed">
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
                                    className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col h-full ${selectedTier === tier.id
                                        ? 'bg-blue-600 border-blue-400 ring-2 ring-blue-400/50'
                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                        }`}
                                >
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{tier.badge || 'Plan'}</span>
                                    <span className="text-sm font-bold text-white mb-1">{tier.name}</span>
                                    <span className="text-xl font-black text-white mt-auto">{tier.price}</span>
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
                                                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                                            />
                                        ) : field.type === 'select' ? (
                                            <select
                                                required={field.required}
                                                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none"
                                            >
                                                <option value="" className="bg-slate-900">{field.label}</option>
                                                {field.options?.map((opt: string) => (
                                                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'checkbox' ? (
                                            <label className="flex items-center space-x-3 text-white/70 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    required={field.required}
                                                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.checked ? 'true' : 'false' })}
                                                    className="w-5 h-5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-0 focus:ring-offset-0 transition-all"
                                                />
                                                <span className="text-sm group-hover:text-white transition-colors">{field.label}</span>
                                            </label>
                                        ) : (
                                            <input
                                                required={field.required}
                                                type={field.type}
                                                placeholder={field.label}
                                                onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            />
                                        )}
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Full Name"
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-medium"
                                        />
                                        <input
                                            required
                                            type="email"
                                            placeholder="Corporate Email"
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-medium"
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Specific Directives / Mission Goals"
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                                    ></textarea>
                                </>
                            )}
                        </div>

                        <button
                            disabled={isSubmitting}
                            className="w-full py-5 bg-white text-black font-black uppercase tracking-tighter text-lg hover:bg-blue-50 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Transmitting...' : (context?.form?.submit_text || 'Commit Submission')}
                        </button>
                    </form>

                    <p className="text-[10px] text-white/20 text-center uppercase tracking-widest italic">
                        Secured via State ID: {config?.current_state_hash || 'PENDING'}
                    </p>
                </div>
            </div>
        </div>
    );
};
