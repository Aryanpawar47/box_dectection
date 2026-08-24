// Typed API client for the Python FastAPI backend
import { getAuthToken } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...customHeaders };
    const token = getAuthToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export function getWsUrl(path: string = "/ws/conveyor"): string {
    const cleanBase = BASE_URL.replace(/^http/, "ws");
    return `${cleanBase}${path}`;
}

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

export interface ProductItem {
    qr_code: string;
    name: string;
    category: string;
    sku: string;
    weight_kg?: number;
    target_stock?: number;
}

export interface BoxCrossingRecord {
    box_id: string;
    qr_code: string;
    product_name?: string;
    sku?: string;
    category?: string;
    confidence: number;
    timestamp: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

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
    if (jobId) form.append("job_id", jobId);

    const res = await fetch(`${BASE_URL}/detect`, {
        method: "POST",
        headers: getHeaders(),
        body: form,
        signal,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Detection request failed.");
    }
    return res.json();
}

export async function stopDetectionJob(jobId: string): Promise<void> {
    await fetch(`${BASE_URL}/detect/stop/${jobId}`, {
        method: "POST",
        headers: getHeaders(),
    });
}

export async function saveWebcamSession(stats: {
    video_source: string;
    frames_processed: number;
    total_boxes_detected: number;
    peak_count: number;
}): Promise<VideoDetectionResult> {
    const res = await fetch(`${BASE_URL}/session`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(stats),
    });
    if (!res.ok) throw new Error("Failed to save webcam session.");
    return res.json();
}

export async function fetchStats(limit: number = 20): Promise<StatsResponse> {
    const t = new Date().getTime();
    const res = await fetch(`${BASE_URL}/stats?limit=${limit}&_t=${t}`, {
        cache: "no-store",
        headers: getHeaders({ "Cache-Control": "no-cache" })
    });
    if (!res.ok) throw new Error("Failed to fetch stats.");
    return res.json();
}

export async function healthCheck(): Promise<{ status: string }> {
    const t = new Date().getTime();
    const res = await fetch(`${BASE_URL}/health?_t=${t}`, {
        cache: "no-store",
        headers: getHeaders({ "Cache-Control": "no-cache" })
    });
    if (!res.ok) throw new Error("Backend is unavailable.");
    return res.json();
}

export async function updateConfidenceThreshold(value: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/detect/config`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confidence_threshold: value }),
    });
    if (!res.ok) throw new Error("Failed to update confidence threshold.");
}

export async function fetchConfig(): Promise<{ confidence_threshold: number }> {
    const res = await fetch(`${BASE_URL}/detect/config`, { cache: "no-store", headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch config.");
    return res.json();
}

export async function generateReport(sessionId: string): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/report/${sessionId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to generate report.");
    return res.blob();
}

export async function fetchAnomalyCheck(): Promise<{
    anomalies: Array<{ type: string; message: string; average: number; current: number }>;
    average: number;
    current: number;
    session_count: number;
}> {
    const res = await fetch(`${BASE_URL}/anomaly/check`, { cache: "no-store", headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to run anomaly check.");
    return res.json();
}

export async function updateSession(sessionId: string, data: any): Promise<void> {
    const res = await fetch(`${BASE_URL}/session/${sessionId}`, {
        method: "PATCH",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update session.");
}

// ─── Live Camera & Conveyor Controls ──────────────────────────────────────────

export async function startCameraStream(sourceType: string = "simulator", sourcePath: string = "0"): Promise<any> {
    const res = await fetch(`${BASE_URL}/camera/start`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ source_type: sourceType, source_path: sourcePath }),
    });
    return res.json();
}

export async function stopCameraStream(): Promise<any> {
    const res = await fetch(`${BASE_URL}/camera/stop`, {
        method: "POST",
        headers: getHeaders(),
    });
    return res.json();
}

export async function getCameraStatus(): Promise<any> {
    const res = await fetch(`${BASE_URL}/camera/status`, {
        cache: "no-store",
        headers: getHeaders(),
    });
    return res.json();
}

export async function updateCameraConfig(lineRatio?: number, confidence?: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/camera/config`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ line_ratio: lineRatio, confidence }),
    });
    return res.json();
}

export async function resetConveyorCount(): Promise<any> {
    const res = await fetch(`${BASE_URL}/camera/reset-count`, {
        method: "POST",
        headers: getHeaders(),
    });
    return res.json();
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function apiLogin(username: string, password: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(err.detail ?? "Login failed");
    }
    return res.json();
}

export async function fetchDemoAccounts(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/auth/demo-accounts`);
    if (!res.ok) return [];
    return res.json();
}

// ─── Products & Admin API ─────────────────────────────────────────────────────

export async function fetchProducts(): Promise<ProductItem[]> {
    const res = await fetch(`${BASE_URL}/admin/products`, { cache: "no-store", headers: getHeaders() });
    if (!res.ok) return [];
    return res.json();
}

export async function createProduct(prod: ProductItem): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/products`, {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(prod),
    });
    if (!res.ok) throw new Error("Failed to save product.");
    return res.json();
}

export async function deleteProduct(qrCode: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/products/${qrCode}`, {
        method: "DELETE",
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete product.");
    return res.json();
}

export async function fetchBoxCrossingRecords(limit: number = 50): Promise<BoxCrossingRecord[]> {
    const res = await fetch(`${BASE_URL}/admin/box-records?limit=${limit}`, {
        cache: "no-store",
        headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
}

export async function fetchSystemInfo(): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/system-info`, {
        cache: "no-store",
        headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
}
