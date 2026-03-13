"""
Image processing utilities — resizing, annotation, and base64 encoding.
"""

import base64
import io
from typing import List, Tuple

import cv2
import numpy as np
from PIL import Image


def resize_frame(frame: np.ndarray, max_width: int = 1280, max_height: int = 720) -> np.ndarray:
    """Resize frame while maintaining aspect ratio."""
    h, w = frame.shape[:2]
    scale = min(max_width / w, max_height / h, 1.0)
    if scale < 1.0:
        new_w, new_h = int(w * scale), int(h * scale)
        frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return frame


def draw_bounding_boxes(
    frame: np.ndarray,
    boxes: List[Tuple[int, int, int, int]],
    labels: List[str],
    confidences: List[float],
    color: Tuple[int, int, int] = (0, 200, 0),
) -> np.ndarray:
    """
    Draw bounding boxes with labels on a frame.

    Args:
        frame: BGR image array
        boxes: list of (x1, y1, x2, y2) ints
        labels: class names per box
        confidences: confidence scores per box
        color: BGR color for boxes

    Returns:
        Annotated frame
    """
    annotated = frame.copy()
    for (x1, y1, x2, y2), label, conf in zip(boxes, labels, confidences):
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        text = f"{label} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            annotated,
            text,
            (x1 + 2, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
    return annotated


def frame_to_base64(frame: np.ndarray, fmt: str = "JPEG") -> str:
    """Convert a BGR numpy frame to a base64-encoded string."""
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    buf = io.BytesIO()
    pil_img.save(buf, format=fmt, quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def bytes_to_frame(image_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes (JPEG/PNG) to a BGR numpy array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image bytes — unsupported format.")
    return frame
