"use client";

import { useRef, useState, useCallback } from "react";

interface Props {
    onFileSelected: (file: File) => void;
    isLoading?: boolean;
    annotatedImageB64?: string;
}

export default function VideoPlayer({ onFileSelected, isLoading, annotatedImageB64 }: Props) {
    const [preview, setPreview] = useState<string | null>(null);
    const [fileType, setFileType] = useState<"image" | "video" | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(
        (file: File) => {
            const url = URL.createObjectURL(file);
            setPreview(url);
            setFileType(file.type.startsWith("video/") ? "video" : "image");
            onFileSelected(file);
        },
        [onFileSelected]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Drop Zone */}
            <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`
          relative border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
          flex flex-col items-center justify-center min-h-[220px] p-8
          ${isDragging || isLoading
                        ? "border-green-400 bg-green-950/30 scale-[1.01]"
                        : "border-slate-600 bg-slate-800/40 hover:border-green-500 hover:bg-slate-800/60"
                    }
        `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {preview ? (
                    fileType === "video" ? (
                        <video src={preview} controls className="max-h-48 rounded-xl w-full object-contain" />
                    ) : (
                        <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-contain" />
                    )
                ) : (
                    <>
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-slate-300 text-base font-medium">Drop image or video here</p>
                        <p className="text-slate-500 text-sm mt-1">or click to browse</p>
                        <p className="text-slate-600 text-xs mt-3">Supports JPEG, PNG, MP4, AVI, MOV</p>
                    </>
                )}
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/70 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-green-300 text-sm font-medium">Detecting boxes…</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Annotated result */}
            {annotatedImageB64 && !isLoading && (
                <div className="rounded-2xl overflow-hidden border border-green-500/30 bg-slate-900">
                    <div className="px-4 py-2 bg-green-900/30 border-b border-green-500/20">
                        <span className="text-green-300 text-xs font-semibold tracking-wide uppercase">
                            Detection Result
                        </span>
                    </div>
                    <img
                        src={`data:image/jpeg;base64,${annotatedImageB64}`}
                        alt="Annotated detection"
                        className="w-full object-contain"
                    />
                </div>
            )}
        </div>
    );
}
