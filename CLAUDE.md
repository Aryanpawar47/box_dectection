# CLAUDE.md

## Project Name

**AI-Based Box Detection and Counting System**

## Project Overview

This project is a real-time computer vision system that detects and counts **boxes only** using a YOLOv8 model.
The system processes video streams (uploaded video, webcam, or simulated conveyor belt footage), detects boxes, and stores the count results in Firebase.

The application consists of:

* **Frontend:** Next.js (React-based UI dashboard)
* **Backend AI Service:** Python (YOLOv8 + OpenCV)
* **Database:** Firebase Firestore
* **Communication:** REST API between Next.js and Python service

The goal is to simulate an industrial **automated inventory monitoring system** that can later be deployed in a real factory environment with cameras and conveyor belts.

---

# System Architecture

Frontend (Next.js Dashboard)
↓
API Request (REST)
↓
Python AI Service (YOLOv8 Detection)
↓
Object Detection + Box Counting
↓
Save Results to Firebase
↓
Return Results to Frontend Dashboard

---

# Core Features

### 1. Box Detection

The system uses YOLOv8 to detect objects in frames.

The detection model must **only detect boxes**, not other objects such as people, vehicles, or animals.

Custom training may be applied if necessary.

### 2. Real-Time Counting

Boxes are counted using a **line-crossing logic** or **frame detection aggregation**.

Each detected box increments the count.

### 3. Video Processing

Supported input sources:

* Uploaded video
* Webcam feed
* Simulated conveyor belt video

### 4. Dashboard Monitoring

The Next.js frontend provides:

* Live detection preview
* Total box count
* Detection statistics
* Export results

### 5. Data Storage

Firebase Firestore stores:

* Timestamp
* Total boxes detected
* Video session ID
* Detection metadata

---

# Tech Stack

## Frontend

* Next.js
* React
* Tailwind CSS
* Chart.js / Recharts (analytics visualization)

## Backend AI Service

* Python
* YOLOv8 (Ultralytics)
* OpenCV
* FastAPI (REST API)

## Database

* Firebase Firestore

## Development Tools

* Node.js
* Python 3.10+
* Git

---

# Folder Structure

project-root/

frontend/
│
├── app/
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── components/
│   │
│   ├── upload/
│   │   └── page.tsx
│   │
│   └── layout.tsx
│
├── components/
│   ├── VideoPlayer.tsx
│   ├── BoxCounter.tsx
│   ├── AnalyticsChart.tsx
│
├── lib/
│   ├── firebase.ts
│   └── api.ts
│
└── styles/

backend/

│
├── app/
│   ├── main.py
│   ├── routes/
│   │   └── detect.py
│   │
│   ├── services/
│   │   ├── detection_service.py
│   │   └── counting_service.py
│   │
│   ├── models/
│   │   └── yolov8_model.py
│   │
│   └── utils/
│       ├── video_stream.py
│       └── image_processing.py
│
├── weights/
│   └── box_detection_model.pt
│
└── requirements.txt

shared/

├── config/
│   └── firebase_config.json

---

# Detection Logic

The YOLOv8 model is loaded in the backend service.

Steps:

1. Receive video frame
2. Run YOLOv8 inference
3. Filter detections to **box class only**
4. Draw bounding boxes
5. Count detected boxes
6. Send results to frontend
7. Store detection result in Firebase

---

# Backend API Endpoints

POST /detect

* Upload frame or video
* Returns detected boxes and count

GET /stats

* Returns detection statistics

GET /health

* Service status check

---

# Firebase Data Model

collection: detection_sessions

fields:

* session_id
* timestamp
* box_count
* video_source
* metadata

---

# Model Requirements

The YOLOv8 model must:

* Detect only **boxes**
* Ignore irrelevant objects
* Maintain high detection confidence
* Work in real-time inference

If necessary, train a custom dataset using labeled box images.

---

# Development Guidelines

1. Keep frontend and backend decoupled.
2. Ensure modular backend services.
3. Avoid mixing detection logic with API logic.
4. Follow proper folder structure.
5. Use environment variables for Firebase keys.

---

# Future Enhancements

* Conveyor belt object tracking
* Multiple camera support
* Edge device deployment (Jetson Nano)
* Real-time industrial alerts
* RFID integration

---

# Development Workflow

1. Start Python AI service
2. Run Next.js frontend
3. Upload video or start webcam
4. Run detection pipeline
5. Store results in Firebase
6. Visualize analytics in dashboard

---

# Objective

Build a scalable **AI-powered industrial monitoring system** capable of detecting and counting boxes in real-time using computer vision.

This prototype simulates a smart manufacturing environment and can be deployed in factories with minimal hardware changes.
