import React from 'react';
import { Type as TypeIcon, Palette, Code, MousePointerClick, Sparkles } from 'lucide-react';
import type { FontSuggestion, ColorPalette } from '@shared/types';

interface VisualCanvasProps {
    mode: 'none' | 'fonts' | 'colors';
    fontSuggestions: FontSuggestion[];
    colorSuggestions: ColorPalette[];
    previewText: string;
    onFontSelect: (fontName: string) => void;
    onColorSelect: (paletteName: string) => void;
    isProcessing?: boolean;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
    mode,
    fontSuggestions,
    colorSuggestions,
    previewText,
    onFontSelect,
    onColorSelect,
    isProcessing = false
}) => {
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
        <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-2xl h-full flex flex-col overflow-hidden relative" >
            {/* Mode indicator */}
            < div className="flex items-center justify-between mb-4" >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {mode === 'fonts' && <TypeIcon className="w-4 h-4 text-purple-600" />}
                    {mode === 'colors' && <Palette className="w-4 h-4 text-orange-600" />}
                    {mode === 'none' && <Code className="w-4 h-4 text-slate-600" />}
                    <span>
                        {mode === 'fonts' ? 'Reviewing Fonts' : mode === 'colors' ? 'Reviewing Palettes' : 'Visual Canvas'}
                    </span>
                </div>

                {mode !== 'none' && (
                    <span className="text-xs text-purple-600 flex items-center gap-1">
                        <MousePointerClick size={12} />
                        Click to select
                    </span>
                )}
            </div >

            <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}>
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
