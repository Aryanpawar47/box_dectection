"use client";

import { useEffect, useState } from "react";
import { updateConfidenceThreshold, fetchConfig } from "@/lib/api";

export default function ConfidenceFilter() {
    const [value, setValue] = useState(0.5);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchConfig().then(cfg => setValue(cfg.confidence_threshold)).catch(() => { });
    }, []);

    const handleApply = async () => {
        setSaving(true);
        setError(null);
        try {
            await updateConfidenceThreshold(value);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            setError("Failed to update. Is the backend running?");
        } finally {
            setSaving(false);
        }
    };

    const pct = Math.round(value * 100);
    const color = value < 0.4 ? "text-yellow-400" : value < 0.7 ? "text-green-400" : "text-blue-400";
    const barColor = value < 0.4 ? "bg-yellow-400" : value < 0.7 ? "bg-green-400" : "bg-blue-400";

    return (
        <div className="space-y-6 max-w-xl">
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Confidence Threshold</h2>
                    <span className={`text-3xl font-bold tabular-nums ${color}`}>{pct}%</span>
                </div>

                {/* Slider */}
                <div className="space-y-3">
                    <input
                        type="range"
                        min={0.1}
                        max={0.95}
                        step={0.01}
                        value={value}
                        onChange={e => setValue(parseFloat(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700 accent-green-400"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>10% (More detections)</span>
                        <span>95% (Stricter filtering)</span>
                    </div>
                </div>

                {/* Visual bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} transition-all duration-300 rounded-full`} style={{ width: `${pct}%` }} />
                </div>

                {/* Guide labels */}
                <div className="grid grid-cols-3 text-center text-xs gap-2">
                    {[
                        { label: "Aggressive", range: "10–39%", active: value < 0.4 },
                        { label: "Balanced", range: "40–69%", active: value >= 0.4 && value < 0.7 },
                        { label: "Strict", range: "70–95%", active: value >= 0.7 },
                    ].map(({ label, range, active }) => (
                        <div key={label} className={`rounded-xl p-2.5 border transition-all ${active ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-slate-700/50 bg-slate-800/30 text-slate-500"}`}>
                            <div className="font-semibold">{label}</div>
                            <div className="opacity-70">{range}</div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleApply}
                    disabled={saving}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all border ${saved
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : "bg-slate-800 hover:bg-slate-700 border-slate-600/50 text-white"
                        }`}
                >
                    {saving ? "Applying..." : saved ? "✓ Applied to Backend" : "Apply to Backend"}
                </button>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-xs text-slate-500 space-y-1">
                <p>💡 This updates the live YOLOv8 confidence threshold for all new detections.</p>
                <p>Lower values detect more boxes (may include false positives). Higher values are more precise.</p>
            </div>
        </div>
    );
}
