"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { fetchStats } from "@/lib/api";

// Dynamically import Recharts to avoid SSR/Turbopack issues
const DynamicChart = dynamic<any>(() => import("./ComparisonChart"), { ssr: false, loading: () => <div className="h-64 animate-pulse bg-slate-800/40 rounded-xl" /> });

interface Session {
    session_id: string;
    video_source: string;
    started_at: string;
    total_boxes_detected: number;
    frames_processed: number;
    average_boxes_per_frame: number;
    peak_count: number;
}

function calcBpm(s: Session) {
    const fps = 5;
    const minutes = s.frames_processed / fps / 60;
    return minutes > 0 ? parseFloat((s.total_boxes_detected / minutes).toFixed(1)) : 0;
}

export default function SessionComparison() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [idA, setIdA] = useState("");
    const [idB, setIdB] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchStats(30);
                const results = data.sessions as unknown as Session[];
                setSessions(results);
                if (results.length >= 2) { 
                    setIdA(results[0].session_id); 
                    setIdB(results[1].session_id); 
                }
            } catch (e) {
                console.error(e);
            } finally { 
                setLoading(false); 
            }
        };
        load();
    }, []);

    const sA = sessions.find(s => s.session_id === idA);
    const sB = sessions.find(s => s.session_id === idB);

    const chartData = sA && sB ? [
        { metric: "Total Boxes", A: sA.total_boxes_detected, B: sB.total_boxes_detected },
        { metric: "Peak Count", A: sA.peak_count, B: sB.peak_count },
        { metric: "Frames", A: sA.frames_processed, B: sB.frames_processed },
        { metric: "Boxes/min", A: calcBpm(sA), B: calcBpm(sB) },
    ] : [];

    const delta = sA && sB && sB.total_boxes_detected > 0
        ? (((sA.total_boxes_detected - sB.total_boxes_detected) / sB.total_boxes_detected) * 100).toFixed(1)
        : null;

    if (loading) return <div className="animate-pulse text-slate-400 p-6">Loading sessions...</div>;
    if (sessions.length < 2) return (
        <div className="text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            At least 2 sessions are required for comparison. Run more detections first.
        </div>
    );

    const sessionLabel = (s: Session) => `${s.video_source.slice(0, 20)} (${s.total_boxes_detected} boxes)`;

    return (
        <div className="space-y-6">
            {/* Dropdowns */}
            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: "Session A", value: idA, color: "border-blue-500/40", onChange: setIdA },
                    { label: "Session B", value: idB, color: "border-pink-500/40", onChange: setIdB },
                ].map(({ label, value, color, onChange }) => (
                    <div key={label} className={`bg-slate-900/60 border ${color} rounded-2xl p-4 space-y-2`}>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</label>
                        <select
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500/50"
                        >
                            {sessions.map(s => (
                                <option key={s.session_id} value={s.session_id}>{sessionLabel(s)}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* Delta banner */}
            {delta !== null && sA && sB && (
                <div className={`rounded-2xl p-4 text-center border ${parseFloat(delta) >= 0 ? "bg-green-900/20 border-green-500/30" : "bg-red-900/20 border-red-500/30"}`}>
                    <p className="text-slate-300 text-sm">
                        Session A: <span className="font-bold text-white">{sA.total_boxes_detected}</span> boxes &nbsp;|&nbsp;
                        Session B: <span className="font-bold text-white">{sB.total_boxes_detected}</span> boxes
                    </p>
                    <p className={`font-bold text-lg mt-1 ${parseFloat(delta) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        Performance {parseFloat(delta) >= 0 ? "increase" : "decrease"}: {delta}%
                    </p>
                </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white">Metrics Comparison</h2>
                    <DynamicChart data={chartData} />
                </div>
            )}
        </div>
    );
}
