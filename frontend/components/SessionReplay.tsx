"use client";

import { useEffect, useState } from "react";
import { fetchStats } from "@/lib/api";

interface Session {
    session_id: string;
    video_source: string;
    started_at: string;
    total_boxes_detected: number;
    frames_processed: number;
    average_boxes_per_frame: number;
    peak_count: number;
}

export default function SessionReplay() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Session | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchStats(30);
                setSessions(data.sessions as unknown as Session[]);
            } catch (e) {
                console.error(e);
                setSessions([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const formatDate = (iso: string) => new Date(iso).toLocaleString();
    const estimatedDuration = (s: Session) => {
        const fps = 5; // sample_fps used in backend
        const seconds = Math.round(s.frames_processed / fps);
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };
    const boxesPerMinute = (s: Session) => {
        const fps = 5;
        const minutes = s.frames_processed / fps / 60;
        return minutes > 0 ? (s.total_boxes_detected / minutes).toFixed(1) : "0";
    };

    if (loading) return <div className="text-slate-400 animate-pulse p-6">Loading sessions...</div>;

    return (
        <div className="space-y-6">
            {selected && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-green-300">▶ Replaying: {selected.video_source}</h2>
                        <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-all">✕ Close</button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm text-center">
                        {[
                            { label: "Total Boxes", value: selected.total_boxes_detected, color: "text-green-400" },
                            { label: "Est. Duration", value: estimatedDuration(selected), color: "text-blue-400" },
                            { label: "Boxes/min", value: boxesPerMinute(selected), color: "text-yellow-400" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="bg-slate-800/60 rounded-xl p-3">
                                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                                <div className="text-slate-500 text-xs mt-1">{label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-center text-slate-500 text-sm py-6 bg-slate-800/30 rounded-xl border border-slate-700/30">
                        <div className="text-3xl mb-2">🎬</div>
                        <p>Session: <code className="text-slate-400 text-xs">{selected.session_id}</code></p>
                        <p className="text-xs mt-1">Detected at: {formatDate(selected.started_at)}</p>
                        <p className="text-xs text-slate-600 mt-2">(Live video replay requires a stored video URL — currently showing session statistics)</p>
                    </div>
                </div>
            )}

            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">Detection Sessions</h2>
                    <span className="text-xs text-slate-500">{sessions.length} sessions</span>
                </div>

                {sessions.length === 0 ? (
                    <div className="p-6 text-slate-500 text-sm text-center">No sessions found. Run a detection first.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                                    <th className="px-5 py-3">Source</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3 text-center">Boxes</th>
                                    <th className="px-5 py-3 text-center">Peak</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s, i) => (
                                    <tr key={s.session_id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${selected?.session_id === s.session_id ? "bg-green-900/10" : ""}`}>
                                        <td className="px-5 py-3 text-slate-200 truncate max-w-[160px]">{s.video_source}</td>
                                        <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(s.started_at)}</td>
                                        <td className="px-5 py-3 text-center text-green-400 font-bold">{s.total_boxes_detected}</td>
                                        <td className="px-5 py-3 text-center text-pink-400 font-bold">{s.peak_count}</td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => setSelected(s)}
                                                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                                            >
                                                {selected?.session_id === s.session_id ? "▶ Playing" : "▶ Replay"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
