"""
YOLOv8 Model Loader — Singleton pattern for efficient model reuse.
"""

import os
from pathlib import Path
from typing import Optional

from ultralytics import YOLO

_model_instance: Optional[YOLO] = None

# Default weights fallback (pretrained YOLOv8 nano)
DEFAULT_WEIGHTS = "yolov8n.pt"


def get_model() -> YOLO:
    """Return cached YOLO model, loading it on first call."""
    global _model_instance

    if _model_instance is None:
        weights_path = os.getenv("MODEL_WEIGHTS_PATH", DEFAULT_WEIGHTS)
        weights_file = Path(weights_path)

        if weights_file.exists():
            print(f"[Model] Loading custom weights: {weights_path}")
        else:
            print(
                f"[Model] Custom weights not found at '{weights_path}'. "
                f"Falling back to pretrained '{DEFAULT_WEIGHTS}'."
            )
            weights_path = DEFAULT_WEIGHTS

        _model_instance = YOLO(weights_path)
        print(f"[Model] Loaded successfully. Classes: {_model_instance.names}")

    return _model_instance


def reset_model() -> None:
    """Force reload model on next call (useful for hot-swapping weights)."""
    global _model_instance
    _model_instance = None
