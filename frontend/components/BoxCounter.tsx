"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
    count: number;
    label?: string;
    showPulse?: boolean;
}

export default function BoxCounter({ count, label = "Boxes Detected", showPulse = false }: Props) {
    const [displayCount, setDisplayCount] = useState(0);
    const animRef = useRef<number | null>(null);

    // Animated number counter
    useEffect(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);

        const start = displayCount;
        const end = count;
        const duration = 600;
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayCount(Math.round(start + (end - start) * eased));
            if (progress < 1) animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count]);

    return (
        <div className="relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-500/30 overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 bg-green-500/5 rounded-2xl" />

            {/* Pulse ring when active */}
            {showPulse && count > 0 && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                    <span className="text-green-400 text-xs font-medium">LIVE</span>
                </div>
            )}

            <div className="text-7xl font-extrabold tabular-nums tracking-tight text-white drop-shadow-lg">
                {displayCount.toLocaleString()}
            </div>
            <div className="text-green-300 text-sm font-semibold uppercase tracking-widest">{label}</div>

            {/* Bottom decorative bar */}
            <div
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-700 rounded-full"
                style={{ width: `${Math.min((count / Math.max(count, 10)) * 100, 100)}%` }}
            />
        </div>
    );
}
