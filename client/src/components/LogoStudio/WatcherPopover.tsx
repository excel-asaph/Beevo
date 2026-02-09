import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Play, Save, Clock, Check, Info } from 'lucide-react';

/**
 * Props for the WatcherPopover component.
 */
interface WatcherPopoverProps {
    /** Callback to trigger a manual run of the watcher/builder. */
    onRun: () => void;
    /** Callback to close the popover. */
    onClose: () => void;
}

const InfoTooltip = ({ content, children }: { content: string, children: React.ReactNode }) => (
    <div className="relative group flex items-center justify-center cursor-help">
        {children}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-gray-100 border border-gray-200 text-gray-800 text-[10px] font-semibold rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-100" />
        </div>
    </div>
);

/**
 * A compact popover for configuring the background Watcher Agent.
 * 
 * Features:
 * - Configures start delay and check intervals.
 * - Persists settings to the workspace configuration.
 * - Manual trigger for immediate build execution.
 * 
 * @param {WatcherPopoverProps} props - The component props.
 */
export const WatcherPopover: React.FC<WatcherPopoverProps> = ({ onRun, onClose }) => {
    const { workspaceId } = useWorkspace();
    // Use string | number to allow empty state
    const [config, setConfig] = useState<{ bufferMinutes: string | number, intervalMinutes: string | number }>({
        bufferMinutes: 5,
        intervalMinutes: 5
    });
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        // Load Config
        fetch('/api/config/watcher', { headers: { 'x-workspace-id': workspaceId } })
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error("Failed to load watcher settings", err));
    }, [workspaceId]);

    const handleSave = async () => {
        setSaveState('saving');
        try {
            // Convert to numbers before saving
            const payload = {
                bufferMinutes: Number(config.bufferMinutes) || 0,
                intervalMinutes: Number(config.intervalMinutes) || 1
            };

            await fetch('/api/config/watcher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId },
                body: JSON.stringify(payload)
            });

            // Show "Saved!" state
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
        } catch (e) {
            console.error(e);
            setSaveState('idle');
        }
    };

    return (
        <div
            className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-64 space-y-3 relative cursor-auto nodrag nowheel nopan"
            onDoubleClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-gray-600" />
                    <span>Watcher Agent</span>
                </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-medium flex items-center gap-1">
                        Start Delay
                        <InfoTooltip content="Wait time before first agent check">
                            <Info className="w-2.5 h-2.5 text-gray-400 hover:text-gray-600 transition-colors" />
                        </InfoTooltip>
                    </label>
                    <div className="relative nodrag nopan">
                        <input
                            type="number"
                            min="0"
                            value={config.bufferMinutes}
                            onChange={(e) => setConfig({ ...config, bufferMinutes: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 transition-all custom-input-number nodrag nopan"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">min</span>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-medium flex items-center gap-1">
                        Interval
                        <InfoTooltip content="Time between agent cycles">
                            <Info className="w-2.5 h-2.5 text-gray-400 hover:text-gray-600 transition-colors" />
                        </InfoTooltip>
                    </label>
                    <div className="relative nodrag nopan">
                        <input
                            type="number"
                            min="1"
                            value={config.intervalMinutes}
                            onChange={(e) => setConfig({ ...config, intervalMinutes: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300 transition-all custom-input-number nodrag nopan"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">min</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={handleSave}
                    disabled={saveState !== 'idle'}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all duration-200 
                        ${saveState === 'saved'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-transparent'
                        }`}
                >
                    {saveState === 'saving' && <span className="animate-pulse">Saving...</span>}
                    {saveState === 'saved' && <><Check className="w-3 h-3" /> Saved</>}
                    {saveState === 'idle' && <><Save className="w-3 h-3" /> Save</>}
                </button>

                <button
                    onClick={() => {
                        onRun();
                        onClose();
                    }}
                    className="flex-none bg-orange-500 hover:bg-orange-600 text-white rounded-lg p-1.5 transition-colors shadow-sm"
                    title="Build Landing Page"
                >
                    <Play className="w-4 h-4 fill-current" />
                </button>
            </div>

            <style>{`
                /* Hide Spinner in Webkit/Blink */
                .custom-input-number::-webkit-outer-spin-button,
                .custom-input-number::-webkit-inner-spin-button {
                    opacity: 1;
                    height: auto;
                }
            `}</style>
        </div>
    );
};
