import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Settings,
    Activity,
    Lock,
    Unlock,
    Cpu,
    CheckCircle2,
    PanelLeftClose,
    PanelLeftOpen,
    Bell,
    ChevronDown,
    ChevronUp,
    Smartphone,
    MessageSquare,
    ExternalLink
} from 'lucide-react';
import { useBrandStore } from '../../../stores/useBrandStore';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { StateAnalytics } from '../../Analytics/StateAnalytics';
import { SystemConfig, InterventionRequest } from '@shared/types';
import { usePushNotifications } from '../../../hooks/usePushNotifications';

const API_URL = process.env.VITE_PROD ? '' : 'http://localhost:3001';

// --- Shared Components for Clean UI ---

/**
 * A reusable toggle switch component for boolean settings.
 * 
 * @param {Object} props - The component props.
 * @param {boolean} props.checking - The current state of the toggle (true = on, false = off).
 * @param {function} props.onChange - Callback function triggered when the toggle is clicked.
 * @param {string} props.label - The label text displayed next to the toggle.
 * @param {string} [props.description] - Optional description text displayed below the label.
 */
const Toggle = ({ checking, onChange, label, description }: { checking: boolean, onChange: (val: boolean) => void, label: string, description?: string }) => (
    <div className="flex items-center justify-between py-5 border-b border-gray-100 last:border-0">
        <div>
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            {description && <div className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-md">{description}</div>}
        </div>
        <button
            onClick={() => onChange(!checking)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checking ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
            <motion.div
                initial={false}
                animate={{ x: checking ? 22 : 2 }}
                className="w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 left-0"
            />
        </button>
    </div>
);



/**
 * A button component used for saving section configurations.
 * Handles loading state and success feedback.
 * 
 * @param {Object} props - The component props.
 * @param {function} props.onClick - Callback function triggered when the button is clicked.
 * @param {boolean} props.isSaving - Indicates if the save operation is in progress.
 * @param {boolean} [props.isSaved] - Indicates if the save operation completed successfully.
 */
const SaveButton: React.FC<{ onClick: () => void; isSaving: boolean; isSaved?: boolean }> = ({ onClick, isSaving, isSaved }) => (
    <button
        onClick={onClick}
        disabled={isSaving || isSaved}
        className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${isSaving
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isSaved
                ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
            }`}
    >
        {isSaving ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : isSaved ? <CheckCircle2 size={14} /> : <Settings size={14} />}
        {isSaving ? 'SAVING...' : isSaved ? 'SAVED' : 'SAVE CHANGES'}
    </button>
);

// --- Notification Settings Component ---
/**
 * Component for managing system notifications settings (Web Push and Telegram).
 * Allows users to subscribe/unsubscribe from browser notifications and link a Telegram bot.
 */
const NotificationSettings: React.FC = () => {
    const { workspaceId } = useWorkspace();
    const pushNotifications = usePushNotifications();
    const [telegramLink, setTelegramLink] = useState<string | null>(null);
    const [telegramConfigured, setTelegramConfigured] = useState(false);

    // Fetch Telegram link
    useEffect(() => {
        const fetchTelegramLink = async () => {
            try {
                const response = await fetch(`${API_URL}/api/telegram/link`, {
                    headers: { 'x-workspace-id': workspaceId || '' }
                });
                const data = await response.json();
                setTelegramLink(data.link);
                setTelegramConfigured(data.configured);
            } catch (e) {
                console.error('Failed to fetch Telegram link:', e);
            }
        };
        fetchTelegramLink();
    }, [workspaceId]);

    return (
        <div className="space-y-4">
            {/* Web Push */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Bell size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 text-sm">Browser Notifications</p>
                        <p className="text-xs text-gray-500">
                            {pushNotifications.isSubscribed ? 'Enabled' : 'Get alerts in your browser'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => pushNotifications.isSubscribed ? pushNotifications.unsubscribe() : pushNotifications.subscribe()}
                    disabled={pushNotifications.isLoading || !pushNotifications.isSupported}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${pushNotifications.isSubscribed
                        ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        } ${!pushNotifications.isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {pushNotifications.isLoading ? '...' : pushNotifications.isSubscribed ? 'Enabled ✓' : 'Enable'}
                </button>
            </div>

            {/* Telegram */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-100 rounded-lg">
                        <MessageSquare size={18} className="text-sky-600" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-900 text-sm">Telegram Bot</p>
                        <p className="text-xs text-gray-500">
                            {telegramConfigured ? 'Approve/reject from Telegram' : 'Not configured'}
                        </p>
                    </div>
                </div>
                {telegramConfigured && telegramLink ? (
                    <a
                        href={telegramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1"
                    >
                        Connect <ExternalLink size={12} />
                    </a>
                ) : (
                    <span className="text-xs text-gray-400 px-3">Setup required</span>
                )}
            </div>

            {pushNotifications.error && (
                <p className="text-xs text-red-500">{pushNotifications.error}</p>
            )}
        </div>
    );
};

/**
 * The main Command Center modal component.
 * 
 * This component functions as the central dashboard for managing the agent system. 
 * It provides tabs for:
 * - **General**: Global system settings (Master Switch, Approval workflows) and Notifications.
 * - **Interventions**: A feed of pending Human-in-the-Loop (HITL) requests requiring approval.
 * - **Configuration**: Fine-grained configuration for specific landing page sections (metrics, directives).
 * - **Dashboard**: Real-time analytics and system health monitoring.
 * 
 * It manages its own local state for configuration editing and synchronizes with the `BrandStore` and backend APIs.
 */
export const CommandCenterModal: React.FC = () => {
    const {
        isCommandCenterOpen,
        setIsCommandCenterOpen,
        pendingInterventions: interventions,
        setPendingInterventions: setInterventions,
        commandCenterTab: activeTab,
        setCommandCenterTab: setActiveTab,
        focusedInterventionId,
        setFocusedInterventionId
    } = useBrandStore();
    const { workspaceId } = useWorkspace();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // --- State ---
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
    const [feedback, setFeedback] = useState('');
    const [savingSections, setSavingSections] = useState<Record<string, boolean>>({});
    const [savedSections, setSavedSections] = useState<Record<string, boolean>>({});
    const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});

    // Handle deep linking from snackbar clicks
    useEffect(() => {
        if (isCommandCenterOpen && focusedInterventionId) {
            // Switch to interventions tab and expand the focused item
            setActiveTab('interventions');
            setSelectedRequest(focusedInterventionId);
            // Clear the focus after handling
            setFocusedInterventionId(null);
        }
    }, [isCommandCenterOpen, focusedInterventionId, setActiveTab, setFocusedInterventionId]);

    // Load Config & Pending Requests
    useEffect(() => {
        if (isCommandCenterOpen && workspaceId) {
            loadConfig();
            loadPendingRequests();
        }
    }, [isCommandCenterOpen, workspaceId]);

    /**
     * Fetches the current system configuration from the backend.
     */
    const loadConfig = () => {
        fetch(`${API_URL}/api/config`, { headers: { 'x-workspace-id': workspaceId } })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setConfig(data);
            })
            .catch(console.error);
    };

    /**
     * Fetches pending intervention requests from the backend.
     */
    const loadPendingRequests = () => {
        fetch(`${API_URL}/api/hitl/pending`, { headers: { 'x-workspace-id': workspaceId } })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setInterventions(data);
            })
            .catch(console.error);
    };

    // Interventions are now managed globally in useBrandStore via Canvas.tsx
    // The modal just loads them once on mount if open.

    // --- Logic ---
    /**
     * Helper to deeply update a value in the configuration object without mutation.
     * 
     * @param {SystemConfig} currentConfig - The current configuration state.
     * @param {string[]} path - The path to the property to update.
     * @param {any} value - The new value.
     * @returns {SystemConfig} A new configuration object with the update applied.
     */
    const updateConfigValueLocal = (currentConfig: SystemConfig, path: string[], value: any): SystemConfig => {
        const newConfig = JSON.parse(JSON.stringify(currentConfig));
        let current = newConfig;
        for (const key of path.slice(0, -1)) {
            current = current[key];
        }
        current[path[path.length - 1]] = value;
        return newConfig;
    };

    /**
     * Updates a traffic control setting (e.g., master switch, approval requirements).
     * Saves the change immediately to the backend.
     * 
     * @param {string} key - The setting key to update.
     * @param {boolean} val - The new boolean value.
     */
    const updateTrafficConfig = (key: string, val: boolean) => {
        if (!config) return;
        const newConfig = updateConfigValueLocal(config, ['hitl', key], val);
        setConfig(newConfig);

        // SAVE ONLY THE CHANGE. Do not call a separate full save.
        fetch(`${API_URL}/api/config/update_section`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
            body: JSON.stringify({ section: 'hitl', metric: key, value: val })
        });
    };

    // ... (Keep existing helpers: handleResolve, toggleLock, updateDirective, handleSaveSection, etc.)
    /**
     * Resolves an intervention request (Approve/Reject).
     * Sends the decision to the backend and removes the request from the local list.
     * 
     * @param {string} id - The ID of the intervention request.
     * @param {'APPROVED' | 'REJECTED'} action - The resolution action.
     */
    const handleResolve = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        await fetch(`${API_URL}/api/hitl/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
            body: JSON.stringify({ id, action, feedback })
        });
        setInterventions((prev: InterventionRequest[]) => prev.filter(i => i.id !== id));
        setFeedback('');
        setSelectedRequest(null);
    };

    /**
     * Toggles the lock state of a landing page section.
     * Locked sections cannot be modified by agents.
     * 
     * @param {string} section - The section key (e.g., 'hero', 'features').
     */
    const toggleLock = async (section: string) => {
        if (!config) return;
        const newLockState = !config.locks?.[section];
        setConfig((prev: SystemConfig | null) => prev ? ({ ...prev, locks: { ...prev.locks, [section]: newLockState } } as SystemConfig) : null);
        await fetch(`${API_URL}/api/config/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
            body: JSON.stringify({ section, isLocked: newLockState })
        });
    };

    const updateDirective = (field: string, value: string) => {
        if (!config) return;
        setConfig({ ...config, feedback: { ...config.feedback, [field]: value } });
    };

    const saveDirective = async (field: string, value: string) => {
        await fetch(`${API_URL}/api/config/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
            body: JSON.stringify({ directive: field, value })
        });
    };

    /**
     * Updates a metric value for a specific section in the local state.
     * 
     * @param {string} section - The section key.
     * @param {string} metric - The metric key.
     * @param {string} value - The new value (as string from input).
     */
    const handleMetricChange = (section: string, metric: string, value: string) => {
        if (!config) return;
        const numValue = parseFloat(value);
        const newConfig = updateConfigValueLocal(config, ['sections', section, metric], isNaN(numValue) ? 0 : numValue);
        setConfig(newConfig);
    };

    const getBufferKey = (section: string, metric: string) => `${section}::${metric}`;

    const saveMetric = async (section: string, metric: string, value: number) => {
        await fetch(`${API_URL}/api/config/update_section`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
            body: JSON.stringify({ section, metric, value })
        });
    };

    /**
     * Saves all changes for a specific section (metrics and directives).
     * 
     * @param {string} sectionKey - The key of the section to save.
     */
    const handleSaveSection = async (sectionKey: string) => {
        if (!config) return;
        setSavingSections((prev: Record<string, boolean>) => ({ ...prev, [sectionKey]: true }));
        try {
            const directiveKey = `${sectionKey}_directive`;
            await saveDirective(directiveKey, config.feedback[directiveKey]);
            const metrics = config.sections[sectionKey];
            for (const [key, value] of Object.entries(metrics)) {
                if (key === 'watcher_confidence_min') continue;
                await saveMetric(sectionKey, key, Number(value));
            }
            // Success!
            setSavedSections((prev: Record<string, boolean>) => ({ ...prev, [sectionKey]: true }));
            setTimeout(() => {
                setSavedSections((prev: Record<string, boolean>) => ({ ...prev, [sectionKey]: false }));
            }, 2000);
        } catch (error) { console.error("Failed to save section", error); }
        finally { setTimeout(() => setSavingSections((prev: Record<string, boolean>) => ({ ...prev, [sectionKey]: false })), 500); }
    };

    if (!isCommandCenterOpen) return null;

    // --- Render ---
    return (
        <AnimatePresence>
            {isCommandCenterOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsCommandCenterOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        className="fixed inset-0 m-auto w-[1200px] h-[750px] max-h-[95vh] max-w-[95vw] bg-white rounded-2xl shadow-2xl z-[1000] flex overflow-hidden font-sans"
                    >
                        {/* SIDEBAR */}
                        <div className={`${isSidebarCollapsed ? 'w-[72px]' : 'w-[240px]'} bg-gray-50/80 flex flex-col border-r border-gray-100 py-6 transition-all duration-300 ease-in-out`}>
                            <div className={`px-4 mb-8 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                                {!isSidebarCollapsed && (
                                    <div>
                                        <h1 className="text-gray-900 font-bold text-lg tracking-tight flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-600 shadow-sm" />
                                            Command Center
                                        </h1>
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                    className={`p-1.5 text-gray-400 hover:text-gray-900 hover:bg-white rounded-lg transition-all ${isSidebarCollapsed ? 'bg-white shadow-sm' : ''}`}
                                >
                                    {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                                </button>
                            </div>

                            <nav className="flex-1 px-3 space-y-1">
                                <SidebarItem
                                    active={activeTab === 'general'}
                                    onClick={() => setActiveTab('general')}
                                    icon={Settings}
                                    label="General"
                                    collapsed={isSidebarCollapsed}
                                />
                                <SidebarItem
                                    active={activeTab === 'interventions'}
                                    onClick={() => setActiveTab('interventions')}
                                    icon={Bell}
                                    label="Interventions"
                                    badge={interventions.length}
                                    collapsed={isSidebarCollapsed}
                                />
                                <SidebarItem
                                    active={activeTab === 'config'}
                                    onClick={() => setActiveTab('config')}
                                    icon={Cpu}
                                    label="Configuration"
                                    collapsed={isSidebarCollapsed}
                                />
                                <SidebarItem
                                    active={activeTab === 'analytics'}
                                    onClick={() => setActiveTab('analytics')}
                                    icon={Activity}
                                    label="Dashboard"
                                    collapsed={isSidebarCollapsed}
                                />
                            </nav>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
                            {/* Header (Close Button) */}
                            <div className="absolute top-6 right-6 z-10">
                                <button
                                    onClick={() => setIsCommandCenterOpen(false)}
                                    className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {activeTab === 'general' && config && (
                                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="sticky top-0 bg-white z-20 px-10 pt-10 pb-4 border-b border-gray-100/50">
                                            <h2 className="text-2xl font-bold text-gray-900 mb-2">General Settings</h2>
                                            <p className="text-gray-500 text-sm">Manage global system and agents behavior.</p>
                                        </div>

                                        <div className="px-10 pb-10 pt-6">
                                            <div className="bg-white">
                                                <div className="space-y-2">
                                                    <Toggle
                                                        label="Master Switch"
                                                        description="Global override. When disabled, no agents will run."
                                                        checking={config.hitl.enabled}
                                                        onChange={(val) => updateTrafficConfig('enabled', val)}
                                                    />
                                                    <Toggle
                                                        label="Pre-Generation Approval"
                                                        description="Require review before agents generate new ideas ('Permission to Think')."
                                                        checking={config.hitl.require_approval_pre}
                                                        onChange={(val) => updateTrafficConfig('require_approval_pre', val)}
                                                    />
                                                    <Toggle
                                                        label="Post-Generation Approval"
                                                        description="Require review before agents update the canvas ('Permission to Commit')."
                                                        checking={config.hitl.require_approval_post}
                                                        onChange={(val) => updateTrafficConfig('require_approval_post', val)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Notifications Section */}
                                            <div className="mt-8 pt-6 border-t border-gray-100">
                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                    <Smartphone size={18} />
                                                    Mobile Notifications
                                                </h3>
                                                <p className="text-gray-500 text-sm mb-4">
                                                    Get notified on your phone when agents need approval.
                                                </p>
                                                <NotificationSettings />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'interventions' && (
                                    <div className="max-w-3xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="sticky top-0 bg-white z-20 px-10 pt-10 pb-6 flex justify-between items-center border-b border-gray-100/50 mb-6">
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900 mb-1">Interventions</h2>
                                                <p className="text-gray-500 text-sm">Pending approvals.</p>
                                            </div>
                                            {interventions.length > 0 && (
                                                <button
                                                    onClick={() => interventions.forEach(req => handleResolve(req.id, 'APPROVED'))}
                                                    className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                                                >
                                                    Approve All ({interventions.length})
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-4 px-10 pb-10">
                                            {interventions.length === 0 ? (
                                                <div className="h-64 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                                    <CheckCircle2 size={32} className="mb-3 opacity-30" />
                                                    <p className="font-medium">All clear. No pending requests.</p>
                                                </div>
                                            ) : (
                                                interventions.map(req => (
                                                    <div
                                                        key={req.id}
                                                        onClick={() => setSelectedRequest(selectedRequest === req.id ? null : req.id)}
                                                        className={`group p-6 rounded-xl border transition-all cursor-pointer ${selectedRequest === req.id
                                                            ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                                                    {req.section}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 font-medium">
                                                                    {new Date(req.timestamp).toLocaleTimeString()}
                                                                </span>
                                                            </div>
                                                            <div className="text-gray-400">
                                                                {selectedRequest === req.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-700 leading-relaxed font-medium">{req.message}</p>

                                                        {selectedRequest === req.id && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                className="pt-4 mt-4 border-t border-gray-100"
                                                            >
                                                                {req.type === 'PRE_GENERATION' && (
                                                                    <div className="mb-4">
                                                                        <input
                                                                            type="text"
                                                                            value={feedback}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setFeedback(e.target.value)}
                                                                            placeholder="Add specific instructions (optional)..."
                                                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="flex gap-3 justify-end">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleResolve(req.id, 'REJECTED'); }}
                                                                        className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-100 rounded-lg transition-colors"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleResolve(req.id, 'APPROVED'); }}
                                                                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm rounded-lg transition-colors"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'config' && config && (
                                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="sticky top-0 bg-white z-20 px-10 pt-10 pb-4 border-b border-gray-100/50 mb-6">
                                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Section Configuration</h2>
                                            <p className="text-gray-500 text-sm">Fine-tune targets, metrics, and permanent rules per landing page section.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 px-10 pb-10">
                                            {Object.keys(config.sections).map((key) => {
                                                const sectionKey = key as keyof typeof config.sections;
                                                const isLocked = config.locks?.[sectionKey] || false;
                                                const directive = config.feedback?.[`${sectionKey}_directive`] || '';

                                                return (
                                                    <div key={key} className={`flex flex-col bg-white rounded-xl border p-6 transition-all shadow-sm ${isLocked ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
                                                        <div className="flex justify-between items-start mb-5">
                                                            <div>
                                                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{key.replace(/_/g, ' ')}</h3>
                                                                <p className="text-[10px] text-gray-400 font-medium mt-1">Last updated recently</p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <SaveButton
                                                                    onClick={() => handleSaveSection(key)}
                                                                    isSaving={savingSections[key] || false}
                                                                    isSaved={savedSections[key] || false}
                                                                />
                                                                <button
                                                                    onClick={() => toggleLock(sectionKey)}
                                                                    className={`p-1.5 rounded-lg transition-colors ${isLocked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                                                                >
                                                                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="space-y-3 mb-6">
                                                            {Object.entries(config.sections[sectionKey]).map(([k, v]) => {
                                                                if (k === 'watcher_confidence_min') return null;
                                                                const getMetricConfig = (key: string) => {
                                                                    if (key.includes('_rate') || key.includes('_ctr')) return { unit: '%', step: 0.1, min: 0, max: 100, isRate: true };
                                                                    if (key.includes('_ms')) return { unit: 'ms', step: 100, min: 0, max: 99999, isRate: false };
                                                                    return { unit: '#', step: 1, min: 0, max: 9999, isRate: false };
                                                                };
                                                                const mConfig = getMetricConfig(k);
                                                                const bufferKey = getBufferKey(sectionKey, k);
                                                                const isBuffered = editBuffer[bufferKey] !== undefined;
                                                                const displayValue = isBuffered ? editBuffer[bufferKey] : (mConfig.isRate ? (Number(v) * 100).toFixed(1) : String(v));

                                                                return (
                                                                    <div key={k} className="flex justify-between items-center text-xs group">
                                                                        <span className="text-gray-500 font-medium group-hover:text-gray-700 transition-colors" title={k}>{k.split('_')[0]}...</span>
                                                                        <div className="flex items-center gap-1 bg-gray-50 rounded px-2 py-0.5 border border-transparent focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                                                            <input
                                                                                type="number"
                                                                                className="w-12 bg-transparent text-right outline-none text-gray-700 font-medium py-1"
                                                                                value={displayValue}
                                                                                onChange={(e) => setEditBuffer(prev => ({ ...prev, [bufferKey]: e.target.value }))}
                                                                                onBlur={(e) => {
                                                                                    let val = parseFloat(e.target.value);
                                                                                    if (isNaN(val)) val = 0;
                                                                                    const sysVal = mConfig.isRate ? (val / 100) : val;
                                                                                    handleMetricChange(sectionKey, k, String(sysVal));
                                                                                    saveMetric(sectionKey, k, sysVal);
                                                                                    setEditBuffer(prev => { const n = { ...prev }; delete n[bufferKey]; return n; });
                                                                                }}
                                                                            />
                                                                            <span className="text-[10px] text-gray-400 w-4 text-center font-medium">{mConfig.unit}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="mt-auto pt-4 border-t border-gray-100">
                                                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2 font-bold">Permanent Rules</label>
                                                            <textarea
                                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none h-20 leading-relaxed placeholder:text-gray-400 transition-all"
                                                                placeholder="Add immutable constraints..."
                                                                value={directive}
                                                                onChange={(e) => updateDirective(`${sectionKey}_directive`, e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'analytics' && (
                                    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <StateAnalytics />
                                    </div>
                                )}

                                {/* Loading State */}
                                {!config && activeTab === 'general' && (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                        <p className="text-sm font-medium">Connecting to Command...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )
            }
        </AnimatePresence >
    );
};

/**
 * A navigation item for the Command Center sidebar.
 * 
 * @param {Object} props - The component props.
 * @param {boolean} props.active - Whether this item is currently selected.
 * @param {function} props.onClick - Callback triggered when the item is clicked.
 * @param {React.ElementType} props.icon - The Lucide icon component to display.
 * @param {string} props.label - The label text for the item.
 * @param {number} [props.badge] - Optional numeric badge to display (e.g., for notification counts).
 * @param {boolean} props.collapsed - Whether the sidebar is in collapsed mode.
 */
const SidebarItem = ({ active, onClick, icon: Icon, label, badge, collapsed }: any) => (
    <button
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'justify-start px-3 gap-3'} py-2.5 rounded-lg transition-all text-sm font-medium group relative ${active
            ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
            : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
            }`}
    >
        <Icon size={18} className={active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600 transition-colors'} />
        {!collapsed && (
            <>
                <span>{label}</span>
                {badge > 0 && (
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-md font-bold ${active ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                        {badge}
                    </span>
                )}
            </>
        )}
        {collapsed && badge > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        )}
    </button>
);
