import React from 'react';
import { Type as TypeIcon, Palette, Target, Edit2, Check, Sparkles } from 'lucide-react';
import type { BrandDNA } from '@shared/types';

interface ProgressPanelProps {
    brandDNA: BrandDNA;
    onEditRequest: (field: string) => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({
    brandDNA,
    onEditRequest
}) => {
    const hasName = brandDNA?.name && brandDNA.name.length > 0;
    const hasMission = brandDNA?.mission && brandDNA.mission.length > 0;
    const hasFont = brandDNA?.typography && brandDNA.typography.length > 0;
    const hasColors = brandDNA?.colors && brandDNA.colors.length > 0;
    const hasVoice = brandDNA?.voice && brandDNA.voice.length > 0;

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center text-slate-200">
                    <Target className="mr-2 w-5 h-5 text-teal-400" />
                    Brand DNA Progress
                </h2>
                <div className="text-xs text-slate-500">
                    {[hasName, hasMission, hasFont, hasColors].filter(Boolean).length} / 4 complete
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
                {/* Brand Name */}
                <ProgressItem
                    label="Brand Name"
                    value={brandDNA?.name}
                    isComplete={hasName}
                    icon={<Sparkles size={16} />}
                    onEdit={() => onEditRequest('brand name')}
                />

                {/* Mission */}
                <ProgressItem
                    label="Mission"
                    value={brandDNA?.mission}
                    isComplete={hasMission}
                    icon={<Target size={16} />}
                    onEdit={() => onEditRequest('mission')}
                    isLong
                />

                {/* Typography */}
                <ProgressItem
                    label="Typography"
                    value={brandDNA?.typography?.[0]}
                    isComplete={hasFont}
                    icon={<TypeIcon size={16} />}
                    onEdit={() => onEditRequest('font')}
                    preview={
                        hasFont && (
                            <div
                                className="text-2xl mt-2 text-white"
                                style={{ fontFamily: `"${brandDNA.typography[0]}", sans-serif` }}
                            >
                                {brandDNA.name || 'Sample Text'}
                            </div>
                        )
                    }
                />

                {/* Colors */}
                <ProgressItem
                    label="Color Palette"
                    value={hasColors ? `${brandDNA.colors.length} colors` : undefined}
                    isComplete={hasColors}
                    icon={<Palette size={16} />}
                    onEdit={() => onEditRequest('colors')}
                    preview={
                        hasColors && (
                            <div className="flex gap-2 mt-2">
                                {brandDNA.colors.map((color, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <div
                                            className="w-8 h-8 rounded-lg shadow-md ring-1 ring-white/10"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="text-[9px] text-slate-500 mt-1 font-mono">{color}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    }
                />

                {/* Voice */}
                <ProgressItem
                    label="Brand Voice"
                    value={brandDNA?.voice}
                    isComplete={hasVoice}
                    icon={<Sparkles size={16} />}
                    onEdit={() => onEditRequest('voice')}
                />
            </div>

            {/* Summary */}
            {(hasName || hasFont || hasColors) && (
                <div className="mt-6 pt-4 border-t border-slate-700">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Brand Preview
                    </h3>
                    <div
                        className="p-4 rounded-xl"
                        style={{
                            background: hasColors && brandDNA.colors[0] ? brandDNA.colors[0] : '#3b82f6'
                        }}
                    >
                        <h4
                            className="text-2xl font-bold text-white"
                            style={{ fontFamily: hasFont ? `"${brandDNA.typography[0]}", sans-serif` : 'inherit' }}
                        >
                            {hasName ? brandDNA.name : 'Your Brand'}
                        </h4>
                        {hasMission && (
                            <p className="text-white/80 text-sm mt-1">{brandDNA.mission}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ProgressItemProps {
    label: string;
    value?: string;
    isComplete: boolean;
    icon: React.ReactNode;
    onEdit: () => void;
    isLong?: boolean;
    preview?: React.ReactNode;
}

const ProgressItem: React.FC<ProgressItemProps> = ({
    label,
    value,
    isComplete,
    icon,
    onEdit,
    isLong,
    preview
}) => {
    return (
        <div className={`p-4 rounded-xl border transition-all ${isComplete
            ? 'bg-slate-700/50 border-teal-800/50'
            : 'bg-slate-800/30 border-slate-700/50 opacity-60'
            }`}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                    {icon}
                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>

                <div className="flex items-center gap-2">
                    {isComplete && (
                        <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                        </div>
                    )}
                    {isComplete && (
                        <button
                            onClick={onEdit}
                            className="p-1 text-slate-500 hover:text-white transition-colors"
                            title="Edit"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {isComplete && value && (
                <div className={`mt-2 ${isLong ? 'text-sm text-slate-300' : 'text-lg font-semibold text-white'}`}>
                    {value}
                </div>
            )}

            {preview}

            {!isComplete && (
                <div className="mt-2 text-xs text-slate-500 italic">
                    Waiting for input...
                </div>
            )}
        </div>
    );
};
