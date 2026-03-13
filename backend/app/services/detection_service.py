"""
Detection Service — YOLOv8 inference with box-class filtering.
"""

import os
from dataclasses import dataclass, field
from typing import List, Tuple

import numpy as np
import torch

from app.models.yolov8_model import get_model
from app.utils.image_processing import draw_bounding_boxes, frame_to_base64, resize_frame

# Force determinism for PyTorch/Numpy during inference (though mostly relevant for training)
torch.manual_seed(0)
np.random.seed(0)

# COCO class names that represent "box-like" objects.
# Extend this list if using a custom model with a dedicated "box" class.
BOX_CLASS_NAMES = {"box", "cardboard box", "carton", "suitcase", "package"}

# When using pretrained COCO weights, 'suitcase' (class 28) is the closest proxy.
COCO_BOX_CLASS_IDS = {28}  # suitcase — replace with 0 when using custom box model


@dataclass
class DetectionResult:
    box_count: int
    boxes: List[Tuple[int, int, int, int]]  # (x1, y1, x2, y2)
    confidences: List[float]
    labels: List[str]
    annotated_image_b64: str = ""
    frame_width: int = 0
    frame_height: int = 0


def detect_boxes_in_frame(
    frame: np.ndarray,
    confidence_threshold: float | None = None,
    encode_image: bool = True,
) -> DetectionResult:
    """
    Run YOLOv8 inference on a single frame and return box detections only.

    Args:
        frame: BGR numpy image array.
        confidence_threshold: Override env-based threshold if provided.
        encode_image: Whether to include base64-annotated image in result.

    Returns:
        DetectionResult with filtered box detections.
    """
    if confidence_threshold is None:
        confidence_threshold = float(os.getenv("DETECTION_CONFIDENCE", "0.5"))

    model = get_model()
    frame = resize_frame(frame)
    h, w = frame.shape[:2]

    # Use strict deterministic parameters (iou=0.45 is standard, agnostic_nms prevents overlapping classes)
    results = model.predict(frame, conf=confidence_threshold, iou=0.45, agnostic_nms=True, verbose=False)

    boxes: List[Tuple[int, int, int, int]] = []
    confidences: List[float] = []
    labels: List[str] = []

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names.get(cls_id, "").lower()

            # Accept if class name matches known box names OR if class id in allowed set
            is_box_class = cls_name in BOX_CLASS_NAMES or cls_id in COCO_BOX_CLASS_IDS

            # If custom model has a single class (class 0 = box), also accept
            if len(model.names) == 1:
                is_box_class = True

            if not is_box_class:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf[0])
            boxes.append((x1, y1, x2, y2))
            confidences.append(conf)
            labels.append("box")

    annotated_b64 = ""
    if encode_image and boxes:
        annotated_frame = draw_bounding_boxes(frame, boxes, labels, confidences)
        annotated_b64 = frame_to_base64(annotated_frame)
    elif encode_image:
        annotated_b64 = frame_to_base64(frame)

    return DetectionResult(
        box_count=len(boxes),
        boxes=boxes,
        confidences=confidences,
        labels=labels,
        annotated_image_b64=annotated_b64,
        frame_width=w,
        frame_height=h,
    )
