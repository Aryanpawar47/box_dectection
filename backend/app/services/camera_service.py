"""
Camera Service — Low-latency, multi-source video capture.
Optimized for Windows with DirectShow (CAP_DSHOW) and real-time thread buffering for 30+ FPS smooth feed.
"""

import math
import os
import sys
import threading
import time
from typing import Optional
import cv2
import numpy as np


class SyntheticConveyorGenerator:
    """Generates synthetic conveyor belt animation with moving boxes and QR markers."""
    def __init__(self, width: int = 640, height: int = 480):
        self.width = width
        self.height = height
        self.box_y = -140.0
        self.box_speed = 3.2
        self.box_width = 190
        self.box_height = 140
        self.belt_offset = 0
        self.qr_codes = ["BOX-ELEC-001", "BOX-AUTO-002", "BOX-FOOD-003", "BOX-PHAR-004", "BOX-GEN-005"]
        self.current_qr_idx = 0

    def get_frame(self) -> np.ndarray:
        frame = np.full((self.height, self.width, 3), (35, 38, 42), dtype=np.uint8)

        self.belt_offset = (self.belt_offset + int(self.box_speed)) % 40
        belt_left = 120
        belt_right = self.width - 120

        # Conveyor metallic rails
        cv2.rectangle(frame, (belt_left - 15, 0), (belt_left, self.height), (70, 75, 80), -1)
        cv2.rectangle(frame, (belt_right, 0), (belt_right + 15, self.height), (70, 75, 80), -1)

        # Conveyor rubber belt
        cv2.rectangle(frame, (belt_left, 0), (belt_right, self.height), (20, 22, 25), -1)

        # Moving belt slats
        for y in range(-40 + self.belt_offset, self.height + 40, 40):
            cv2.line(frame, (belt_left, y), (belt_right, y), (42, 46, 50), 2)

        # Move box smoothly
        self.box_y += self.box_speed
        if self.box_y > self.height + 60:
            self.box_y = -self.box_height - 20
            self.current_qr_idx = (self.current_qr_idx + 1) % len(self.qr_codes)

        bx1 = int((belt_left + belt_right) / 2 - self.box_width / 2)
        by1 = int(self.box_y)
        bx2 = bx1 + self.box_width
        by2 = by1 + self.box_height

        # Shadow
        cv2.rectangle(frame, (bx1 + 6, by1 + 6), (bx2 + 6, by2 + 6), (12, 14, 16), -1)

        # Cardboard box body (industrial tan cardboard)
        cv2.rectangle(frame, (bx1, by1), (bx2, by2), (65, 115, 160), -1)
        cv2.rectangle(frame, (bx1, by1), (bx2, by2), (40, 80, 120), 2)

        # Sealing tape
        tape_h = 24
        tape_y1 = by1 + self.box_height // 2 - tape_h // 2
        cv2.rectangle(frame, (bx1, tape_y1), (bx2, tape_y1 + tape_h), (80, 140, 185), -1)

        # QR Code Label
        qr_size = 52
        qrx1 = bx1 + 18
        qry1 = by1 + 18
        qrx2 = qrx1 + qr_size
        qry2 = qry1 + qr_size

        if by1 > -self.box_height and by2 < self.height + self.box_height:
            cv2.rectangle(frame, (qrx1 - 4, qry1 - 4), (qrx2 + 4, qry2 + 4), (245, 245, 245), -1)
            cv2.rectangle(frame, (qrx1, qry1), (qrx2, qry2), (20, 20, 20), 2)
            cv2.rectangle(frame, (qrx1 + 4, qry1 + 4), (qrx1 + 16, qry1 + 16), (20, 20, 20), -1)
            cv2.rectangle(frame, (qrx2 - 16, qry1 + 4), (qrx2 - 4, qry1 + 16), (20, 20, 20), -1)
            cv2.rectangle(frame, (qrx1 + 4, qry2 - 16), (qrx1 + 16, qry2 - 4), (20, 20, 20), -1)
            qr_text = self.qr_codes[self.current_qr_idx]
            cv2.putText(frame, qr_text, (bx1 + 10, by2 - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        return frame


class CameraStreamService:
    """Singleton service for live video capture with low-latency dedicated thread reader."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CameraStreamService, cls).__new__(cls)
            cls._instance._init_service()
        return cls._instance

    def _init_service(self):
        self.source_type: str = "simulator"
        self.source_path: str = "0"
        self.cap: Optional[cv2.VideoCapture] = None
        self.simulator = SyntheticConveyorGenerator()
        self.latest_frame: Optional[np.ndarray] = None
        self.is_running: bool = False
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None
        self.frame_count: int = 0

    def start(self, source_type: str = "simulator", source_path: str = "0"):
        self.stop()
        self.source_type = source_type
        self.source_path = source_path
        self.is_running = True

        if source_type in ["webcam", "ip_cam", "video_file"]:
            try:
                if source_type == "webcam" and str(source_path).isdigit():
                    cam_idx = int(source_path)
                    # Use cv2.CAP_DSHOW on Windows for instant webcam opening and 0-buffer latency
                    if sys.platform.startswith("win"):
                        self.cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
                    else:
                        self.cap = cv2.VideoCapture(cam_idx)
                else:
                    self.cap = cv2.VideoCapture(source_path)

                if self.cap and self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_FPS, 30)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    print(f"[Camera] Opened hardware camera {source_path} successfully at 640x480.")
                else:
                    print(f"[Camera] Could not open {source_type} at {source_path}. Falling back to Conveyor Simulator.")
                    self.source_type = "simulator"
                    self.cap = None
            except Exception as e:
                print(f"[Camera] Camera error: {e}. Using Simulator.")
                self.source_type = "simulator"
                self.cap = None

        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        print(f"[Camera] Camera capture loop running ({self.source_type})")

    def _capture_loop(self):
        while self.is_running:
            frame = None
            if self.source_type == "simulator":
                frame = self.simulator.get_frame()
                time.sleep(0.03)  # ~30 FPS for simulation
            elif self.cap and self.cap.isOpened():
                ret, captured = self.cap.read()
                if ret and captured is not None:
                    frame = captured
                else:
                    if self.source_type == "video_file":
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    time.sleep(0.01)

            if frame is not None:
                with self.lock:
                    self.latest_frame = frame
                    self.frame_count += 1

    def get_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            if self.source_type == "simulator":
                return self.simulator.get_frame()
            return None

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.5)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        print("[Camera] Camera service stopped.")

    def get_status(self) -> dict:
        return {
            "is_running": self.is_running,
            "source_type": self.source_type,
            "source_path": self.source_path,
            "frame_count": self.frame_count,
            "has_frame": self.latest_frame is not None
        }


def get_camera_service() -> CameraStreamService:
    return CameraStreamService()
