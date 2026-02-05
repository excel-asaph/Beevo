import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ArrowRight, Sparkles, Search, PlusCircle, History, LayoutDashboard } from 'lucide-react';
import { useBrandStore } from '../../stores/useBrandStore';
import { useWorkspace } from '../../context/WorkspaceContext';

interface LocalBrand {
    name: string;
    lastActive: number;
}

export const WorkspaceLanding: React.FC = () => {
    const { userId, getWorkspaceForBrand, setWorkspaceId } = useWorkspace();

    const [brandName, setBrandName] = useState('');
    const [recentBrands, setRecentBrands] = useState<LocalBrand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [exists, setExists] = useState<boolean | null>(null);

    const setPhase = useBrandStore(state => state.setPhase);
    const updateDNA = useBrandStore(state => state.updateDNA);
    const setProjectName = useBrandStore(state => state.setProjectName);

    // Fetch real workspaces from server on mount
    useEffect(() => {
        const fetchRecentBrands = async () => {
            try {
                const response = await fetch('/api/workspaces');
                if (response.ok) {
                    const data = await response.json();
                    // Filter by current User ID and map to friendly names
                    const userBrands = data
                        .filter((ws: any) => ws.id.startsWith(userId))
                        .map((ws: any) => {
                            // Extract name after the first underscore
                            const parts = ws.id.split('_');
                            const slug = parts.length > 1 ? parts.slice(1).join(' ') : ws.id;
                            const friendlyName = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

                            return {
                                name: friendlyName,
                                lastActive: new Date(ws.lastActive).getTime()
                            };
                        })
                        .sort((a: any, b: any) => b.lastActive - a.lastActive);

                    setRecentBrands(userBrands);
                }
            } catch (err) {
                console.warn("Failed to fetch workspaces:", err);
            }
        };
        fetchRecentBrands();
    }, [userId]);

    // Check for existence whenever name changes
    useEffect(() => {
        const checkExistence = async () => {
            if (!brandName.trim() || brandName.length < 2) {
                setExists(null);
                return;
            }

            const wsId = getWorkspaceForBrand(brandName);
            try {
                const response = await fetch(`/api/workspaces/check/${wsId}`);
                if (response.ok) {
                    const data = await response.json();
                    setExists(data.exists);
                }
            } catch (err) {
                console.error("Check failed:", err);
            }
        };

        const timer = setTimeout(checkExistence, 300);
        return () => clearTimeout(timer);
    }, [brandName, getWorkspaceForBrand]);


    const handleLaunch = async (nameToLaunch: string) => {
        const name = nameToLaunch.trim();
        if (!name || name.length < 2) {
            setError('Please enter a valid brand name');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const wsId = getWorkspaceForBrand(name);
            const response = await fetch(`/api/workspaces/check/${wsId}`);
            const data = await response.json();

            // Set state and navigate
            setWorkspaceId(wsId);
            updateDNA({ name: { value: name, isSelected: false } });
            setProjectName(name);

            if (data.exists) {
                setPhase('canvas');
            } else {
                setPhase('onboarding');
            }
        } catch (err) {
            console.error(err);
            setError('Connection failed. Is the server running?');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden text-slate-200">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.15),transparent_70%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:48px_48px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full relative z-10 space-y-12"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20">
                            <Brain className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white italic tracking-tighter leading-none">BEEVO</h1>
                            <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">Autonomous CMO</p>
                        </div>
                    </div>
                </div>

                {/* Continue Section (Recents) */}
                <AnimatePresence>
                    {recentBrands.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <History size={14} /> Continue Creating
                                </h3>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                                {recentBrands.map((brand) => (
                                    <button
                                        key={brand.name}
                                        onClick={() => handleLaunch(brand.name)}
                                        className="flex-shrink-0 group relative bg-slate-900 border border-white/5 hover:border-indigo-500/50 p-5 rounded-3xl transition-all w-[180px] text-left overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <LayoutDashboard className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 mb-4 transition-colors" />
                                        <p className="text-white font-bold truncate text-sm">{brand.name}</p>
                                        <div className="flex items-center mt-2 group-hover:translate-x-1 transition-transform">
                                            <span className="text-indigo-400 text-[9px] font-black uppercase tracking-widest">Resume</span>
                                            <ArrowRight size={10} className="ml-1 text-indigo-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Action Section */}
                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-12 shadow-3xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

                    <div className="mb-12 text-center md:text-left">
                        <h2 className="text-3xl font-black text-white italic tracking-tight">New Brand</h2>
                        <p className="text-slate-400 text-sm font-medium mt-1">Initialize your brand identity to begin the discovery.</p>
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleLaunch(brandName); }}
                        className="space-y-8"
                    >
                        <div className="relative group/input">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                            <input
                                autoFocus
                                type="text"
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                placeholder="e.g. Acme Corp"
                                className="w-full bg-slate-950/50 border border-white/5 focus:border-indigo-500/50 rounded-[1.5rem] py-7 pl-16 pr-6 text-white text-2xl font-bold placeholder-slate-800 outline-none transition-all shadow-inner"
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs font-bold text-center px-4">{error}</p>
                        )}

                        <div className="h-6 flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                {exists === true && (
                                    <motion.div
                                        key="found"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center space-x-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-4 py-1.5 rounded-full"
                                    >
                                        <Sparkles size={14} className="animate-pulse" />
                                        <span>Brand Detected • Straight to Canvas</span>
                                    </motion.div>
                                )}
                                {exists === false && (
                                    <motion.div
                                        key="new"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center space-x-2 text-indigo-400 text-xs font-bold bg-indigo-500/10 px-4 py-1.5 rounded-full"
                                    >
                                        <PlusCircle size={14} />
                                        <span>Ready to Initialize</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button
                            disabled={isLoading || !brandName.trim()}
                            className={`
                                w-full py-6 rounded-[1.5rem] font-black text-xl tracking-tight
                                flex items-center justify-center space-x-3 
                                transition-all active:scale-[0.98] disabled:opacity-10
                                shadow-2xl
                                ${exists ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-white text-slate-950 hover:bg-slate-100'}
                            `}
                        >
                            {isLoading ? (
                                <div className="w-7 h-7 border-3 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>{exists ? 'Enter Workspace' : 'Initialize Brand'}</span>
                                    <ArrowRight className="w-6 h-6" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Metadata */}
                <div className="flex flex-col items-center space-y-4 opacity-40">
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">
                        BEEVO CORE ENGINE v1.2 • {userId}
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default WorkspaceLanding;
