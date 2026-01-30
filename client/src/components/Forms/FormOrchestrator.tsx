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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
            <div className="max-w-xl w-full bg-slate-900 border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden">
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
                            {type === 'OFFER' ? 'Secure Proposal' : 'Initiate Contact'}
                        </h2>
                        <p className="text-white/50 text-sm leading-relaxed">
                            {type === 'OFFER'
                                ? `Requesting access for ${context?.tierName || 'the selected package'}.`
                                : 'Our agents are ready to coordinate your transformation.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
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

                        <button
                            disabled={isSubmitting}
                            className="w-full py-5 bg-white text-black font-black uppercase tracking-tighter text-lg hover:bg-blue-50 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Transmitting...' : 'Commit Submission'}
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
