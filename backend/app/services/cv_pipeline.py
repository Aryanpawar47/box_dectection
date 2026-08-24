"""
Computer Vision Pipeline — Box-Only Detection + Anti-Face/Skin Filter + QR Decoding + Line Crossing.
Optimized for 30+ FPS smooth camera streaming with zero lag.
"""

import asyncio
import base64
import math
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import cv2
import numpy as np

from app.models.yolov8_model import get_model
from app.db.mongo import get_product_by_qr, record_box_crossing


def is_skin_or_face(crop_bgr: np.ndarray) -> bool:
    """Detect if bounding box contains human skin/face to reject false positives."""
    if crop_bgr.size == 0:
        return False
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    # Human skin color range in HSV
    lower_skin = np.array([0, 38, 50], dtype=np.uint8)
    upper_skin = np.array([25, 200, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_skin, upper_skin)
    skin_pixels = cv2.countNonZero(mask)
    total_pixels = crop_bgr.shape[0] * crop_bgr.shape[1]
    if total_pixels == 0:
        return False
    skin_ratio = skin_pixels / total_pixels
    # If more than 28% of the box is skin tone, it is a person/face/hand
    return skin_ratio > 0.28


class TrackedBox:
    def __init__(self, track_id: int, bbox: List[int], confidence: float, qr_code: Optional[str] = None):
        self.track_id = track_id
        self.bbox = bbox  # [x1, y1, x2, y2]
        self.confidence = confidence
        self.qr_code = qr_code
        self.product_name: Optional[str] = None
        self.centroid = ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
        self.history: List[Tuple[int, int]] = [self.centroid]
        self.crossed_line: bool = False
        self.last_seen: float = time.time()

    def update(self, bbox: List[int], confidence: float, qr_code: Optional[str] = None):
        self.bbox = bbox
        self.confidence = confidence
        if qr_code:
            self.qr_code = qr_code
        self.centroid = ((bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2)
        self.history.append(self.centroid)
        if len(self.history) > 15:
            self.history.pop(0)
        self.last_seen = time.time()


class CVPipeline:
    def __init__(self):
        self.model = get_model()
        self.qr_detector = cv2.QRCodeDetector()
        self.tracked_objects: Dict[int, TrackedBox] = {}
        self.next_track_id: int = 1
        self.total_crossed_count: int = 0
        self.counted_ids: Set[int] = set()
        self.line_ratio: float = 0.50
        self.confidence_threshold: float = 0.45
        self.current_session_id: str = "conveyor_live"
        self.recent_events: List[Dict[str, Any]] = []
        self.frame_counter: int = 0
        self.cached_detections: List[Dict[str, Any]] = []

    def set_config(self, line_ratio: Optional[float] = None, confidence: Optional[float] = None):
        if line_ratio is not None:
            self.line_ratio = max(0.1, min(0.9, line_ratio))
        if confidence is not None:
            self.confidence_threshold = max(0.15, min(0.99, confidence))

    def reset_counter(self):
        self.total_crossed_count = 0
        self.counted_ids.clear()
        self.tracked_objects.clear()
        self.recent_events.clear()

    def _decode_qr_codes(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        qr_results = []
        try:
            retval, decoded_info, points, _ = self.qr_detector.detectAndDecodeMulti(frame)
            if retval and decoded_info:
                for text, pts in zip(decoded_info, points):
                    if text:
                        qr_results.append({"text": text, "pts": pts})
        except Exception:
            pass

        try:
            from pyzbar.pyzbar import decode
            for obj in decode(frame):
                text = obj.data.decode("utf-8")
                if text and not any(r["text"] == text for r in qr_results):
                    rect = obj.rect
                    qr_results.append({
                        "text": text,
                        "pts": np.array([[rect.left, rect.top], [rect.left + rect.width, rect.top],
                                         [rect.left + rect.width, rect.top + rect.height], [rect.left, rect.top + rect.height]])
                    })
        except Exception:
            pass

        return qr_results

    def process_frame(self, frame: np.ndarray, is_simulation: bool = False) -> Dict[str, Any]:
        h, w = frame.shape[:2]
        line_y = int(h * self.line_ratio)
        self.frame_counter += 1

        # Run inference every 2nd frame to keep streaming at 30+ FPS
        detected_boxes: List[Dict[str, Any]] = []

        if self.frame_counter % 2 == 1 or len(self.cached_detections) == 0:
            # 1. YOLOv8 Fast Inference (320px input size for ~10ms execution)
            try:
                results = self.model.predict(
                    source=frame,
                    conf=self.confidence_threshold,
                    imgsz=320,
                    verbose=False
                )
                for r in results:
                    boxes = r.boxes
                    if boxes is None or len(boxes) == 0:
                        continue
                    for box in boxes:
                        cls_id = int(box.cls[0].cpu().numpy())
                        conf = float(box.conf[0].cpu().numpy())

                        # CRITICAL: Exclude Person (class 0) and non-package objects
                        if cls_id == 0:  # 0 is 'person'
                            continue

                        xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                        bx1, by1, bx2, by2 = max(0, xyxy[0]), max(0, xyxy[1]), min(w, xyxy[2]), min(h, xyxy[3])
                        bw, bh = bx2 - bx1, by2 - by1

                        # Reject bad aspect ratios or areas
                        area = bw * bh
                        if area < 2500 or area > (0.65 * w * h):
                            continue
                        aspect = bw / max(1, bh)
                        if aspect < 0.35 or aspect > 2.8:
                            continue

                        # Reject Human Face / Skin
                        crop = frame[by1:by2, bx1:bx2]
                        if is_skin_or_face(crop):
                            continue

                        detected_boxes.append({"bbox": [bx1, by1, bx2, by2], "conf": conf})
            except Exception:
                pass

            # 2. Simulator mode cardboard detection
            if is_simulation and len(detected_boxes) == 0:
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                mask = cv2.inRange(hsv, np.array([10, 60, 60]), np.array([25, 255, 220]))
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if 5000 < area < (0.6 * w * h):
                        x, y, bw, bh = cv2.boundingRect(cnt)
                        detected_boxes.append({"bbox": [x, y, x + bw, y + bh], "conf": 0.92})

            self.cached_detections = detected_boxes
        else:
            detected_boxes = self.cached_detections

        # 3. QR Code Detections
        qr_detections = self._decode_qr_codes(frame)

        # 4. Centroid Tracking & Line Crossing
        current_time = time.time()
        new_crossed_events = []
        unmatched_detections = list(range(len(detected_boxes)))

        for track_id, tracked in list(self.tracked_objects.items()):
            best_match_idx = None
            min_dist = float("inf")
            for idx in unmatched_detections:
                det = detected_boxes[idx]
                det_center = ((det["bbox"][0] + det["bbox"][2]) // 2, (det["bbox"][1] + det["bbox"][3]) // 2)
                dist = math.hypot(det_center[0] - tracked.centroid[0], det_center[1] - tracked.centroid[1])
                if dist < 95 and dist < min_dist:
                    min_dist = dist
                    best_match_idx = idx

            if best_match_idx is not None:
                det = detected_boxes[best_match_idx]
                unmatched_detections.remove(best_match_idx)

                # Match QR Code to box
                matched_qr = tracked.qr_code
                for qr in qr_detections:
                    q_pts = qr["pts"]
                    q_cx = int(np.mean(q_pts[:, 0])) if hasattr(q_pts, "__len__") else det["bbox"][0] + 20
                    q_cy = int(np.mean(q_pts[:, 1])) if hasattr(q_pts, "__len__") else det["bbox"][1] + 20
                    if det["bbox"][0] - 25 <= q_cx <= det["bbox"][2] + 25 and det["bbox"][1] - 25 <= q_cy <= det["bbox"][3] + 25:
                        matched_qr = qr["text"]
                        break

                prev_y = tracked.centroid[1]
                tracked.update(det["bbox"], det["conf"], matched_qr)
                curr_y = tracked.centroid[1]

                # Trigger Line Crossing
                if not tracked.crossed_line and track_id not in self.counted_ids:
                    if (prev_y <= line_y and curr_y > line_y) or (prev_y >= line_y and curr_y < line_y):
                        tracked.crossed_line = True
                        self.counted_ids.add(track_id)
                        self.total_crossed_count += 1

                        event_data = {
                            "track_id": track_id,
                            "box_id": f"BOX-{track_id:04d}",
                            "qr_code": tracked.qr_code or f"QR-BOX-{track_id:03d}",
                            "confidence": round(tracked.confidence, 2),
                            "timestamp": time.strftime("%H:%M:%S"),
                            "session_id": self.current_session_id
                        }
                        self.recent_events.insert(0, event_data)
                        self.recent_events = self.recent_events[:50]
                        new_crossed_events.append(event_data)
            else:
                if current_time - tracked.last_seen > 0.8:
                    del self.tracked_objects[track_id]

        # Add new tracked boxes
        for idx in unmatched_detections:
            det = detected_boxes[idx]
            matched_qr = None
            for qr in qr_detections:
                matched_qr = qr["text"]
                break

            new_box = TrackedBox(self.next_track_id, det["bbox"], det["conf"], matched_qr)
            self.tracked_objects[self.next_track_id] = new_box
            self.next_track_id += 1

        # 5. Fast Frame Annotation
        annotated = frame.copy()

        # Virtual Counting Line
        cv2.line(annotated, (0, line_y), (w, line_y), (0, 255, 230), 2)
        cv2.putText(annotated, f"COUNTING LINE (Y={line_y})", (15, line_y - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 230), 1, cv2.LINE_AA)

        # Draw detected boxes
        for track_id, obj in self.tracked_objects.items():
            x1, y1, x2, y2 = obj.bbox
            color = (0, 230, 100) if obj.crossed_line else (255, 165, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            cx, cy = obj.centroid
            cv2.circle(annotated, (cx, cy), 4, (0, 0, 255), -1)

            label = f"BOX #{track_id} ({int(obj.confidence*100)}%)"
            if obj.qr_code:
                label += f" | {obj.qr_code}"

            cv2.rectangle(annotated, (x1, max(0, y1 - 20)), (x1 + len(label) * 8 + 8, y1), color, -1)
            cv2.putText(annotated, label, (x1 + 4, max(12, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)

        # Fast JPEG compression
        _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 55])
        frame_b64 = base64.b64encode(buffer).decode("utf-8")

        return {
            "frame_b64": frame_b64,
            "total_count": self.total_crossed_count,
            "active_boxes": len(self.tracked_objects),
            "new_events": new_crossed_events,
            "recent_events": self.recent_events[:10],
            "line_y": line_y,
            "width": w,
            "height": h,
        }


_pipeline_instance = None

def get_cv_pipeline() -> CVPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = CVPipeline()
    return _pipeline_instance
