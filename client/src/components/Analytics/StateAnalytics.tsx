import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { TrendingUp, Users, Target, Clock } from 'lucide-react';

/**
 * Represents a variation of a block active in a specific state.
 */
interface StateVariant {
    block: string;
    variant: string;
}

/**
 * Represents a historical state record in the leaderboard.
 */
interface LeaderboardItem {
    /** Unique hash representing the state configuration. */
    stateHash: string;
    /** Time when this state was recorded. */
    timestamp: string;
    /** Number of views for this state. */
    views: number;
    /** Number of clicks recorded. */
    clicks: number;
    /** Number of leads generated. */
    leads: number;
    /** Number of sales generated. */
    sales?: number;
    /** Conversion rate percentage (as a string). */
    cr: string;
    /** List of active variants in this state. */
    variants: StateVariant[];
}

/**
 * A comprehensive analytics dashboard for tracking state performance.
 * 
 * Features:
 * - Real-time "Active Deployment" card with live metrics.
 * - Historical leaderboard comparing different state configurations.
 * - Visualization of conversion rates and engagement metrics.
 */
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
                const resLeader = await fetch('/api/analytics/leaderboard', { headers: { 'x-workspace-id': workspaceId } });
                if (resLeader.ok) {
                    const data = await resLeader.json();
                    setLeaderboard(data);
                }

                // Fetch Current State
                // Fetch Current State
                const resCurrent = await fetch('/api/analytics/current', { headers: { 'x-workspace-id': workspaceId } });
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

    if (loading) return <div className="flex items-center justify-center h-[600px] text-gray-400 animate-pulse">Synchronizing State Intelligence...</div>;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="sticky top-0 bg-white z-20 px-10 pt-10 pb-6 border-b border-gray-100/50 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-600">
                        <TrendingUp size={18} />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Live Intelligence</span>
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-900">State Leaderboard</h1>
                    <p className="text-gray-500 text-sm max-w-xl">
                        Real-time tracking of the current active configuration vs historical performance.
                    </p>
                </div>
            </div>

            <div className="px-10 pb-10 space-y-8">

                {/* NEW: Current State "Live" Card */}
                {current && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Target size={120} className="text-blue-600" />
                        </div>

                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                            <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Active Deployment</span>
                            <span className="font-mono text-xs text-blue-800 bg-blue-100 px-2 py-1 rounded">#{current.stateHash.substring(0, 8)}</span>
                            <span className="ml-auto text-[10px] uppercase font-bold text-blue-400 tracking-widest">Source: Real-time Database</span>
                        </div>

                        <div className="grid grid-cols-4 gap-8 relative z-10">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">State Views</p>
                                <p className="text-4xl font-black text-gray-900">{current.metrics.views}</p>
                                <div className="text-[10px] text-gray-400 mt-1 space-x-2 font-medium">
                                    <span title="Hero Views">H: {current.metrics.hero_views}</span>
                                    <span title="Proof Views">P: {current.metrics.proof_views}</span>
                                    <span title="Offer Views">O: {current.metrics.offer_views}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-1">Leads (Interest)</p>
                                <p className="text-4xl font-black text-blue-600">{current.business.leads}</p>
                                <p className="text-[10px] text-blue-500/70 mt-1">Contact + Intent Forms</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">Sales (Conversion)</p>
                                <p className="text-4xl font-black text-emerald-600">{current.business.sales}</p>
                                <p className="text-[10px] text-emerald-500/70 mt-1">Offer Claim Submissions</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Conversion Rate</p>
                                <div className="flex flex-col items-end">
                                    <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-gray-900 to-gray-600">
                                        {current.business.cr}<span className="text-2xl text-gray-300">%</span>
                                    </p>
                                    <p className="text-[10px] font-mono text-gray-400 mt-1">
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
                    <Clock size={16} className="text-gray-400" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Historical Performance</h3>
                </div>

                <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                <th className="px-6 py-4">Page State</th>
                                <th className="px-6 py-4">Active Variants</th>
                                <th className="px-6 py-4 text-center">Views</th>
                                <th className="px-6 py-4 text-center">Leads</th>
                                <th className="px-6 py-4 text-center">Sales</th>
                                <th className="px-6 py-4 text-right">Conv. Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {leaderboard.map((item) => (
                                <tr key={item.stateHash} className={`group transition-colors ${item.stateHash === current?.stateHash ? 'bg-blue-50 hover:bg-blue-100/50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-6 font-mono text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-gray-700 group-hover:text-blue-600 transition-colors uppercase font-bold tracking-widest">
                                                #{item.stateHash.substring(0, 8)}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                                <Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-wrap gap-2">
                                            {item.variants.map((v, i) => (
                                                <div key={i} className="px-2 py-1 bg-gray-100 rounded-md border border-gray-200 text-[10px] flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="opacity-50 uppercase tracking-tighter text-gray-600">{v.block}:</span>
                                                    <span className="font-bold text-gray-800">{(v.variant || "N/A").split('_').pop()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center font-bold text-gray-600">{item.views.toLocaleString()}</td>
                                    <td className="px-6 py-6 text-center font-bold text-blue-600">{item.leads.toLocaleString()}</td>
                                    <td className="px-6 py-6 text-center font-bold text-emerald-600">{item.sales !== undefined ? item.sales.toLocaleString() : '-'}</td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-xl font-black ${parseFloat(item.cr) > 5 ? 'text-emerald-500' : 'text-gray-900'}`}>
                                                {item.cr}%
                                            </span>
                                            <div className="w-24 h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
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
                    <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                        <Users className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-gray-400 uppercase tracking-widest font-bold">No state data recorded yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};
