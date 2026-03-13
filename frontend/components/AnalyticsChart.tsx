"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    AreaChart,
    Area,
} from "recharts";
import type { DetectionSession } from "@/lib/api";

interface Props {
    sessions: DetectionSession[];
}

function formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-xl text-sm">
            <p className="text-slate-400 mb-1">{label}</p>
            {payload.map((entry: any) => (
                <p key={entry.name} style={{ color: entry.color }} className="font-semibold">
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
};

export default function AnalyticsChart({ sessions }: Props) {
    if (!sessions.length) {
        return (
            <div className="flex items-center justify-center h-48 rounded-2xl bg-slate-800/40 border border-slate-700">
                <div className="text-center">
                    <div className="text-3xl mb-2">📊</div>
                    <p className="text-slate-400 text-sm">No session data yet.</p>
                    <p className="text-slate-600 text-xs mt-1">Run a detection to see analytics.</p>
                </div>
            </div>
        );
    }

    const data = [...sessions]
        .reverse()
        .slice(-20)
        .map((s) => ({
            time: formatTime(s.started_at),
            "Total Boxes": s.total_boxes_detected,
            "Avg / Frame": +s.average_boxes_per_frame.toFixed(2),
            Peak: s.peak_count,
        }));

    return (
        <div className="flex flex-col gap-6">
            {/* Area chart — total boxes over time */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                    Total Boxes per Session
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="Total Boxes"
                            stroke="#4ade80"
                            strokeWidth={2}
                            fill="url(#greenGrad)"
                            dot={{ r: 3, fill: "#4ade80" }}
                            activeDot={{ r: 5 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Line chart — avg per frame vs peak */}
            <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                    Avg / Frame & Peak Count
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                        <Line type="monotone" dataKey="Avg / Frame" stroke="#60a5fa" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Peak" stroke="#f472b6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
