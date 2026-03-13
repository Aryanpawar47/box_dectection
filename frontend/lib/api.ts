// Typed API client for the Python FastAPI backend

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageDetectionResult {
    source_type: "image";
    box_count: number;
    confidences: number[];
    annotated_image_b64: string;
    frame_width: number;
    frame_height: number;
}

export interface VideoDetectionResult {
    source_type: "video";
    session_id: string;
    video_source: string;
    started_at: string;
    frames_processed: number;
    total_boxes_detected: number;
    average_boxes_per_frame: number;
    peak_count: number;
    document_id: string | null;
    video_metadata: {
        fps: number;
        frame_count: number;
        width: number;
        height: number;
    };
}

export type DetectionResult = ImageDetectionResult | VideoDetectionResult;

export interface DetectionSession {
    session_id: string;
    video_source: string;
    started_at: string;
    frames_processed: number;
    total_boxes_detected: number;
    average_boxes_per_frame: number;
    peak_count: number;
}

export interface StatsResponse {
    sessions: DetectionSession[];
    count: number;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Send an image or video file to /detect and return detection results.
 */
export async function detectFile(
    file: File | Blob,
    confidence: number = 0.5,
    jobId?: string,
    signal?: AbortSignal
): Promise<DetectionResult> {
    const sourceType = file.type.startsWith("video/") ? "video" : "image";

    const form = new FormData();
    form.append("file", file);
    form.append("source_type", sourceType);
    form.append("confidence", confidence.toString());
    if (jobId) {
        form.append("job_id", jobId);
    }

    const res = await fetch(`${BASE_URL}/detect`, {
        method: "POST",
        body: form,
        signal,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Detection request failed.");
    }

    return res.json();
}

/**
 * Stop an ongoing video detection job to return partial results.
 */
export async function stopDetectionJob(jobId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/detect/stop/${jobId}`, {
        method: "POST",
    });
    if (!res.ok) {
        console.warn("Failed to stop detection job:", jobId);
    }
}

/**
 * Save an aggregated webcam detection session to the backend.
 */
export async function saveWebcamSession(stats: {
    video_source: string;
    frames_processed: number;
    total_boxes_detected: number;
    peak_count: number;
}): Promise<VideoDetectionResult> {
    const res = await fetch(`${BASE_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
    });

    if (!res.ok) {
        throw new Error("Failed to save webcam session.");
    }

    return res.json();
}

/**
 * Fetch recent detection sessions from the backend.
 */
export async function fetchStats(limit: number = 20): Promise<StatsResponse> {
    const t = new Date().getTime();
    const res = await fetch(`${BASE_URL}/stats?limit=${limit}&_t=${t}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });
    if (!res.ok) throw new Error("Failed to fetch stats.");
    return res.json();
}

/**
 * Health-check the backend service.
 */
export async function healthCheck(): Promise<{ status: string }> {
    const t = new Date().getTime();
    const res = await fetch(`${BASE_URL}/health?_t=${t}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
    });
    if (!res.ok) throw new Error("Backend is unavailable.");
    return res.json();
}

/**
 * Update the YOLO inference confidence threshold on the backend.
 */
export async function updateConfidenceThreshold(value: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/detect/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidence_threshold: value }),
    });
    if (!res.ok) throw new Error("Failed to update confidence threshold.");
}

/**
 * Fetch the current backend inference config.
 */
export async function fetchConfig(): Promise<{ confidence_threshold: number }> {
    const res = await fetch(`${BASE_URL}/detect/config`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch config.");
    return res.json();
}

/**
 * Download a PDF session report as a Blob.
 */
export async function generateReport(sessionId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/report/${sessionId}`);
    if (!res.ok) throw new Error("Failed to generate report.");
    return res.blob();
}

/**
 * Check for anomalies across recent detection sessions.
 */
export async function fetchAnomalyCheck(): Promise<{
    anomalies: Array<{ type: string; message: string; average: number; current: number }>;
    average: number;
    current: number;
    session_count: number;
}> {
    const res = await fetch(`${BASE_URL}/anomaly/check`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to run anomaly check.");
    return res.json();
}

/**
 * Update an existing session's data (e.g. expected_count) through the backend.
 */
export async function updateSession(sessionId: string, data: any): Promise<void> {
    const res = await fetch(`${BASE_URL}/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update session.");
}
