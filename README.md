# AI-Based Box Detection and Counting System

Real-time industrial box detection powered by **YOLOv8**, **FastAPI**, **Next.js**, and **Firebase Firestore**.

---

## Architecture

```
Next.js Dashboard  →  FastAPI (Python)  →  YOLOv8 Detection  →  Firebase Firestore
      :3000                :8000
```

---

## Project Structure

```
boxDetection/
├── backend/           # Python FastAPI + YOLOv8
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/detect.py
│   │   ├── services/
│   │   ├── models/
│   │   └── utils/
│   ├── weights/       # Place box_detection_model.pt here
│   └── requirements.txt
├── frontend/          # Next.js + Tailwind + Recharts
│   ├── app/
│   ├── components/
│   └── lib/
└── shared/
    └── config/        # Firebase config (fill in credentials)
```

---

## Setup

### 1. Python Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your Firebase credentials and model path

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Next.js Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.local.example .env.local
# Edit .env.local with your Firebase web config

# Start dev server
npm run dev
```

Dashboard available at: http://localhost:3000/dashboard

### 3. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore** in Native mode
3. Download the **service account JSON** key → paste into `shared/config/firebase_config.json`
4. Copy your **web app config** → fill into `frontend/.env.local`

---

## API Endpoints

| Method | Endpoint  | Description                              |
|--------|-----------|------------------------------------------|
| GET    | /health   | Service health check                     |
| POST   | /detect   | Upload image or video for detection      |
| GET    | /stats    | Recent detection sessions from Firestore |

### POST /detect

| Field       | Type   | Description                          |
|-------------|--------|--------------------------------------|
| file        | File   | JPEG, PNG, MP4, AVI, or MOV          |
| source_type | string | `"image"` or `"video"`               |
| confidence  | float  | Detection threshold (default `0.5`)  |

---

## YOLOv8 Model

The backend uses **YOLOv8n** (pretrained) as a fallback. To use a custom box-detection model:

1. Train: `yolo train data=boxes.yaml model=yolov8n.pt epochs=100`
2. Copy `runs/detect/train/weights/best.pt` → `backend/weights/box_detection_model.pt`
3. Set `MODEL_WEIGHTS_PATH=weights/box_detection_model.pt` in `.env`

---

## Tech Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Frontend | Next.js 15, Tailwind CSS, Recharts |
| Backend  | Python 3.10+, FastAPI, Uvicorn  |
| AI Model | YOLOv8 (Ultralytics)            |
| Vision   | OpenCV                          |
| Database | Firebase Firestore              |
