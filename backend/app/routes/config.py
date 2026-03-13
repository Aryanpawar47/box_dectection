"""
Config route — POST /detect/config
Updates the global confidence threshold used by the YOLO inference.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()

# Shared mutable config — this is read by detection_service
_config = {"confidence_threshold": 0.5}


def get_confidence() -> float:
    return _config["confidence_threshold"]


class ConfigUpdateRequest(BaseModel):
    confidence_threshold: float = Field(..., ge=0.05, le=0.99)


@router.post("/detect/config")
async def update_config(req: ConfigUpdateRequest) -> JSONResponse:
    """Update the global YOLO inference confidence threshold."""
    _config["confidence_threshold"] = req.confidence_threshold
    return JSONResponse({
        "status": "updated",
        "confidence_threshold": _config["confidence_threshold"]
    })


@router.get("/detect/config")
async def get_config() -> JSONResponse:
    """Return the current inference config."""
    return JSONResponse(_config)
