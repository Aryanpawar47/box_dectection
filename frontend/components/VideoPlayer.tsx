"use client";

import { useRef, useState, useCallback } from "react";

interface Props {
    onFilesSelected: (files: File[]) => void;
    isLoading?: boolean;
    annotatedImageB64?: string;
}

export default function VideoPlayer({ onFilesSelected, isLoading, annotatedImageB64 }: Props) {
    const [previews, setPreviews] = useState<{ url: string; type: "image" | "video"; name: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(
        (files: FileList | File[]) => {
            const fileArray = Array.from(files);
            const newPreviews = fileArray.map(file => ({
                url: URL.createObjectURL(file),
                type: (file.type.startsWith("video/") ? "video" : "image") as "image" | "video",
                name: file.name
            }));
            setPreviews(newPreviews);
            onFilesSelected(fileArray);
        },
        [onFilesSelected]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
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
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                {previews.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                        {previews.map((preview, idx) => (
                            <div key={idx} className="relative group">
                                {preview.type === "video" ? (
                                    <video src={preview.url} className="max-h-32 rounded-xl w-full object-cover border border-slate-700" />
                                ) : (
                                    <img src={preview.url} alt="Preview" className="max-h-32 rounded-xl w-full object-cover border border-slate-700" />
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[10px] text-white truncate rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                    {preview.name}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="text-5xl mb-3">📦</div>
                        <p className="text-slate-300 text-base font-medium">Drop images or videos here</p>
                        <p className="text-slate-500 text-sm mt-1">or click to browse multiple</p>
                        <p className="text-slate-600 text-xs mt-3">Supports JPEG, PNG, MP4, AVI, MOV</p>
                    </>
                )}
                {isLoading && (
                    <div className="absolute inset-0 bg-slate-900/70 rounded-2xl flex items-center justify-center backdrop-blur-sm z-10">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-green-300 text-sm font-medium">Detecting boxes…</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Annotated result (for the last processed image if any) */}
            {annotatedImageB64 && !isLoading && (
                <div className="rounded-2xl overflow-hidden border border-green-500/30 bg-slate-900">
                    <div className="px-4 py-2 bg-green-900/30 border-b border-green-500/20">
                        <span className="text-green-300 text-xs font-semibold tracking-wide uppercase">
                            Last Detection Result
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
