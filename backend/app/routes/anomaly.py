"""
Anomaly route — GET /anomaly/check
Detects unusual patterns in detection history using a moving average.
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

SPIKE_RATIO = 1.6     # 60% above average = spike
DROP_RATIO = 0.5      # 50% below average = drop
MIN_SESSIONS = 3      # minimum history needed


def _get_db():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../shared/config/firebase_config.json")
        project_id = os.getenv("FIREBASE_PROJECT_ID")

        if not firebase_admin._apps:
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred, {"projectId": project_id})

        return firestore.client()
    except Exception as e:
        print(f"[Anomaly] Firebase error: {e}")
        return None


def _get_recent_sessions(limit: int = 20) -> List[Dict[str, Any]]:
    db = _get_db()
    if not db:
        return []
    try:
        docs = (
            db.collection("detection_sessions")
            .order_by("started_at", direction="DESCENDING")
            .limit(limit)
            .stream()
        )
        return [d.to_dict() for d in docs]
    except Exception as e:
        print(f"[Anomaly] Fetch error: {e}")
        return []


def _save_anomaly(event: Dict[str, Any]) -> None:
    db = _get_db()
    if not db:
        return
    try:
        db.collection("anomaly_events").add(event)
    except Exception as e:
        print(f"[Anomaly] Save error: {e}")


@router.get("/anomaly/check")
async def check_anomaly() -> JSONResponse:
    """Calculate moving-average anomalies from recent detection sessions."""
    sessions = _get_recent_sessions(20)

    if len(sessions) < MIN_SESSIONS:
        return JSONResponse({
            "anomalies": [],
            "message": f"Need at least {MIN_SESSIONS} sessions for anomaly detection.",
            "session_count": len(sessions)
        })

    counts = [s.get("total_boxes_detected", 0) for s in sessions]
    average = sum(counts[1:]) / len(counts[1:])  # exclude current
    current = counts[0]
    current_session = sessions[0]

    anomalies: List[Dict[str, Any]] = []

    if average > 0 and current >= average * SPIKE_RATIO:
        event = {
            "type": "spike",
            "session_id": current_session.get("session_id"),
            "average": round(average, 1),
            "current": current,
            "message": f"Spike detected: {current} boxes (avg {average:.1f})",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }
        anomalies.append(event)
        _save_anomaly(event)

    elif average > 0 and current <= average * DROP_RATIO:
        event = {
            "type": "drop",
            "session_id": current_session.get("session_id"),
            "average": round(average, 1),
            "current": current,
            "message": f"Drop detected: {current} boxes (avg {average:.1f})",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }
        anomalies.append(event)
        _save_anomaly(event)

    elif current == 0 and average > 5:
        event = {
            "type": "inactivity",
            "session_id": current_session.get("session_id"),
            "average": round(average, 1),
            "current": 0,
            "message": f"Detection inactivity: 0 boxes (avg {average:.1f})",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }
        anomalies.append(event)
        _save_anomaly(event)

    return JSONResponse({
        "anomalies": anomalies,
        "average": round(average, 1),
        "current": current,
        "session_count": len(sessions)
    })
