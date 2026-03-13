"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import BoxCounter from "@/components/BoxCounter";
import AnimatedNumber from "@/components/AnimatedNumber";
import { fetchStats, healthCheck } from "@/lib/api";
import type { DetectionSession } from "@/lib/api";
import Link from "next/link";

const AnalyticsChart = dynamic(() => import("@/components/AnalyticsChart"), { ssr: false, loading: () => <div className="h-48 animate-pulse bg-slate-800/40 rounded-xl" /> });

export default function DashboardPage() {
    const [sessions, setSessions] = useState<DetectionSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const refresh = useCallback(async (manual = false) => {
        if (manual) setIsRefreshing(true);
        try {
            await healthCheck();
            setBackendOnline(true);
        } catch {
            setBackendOnline(false);
        }

        try {
            const data = await fetchStats(50);
            setSessions(data.sessions);
            setLastRefresh(new Date());
        } catch {
            // silently fail
        } finally {
            setLoading(false);
            if (manual) {
                setRefreshKey(prev => prev + 1);
                // Add a tiny artificial delay so the user explicitly sees the reload animation even if backend is lightning fast
                setTimeout(() => setIsRefreshing(false), 400);
            }
        }
    }, []);

    useEffect(() => {
        refresh(false);
        const id = setInterval(() => refresh(false), 30_000); // auto-refresh every 30s
        return () => clearInterval(id);
    }, [refresh]);

    const totalBoxes = sessions.reduce((s, x) => s + x.total_boxes_detected, 0);
    const totalSessions = sessions.length;
    const avgBoxes =
        totalSessions > 0
            ? (sessions.reduce((s, x) => s + x.average_boxes_per_frame, 0) / totalSessions).toFixed(2)
            : "0";

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md -mx-6 px-6 py-4 md:-mx-8 md:px-8 border-b border-slate-800/80 flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Real-time box detection monitoring
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refresh(true)}
                        disabled={isRefreshing}
                        className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700 w-28 text-center disabled:opacity-50"
                    >
                        {isRefreshing ? "↻ Reloading..." : "↻ Refresh"}
                    </button>
                </div>
            </div>

            <div className={`space-y-8 transition-opacity duration-300 ${isRefreshing ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <BoxCounter key={`boxes-${refreshKey}`} count={totalBoxes} label="Total Boxes (All Sessions)" />
                    <div key={`sessions-${refreshKey}`} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-800/40 border border-slate-700">
                        <div className="text-5xl font-extrabold text-blue-300 tabular-nums">
                            <AnimatedNumber value={totalSessions} />
                        </div>
                        <div className="text-slate-400 text-sm mt-2 uppercase tracking-widest font-semibold">Sessions</div>
                    </div>
                    <div key={`avg-${refreshKey}`} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-800/40 border border-slate-700">
                        <div className="text-5xl font-extrabold text-pink-300 tabular-nums">
                            <AnimatedNumber value={parseFloat(avgBoxes as string)} isFloat />
                        </div>
                        <div className="text-slate-400 text-sm mt-2 uppercase tracking-widest font-semibold">Avg / Frame</div>
                    </div>
                </div>

                {/* Analytics Chart */}
                <section key={`chart-${refreshKey}`} className="rounded-2xl bg-slate-900/60 border border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-base font-semibold text-white">Detection Analytics</h2>
                        {lastRefresh && (
                            <span className="text-xs text-slate-500">
                                Updated {lastRefresh.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                    {loading && sessions.length === 0 ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <AnalyticsChart sessions={sessions} />
                    )}
                </section>

                {/* Recent Sessions Table */}
                <section className="rounded-2xl bg-slate-900/60 border border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-white">Recent Sessions</h2>
                        <Link
                            href="/upload"
                            className="text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                        >
                            + New Detection →
                        </Link>
                    </div>
                    {sessions.length === 0 && !loading ? (
                        <p className="text-slate-500 text-sm text-center py-8">
                            No sessions yet. <Link href="/upload" className="text-green-400 hover:underline">Upload a file</Link> to start.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800">
                                        <th className="text-left py-2 pr-4">Source</th>
                                        <th className="text-right py-2 pr-4">Total Boxes</th>
                                        <th className="text-right py-2 pr-4">Frames</th>
                                        <th className="text-right py-2 pr-4">Peak</th>
                                        <th className="text-right py-2">Time</th>
                                    </tr>
                                </thead>
                                <tbody key={`table-${refreshKey}`}>
                                    {sessions.slice(0, 15).map((s, idx) => (
                                        <tr
                                            key={s.session_id}
                                            className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                                            style={{ animationDelay: `${idx * 40}ms` }}
                                        >
                                            <td className="py-2.5 pr-4 text-slate-300 truncate max-w-[160px]">{s.video_source}</td>
                                            <td className="py-2.5 pr-4 text-right font-semibold text-green-300">
                                                <AnimatedNumber value={s.total_boxes_detected} />
                                            </td>
                                            <td className="py-2.5 pr-4 text-right text-slate-400">
                                                <AnimatedNumber value={s.frames_processed} />
                                            </td>
                                            <td className="py-2.5 pr-4 text-right text-pink-300">
                                                <AnimatedNumber value={s.peak_count} />
                                            </td>
                                            <td className="py-2.5 text-right text-slate-500 text-xs">
                                                {new Date(s.started_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
