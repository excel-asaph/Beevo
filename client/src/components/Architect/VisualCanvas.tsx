import React, { useState } from 'react';
import { Type as TypeIcon, Palette, Code, MousePointerClick, Sparkles, BookOpen, ChevronDown, ChevronUp, Search, Zap, LayoutTemplate } from 'lucide-react';
import type { FontSuggestion, ColorPalette } from '@shared/types';

interface LogoConcept {
    id: string;
    url: string;
    source: string;
    style: string;
    mood: string;
    reasoning: string;
    alt_text: string;
}

interface ResearchProgress {
    isResearching: boolean;
    phase: 'starting' | 'browsing' | 'analyzing' | 'complete';
    source: string;
    progress: number;
    message: string;
}

interface LogoResearchInsights {
    dominantStyles: string[];
    commonPatterns: string[];
    recommendation: string;
}

interface VisualCanvasProps {
    mode: 'none' | 'fonts' | 'colors' | 'logos';
    fontSuggestions: FontSuggestion[];
    colorSuggestions: ColorPalette[];
    logoSuggestions?: LogoConcept[];
    logoResearchInsights?: LogoResearchInsights;
    previewText: string;
    onFontSelect: (fontName: string) => void;
    onColorSelect: (paletteName: string) => void;
    onLogoSelect?: (logoId: string, style: string) => void;
    isProcessing?: boolean;
    researchProgress?: ResearchProgress;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
    mode,
    fontSuggestions,
    colorSuggestions,
    logoSuggestions = [],
    logoResearchInsights,
    previewText,
    onFontSelect,
    onColorSelect,
    onLogoSelect,
    isProcessing = false,
    researchProgress
}) => {
    // Local state for expandable views
    const [isReportExpanded, setIsReportExpanded] = useState(false);

    // Dynamically load Google Fonts
    React.useEffect(() => {
        if (mode !== 'fonts' || !fontSuggestions.length) return;

        const fontFamilies = fontSuggestions
            .map(f => f.name.trim().replace(/\s+/g, '+'))
            .join('&family=');

        if (!fontFamilies) return;

        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        return () => {
            document.head.removeChild(link);
        };
    }, [mode, fontSuggestions]);

    return (
        <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-2xl h-full flex flex-col overflow-hidden relative">
            {/* Mode indicator */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {mode === 'fonts' && <TypeIcon className="w-4 h-4 text-purple-600" />}
                    {mode === 'colors' && <Palette className="w-4 h-4 text-orange-600" />}
                    {mode === 'logos' && <LayoutTemplate className="w-4 h-4 text-indigo-600" />}
                    {mode === 'none' && <Code className="w-4 h-4 text-slate-600" />}
                    <span>
                        {mode === 'fonts' ? 'Reviewing Fonts' :
                            mode === 'colors' ? 'Reviewing Palettes' :
                                mode === 'logos' ? 'Logo Inspiration' :
                                    'Visual Canvas'}
                    </span>
                </div>

                {mode !== 'none' && (
                    <span className="text-xs text-purple-600 flex items-center gap-1">
                        <MousePointerClick size={12} />
                        Click to select
                    </span>
                )}
            </div>

            <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'opacity-100'} scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-2`}>
                {/* Font Suggestions */}
                {mode === 'fonts' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">Typography Options</h3>
                            <p className="text-slate-500 text-sm">Preview: "{previewText}"</p>
                        </div>

                        {fontSuggestions.map((font, idx) => (
                            <div
                                key={idx}
                                onClick={() => onFontSelect(font.name)}
                                className="p-5 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:shadow-xl transition-all cursor-pointer group bg-slate-50 relative"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 text-white p-1.5 rounded-full">
                                    <MousePointerClick size={14} />
                                </div>

                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xl font-bold text-slate-800">{font.name}</span>
                                    <span className="px-2 py-1 bg-white text-xs font-bold uppercase tracking-wider text-slate-500 rounded border border-slate-200">
                                        {font.category}
                                    </span>
                                </div>

                                <h4
                                    className="text-4xl mb-3 leading-tight text-slate-900"
                                    style={{ fontFamily: `"${font.name}", sans-serif` }}
                                >
                                    {previewText}
                                </h4>

                                <p
                                    className="text-lg text-slate-600 mb-3"
                                    style={{ fontFamily: `"${font.name}", sans-serif` }}
                                >
                                    The quick brown fox jumps over the lazy dog.
                                </p>

                                <div className="flex items-center text-xs text-slate-400 pt-2 border-t border-slate-200">
                                    <Sparkles className="w-3 h-3 mr-1 text-purple-400" />
                                    <span className="italic">"{font.reasoning}"</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Color Suggestions */}
                {mode === 'colors' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-800 mb-1">Palette Options</h3>
                            <p className="text-slate-500 text-sm">Click to apply to your Brand DNA</p>
                        </div>

                        {colorSuggestions.map((palette, idx) => (
                            <div
                                key={idx}
                                onClick={() => onColorSelect(palette.name)}
                                className="border-2 border-slate-200 rounded-xl overflow-hidden hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer group relative"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur text-white p-1.5 rounded-full">
                                    <MousePointerClick size={14} />
                                </div>

                                <div className="h-24 flex">
                                    {palette.colors.map((color, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 h-full flex items-end justify-center pb-2 group/color relative"
                                            style={{ backgroundColor: color }}
                                        >
                                            <span className="text-[10px] font-mono uppercase bg-black/20 text-white px-1 rounded opacity-0 group-hover/color:opacity-100 transition-opacity">
                                                {color}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-white">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-lg text-slate-800">{palette.name}</h4>
                                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                            {palette.vibe}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Logo Discovery Grid */}
                {mode === 'logos' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-4 flex items-end justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1">Logo Discovery</h3>
                                <p className="text-slate-500 text-sm">Real-world brand inspiration from verified sources</p>
                            </div>

                            {/* Research Report Toggle - Matches user Mockup */}
                            {logoResearchInsights && (
                                <button
                                    onClick={() => setIsReportExpanded(!isReportExpanded)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <BookOpen size={14} />
                                    {isReportExpanded ? 'Collapse Report' : 'View Research'}
                                    {isReportExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                            )}
                        </div>

                        {/* Research Report Card - Expandable */}
                        {logoResearchInsights && isReportExpanded && (
                            <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                                <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Search size={16} className="text-indigo-600" />
                                        Research Findings
                                    </h4>
                                </div>
                                <div className="p-5 bg-white space-y-5">
                                    {/* Methodology */}
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Methodology</h5>
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            Analyzed {logoSuggestions.length || 12} leading brands from Dribbble, Behance, and official brand sites matching the current brand directions.
                                        </p>
                                    </div>

                                    {/* Findings */}
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Key Findings</h5>
                                        <ul className="space-y-2">
                                            {logoResearchInsights.dominantStyles.map((style, i) => (
                                                <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                                    {style}
                                                </li>
                                            ))}
                                            {logoResearchInsights.commonPatterns.map((pattern, i) => (
                                                <li key={`pat-${i}`} className="text-sm text-slate-700 flex items-start gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                                                    {pattern}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Recommendation */}
                                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                        <h5 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Zap size={12} />
                                            Active Recommendation
                                        </h5>
                                        <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                                            {logoResearchInsights.recommendation}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {logoSuggestions.length === 0 ? (
                            <div className="text-center py-12">
                                {researchProgress?.isResearching ? (
                                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8">
                                        {/* Progress Circle */}
                                        <div className="relative w-24 h-24 mx-auto mb-6">
                                            <svg className="w-24 h-24 transform -rotate-90">
                                                <circle
                                                    cx="48" cy="48" r="40"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="none"
                                                    className="text-slate-200"
                                                />
                                                <circle
                                                    cx="48" cy="48" r="40"
                                                    stroke="currentColor"
                                                    strokeWidth="8"
                                                    fill="none"
                                                    strokeDasharray={`${(researchProgress.progress / 100) * 251.2} 251.2`}
                                                    className="text-purple-600 transition-all duration-500"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-xl font-bold text-purple-600">{researchProgress.progress}%</span>
                                            </div>
                                        </div>

                                        {/* Phase Indicator */}
                                        <div className="flex items-center justify-center gap-2 mb-3">
                                            <div className={`w-2 h-2 rounded-full ${researchProgress.phase === 'browsing' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                                            <span className="text-sm font-medium text-slate-600">
                                                {researchProgress.phase === 'starting' && 'Launching browser agent...'}
                                                {researchProgress.phase === 'browsing' && `Browsing ${researchProgress.source}...`}
                                                {researchProgress.phase === 'analyzing' && 'Analyzing with Gemini 3...'}
                                            </span>
                                        </div>

                                        {/* Message */}
                                        <p className="text-sm text-slate-500">{researchProgress.message}</p>
                                    </div>
                                ) : (
                                    <p className="text-slate-400">Searching for logo inspiration...</p>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {logoSuggestions.map((logo) => (
                                    <div
                                        key={logo.id}
                                        onClick={() => onLogoSelect?.(logo.id, logo.style)}
                                        className="group bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-500 cursor-pointer overflow-hidden transform hover:-translate-y-1"
                                    >
                                        {/* Logo Image Container */}
                                        <div className="aspect-square flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
                                            {/* Subtle background pattern */}
                                            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,_#000_1px,_transparent_1px)] bg-[length:16px_16px]" />

                                            <img
                                                src={logo.url}
                                                alt={logo.alt_text || logo.source}
                                                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 relative z-10"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Better fallback SVG with brand initial
                                                    const initial = (logo.source || 'L').charAt(0).toUpperCase();
                                                    e.currentTarget.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect fill="#f1f5f9" width="120" height="120" rx="12"/><text x="60" y="60" font-family="system-ui,-apple-system,sans-serif" font-size="48" font-weight="600" fill="#94a3b8" text-anchor="middle" dy=".35em">${initial}</text></svg>`)}`;
                                                }}
                                            />

                                            {/* Hover overlay with reasoning */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                                                <p className="text-white text-xs leading-tight">{logo.reasoning}</p>
                                            </div>
                                        </div>

                                        {/* Logo Info */}
                                        <div className="p-3 bg-white border-t border-slate-100">
                                            <p className="font-semibold text-sm text-slate-800 truncate">{logo.source}</p>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className="text-xs bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                                    {logo.mood}
                                                </span>
                                                <span className="text-xs text-slate-400 truncate">{logo.style?.split(' ').slice(0, 2).join(' ')}</span>
                                            </div>
                                        </div>

                                        {/* Selection indicator */}
                                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                                            <MousePointerClick className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {mode === 'none' && !isProcessing && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="bg-slate-100 p-6 rounded-full mb-4">
                            <Code className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 mb-2">Visual Canvas Ready</h3>
                        <p className="text-center text-sm max-w-xs">
                            Start the design call to see font and color suggestions appear here as you discuss your brand.
                        </p>
                    </div>
                )}
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
                            </div>
                        </div>
                        <div className="text-slate-800 font-medium animate-pulse">
                            Generating options...
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
