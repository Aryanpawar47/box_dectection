"use client";

import { useEffect, useState } from "react";
import { fetchAnomalyCheck } from "@/lib/api";

interface Anomaly {
    type: "spike" | "drop" | "inactivity";
    message: string;
    average: number;
    current: number;
    detected_at?: string;
}

const typeConfig = {
    spike: { icon: "📈", label: "Detection Spike", bg: "bg-orange-900/30", border: "border-orange-500/50", text: "text-orange-300" },
    drop: { icon: "📉", label: "Detection Drop", bg: "bg-red-900/30", border: "border-red-500/50", text: "text-red-300" },
    inactivity: { icon: "💤", label: "Detection Inactivity", bg: "bg-yellow-900/30", border: "border-yellow-500/50", text: "text-yellow-300" },
};

export default function AnomalyAlertComponent() {
    const [data, setData] = useState<{ anomalies: Anomaly[]; average: number; current: number; session_count: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const check = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAnomalyCheck();
            setData({ ...res, anomalies: res.anomalies as Anomaly[] });
        } catch {
            setError("Failed to connect to backend. Is the server running?");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { check(); }, []);

    return (
        <div className="space-y-5 max-w-2xl">
            {/* Header controls */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4">
                <div>
                    <p className="text-sm text-slate-300 font-medium">Moving average analysis across recent sessions</p>
                    {data && <p className="text-xs text-slate-500 mt-0.5">Analyzed {data.session_count} sessions &mdash; Avg: <span className="text-white font-bold">{data.average}</span> boxes</p>}
                </div>
                <button
                    onClick={check}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-xl border border-slate-600/50 transition-all"
                >
                    {loading ? "⟳ Checking..." : "↻ Re-check"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm p-4 rounded-xl">⚠ {error}</div>
            )}

            {!loading && data && data.anomalies.length === 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-8 text-center space-y-2">
                    <div className="text-4xl">✅</div>
                    <h3 className="text-lg font-semibold text-green-400">No Anomalies Detected</h3>
                    <p className="text-green-500/70 text-sm">All detection sessions are within normal operating range.</p>
                    {data.session_count < 3 && (
                        <p className="text-xs text-slate-500 mt-2">Need at least 3 sessions for anomaly detection — currently {data.session_count}.</p>
                    )}
                </div>
            )}

            {data?.anomalies.map((a, i) => {
                const cfg = typeConfig[a.type] ?? typeConfig.drop;
                return (
                    <div key={i} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 space-y-3`}>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{cfg.icon}</span>
                            <div>
                                <h3 className={`font-bold text-lg ${cfg.text}`}>{cfg.label}</h3>
                                {a.detected_at && <p className="text-xs text-slate-500">{new Date(a.detected_at).toLocaleString()}</p>}
                            </div>
                        </div>
                        <div className={`bg-slate-900/40 rounded-xl p-4 border ${cfg.border} text-sm space-y-1`}>
                            <p className={cfg.text}>{a.message}</p>
                            <div className="flex gap-4 mt-2 text-xs text-slate-400">
                                <span>Average: <span className="text-white font-bold">{a.average}</span> boxes</span>
                                <span>Current: <span className="text-white font-bold">{a.current}</span> boxes</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
