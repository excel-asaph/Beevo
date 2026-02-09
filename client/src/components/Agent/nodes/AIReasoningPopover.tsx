import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Data structure representing a single unit of AI reasoning or "thought".
 */
export interface ThoughtSignatureData {
    /** Unique identifier for the thought node. */
    nodeId: string;
    /** Short title or topic of the thought. */
    title: string;
    /** Detailed explanation of the AI's reasoning. */
    reasoning: string;
    /** Confidence score (0-1) associated with this thought. */
    confidence?: number;
}

/**
 * Props for the AIReasoningPopover component.
 */
interface AIReasoningPopoverProps {
    /** List of thought signatures to display. */
    signatures: ThoughtSignatureData[];
    /** Callback to close the popover. */
    onClose: () => void;
}

/**
 * AI Reasoning Popover - Displays thought signatures in InfoTooltip style
 * Design: White bg, Gray/Black accents, Scrollable list, Zoom blocking
 */
export const AIReasoningPopover: React.FC<AIReasoningPopoverProps> = ({ signatures, onClose }) => {

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />
            {/* Popover */}
            {/* Popover */}
            <div
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 cursor-auto nowheel"
                onWheel={(e) => e.stopPropagation()} // Prevent canvas zoom
                onMouseDown={(e) => e.stopPropagation()} // Prevent interactions leaking
            >
                <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-72 flex flex-col max-h-[320px] overflow-hidden">
                    {/* Header */}
                    <div className="flex-none flex items-center gap-2 border-b border-gray-100 p-3 bg-white">
                        <Sparkles className="w-3.5 h-3.5 text-gray-900" />
                        <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wide">
                            AI Reasoning
                        </span>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar overscroll-contain">
                        {signatures.map((sig, index) => {
                            const confidencePercent = Math.round((sig.confidence || 0.9) * 100);
                            return (
                                <div key={sig.nodeId || index} className={`${index > 0 ? 'pt-4 border-t border-gray-100' : ''}`}>
                                    {/* Title */}
                                    <div className="text-xs font-bold text-gray-800 mb-1.5">
                                        {sig.title}
                                    </div>

                                    {/* Reasoning */}
                                    <div className="text-[11px] text-gray-600 leading-relaxed mb-2.5">
                                        {sig.reasoning}
                                    </div>

                                    {/* Confidence Bar */}
                                    <div className="space-y-1 mb-2">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="text-gray-400 uppercase tracking-wider font-semibold">Confidence</span>
                                            <span className="text-gray-800 font-bold">{confidencePercent}%</span>
                                        </div>
                                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gray-700 rounded-full transition-all"
                                                style={{ width: `${confidencePercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Deep Think Badge (No Icon, Soft Dark Text) */}
                                    <div className="text-[10px] text-gray-600 font-medium">
                                        Deep Think
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Arrow pointing down */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e5e7eb;
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d1d5db;
                }
            `}</style>
        </>
    );
};
