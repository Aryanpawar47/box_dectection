"use client";

import { useState, useEffect } from "react";
import { fetchStats } from "@/lib/api";
import { generateReport } from "@/lib/api";

interface Session {
    session_id: string;
    video_source: string;
    started_at: string;
    total_boxes_detected: number;
    frames_processed: number;
    average_boxes_per_frame: number;
    peak_count: number;
}

export default function DetectionReport() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats(30).then(res => setSessions(res.sessions || [])).finally(() => setLoading(false));
    }, []);

    const handleDownload = async (sessionId: string, videoSource: string) => {
        setGenerating(sessionId);
        setError(null);
        try {
            const blob = await generateReport(sessionId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `report_${sessionId.slice(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError("Failed to generate report. Ensure the backend is running.");
        } finally {
            setGenerating(null);
        }
    };

    if (loading) return <div className="animate-pulse text-slate-400 p-6">Loading sessions...</div>;

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm p-4 rounded-xl">⚠ {error}</div>
            )}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">Detection Sessions</h2>
                    <span className="text-xs text-slate-500">{sessions.length} available</span>
                </div>
                {sessions.length === 0 ? (
                    <div className="p-6 text-slate-500 text-sm text-center">No sessions found. Run a detection first.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                                    <th className="px-5 py-3">Session</th>
                                    <th className="px-5 py-3 text-center">Boxes</th>
                                    <th className="px-5 py-3 text-center">Frames</th>
                                    <th className="px-5 py-3 text-center">Peak</th>
                                    <th className="px-5 py-3 text-right">Report</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => (
                                    <tr key={s.session_id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="text-slate-200 text-sm truncate max-w-[160px]">{s.video_source}</div>
                                            <div className="text-slate-500 text-xs">{new Date(s.started_at).toLocaleString()}</div>
                                        </td>
                                        <td className="px-5 py-3 text-center text-green-400 font-bold">{s.total_boxes_detected}</td>
                                        <td className="px-5 py-3 text-center text-blue-400">{s.frames_processed}</td>
                                        <td className="px-5 py-3 text-center text-pink-400">{s.peak_count}</td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleDownload(s.session_id, s.video_source)}
                                                disabled={generating === s.session_id}
                                                className="text-xs px-4 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-all flex items-center gap-1.5 ml-auto"
                                            >
                                                {generating === s.session_id ? (
                                                    <><span className="animate-spin">⟳</span> Generating...</>
                                                ) : (
                                                    <><span>⬇</span> PDF</>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-slate-600 text-center">PDFs are generated by the backend using reportlab and downloaded directly to your device.</p>
        </div>
    );
}
