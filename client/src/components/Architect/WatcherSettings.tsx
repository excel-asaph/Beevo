import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Timer, Save, Clock, PlayCircle, Activity } from 'lucide-react';

export const WatcherSettings: React.FC = () => {
    const { workspaceId } = useWorkspace();
    const [config, setConfig] = useState({ bufferMinutes: 5, intervalMinutes: 5 });
    const [status, setStatus] = useState<{ ready: boolean, hasGenerated: boolean }>({ ready: false, hasGenerated: false });
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isRunningDate, setIsRunningDate] = useState<number | null>(null);

    useEffect(() => {
        // Load Config
        // Load Config
        fetch('http://localhost:3000/api/config/watcher', { headers: { 'x-workspace-id': workspaceId } })
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error("Failed to load watcher settings", err));

        // Check Status (Do logos exist?)
        const checkStatus = () => {
            fetch('http://localhost:3000/api/status/logos', { headers: { 'x-workspace-id': workspaceId } })
                .then(res => res.json())
                .then(data => setStatus(data))
                .catch(err => console.warn("Status check failed", err));
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [workspaceId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('http://localhost:3000/api/config/watcher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
                body: JSON.stringify(config)
            });
            setTimeout(() => setIsSaving(false), 500);
            setIsOpen(false);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
        }
    };

    const handleRunInit = async () => {
        if (!confirm("This will RESET history and start the full initialization flow. Continue?")) return;

        setIsRunningDate(Date.now());
        try {
            await fetch('http://localhost:3000/api/action/run-initializers', {
                method: 'POST',
                headers: { 'x-workspace-id': workspaceId }
            });
        } catch (e) {
            console.error("Failed to trigger init", e);
        }
    };

    // State 1: System Running (Recently triggered)
    if (isRunningDate) {
        return (
            <div className="bg-emerald-900/80 p-2 rounded-lg border border-emerald-700 flex items-center gap-2 text-xs text-emerald-100 animate-pulse">
                <Activity size={16} className="animate-spin" />
                <span>Initializing System... ({Math.floor((Date.now() - isRunningDate) / 1000)}s)</span>
            </div>
        );
    }

    // State 2: Logos NOT Ready -> Hide Completely (User Requirement)
    if (!status.ready) {
        return null;
    }

    // State 3: Logos Ready -> Show Config Button
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bg-slate-800/80 hover:bg-slate-700 text-slate-400 p-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-2 text-xs"
            >
                <Clock size={16} />
                <span>Watcher Config</span>
            </button>
        );
    }

    // Expanded Config Panel
    return (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl w-64 space-y-4 relative">
            <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2 text-slate-500 hover:text-white">✕</button>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Timer size={16} className="text-orange-400" />
                Watcher Timers
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Startup Delay (Mins)</label>
                    <input
                        type="number"
                        min="5"
                        value={config.bufferMinutes}
                        onChange={(e) => setConfig({ ...config, bufferMinutes: parseInt(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Wait time before first check</p>
                </div>

                <div>
                    <label className="text-xs text-slate-400 block mb-1">Check Interval (Mins)</label>
                    <input
                        type="number"
                        min="5"
                        value={config.intervalMinutes}
                        onChange={(e) => setConfig({ ...config, intervalMinutes: parseInt(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Time between cycles</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-2 rounded flex items-center justify-center gap-2 text-xs"
                >
                    {isSaving ? "Saving..." : <><Save size={14} /> Save Configuration</>}
                </button>

                <div className="pt-2 border-t border-slate-800">
                    <button
                        onClick={handleRunInit}
                        className="w-full text-indigo-400 hover:text-indigo-300 text-[10px] flex items-center justify-center gap-1 py-1 font-medium"
                    >
                        🚀 Run System Initialization
                    </button>
                </div>
            </div>
        </div>
    );
};
