"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchStats, updateSession } from "@/lib/api";

interface DetectionSession {
    session_id: string;
    video_source: string;
    started_at: string;
    total_boxes_detected: number;
    expected_count?: number;
}

// Custom hook to poll the most recent active session via the backend API
function useDetectionSession() {
    const [session, setSession] = useState<DetectionSession | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await fetchStats(1);
            if (data.sessions.length > 0) {
                setSession(data.sessions[0] as unknown as DetectionSession);
            } else {
                setSession(null);
            }
        } catch (e) {
            console.error("Failed to poll session:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 5000); // Poll every 5s
        return () => clearInterval(id);
    }, [refresh]);

    const handleUpdateExpectedCount = async (sessionId: string, count: number) => {
        await updateSession(sessionId, { expected_count: count });
        refresh(); // manual refresh after update
    };

    return { session, loading, updateExpectedCount: handleUpdateExpectedCount };
}

export default function InventoryAlert() {
    const { session, loading, updateExpectedCount } = useDetectionSession();
    const [localExpected, setLocalExpected] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [savedJustNow, setSavedJustNow] = useState(false);

    // Sync local input state with db when session loads/changes
    useEffect(() => {
        if (session && session.expected_count !== undefined && session.expected_count !== null) {
            setLocalExpected(session.expected_count.toString());
        }
    }, [session?.expected_count, session?.session_id]);

    const handleSaveExpected = async () => {
        if (!session) return;
        const num = parseInt(localExpected, 10);
        if (!isNaN(num)) {
            setIsSaving(true);
            try {
                await updateExpectedCount(session.session_id, num);
                setSavedJustNow(true);
                setTimeout(() => setSavedJustNow(false), 2000);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (loading && !session) {
        return <div className="text-slate-400 animate-pulse bg-slate-900/40 p-6 rounded-2xl border border-slate-800">Loading live inventory database...</div>;
    }

    if (!session) {
        return <div className="text-slate-500 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">No active detection sessions found in database. Run a detection first.</div>;
    }

    const hasMismatch = session.expected_count !== undefined && session.expected_count !== null && session.expected_count !== session.total_boxes_detected;
    const isMatched = session.expected_count !== undefined && session.expected_count !== null && session.expected_count === session.total_boxes_detected;

    return (
        <div className="space-y-6 max-w-xl">
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 space-y-5 shadow-inner">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span>📦</span> Inventory Tracking
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Expected Box Count</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={localExpected}
                                onChange={(e) => setLocalExpected(e.target.value)}
                                placeholder="e.g. 50"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-all font-medium"
                            />
                            <button
                                onClick={handleSaveExpected}
                                disabled={isSaving}
                                className={`px-5 py-2 hover:bg-slate-700 active:bg-slate-600 rounded-xl transition-all border text-sm font-semibold flex items-center gap-2 ${savedJustNow
                                        ? "bg-green-500/20 border-green-500/50 text-green-400"
                                        : "bg-slate-800 border-slate-600/50 text-white"
                                    }`}
                            >
                                {isSaving ? "..." : savedJustNow ? "Saved! ✓" : "Set"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Live Detected Count</label>
                        <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-green-400 font-mono text-xl tabular-nums shadow-inner flex items-center h-[42px]">
                            {session.total_boxes_detected}
                        </div>
                    </div>
                </div>
            </div>

            {hasMismatch && (
                <div className="bg-red-500/10 border border-red-500/80 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600/0 via-red-500 to-red-600/0"></div>
                    <div className="text-5xl mb-1 animate-bounce drop-shadow-md">⚠️</div>
                    <h3 className="text-xl font-bold text-red-500 tracking-wide">Inventory Mismatch Detected</h3>
                    <div className="bg-red-950/40 rounded-xl px-6 py-3 border border-red-500/20">
                        <p className="text-red-400/90 font-medium text-lg flex items-center gap-4">
                            <span className="flex flex-col">
                                <span className="text-[10px] uppercase text-red-500/60 font-black tracking-widest text-left">Expected</span>
                                <span className="text-white font-black text-2xl">{session.expected_count}</span>
                            </span>
                            <span className="text-red-600/30 text-3xl font-light">/</span>
                            <span className="flex flex-col">
                                <span className="text-[10px] uppercase text-red-500/60 font-black tracking-widest text-left">Detected</span>
                                <span className="text-white font-black text-2xl">{session.total_boxes_detected}</span>
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {isMatched && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/0 via-green-500/50 to-green-500/0"></div>
                    <div className="text-4xl">✅</div>
                    <h3 className="text-lg font-bold text-green-400">Inventory Matches Expected Count</h3>
                    <p className="text-green-500/70 text-sm font-medium">All {session.total_boxes_detected} boxes are accounted for!</p>
                </div>
            )}
        </div>
    );
}
