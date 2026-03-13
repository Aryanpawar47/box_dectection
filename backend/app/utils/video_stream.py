"""
Video stream utilities — extract frames from uploaded video files or webcam.
"""

import asyncio
import os
import tempfile
from typing import AsyncGenerator, Generator, List

import cv2
import numpy as np


def extract_frames_from_file(video_path: str, sample_fps: int = 5) -> Generator[np.ndarray, None, None]:
    """
    Yield frames from a video file at a given sampling rate.

    Args:
        video_path: Absolute path to the video file.
        sample_fps: How many frames per second to sample.

    Yields:
        BGR numpy frames.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video file: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(1, int(source_fps / sample_fps))
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                yield frame
            frame_idx += 1
    finally:
        cap.release()


async def save_upload_to_temp(file_bytes: bytes, suffix: str = ".mp4") -> str:
    """
    Write uploaded video bytes to a temporary file and return the path.
    Caller is responsible for deleting the file after use.
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(file_bytes)
    tmp.flush()
    tmp.close()
    return tmp.name


def get_video_metadata(video_path: str) -> dict:
    """Return basic metadata for a video file."""
    cap = cv2.VideoCapture(video_path)
    metadata = {
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
    }
    cap.release()
    return metadata
