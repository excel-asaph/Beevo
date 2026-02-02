import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from 'react-use-websocket';
import { StateAnalytics } from './Analytics/StateAnalytics';
import { Settings, BarChart2 } from 'lucide-react';

interface SystemConfig {
    sections: Record<string, any>;
    client_tracking: any;
    hitl: {
        enabled: boolean;
        require_approval_pre: boolean;
        require_approval_post: boolean;
        auto_proceed_delay_m: number;
    };
    locks: Record<string, boolean>;
    feedback: Record<string, string>;
}

// Helper to update deeply nested config state locally
const updateConfigValue = (config: SystemConfig, path: string[], value: any): SystemConfig => {
    const newConfig = JSON.parse(JSON.stringify(config));
    let current = newConfig;
    for (const key of path.slice(0, -1)) {
        current = current[key];
    }
    current[path[path.length - 1]] = value;
    return newConfig;
};

interface InterventionRequest {
    id: string;
    section: string;
    type: 'PRE_GENERATION' | 'POST_GENERATION';
    message: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    timestamp: number;
    proposal?: any;
}

const WS_URL = 'ws://localhost:3001';
const API_URL = 'http://localhost:3001';

// Separate component for the save button to handle local loading state cleanly
const SaveButton: React.FC<{ onClick: () => void; isSaving: boolean }> = ({ onClick, isSaving }) => (
    <button
        onClick={onClick}
        disabled={isSaving}
        className={`text-[10px] font-bold px-3 py-1 rounded transition-colors ${isSaving
            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/50'
            }`}
    >
        {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
    </button>
);

export const HITLControlCenter: React.FC = () => {
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [interventions, setInterventions] = useState<InterventionRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [savingSections, setSavingSections] = useState<Record<string, boolean>>({}); // Track saving state per section
    const [activeTab, setActiveTab] = useState<'controls' | 'analytics'>('controls');

    const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});

    // Load Initial Config & Pending Interventions
    useEffect(() => {
        loadConfig();
        loadPendingRequests();
    }, []);

    const loadConfig = () => {
        fetch(`${API_URL}/api/config`)
            .then(res => res.json())
            .then(setConfig)
            .catch(console.error);
    };

    const loadPendingRequests = () => {
        fetch(`${API_URL}/api/hitl/pending`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setInterventions(data);
                }
            })
            .catch(console.error);
    };

    // WebSocket for Live Interventions
    const { sendMessage, lastMessage } = useWebSocket(WS_URL, {
        shouldReconnect: () => true,
    });

    useEffect(() => {
        if (lastMessage !== null) {
            const data = JSON.parse(lastMessage.data);
            if (data.type === 'INTERVENTION_REQUIRED') {
                setInterventions(data.payload.requests);
            } else if (data.type === 'FULL_STATE_UPDATE') {
                // Refresh config if needed
            }
        }
    }, [lastMessage]);

    const handleResolve = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        await fetch(`${API_URL}/api/hitl/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action, feedback })
        });
        // Optimistic update
        setInterventions(prev => prev.filter(i => i.id !== id));
        setFeedback('');
        setSelectedRequest(null);
    };

    const setLock = async (section: string, isLocked: boolean) => {
        // Optimistic
        if (!config) return;
        setConfig({
            ...config,
            locks: { ...config.locks, [section]: isLocked }
        });

        await fetch(`${API_URL}/api/config/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, isLocked })
        });
    };

    const updateDirective = (field: string, value: string) => {
        if (!config) return;
        setConfig({
            ...config,
            feedback: { ...config.feedback, [field]: value }
        });
    };

    const saveDirective = async (field: string, value: string) => {
        await fetch(`${API_URL}/api/config/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directive: field, value })
        });
    };

    // NEW: Handle Metric Inputs
    const handleMetricChange = (section: string, metric: string, value: string) => {
        if (!config) return;
        const numValue = parseFloat(value);
        const newConfig = updateConfigValue(config, ['sections', section, metric], isNaN(numValue) ? 0 : numValue);
        setConfig(newConfig);
    };

    // Helper to get buffer key
    const getBufferKey = (section: string, metric: string) => `${section}::${metric}`;

    const handleSaveSection = async (sectionKey: string) => {
        if (!config) return;
        setSavingSections(prev => ({ ...prev, [sectionKey]: true }));

        try {
            // 1. Save Directive
            const directiveKey = `${sectionKey}_directive`;
            const directiveValue = config.feedback[directiveKey];
            await saveDirective(directiveKey, directiveValue);

            // 2. Save Metrics
            const metrics = config.sections[sectionKey];
            for (const [key, value] of Object.entries(metrics)) {
                if (key === 'watcher_confidence_min') continue;
                await saveMetric(sectionKey, key, Number(value));
            }
        } catch (error) {
            console.error("Failed to save section", error);
        } finally {
            // Fake delay for UX so user calls 'Saving...'
            setTimeout(() => {
                setSavingSections(prev => ({ ...prev, [sectionKey]: false }));
            }, 500);
        }
    };

    const saveMetric = async (section: string, metric: string, value: number) => {
        // We need an endpoint for this, or just update the whole config.
        // For now, let's assume valid JSON config update endpoint or discrete.
        // Since we don't have a discrete metric update endpoint, we'll implement a 'save section' or 'update config' one.
        // Actually, let's just make a generic /api/config/update endpoint for key-value pairs or sections.
        console.log(`Saving ${section}.${metric} = ${value}`);
        // NOTE: Ideally, add /api/config/update to server.
        // For now, I will add a generic update call.
        await fetch(`${API_URL}/api/config/update_section`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, metric, value })
        });
    };

    if (!config) return <div className="p-8 text-white">Loading Control Center...</div>;

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-6 font-sans">
            <header className="mb-8 flex justify-between items-center border-b border-neutral-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                        BEEVO CONTROL CENTER
                    </h1>
                    <p className="text-neutral-400 text-sm">Human-in-the-Loop Orchestration</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex bg-neutral-800 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('controls')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'controls' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <Settings size={14} /> CONTROLS
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <BarChart2 size={14} /> INTELLIGENCE
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.hitl.enabled ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                        <span className="text-xs font-mono text-neutral-500 uppercase tracking-tighter">System {config.hitl.enabled ? 'Responsive' : 'Halted'}</span>
                    </div>
                </div>
            </header>

            <main className="grid grid-cols-12 gap-8">
                {activeTab === 'controls' ? (
                    <>
                        {/* LEFT: INTERVENTION FEED */}
                        <section className="col-span-4 space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                                    Intervention Queue ({interventions.length})
                                </h2>
                                {interventions.length > 0 && (
                                    <button
                                        onClick={() => interventions.forEach(req => handleResolve(req.id, 'APPROVED'))}
                                        className="text-[10px] font-bold text-green-400 border border-green-500/30 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                                    >
                                        APPROVE ALL
                                    </button>
                                )}
                            </div>

                            {interventions.length === 0 ? (
                                <div className="p-8 border border-neutral-800 rounded-lg text-center text-neutral-600 italic">
                                    All systems nominal. No active requests.
                                </div>
                            ) : (
                                interventions.map(req => (
                                    <div
                                        key={req.id}
                                        onClick={() => setSelectedRequest(req.id)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedRequest === req.id
                                            ? 'border-yellow-500/50 bg-yellow-500/10'
                                            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                                                {req.section.toUpperCase()}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 font-mono">
                                                {req.type === 'PRE_GENERATION' ? 'GATE 1 (PRE)' : 'GATE 2 (POST)'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-300 leading-relaxed mb-3">
                                            {req.message}
                                        </p>

                                        {selectedRequest === req.id && (
                                            <div className="mt-4 pt-4 border-t border-neutral-800/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                                                {req.type === 'PRE_GENERATION' && (
                                                    <div>
                                                        <label className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
                                                            Inject Directive (Optional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={feedback}
                                                            onChange={(e) => setFeedback(e.target.value)}
                                                            placeholder="e.g., 'Focus more on privacy features...'"
                                                            className="w-full bg-black/50 border border-neutral-800 rounded px-3 py-2 text-sm text-white focus:border-yellow-500/50 outline-none"
                                                        />
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleResolve(req.id, 'REJECTED'); }}
                                                        className="py-2 text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors"
                                                    >
                                                        REJECT
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleResolve(req.id, 'APPROVED'); }}
                                                        className="py-2 text-xs font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded border border-green-500/20 transition-colors"
                                                    >
                                                        APPROVE {req.type === 'POST_GENERATION' ? '& DEPLOY' : '& OPTIMIZE'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </section>

                        {/* RIGHT: SYSTEM CONFIGURATION */}
                        <section className="col-span-8 space-y-8 h-[calc(100vh-140px)] overflow-y-auto pr-2">

                            {/* SECTION 1: GLOBAL GATES */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="text-yellow-500">🚦</span> Traffic Control
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <ConfigToggle
                                        label="Master Switch"
                                        value={config.hitl.enabled}
                                        description="Enable/Disable all HITL features"
                                    />
                                    <ConfigToggle
                                        label="Pre-Gen Gate"
                                        value={config.hitl.require_approval_pre}
                                        description={`"Permission to Think"`}
                                    />
                                    <ConfigToggle
                                        label="Post-Gen Gate"
                                        value={config.hitl.require_approval_post}
                                        description={`"Permission to Commit"`}
                                    />
                                </div>
                            </div>

                            {/* SECTION 2: SECTION CONTROLS (Locks & Directives) */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="text-blue-500">🎛️</span> Section Controls
                                </h3>
                                <div className="space-y-6">
                                    {Object.keys(config.sections).map((key) => {
                                        const sectionKey = key as keyof typeof config.sections;
                                        const isLocked = config.locks?.[sectionKey] || false;
                                        const directive = config.feedback?.[`${sectionKey}_directive`] || '';

                                        return (
                                            <div key={key} className={`p-5 border rounded-lg bg-neutral-950/50 ${isLocked ? 'border-red-900/30' : 'border-neutral-800'}`}>

                                                {/* HEADER: Title + Save + Lock Toggle */}
                                                <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-2">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="font-mono text-sm uppercase text-blue-400">{key}</h4>
                                                        {isLocked && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded font-bold">LOCKED</span>}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <SaveButton
                                                            onClick={() => handleSaveSection(key)}
                                                            isSaving={savingSections[key] || false}
                                                        />
                                                        <button
                                                            onClick={() => setLock(sectionKey, !isLocked)}
                                                            className={`text-[10px] px-3 py-1 rounded border transition-colors ${isLocked
                                                                ? 'bg-red-500 text-white border-red-500'
                                                                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
                                                                }`}
                                                        >
                                                            {isLocked ? 'UNLOCK' : 'LOCK'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-12 gap-6">
                                                    {/* METRICS */}
                                                    <div className="col-span-5 space-y-3 border-r border-neutral-800 pr-4">
                                                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">Targets</span>
                                                        {Object.entries(config.sections[sectionKey]).map(([k, v]) => {
                                                            if (k === 'watcher_confidence_min') return null;

                                                            // Determine Config for this Metric (Units, Limits, Translation)
                                                            const getMetricConfig = (key: string) => {
                                                                if (key.includes('_rate') || key.includes('_ctr') || key.includes('_depth') || key.includes('_retention')) {
                                                                    return { unit: '%', step: 0.1, min: 0, max: 100, isRate: true };
                                                                }
                                                                if (key.includes('_ms')) {
                                                                    return { unit: 'ms', step: 100, min: 0, max: 99999, isRate: false };
                                                                }
                                                                return { unit: '#', step: 1, min: 0, max: 9999, isRate: false };
                                                            };

                                                            const mConfig = getMetricConfig(k);
                                                            const bufferKey = getBufferKey(sectionKey, k);
                                                            const isBuffered = editBuffer[bufferKey] !== undefined;

                                                            // Translate Value for Display (0.05 -> 5)
                                                            // If editing, show buffer. If not, show derived value.
                                                            const displayValue = isBuffered
                                                                ? editBuffer[bufferKey]
                                                                : (mConfig.isRate ? (Number(v) * 100).toFixed(1) : String(v));

                                                            return (
                                                                <div key={k} className="flex justify-between items-center text-xs">
                                                                    <span className="text-neutral-400 font-mono truncate mr-2" title={k}>{k.replace(/_/g, ' ')}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            className={`w-16 font-bold px-2 py-1 rounded text-center border outline-none appearance-none transition-colors
                                                                                ${isBuffered ? 'bg-neutral-700 text-yellow-300 border-yellow-500/50' : 'bg-neutral-800 text-white border-transparent focus:border-blue-500'}
                                                                            `}
                                                                            value={displayValue}
                                                                            min={mConfig.min}
                                                                            max={mConfig.max}
                                                                            step={mConfig.step}

                                                                            onChange={(e) => {
                                                                                // 1. Update Buffer Only (Allow free typing)
                                                                                setEditBuffer(prev => ({
                                                                                    ...prev,
                                                                                    [bufferKey]: e.target.value
                                                                                }));
                                                                            }}

                                                                            onBlur={(e) => {
                                                                                // 2. Commit on Blur
                                                                                let val = parseFloat(e.target.value);
                                                                                if (isNaN(val)) val = 0;

                                                                                // Clamp
                                                                                if (val < mConfig.min) val = mConfig.min;
                                                                                // Only clamp max if Rate (don't clamp ms/views to 100)
                                                                                if (mConfig.isRate && val > mConfig.max) val = mConfig.max;

                                                                                // Translate to System Value
                                                                                const systemValue = mConfig.isRate ? (val / 100) : val;

                                                                                // Update Config State
                                                                                handleMetricChange(sectionKey, k, String(systemValue));
                                                                                // Save to Server
                                                                                saveMetric(sectionKey, k, systemValue);

                                                                                // Clear Buffer (Return to derived state)
                                                                                setEditBuffer(prev => {
                                                                                    const next = { ...prev };
                                                                                    delete next[bufferKey];
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        />
                                                                        <span className="text-[10px] text-neutral-600 font-bold w-4">{mConfig.unit}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* DIRECTIVE */}
                                                    <div className="col-span-7">
                                                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-2">
                                                            Permanent Rules
                                                        </span>
                                                        <textarea
                                                            className="w-full bg-black/30 border border-neutral-800 rounded p-2 text-xs text-neutral-300 focus:border-blue-500/50 outline-none resize-none h-24"
                                                            placeholder={`Always apply this rule for ${key}...`}
                                                            value={directive}
                                                            onChange={(e) => updateDirective(`${sectionKey}_directive`, e.target.value)}
                                                        />
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </>
                ) : (
                    <div className="col-span-12">
                        <StateAnalytics />
                    </div>
                )}
            </main>
        </div >
    );
};

const ConfigToggle = ({ label, value, description }: { label: string, value: boolean, description: string }) => (
    <div className={`p-4 rounded-lg border ${value ? 'border-green-500/20 bg-green-500/5' : 'border-neutral-800 bg-neutral-900'} transition-all`}>
        <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-sm text-neutral-200">{label}</span>
            <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-neutral-700'}`} />
        </div>
        <p className="text-[10px] text-neutral-500">{description}</p>
    </div>
);
