import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Play, Sparkles, Loader2, Wand2 } from 'lucide-react';

interface PipelineControlProps {
    onGenerate: (context: string) => Promise<void>;
    onFinalize: () => Promise<void>;
}

export const PipelineControl: React.FC<PipelineControlProps> = ({ onGenerate, onFinalize }) => {
    const [context, setContext] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'GENERATING' | 'BAKING'>('IDLE');

    const handleGenerate = async () => {
        // Allow generation even if context is empty (uses default logic), 
        // but user specifically asked for "more context" feature.
        setStatus('GENERATING');
        await onGenerate(context);
        setStatus('IDLE');
        // Clear context after successful generation? Maybe keep it for reference.
    };

    const handleFinalize = async () => {
        setStatus('BAKING');
        await onFinalize();
        setStatus('IDLE');
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                Logo Pipeline
            </h3>

            <div>
                <label className="text-xs text-slate-400 mb-1 block">Context Override</label>
                <textarea
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none resize-none placeholder-slate-600"
                    rows={3}
                    placeholder="E.g. Make it more geometric, exclude the lightning bolt, use circles..."
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={status !== 'IDLE'}
                    className="w-full text-xs h-8"
                >
                    {status === 'GENERATING' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Generate New
                </Button>

                <Button
                    variant="ghost" // Use ghost or secondary
                    onClick={handleFinalize}
                    disabled={status !== 'IDLE'}
                    className="w-full text-xs h-8 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600"
                >
                    {status === 'BAKING' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    Finalize & Export
                </Button>
            </div>

            {status !== 'IDLE' && (
                <div className="text-xs text-center text-slate-400 animate-pulse bg-slate-900/50 py-1 rounded">
                    {status === 'GENERATING' ? 'Generating 8 variants & Kit...' : 'Baking Transparency & Exporting...'}
                </div>
            )}
        </div>
    );
};
