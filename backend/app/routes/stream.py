"""
Stream and Camera routes — WebSocket /ws/conveyor and camera configuration endpoints.
Smooth 30+ FPS transmission with real-time MongoDB line-crossing persistence.
"""

import asyncio
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.services.camera_service import get_camera_service
from app.services.cv_pipeline import get_cv_pipeline
from app.db.mongo import record_box_crossing, get_product_by_qr, is_mongo_connected

router = APIRouter(tags=["Conveyor Stream & Camera"])


class CameraConfigRequest(BaseModel):
    line_ratio: Optional[float] = None
    confidence: Optional[float] = None


class CameraStartRequest(BaseModel):
    source_type: str = "simulator"  # "simulator", "webcam", "ip_cam", "video_file"
    source_path: str = "0"


@router.post("/camera/start")
async def start_camera(req: CameraStartRequest) -> Dict[str, Any]:
    camera = get_camera_service()
    camera.start(source_type=req.source_type, source_path=req.source_path)
    return {"status": "started", "config": camera.get_status()}


@router.post("/camera/stop")
async def stop_camera() -> Dict[str, Any]:
    camera = get_camera_service()
    camera.stop()
    return {"status": "stopped"}


@router.get("/camera/status")
async def camera_status() -> Dict[str, Any]:
    camera = get_camera_service()
    pipeline = get_cv_pipeline()
    return {
        "camera": camera.get_status(),
        "pipeline": {
            "total_count": pipeline.total_crossed_count,
            "line_ratio": pipeline.line_ratio,
            "confidence_threshold": pipeline.confidence_threshold,
            "active_tracked": len(pipeline.tracked_objects),
            "recent_events": pipeline.recent_events[:10]
        },
        "mongodb_connected": is_mongo_connected()
    }


@router.post("/camera/config")
async def update_camera_config(req: CameraConfigRequest) -> Dict[str, Any]:
    pipeline = get_cv_pipeline()
    pipeline.set_config(line_ratio=req.line_ratio, confidence=req.confidence)
    return {
        "status": "updated",
        "line_ratio": pipeline.line_ratio,
        "confidence_threshold": pipeline.confidence_threshold
    }


@router.post("/camera/reset-count")
async def reset_conveyor_count() -> Dict[str, Any]:
    pipeline = get_cv_pipeline()
    pipeline.reset_counter()
    return {"status": "reset", "total_count": 0}


@router.websocket("/ws/conveyor")
async def websocket_conveyor_stream(websocket: WebSocket):
    """
    High-frequency WebSocket endpoint streaming frames at 30+ FPS
    with box-only detection and MongoDB persistence.
    """
    await websocket.accept()
    camera = get_camera_service()
    pipeline = get_cv_pipeline()

    if not camera.is_running:
        camera.start(source_type="simulator")

    try:
        while True:
            frame = camera.get_frame()
            if frame is not None:
                is_sim = (camera.source_type == "simulator")
                cv_result = pipeline.process_frame(frame, is_simulation=is_sim)

                # Persist new line-crossing events to MongoDB
                for ev in cv_result.get("new_events", []):
                    qr_code = ev.get("qr_code")
                    product_info = await get_product_by_qr(qr_code) if qr_code else None
                    ev["product_name"] = product_info.get("name") if product_info else "Standard Box Package"
                    ev["sku"] = product_info.get("sku") if product_info else "N/A"
                    ev["category"] = product_info.get("category") if product_info else "General Goods"
                    await record_box_crossing(ev)

                await websocket.send_json(cv_result)

            # ~30 FPS sleep
            await asyncio.sleep(0.02)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WebSocket] Stream closed: {e}")
