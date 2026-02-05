import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { BarChart3, TrendingUp, Users, Target, Clock } from 'lucide-react';

interface StateVariant {
    block: string;
    variant: string;
}

interface LeaderboardItem {
    stateHash: string;
    timestamp: string;
    views: number;
    clicks: number;
    leads: number;
    sales?: number;
    cr: string;
    variants: StateVariant[];
}

export const StateAnalytics: React.FC = () => {
    const { workspaceId } = useWorkspace();
    const [current, setCurrent] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // Fetch Leaderboard
                // Fetch Leaderboard
                const resLeader = await fetch('http://localhost:3001/api/analytics/leaderboard', { headers: { 'x-workspace-id': workspaceId } });
                if (resLeader.ok) {
                    const data = await resLeader.json();
                    setLeaderboard(data);
                }

                // Fetch Current State
                // Fetch Current State
                const resCurrent = await fetch('http://localhost:3001/api/analytics/current', { headers: { 'x-workspace-id': workspaceId } });
                if (resCurrent.ok) {
                    const data = await resCurrent.json();
                    setCurrent(data);
                }

            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 5000); // 5s refresh for live data
        return () => clearInterval(interval);
    }, [workspaceId]);

    if (loading) return <div className="p-8 text-white/50 animate-pulse">Synchronizing State Intelligence...</div>;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-400">
                        <TrendingUp size={18} />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Live Intelligence</span>
                    </div>
                    <h1 className="text-5xl font-black uppercase tracking-tighter text-white">State Leaderboard</h1>
                    <p className="text-white/40 text-sm max-w-xl">
                        Real-time tracking of the current active configuration vs historical performance.
                    </p>
                </div>
            </div>

            {/* NEW: Current State "Live" Card */}
            {current && (
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Target size={120} className="text-blue-500" />
                    </div>

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-300">Active Deployment</span>
                        <span className="font-mono text-xs text-white/50 bg-white/5 px-2 py-1 rounded">#{current.stateHash.substring(0, 8)}</span>
                        <span className="ml-auto text-[10px] uppercase font-bold text-white/20 tracking-widest">Source: Real-time Database</span>
                    </div>

                    <div className="grid grid-cols-4 gap-8 relative z-10">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">State Views</p>
                            <p className="text-4xl font-black text-white">{current.metrics.views}</p>
                            <div className="text-[10px] text-white/30 mt-1 space-x-2">
                                <span title="Hero Views">H: {current.metrics.hero_views}</span>
                                <span title="Proof Views">P: {current.metrics.proof_views}</span>
                                <span title="Offer Views">O: {current.metrics.offer_views}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-1">Leads (Interest)</p>
                            <p className="text-4xl font-black text-blue-400">{current.business.leads}</p>
                            <p className="text-[10px] text-blue-400/50 mt-1">Contact + Intent Forms</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 mb-1">Sales (Conversion)</p>
                            <p className="text-4xl font-black text-emerald-400">{current.business.sales}</p>
                            <p className="text-[10px] text-emerald-400/50 mt-1">Offer Claim Submissions</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Conversion Rate</p>
                            <div className="flex flex-col items-end">
                                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50">
                                    {current.business.cr}<span className="text-2xl text-white/30">%</span>
                                </p>
                                <p className="text-[10px] font-mono text-white/30 mt-1">
                                    (Sales / Views) * 100
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />

            {/* Historical Leaderboard Table */}
            <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-white/40" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Historical Performance</h3>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                            <th className="px-6 py-4">Page State</th>
                            <th className="px-6 py-4">Active Variants</th>
                            <th className="px-6 py-4 text-center">Views</th>
                            <th className="px-6 py-4 text-center">Leads</th>
                            <th className="px-6 py-4 text-center">Sales</th>
                            <th className="px-6 py-4 text-right">Conv. Rate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {leaderboard.map((item) => (
                            <tr key={item.stateHash} className={`group transition-colors ${item.stateHash === current?.stateHash ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'hover:bg-white/[0.02]'}`}>
                                <td className="px-6 py-6 font-mono text-xs">
                                    <div className="flex flex-col">
                                        <span className="text-white/80 group-hover:text-blue-400 transition-colors uppercase font-bold tracking-widest">
                                            #{item.stateHash.substring(0, 8)}
                                        </span>
                                        <span className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                                            <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    <div className="flex flex-wrap gap-2">
                                        {item.variants.map((v, i) => (
                                            <div key={i} className="px-2 py-1 bg-white/5 rounded-md border border-white/5 text-[10px] flex items-center gap-1.5 whitespace-nowrap">
                                                <span className="opacity-40 uppercase tracking-tighter">{v.block}:</span>
                                                <span className="font-bold text-white/70">{v.variant.split('_').pop()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center font-bold text-white/60">{item.views.toLocaleString()}</td>
                                <td className="px-6 py-6 text-center font-bold text-blue-400">{item.leads.toLocaleString()}</td>
                                <td className="px-6 py-6 text-center font-bold text-emerald-400">{item.sales !== undefined ? item.sales.toLocaleString() : '-'}</td>
                                <td className="px-6 py-6 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className={`text-xl font-black ${parseFloat(item.cr) > 5 ? 'text-emerald-400' : 'text-white'}`}>
                                            {item.cr}%
                                        </span>
                                        <div className="w-24 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${Math.min(parseFloat(item.cr) * 5, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Empty State */}
            {leaderboard.length === 0 && !loading && (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-3xl">
                    <Users className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40 uppercase tracking-widest font-bold">No state data recorded yet</p>
                </div>
            )}
        </div>
    );
};
