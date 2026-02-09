import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ArrowRight, Sparkles, Plus, Clock, Trash2, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Represents a locally cached or recently accessed brand workspace.
 */
interface LocalBrand {
    /** Unique identifier for the workspace. */
    id: string;
    /** Friendly display name of the brand. */
    name: string;
    /** Timestamp of last activity. */
    lastActive: number;
    /** URL to a thumbnail image for the workspace. */
    thumbnailUrl?: string;
}

/**
 * The entry point / landing page for the application.
 * 
 * Allows users to:
 * - Create a new brand workspace (by entering a name).
 * - view and resume recently accessed workspaces.
 * - Manage existing workspaces (delete).
 */
export const WorkspaceLanding: React.FC = () => {
    const { userId, getWorkspaceForBrand } = useWorkspace();

    const [brandName, setBrandName] = useState('');
    const [recentBrands, setRecentBrands] = useState<LocalBrand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [exists, setExists] = useState<boolean | null>(null);

    // Fetch real workspaces
    useEffect(() => {
        const fetchRecentBrands = async () => {
            try {
                const response = await fetch('/api/workspaces');
                if (response.ok) {
                    const data = await response.json();
                    const userBrands = data
                        .filter((ws: any) => ws.id.startsWith(userId))
                        .map((ws: any) => {
                            const parts = ws.id.split('_');
                            const slug = parts.length > 1 ? parts.slice(1).join(' ') : ws.id;
                            const friendlyName = slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                            return {
                                id: ws.id,
                                name: friendlyName,
                                lastActive: new Date(ws.lastActive).getTime(),
                                thumbnailUrl: ws.thumbnailUrl
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

    // Check existence
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
            console.log(`🚀 Launching workspace: ${wsId}`);

            // ALWAYS attempt creation to ensure folder exists
            // The server handles idempotency (checks if exists internally)
            console.log(`🛠️ Ensuring workspace exists: ${wsId}`);
            await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: wsId })
            });
            console.log(`✅ Creation/Verification complete for ${wsId}`);

            // Small delay for checking filesystem consistency
            await new Promise(resolve => setTimeout(resolve, 500));

            window.location.href = `/?workspace=${wsId}`;
        } catch (err) {
            console.error("Launch failed:", err);
            setError('Connection failed. Is the server running?');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, workspaceId: string) => {
        e.stopPropagation();
        if (confirmDeleteId !== workspaceId) {
            setConfirmDeleteId(workspaceId);
            return;
        }
        setDeletingId(workspaceId);
        try {
            const response = await fetch(`/api/workspaces/${workspaceId}`, {
                method: 'DELETE',
                headers: { 'x-workspace-id': workspaceId }
            });
            if (response.ok) {
                setRecentBrands(prev => prev.filter(b => b.id !== workspaceId));
                setConfirmDeleteId(null);
            } else {
                setError('Failed to delete workspace');
            }
        } catch (err) {
            setError('Connection failed during deletion');
        } finally {
            setDeletingId(null);
        }
    };

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-start p-6 relative overflow-hidden text-slate-200 font-sans selection:bg-yellow-500/30">
            {/* Animated Gradient Background - 'Lovable Style' Mesh */}
            <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
                {/* Top Left - Vibrant Yellow */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.6, 0.5, 0.6],
                        x: [0, 20, 0]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-yellow-600/30 rounded-full blur-[120px]"
                />

                {/* Bottom Right - Deep Amber */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.4, 0.5],
                        x: [0, -30, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[80%] bg-amber-700/20 rounded-full blur-[140px]"
                />

                {/* Bottom Left - Darker Gold */}
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.4, 0.3, 0.4],
                        y: [0, -40, 0]
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute -bottom-[10%] -left-[10%] w-[60%] h-[60%] bg-yellow-800/20 rounded-full blur-[130px]"
                />

                {/* Top Right - Subtle slate/blue contrast to pop the yellow */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[60%] bg-slate-900/80 rounded-full blur-[100px]" />
            </div>

            {/* MAIN CONTAINER */}
            <div className="relative z-10 w-full max-w-5xl flex flex-col items-center mt-20 md:mt-32 space-y-12">

                {/* 1. HERO HEADER */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-6"
                >
                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-yellow-950/30 rounded-full border border-yellow-500/20 mb-4 backdrop-blur-sm">
                        <span className="text-xs font-semibold text-yellow-400">Introducing Beevo</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
                        <span className="text-yellow-400 inline-block bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">Hey</span>, let's build your brand
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        Enter a new brand name or resume your existing campaigns.
                    </p>
                </motion.div>

                {/* 2. THE "LOVABLE" INPUT BOX */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-full max-w-2xl relative group"
                >
                    {/* Glowing Backdrop - Gold/Yellow */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); handleLaunch(brandName); }}
                        className="relative bg-slate-900/80 border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center backdrop-blur-xl"
                    >
                        <div className="pl-4 pr-2 text-slate-500">
                            {exists ? <Sparkles size={24} className="text-yellow-400 animate-pulse" /> : <Plus size={24} />}
                        </div>

                        <input
                            autoFocus
                            type="text"
                            value={brandName}
                            onChange={(e) => setBrandName(e.target.value)}
                            placeholder="Ask Beevo to create a brand..."
                            className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder-slate-500 h-14"
                        />

                        <button
                            disabled={!brandName.trim() || isLoading}
                            className={`
                                h-10 px-4 rounded-xl font-medium text-sm transition-all flex items-center space-x-2 gap-2
                                ${brandName.trim()
                                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20 font-bold'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }
                            `}
                        >
                            <span>{exists ? 'Resume' : 'Generate'}</span>
                            {isLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={16} />}
                        </button>
                    </form>

                    {/* Helper / Status Text */}
                    <div className="absolute top-full left-0 w-full mt-3 text-center h-6">
                        <AnimatePresence>
                            {exists === true && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-xs font-medium text-emerald-400 flex items-center justify-center gap-1"
                                >
                                    <Clock size={12} /> Existing workspace found. Resuming context...
                                </motion.span>
                            )}
                            {error && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-xs font-medium text-red-400"
                                >
                                    {error}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* 3. RECENT WORKSPACES GRID */}
                {recentBrands.length > 0 && (
                    <div className="w-full mt-12">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                                <Clock size={16} /> Recently viewed
                            </h3>
                            <button className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors font-medium">View all</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {recentBrands.map((brand) => (
                                <motion.div
                                    key={brand.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="group relative bg-slate-900/50 border border-white/5 hover:border-yellow-500/30 rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col h-56 shadow-lg hover:shadow-yellow-900/10 backdrop-blur-sm"
                                    onClick={() => handleLaunch(brand.name)}
                                >
                                    {/* Top: Thumbnail Cover */}
                                    <div className="h-32 w-full bg-slate-800 relative overflow-hidden border-b border-white/5">
                                        {brand.thumbnailUrl ? (
                                            <img
                                                src={brand.thumbnailUrl}
                                                alt={brand.name}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-800 group-hover:bg-slate-700/50 transition-colors">
                                                <Brain size={32} className="text-slate-600 group-hover:text-yellow-500/50 transition-colors" />
                                            </div>
                                        )}

                                        {/* Overlay Actions */}
                                        <div className="absolute top-2 right-2 flex gap-1 z-10 transition-opacity opacity-0 group-hover:opacity-100">
                                            {confirmDeleteId === brand.id ? (
                                                <div className="flex bg-black/80 backdrop-blur-md rounded-lg p-1 gap-1 shadow-md border border-white/10" onClick={e => e.stopPropagation()}>
                                                    <button onClick={(e) => handleDelete(e, brand.id)} className="p-1.5 hover:bg-red-900/30 text-red-400 rounded-md transition-colors"><Trash2 size={14} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="p-1.5 hover:bg-slate-800 text-slate-400 rounded-md transition-colors"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(e) => handleDelete(e, brand.id)}
                                                    className="p-2 bg-black/60 hover:bg-black/90 backdrop-blur-md rounded-lg text-slate-400 hover:text-red-400 shadow-sm transition-all border border-white/5"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom: Info */}
                                    <div className="p-4 flex-1 flex flex-col justify-center">
                                        <h4 className="font-semibold text-slate-200 group-hover:text-yellow-400 transition-colors truncate text-base">
                                            {brand.name}
                                        </h4>
                                        <div className="flex items-center text-xs text-slate-500 mt-1 gap-1">
                                            <span>Edited {timeAgo(brand.lastActive)}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* "New Brand" Card Placeholder */}

                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}

        </div>
    );
};

export default WorkspaceLanding;
