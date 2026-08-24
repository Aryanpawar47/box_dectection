"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
    getWsUrl,
    startCameraStream,
    stopCameraStream,
    updateCameraConfig,
    resetConveyorCount,
    BoxCrossingRecord
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export default function LiveConveyorFeed() {
    const [connected, setConnected] = useState<boolean>(false);
    const [frameB64, setFrameB64] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [activeBoxes, setActiveBoxes] = useState<number>(0);
    const [recentEvents, setRecentEvents] = useState<any[]>([]);
    const [sourceType, setSourceType] = useState<string>("simulator");
    const [sourcePath, setSourcePath] = useState<string>("0");
    const [lineRatio, setLineRatio] = useState<number>(0.50);
    const [confidence, setConfidence] = useState<number>(0.40);
    const [isStreaming, setIsStreaming] = useState<boolean>(true);
    const [lastCrossedFlash, setLastCrossedFlash] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const prevCountRef = useRef<number>(0);
    const user = getCurrentUser();

    // Connect WebSocket
    const connectWebSocket = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = getWsUrl("/ws/conveyor");
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setConnected(true);
            setErrorMsg(null);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.frame_b64) {
                    setFrameB64(data.frame_b64);
                }
                if (typeof data.total_count === "number") {
                    if (data.total_count > prevCountRef.current) {
                        setLastCrossedFlash(true);
                        setTimeout(() => setLastCrossedFlash(false), 600);
                    }
                    prevCountRef.current = data.total_count;
                    setTotalCount(data.total_count);
                }
                if (typeof data.active_boxes === "number") {
                    setActiveBoxes(data.active_boxes);
                }
                if (Array.isArray(data.recent_events)) {
                    setRecentEvents(data.recent_events);
                }
            } catch (err) {
                console.error("WS Parse error", err);
            }
        };

        ws.onerror = (err) => {
            setConnected(false);
            setErrorMsg("WebSocket connection error. Is the backend running?");
        };

        ws.onclose = () => {
            setConnected(false);
        };

        wsRef.current = ws;
    }, []);

    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [connectWebSocket]);

    // Camera Switch handler
    const handleSourceChange = async (newType: string, newPath: string = "0") => {
        setSourceType(newType);
        setSourcePath(newPath);
        try {
            await startCameraStream(newType, newPath);
        } catch (e) {
            console.error("Failed to switch camera source", e);
        }
    };

    const handleLineChange = async (val: number) => {
        setLineRatio(val);
        try {
            await updateCameraConfig(val, confidence);
        } catch (e) {
            console.error(e);
        }
    };

    const handleConfidenceChange = async (val: number) => {
        setConfidence(val);
        try {
            await updateCameraConfig(lineRatio, val);
        } catch (e) {
            console.error(e);
        }
    };

    const handleReset = async () => {
        try {
            await resetConveyorCount();
            setTotalCount(0);
            prevCountRef.current = 0;
            setRecentEvents([]);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header Status Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl backdrop-blur-md">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="flex h-3 w-3 relative">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? "bg-emerald-500" : "bg-red-500"}`}></span>
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight">Live Conveyor Belt & QR Box Counting</h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Layer 1 & 2 Active
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Real-time YOLOv8 object detection, OpenCV QR decoding, and centroid line-crossing tracking.
                    </p>
                </div>

                {/* Quick Source Switcher */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Input Source:</span>
                    <button
                        onClick={() => handleSourceChange("simulator")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            sourceType === "simulator"
                                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        ⚙️ Conveyor Simulator
                    </button>
                    <button
                        onClick={() => handleSourceChange("webcam", "0")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            sourceType === "webcam" && sourcePath === "0"
                                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        📷 Webcam 0 (Default)
                    </button>
                    <button
                        onClick={() => handleSourceChange("webcam", "1")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            sourceType === "webcam" && sourcePath === "1"
                                ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                    >
                        📹 Webcam 1
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm flex items-center justify-between">
                    <span>⚠️ {errorMsg}</span>
                    <button onClick={connectWebSocket} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-semibold">
                        Reconnect
                    </button>
                </div>
            )}

            {/* Main Video & Counter Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Video Feed Canvas (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative aspect-[4/3] md:aspect-video w-full rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
                        {frameB64 ? (
                            <img
                                src={`data:image/jpeg;base64,${frameB64}`}
                                alt="Live Conveyor Stream"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-medium">Connecting to live video stream...</p>
                            </div>
                        )}

                        {/* Top Overlay Badge */}
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                            <span className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                {sourceType === "simulator" ? "SYNTHETIC CONVEYOR" : `CAM: ${sourcePath}`}
                            </span>
                            <span className="bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 text-xs font-medium text-slate-400">
                                Tracking: <span className="text-cyan-400 font-bold">{activeBoxes}</span> in frame
                            </span>
                        </div>

                        {/* Line Crossing Flash Alert */}
                        {lastCrossedFlash && (
                            <div className="absolute inset-0 border-4 border-emerald-400 pointer-events-none animate-ping opacity-60"></div>
                        )}
                    </div>

                    {/* Stream Adjustment Toolbar */}
                    <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        {/* Virtual Line Position */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-slate-400 font-medium">
                                <span>Virtual Counting Line:</span>
                                <span className="text-cyan-400 font-bold">{Math.round(lineRatio * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="0.9"
                                step="0.05"
                                value={lineRatio}
                                onChange={(e) => handleLineChange(parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Confidence Threshold */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-slate-400 font-medium">
                                <span>YOLO Confidence:</span>
                                <span className="text-cyan-400 font-bold">{Math.round(confidence * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="0.9"
                                step="0.05"
                                value={confidence}
                                onChange={(e) => handleConfidenceChange(parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-end gap-2">
                            <button
                                onClick={handleReset}
                                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold transition-all hover:text-white"
                            >
                                🔄 Reset Count
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Statistics & QR Feed (1 col) */}
                <div className="space-y-4">
                    {/* Live Box Count Big Card */}
                    <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                        lastCrossedFlash
                            ? "bg-emerald-500/20 border-emerald-400 shadow-xl shadow-emerald-500/20 scale-[1.02]"
                            : "bg-slate-900/80 border-slate-800"
                    }`}>
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">Total Crossed Count</span>
                            <span className="text-xl">📦</span>
                        </div>
                        <div className="text-5xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                            <span>{totalCount}</span>
                            <span className="text-sm font-medium text-emerald-400">units</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Unique items that traversed the virtual threshold line.
                        </p>
                    </div>

                    {/* QR Code & Box Crossing Log Ticker */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <span>🏷️</span> Scanned QR & Crossing Ticker
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                Live Feed
                            </span>
                        </div>

                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {recentEvents.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-xs">
                                    Awaiting box line-crossings on conveyor...
                                </div>
                            ) : (
                                recentEvents.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl text-xs space-y-1 hover:border-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-white flex items-center gap-1.5">
                                                <span className="text-emerald-400">✓</span> {item.box_id}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500">{item.timestamp}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                                            <span className="font-mono text-cyan-400">{item.qr_code}</span>
                                            <span className="text-slate-500">{item.product_name || "Industrial Box"}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
