"use client";

import { useState, useCallback, useRef } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import BoxCounter from "@/components/BoxCounter";
import { detectFile, stopDetectionJob } from "@/lib/api";
import type { DetectionResult, ImageDetectionResult, VideoDetectionResult } from "@/lib/api";

export default function UploadPage() {
    const [results, setResults] = useState<DetectionResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confidence, setConfidence] = useState(0.5);
    const [currentFiles, setCurrentFiles] = useState<File[]>([]);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    const [playerKey, setPlayerKey] = useState(0);
    const activeJobIdRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stopDetection = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (activeJobIdRef.current) {
            stopDetectionJob(activeJobIdRef.current).catch(console.error);
        }
        setLoading(false);
        setProcessingIndex(null);
    }, []);

    const handleFiles = useCallback(
        async (files: File[]) => {
            setCurrentFiles(files);
            setError(null);
            setResults([]);
            setLoading(true);

            for (let i = 0; i < files.length; i++) {
                setProcessingIndex(i);
                const file = files[i];
                const jobId = Math.random().toString(36).substring(2, 15);
                activeJobIdRef.current = jobId;
                abortControllerRef.current = new AbortController();

                try {
                    const res = await detectFile(file, confidence, jobId, abortControllerRef.current.signal);
                    setResults(prev => [...prev, res]);
                } catch (e: any) {
                    if (e.name === "AbortError") {
                        setError("Detection stopped by user.");
                        break; 
                    } else {
                        setError(`Failed to detect ${file.name}: ${e.message ?? "Unknown error"}`);
                    }
                }
            }

            setLoading(false);
            setProcessingIndex(null);
            activeJobIdRef.current = null;
            abortControllerRef.current = null;
        },
        [confidence]
    );

    const handleDetectAgain = useCallback(() => {
        if (currentFiles.length > 0) {
            handleFiles(currentFiles);
        }
    }, [currentFiles, handleFiles]);

    const lastResult = results[results.length - 1];
    const lastImageResult = lastResult?.source_type === "image" ? (lastResult as ImageDetectionResult) : null;

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Upload & Detect</h1>
                <p className="text-slate-400 text-sm mt-0.5">
                    Upload an image or video to run YOLOv8 box detection.
                </p>
            </div>

            {/* Confidence slider */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-700">
                <div className="flex items-center justify-between sm:w-36 shrink-0">
                    <label className="text-slate-300 text-sm font-medium">
                        Confidence Threshold
                    </label>
                    <span className="text-green-300 font-semibold text-sm sm:hidden">
                        {(confidence * 100).toFixed(0)}%
                    </span>
                </div>
                <input
                    type="range"
                    min={0.1}
                    max={0.95}
                    step={0.05}
                    value={confidence}
                    onChange={(e) => setConfidence(+e.target.value)}
                    className="flex-1 accent-green-400 cursor-pointer w-full"
                />
                <span className="text-green-300 font-semibold text-sm w-10 text-right hidden sm:block">
                    {(confidence * 100).toFixed(0)}%
                </span>
            </div>

            {/* Main Content Area (Upload / Preview) */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-700 p-6">
                <div className="space-y-6">
                    <VideoPlayer
                        key={playerKey}
                        onFilesSelected={handleFiles}
                        isLoading={loading}
                        annotatedImageB64={lastImageResult?.annotated_image_b64}
                    />

                    {/* Progress indicator */}
                    {loading && processingIndex !== null && currentFiles.length > 1 && (
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-300 text-sm font-medium">
                                    Processing {processingIndex + 1} of {currentFiles.length} files
                                </span>
                                <span className="text-green-400 text-sm font-bold">
                                    {Math.round(((processingIndex + 1) / currentFiles.length) * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-green-500 h-full transition-all duration-500" 
                                    style={{ width: `${((processingIndex + 1) / currentFiles.length) * 100}%` }}
                                />
                            </div>
                            <p className="text-slate-500 text-xs mt-2 italic truncate">
                                Current: {currentFiles[processingIndex]?.name}
                            </p>
                        </div>
                    )}

                    {/* Stop Detection / Loading State */}
                    {loading && currentFiles.length > 0 && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={stopDetection}
                                className="px-6 py-2.5 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-100 font-medium transition-colors border border-red-700/50 flex items-center gap-2 mt-4 shadow-md"
                            >
                                <span className="text-xl leading-none">⏹️</span> Stop Detection
                            </button>
                        </div>
                    )}

                    {/* Detect Again / Upload New File */}
                    {!loading && (results.length > 0 || error) && currentFiles.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center pt-2 border-t border-slate-800/50">
                            <button
                                onClick={handleDetectAgain}
                                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-700 flex items-center gap-2 mt-4"
                            >
                                <span className="text-xl leading-none">↻</span> Detect Again
                            </button>
                            <button
                                onClick={() => {
                                    setResults([]);
                                    setError(null);
                                    setCurrentFiles([]);
                                    setPlayerKey(prev => prev + 1);
                                }}
                                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-colors flex items-center gap-2 mt-4 shadow-lg shadow-green-900/20"
                            >
                                <span className="text-xl leading-none">+</span> Upload New
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
                    <span className="text-lg">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Results list */}
            {results.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">
                        Detection Results ({results.length})
                    </h2>
                    {results.map((res, idx) => {
                        const isImage = res.source_type === "image";
                        const imgRes = isImage ? (res as ImageDetectionResult) : null;
                        const vidRes = !isImage ? (res as VideoDetectionResult) : null;
                        const file = currentFiles[idx];

                        return (
                            <section key={idx} className="rounded-2xl bg-slate-900/60 border border-green-500/20 p-6 space-y-4 shadow-sm">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-base font-semibold text-white truncate max-w-[70%]">
                                        {file?.name || (isImage ? "Image Result" : "Video Result")}
                                    </h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${isImage ? 'bg-blue-900/20 border-blue-500/30 text-blue-300' : 'bg-purple-900/20 border-purple-500/30 text-purple-300'}`}>
                                        {isImage ? 'IMAGE' : 'VIDEO'}
                                    </span>
                                </div>

                                {isImage && imgRes && (
                                    <>
                                        {imgRes.box_count === 0 ? (
                                            <div className="bg-orange-900/40 border border-orange-500/30 text-orange-200 p-3 rounded-xl text-center text-sm">
                                                No boxes detected.
                                            </div>
                                        ) : (
                                            <BoxCounter count={imgRes.box_count} label="Boxes Detected" showPulse />
                                        )}
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-slate-800/50 rounded-xl p-3">
                                                <div className="text-slate-500 mb-1">Dimensions</div>
                                                <div className="text-slate-200 font-medium">
                                                    {imgRes.frame_width} × {imgRes.frame_height} px
                                                </div>
                                            </div>
                                            <div className="bg-slate-800/50 rounded-xl p-3">
                                                <div className="text-slate-500 mb-1">Confidences</div>
                                                <div className="text-slate-200 font-medium truncate">
                                                    {imgRes.confidences.length > 0
                                                        ? imgRes.confidences.map((c) => (c * 100).toFixed(0) + "%").join(", ")
                                                        : "—"}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!isImage && vidRes && (
                                    <>
                                        {vidRes.total_boxes_detected === 0 ? (
                                            <div className="bg-orange-900/40 border border-orange-500/30 text-orange-200 p-4 rounded-xl text-center text-sm">
                                                No boxes detected in this video.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                {[
                                                    { label: "Total Boxes", value: vidRes.total_boxes_detected, color: "text-green-300" },
                                                    { label: "Frames", value: vidRes.frames_processed, color: "text-blue-300" },
                                                    { label: "Peak", value: vidRes.peak_count, color: "text-pink-300" },
                                                    { label: "Avg / Frame", value: vidRes.average_boxes_per_frame.toFixed(2), color: "text-yellow-300" },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} className="bg-slate-800/50 rounded-xl p-3 text-center">
                                                        <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                                                        <div className="text-slate-500 text-[10px] mt-0.5 uppercase tracking-wide">{label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {vidRes.document_id && (
                                            <p className="text-slate-600 text-[10px]">
                                                Session saved to Firebase · ID: <code className="text-slate-500">{vidRes.document_id}</code>
                                            </p>
                                        )}
                                    </>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
