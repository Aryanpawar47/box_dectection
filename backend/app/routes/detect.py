"""
Detection routes — POST /detect, GET /stats, GET /health
"""

import asyncio
import os
import tempfile
from typing import Any, Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile  # type: ignore
from fastapi.responses import JSONResponse  # type: ignore

from app.services.counting_service import DetectionSession, get_recent_sessions, save_session_to_firebase  # type: ignore
from app.services.detection_service import detect_boxes_in_frame  # type: ignore
from app.utils.image_processing import bytes_to_frame  # type: ignore
from app.utils.video_stream import extract_frames_from_file, get_video_metadata, save_upload_to_temp  # type: ignore
from pydantic import BaseModel  # type: ignore

class SessionCreateRequest(BaseModel):
    video_source: str
    frames_processed: int
    total_boxes_detected: int
    peak_count: int

router = APIRouter()

# Global state to track active long-running detection jobs
active_jobs: Dict[str, bool] = {}

@router.post("/session")
async def create_session(req: SessionCreateRequest) -> JSONResponse:
    session = DetectionSession(video_source=req.video_source)
    session.frames_processed = req.frames_processed
    session.total_boxes_detected = req.total_boxes_detected
    session.peak_count = req.peak_count
    doc_id = save_session_to_firebase(session)
    
    session_data = session.to_dict()
    session_data["document_id"] = doc_id
    
    return JSONResponse({"source_type": "video", **session_data})


@router.patch("/session/{session_id}")
async def update_session_route(session_id: str, data: Dict[str, Any]) -> JSONResponse:
    """Update an existing session."""
    from app.services.counting_service import update_session
    success = update_session(session_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return JSONResponse({"status": "updated"})


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Service health-check endpoint."""
    return {"status": "ok", "service": "box-detection-api"}


@router.post("/detect")
async def detect(
    file: UploadFile = File(...),
    source_type: str = Form(default="image"),  # "image" | "video"
    confidence: float = Form(default=0.5),
    job_id: str = Form(default=None),
) -> JSONResponse:
    """
    Detect boxes in an uploaded image or video.

    - **file**: Image (JPEG/PNG) or video (MP4/AVI/MOV)
    - **source_type**: "image" to process a single frame; "video" to process all frames
    - **confidence**: Detection confidence threshold (0.0–1.0)
    - **job_id**: Optional unique ID for cancelling the job mid-way and getting partial results.

    Returns JSON with box count, detections, and base64-annotated image (for images)
    or aggregated session data (for videos).
    """
    file_bytes = await file.read()

    if source_type == "image":
        try:
            frame = bytes_to_frame(file_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        result = detect_boxes_in_frame(frame, confidence_threshold=confidence, encode_image=True)

        # Save image detection as a single-frame session to Firestore so it appears on the dashboard
        session = DetectionSession(video_source=file.filename or "uploaded_image")
        session.record_frame(result)
        doc_id = save_session_to_firebase(session)

        return JSONResponse(
            {
                "source_type": "image",
                "box_count": result.box_count,
                "confidences": result.confidences,
                "annotated_image_b64": result.annotated_image_b64,
                "frame_width": result.frame_width,
                "frame_height": result.frame_height,
                "session_id": session.session_id,
                "document_id": doc_id,
            }
        )

    elif source_type == "video":
        # Save upload to temp file
        suffix = os.path.splitext(file.filename or ".mp4")[1] or ".mp4"
        tmp_path = await save_upload_to_temp(file_bytes, suffix=suffix)

        try:
            if job_id:
                active_jobs[job_id] = True

            metadata = get_video_metadata(tmp_path)
            session = DetectionSession(video_source=file.filename or "uploaded_video")

            # Run heavy CPU block in a separate thread to prevent event loop starvation
            def _process() -> None:
                for frame in extract_frames_from_file(tmp_path, sample_fps=5):
                    if job_id and not active_jobs.get(job_id, True):
                        break
                    result = detect_boxes_in_frame(frame, confidence_threshold=confidence, encode_image=False)
                    session.record_frame(result)
            
            await asyncio.to_thread(_process)

        finally:
            if job_id in active_jobs:
                active_jobs.pop(job_id, None)
            os.unlink(tmp_path)

        doc_id = save_session_to_firebase(session)
        session_data = session.to_dict()
        session_data["document_id"] = doc_id
        session_data["video_metadata"] = metadata

        return JSONResponse({"source_type": "video", **session_data})

    else:
        raise HTTPException(status_code=400, detail="source_type must be 'image' or 'video'.")


@router.post("/detect/stop/{job_id}")
async def stop_detection(job_id: str) -> JSONResponse:
    """Stop an ongoing video detection job to return partial results."""
    if job_id in active_jobs:
        active_jobs[job_id] = False
        return JSONResponse({"status": "stopping"})
    return JSONResponse({"status": "not_found"}, status_code=404)


@router.get("/stats")
async def get_stats(limit: int = 20) -> JSONResponse:
    """
    Return recent detection sessions from Firebase Firestore.

    - **limit**: Number of sessions to return (default 20, max 100)
    """
    limit = min(limit, 100)
    sessions = get_recent_sessions(limit=limit)
    return JSONResponse({"sessions": sessions, "count": len(sessions)})
