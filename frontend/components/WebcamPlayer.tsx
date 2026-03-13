"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { detectFile } from "@/lib/api";

interface Props {
    confidence: number;
    onSessionComplete: (stats: {
        video_source: string;
        frames_processed: number;
        total_boxes_detected: number;
        peak_count: number;
    }) => void;
    onCancel: () => void;
}

export default function WebcamPlayer({ confidence, onSessionComplete, onCancel }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const loopRef = useRef<NodeJS.Timeout | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResultB64, setLastResultB64] = useState<string | null>(null);
    const [liveCount, setLiveCount] = useState<number>(0);

    // Stats tracking
    const statsRef = useRef({
        frames_processed: 0,
        total_boxes_detected: 0,
        peak_count: 0,
        consecEmptyFrames: 0 // to track 10s of emptiness
    });

    // We'll aim for ~2 FPS for backend polling
    const FPS = 2;
    const EMPTY_SECONDS_LIMIT = 10;
    const MAX_EMPTY_FRAMES = FPS * EMPTY_SECONDS_LIMIT;

    const stopWebcam = useCallback(() => {
        if (loopRef.current) clearInterval(loopRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        setIsActive(false);
    }, []);

    const finishSession = useCallback(() => {
        stopWebcam();
        if (statsRef.current.frames_processed > 0) {
            onSessionComplete({
                video_source: "webcam_live",
                frames_processed: statsRef.current.frames_processed,
                total_boxes_detected: statsRef.current.total_boxes_detected,
                peak_count: statsRef.current.peak_count
            });
        } else {
            onCancel(); // nothing processed
        }
    }, [stopWebcam, onSessionComplete, onCancel]);

    const captureAndDetect = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !isActive) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // Wait until video has dimensions
        if (video.videoWidth === 0) return;

        // Draw video frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                const res = await detectFile(blob, confidence);
                if (res.source_type === "image") {
                    setLastResultB64(res.annotated_image_b64);
                    setLiveCount(res.box_count);

                    // Update stats
                    statsRef.current.frames_processed += 1;
                    statsRef.current.total_boxes_detected += res.box_count;
                    if (res.box_count > statsRef.current.peak_count) {
                        statsRef.current.peak_count = res.box_count;
                    }

                    // Check auto-stop condition
                    if (res.box_count === 0) {
                        statsRef.current.consecEmptyFrames += 1;
                        if (statsRef.current.consecEmptyFrames >= MAX_EMPTY_FRAMES) {
                            finishSession();
                            return;
                        }
                    } else {
                        statsRef.current.consecEmptyFrames = 0;
                    }
                }
            } catch (err: any) {
                console.error("Frame detection failed:", err);
            }
        }, "image/jpeg", 0.6); // 60% quality jpeg to save bandwidth
    }, [isActive, confidence, finishSession, MAX_EMPTY_FRAMES]);

    useEffect(() => {
        const startWebcam = async () => {
            try {
                // Prioritize back camera on mobile, or standard webcam
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch((e) => {
                        // Ignore the AbortError from React hot-reloading or fast unmounts
                        console.log("Video play interrupted:", e);
                    });
                }
                setIsActive(true);
            } catch (err: any) {
                setError(err.message ?? "Could not access webcam.");
            }
        };
        startWebcam();

        return () => stopWebcam();
    }, [stopWebcam]);

    // Start polling loop once video is active
    useEffect(() => {
        if (isActive) {
            loopRef.current = setInterval(captureAndDetect, 1000 / FPS);
        }
        return () => {
            if (loopRef.current) clearInterval(loopRef.current);
        };
    }, [isActive, captureAndDetect]);

    if (error) {
        return (
            <div className="bg-red-900/30 border border-red-500/30 p-6 rounded-2xl text-center space-y-4">
                <p className="text-red-300">⚠️ {error}</p>
                <button onClick={onCancel} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="relative border border-slate-700 rounded-2xl bg-black overflow-hidden flex items-center justify-center min-h-[300px] h-[60vh] md:h-[500px]">
                {/* Hidden canvas for grabbing frames */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Live Video Feed (Hidden initially until first result replaces it, or we could just overlay) */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-contain ${lastResultB64 ? 'opacity-0' : 'opacity-100'}`}
                />

                {/* Annotated Output Overlay */}
                {lastResultB64 && (
                    <img
                        src={`data:image/jpeg;base64,${lastResultB64}`}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        alt="Detection"
                    />
                )}

                {/* Top UI Overlay */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <div className="bg-slate-900/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-700 flex flex-col items-center">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Live Count</span>
                        <span className="text-2xl font-bold text-green-400 leading-none mt-0.5">{liveCount}</span>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">Live Rec</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                    onClick={finishSession}
                    className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                >
                    <span className="text-xl leading-none">⏹</span> Stop & Save
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>

            <p className="text-center text-xs text-slate-500 max-w-sm mx-auto">
                Auto-stops if no boxes are detected for {EMPTY_SECONDS_LIMIT} consecutive seconds.
            </p>
        </div>
    );
}
