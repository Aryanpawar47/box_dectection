"""
FastAPI application entry point — CORS, router registration, lifespan events.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before anything else
load_dotenv()

from app.models.yolov8_model import get_model
from app.routes.detect import router as detect_router
from app.routes.config import router as config_router
from app.routes.report import router as report_router
from app.routes.anomaly import router as anomaly_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the YOLO model on startup to avoid cold-start latency."""
    print("[Startup] Pre-loading YOLOv8 model...")
    get_model()
    print("[Startup] Model ready.")
    yield
    print("[Shutdown] Cleaning up resources.")


app = FastAPI(
    title="Box Detection API",
    description=(
        "Real-time box detection and counting service powered by YOLOv8. "
        "Upload images or videos to detect and count boxes, and retrieve historical session statistics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(detect_router, tags=["Detection"])
app.include_router(config_router, tags=["Config"])
app.include_router(report_router, tags=["Reports"])
app.include_router(anomaly_router, tags=["Anomaly"])


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Box Detection API is running.",
        "docs": "/docs",
        "health": "/health",
    }
