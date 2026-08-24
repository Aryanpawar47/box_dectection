"""
FastAPI application entry point — CORS, router registration, lifespan events.
Includes 5-Layer Smart Inventory with Conveyor WebSocket, QR Detection, and MongoDB/Auth.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before anything else
load_dotenv()

from app.models.yolov8_model import get_model
from app.db.mongo import init_db
from app.services.auth_service import seed_default_users
from app.services.camera_service import get_camera_service
from app.routes.detect import router as detect_router
from app.routes.config import router as config_router
from app.routes.report import router as report_router
from app.routes.anomaly import router as anomaly_router
from app.routes.stream import router as stream_router
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load YOLO model, connect to MongoDB, seed default admin accounts and start camera."""
    print("[Startup] Initializing Database & Auth...")
    await init_db()
    await seed_default_users()

    print("[Startup] Pre-loading YOLOv8 model...")
    get_model()
    print("[Startup] Model ready.")

    # Start conveyor camera simulator by default
    camera = get_camera_service()
    camera.start(source_type="simulator")

    yield

    print("[Shutdown] Cleaning up camera and services.")
    camera.stop()


app = FastAPI(
    title="Smart Inventory Box Detection API",
    description=(
        "5-Layer Automated Smart Inventory System powered by YOLOv8, OpenCV, QR Detection, "
        "and Line-Crossing Counting for Conveyor Belts."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local development & websockets
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(stream_router, tags=["Conveyor Stream & Camera"])
app.include_router(auth_router, tags=["Authentication"])
app.include_router(admin_router, tags=["Admin & Inventory"])
app.include_router(detect_router, tags=["Detection"])
app.include_router(config_router, tags=["Config"])
app.include_router(report_router, tags=["Reports"])
app.include_router(anomaly_router, tags=["Anomaly"])


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Computer Vision Smart Inventory Management API is running.",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "websocket_conveyor": "/ws/conveyor",
    }
