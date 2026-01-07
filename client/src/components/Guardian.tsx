import React, { useState } from 'react';
import { useBrand } from '../context/BrandContext';
import { auditAsset } from '../services/gemini';
import { Button } from './ui/Button';
import { Junction } from '@shared/types';
import { ShieldCheck, AlertOctagon, CheckCircle, Crosshair } from 'lucide-react';

export const Guardian: React.FC = () => {
    const { assets, dna, addThought } = useBrand();
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [auditResult, setAuditResult] = useState<any>(null);

    const selectedAsset = assets.find(a => a.id === selectedAssetId);

    const handleAudit = async () => {
        if (!selectedAsset || !dna) return;
        setIsAuditing(true);
        addThought("Guardian Eye Activated. Initiating Pixel-Precise Audit...", Junction.GUARDIAN);

        try {
            const result = await auditAsset(selectedAsset.url, JSON.stringify(dna));
            setAuditResult(result);
            addThought(`Audit Complete. Status: ${result.passed ? 'PASSED' : 'FAILED'}. Issues: ${result.issues?.length}`, Junction.GUARDIAN);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAuditing(false);
        }
    };

    // Convert normalized coords [ymin, xmin, ymax, xmax] to style
    const getBoxStyle = (box: number[]) => ({
        top: `${box[0] * 100}%`,
        left: `${box[1] * 100}%`,
        height: `${(box[2] - box[0]) * 100}%`,
        width: `${(box[3] - box[1]) * 100}%`
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Asset List */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <h2 className="text-xl font-bold mb-4 flex items-center text-teal-400">
                    <ShieldCheck className="mr-2" /> Asset Vault
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {assets.length === 0 && <p className="text-slate-500 text-sm">No assets in vault.</p>}
                    {assets.map(asset => (
                        <div
                            key={asset.id}
                            onClick={() => { setSelectedAssetId(asset.id); setAuditResult(null); }}
                            className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedAssetId === asset.id ? 'border-teal-500 bg-slate-700' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-black rounded overflow-hidden flex-shrink-0">
                                    {asset.type === 'image' ? (
                                        <img src={asset.url} className="w-full h-full object-cover" />
                                    ) : (
                                        <video src={asset.url} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium truncate text-white">{asset.prompt}</p>
                                    <p className="text-xs text-slate-400 capitalize">{asset.type} • {asset.status}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inspection Area */}
            <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-700 p-6 flex flex-col items-center justify-center relative">
                {selectedAsset ? (
                    <>
                        <div className="relative inline-block">
                            {selectedAsset.type === 'image' ? (
                                <img src={selectedAsset.url} className="max-h-[500px] rounded-lg shadow-2xl" alt="To Audit" />
                            ) : (
                                <video src={selectedAsset.url} controls className="max-h-[500px] rounded-lg shadow-2xl" />
                            )}

                            {/* Pixel Precise Overlays */}
                            {auditResult && auditResult.corrections?.map((c: any, i: number) => (
                                <div
                                    key={i}
                                    className="absolute border-2 border-red-500 bg-red-500/20 z-20 animate-pulse"
                                    style={getBoxStyle(c.boundingBox)}
                                >
                                    <span className="absolute -top-6 left-0 bg-red-600 text-white text-xs px-2 py-0.5 rounded shadow whitespace-nowrap">
                                        {c.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 w-full max-w-xl">
                            {!auditResult ? (
                                <Button onClick={handleAudit} isLoading={isAuditing} className="w-full bg-teal-600 hover:bg-teal-500">
                                    <Crosshair className="mr-2" /> Run Pixel-Precise Audit
                                </Button>
                            ) : (
                                <div className={`p-4 rounded-lg border ${auditResult.passed ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'}`}>
                                    <div className="flex items-center mb-2">
                                        {auditResult.passed ? <CheckCircle className="text-green-500 mr-2" /> : <AlertOctagon className="text-red-500 mr-2" />}
                                        <h3 className={`font-bold ${auditResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                                            {auditResult.passed ? 'Asset Verified' : 'Integrity Violated'}
                                        </h3>
                                    </div>
                                    <ul className="text-sm space-y-1 text-slate-300 ml-6 list-disc">
                                        {auditResult.issues?.map((issue: string, i: number) => (
                                            <li key={i}>{issue}</li>
                                        ))}
                                    </ul>
                                    {!auditResult.passed && (
                                        <div className="mt-4 flex justify-end">
                                            <Button variant="secondary" className="text-xs">
                                                Request Auto-Healing (Send to Forge)
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                        <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                        <p>Select an asset to inspect</p>
                    </div>
                )}
            </div>
        </div>
    );
};