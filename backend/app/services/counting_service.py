"""
Counting Service — aggregates detection results and persists to Firebase Firestore.
Falls back to local JSON file storage if Firestore is unavailable.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.detection_service import DetectionResult

# Lazy Firebase import so the app still works without Firebase credentials
_db = None
_firebase_ok = None  # None = not tried yet, True = works, False = failed

# Local fallback storage path (inside backend folder)
_LOCAL_STORE = Path(__file__).parent.parent.parent / "data" / "sessions.json"


def _ensure_local_store():
    _LOCAL_STORE.parent.mkdir(parents=True, exist_ok=True)
    if not _LOCAL_STORE.exists():
        _LOCAL_STORE.write_text("[]", encoding="utf-8")


def _load_local_sessions() -> List[Dict[str, Any]]:
    _ensure_local_store()
    try:
        return json.loads(_LOCAL_STORE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_local_session(session_dict: Dict[str, Any]) -> None:
    sessions = _load_local_sessions()
    sessions.insert(0, session_dict)          # newest first
    sessions = sessions[:500]                  # keep at most 500 records
    _LOCAL_STORE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")


def _get_db():
    global _db, _firebase_ok
    if _firebase_ok is False:
        return None
    if _db is not None:
        return _db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        # Check if we're running on Streamlit Cloud
        is_streamlit = "streamlit" in sys.modules
        
        if is_streamlit:
            import streamlit as st
            if "firebase" in st.secrets:
                if not firebase_admin._apps:
                    # Load from secrets
                    cred_dict = dict(st.secrets["firebase"])
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                _db = firestore.client()
                _firebase_ok = True
                return _db

        creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../shared/config/firebase_config.json")
        project_id = os.getenv("FIREBASE_PROJECT_ID")

        abs_creds = os.path.abspath(creds_path)
        if not os.path.exists(abs_creds):
            print(f"[Firebase] ❌ Credentials file not found at: {abs_creds}")
            _firebase_ok = False
            return None

        if not firebase_admin._apps:
            cred = credentials.Certificate(abs_creds)
            firebase_admin.initialize_app(cred, {"projectId": project_id})

        _db = firestore.client()
        # Probe with a tiny read
        list(_db.collection("detection_sessions").limit(1).stream())
        _firebase_ok = True
        print("[Firebase] ✅ Firestore connected successfully.")
    except Exception as e:
        print(f"[Firebase] ❌ Could not connect to Firestore — {e}")
        # Only fallback if not on streamlit or if specifically failed
        _firebase_ok = False
        _db = None

    return _db


class DetectionSession:
    """Accumulates detection results for a single video/image session."""

    def __init__(self, video_source: str = "unknown"):
        self.session_id: str = str(uuid.uuid4())
        self.video_source: str = video_source
        self.started_at: datetime = datetime.now(timezone.utc)
        self.frames_processed: int = 0
        self.total_boxes_detected: int = 0
        self.per_frame_counts: List[int] = []
        self.peak_count: int = 0
        self.expected_count: Optional[int] = None

    def record_frame(self, result: DetectionResult) -> None:
        """Record detection result from one processed frame."""
        self.frames_processed += 1
        self.total_boxes_detected += result.box_count
        self.per_frame_counts.append(result.box_count)
        self.peak_count = max(self.peak_count, result.box_count)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "video_source": self.video_source,
            "started_at": self.started_at.isoformat(),
            "frames_processed": self.frames_processed,
            "total_boxes_detected": self.total_boxes_detected,
            "average_boxes_per_frame": (
                round(self.total_boxes_detected / self.frames_processed, 2)
                if self.frames_processed > 0
                else 0
            ),
            "peak_count": self.peak_count,
            "expected_count": self.expected_count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DetectionSession":
        session = cls(video_source=data.get("video_source", "unknown"))
        session.session_id = data.get("session_id", session.session_id)
        session.started_at = datetime.fromisoformat(data["started_at"])
        session.frames_processed = data.get("frames_processed", 0)
        session.total_boxes_detected = data.get("total_boxes_detected", 0)
        session.peak_count = data.get("peak_count", 0)
        session.expected_count = data.get("expected_count")
        return session


def save_session_to_firebase(session: DetectionSession) -> Optional[str]:
    """
    Persist a completed detection session.
    Tries Firestore first; falls back to local JSON file.

    Returns:
        Document / session ID on success, None on failure.
    """
    session_dict = session.to_dict()

    db = _get_db()
    if db is not None:
        try:
            doc_ref = db.collection("detection_sessions").document(session.session_id)
            doc_ref.set(session_dict)
            print(f"[Counting] ✅ Session {session.session_id} saved to Firestore.")
            return session.session_id
        except Exception as e:
            print(f"[Counting] ❌ Failed to save to Firestore — {e}")

    # Fallback: local JSON file
    try:
        _save_local_session(session_dict)
        print(f"[Counting] 💾 Session {session.session_id} saved to local JSON store.")
        return session.session_id
    except Exception as e:
        print(f"[Counting] ❌ Failed to save locally — {e}")
        return None


def get_recent_sessions(limit: int = 20) -> List[Dict[str, Any]]:
    """Fetch the most recent detection sessions (Firestore or local fallback)."""
    db = _get_db()
    if db is not None:
        try:
            docs = (
                db.collection("detection_sessions")
                .order_by("started_at", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            results = [doc.to_dict() for doc in docs]
            print(f"[Counting] Fetched {len(results)} sessions from Firestore.")
            return results
        except Exception as e:
            print(f"[Counting] ❌ Failed to fetch from Firestore — {e}")

    # Fallback: local JSON file
    sessions = _load_local_sessions()
    print(f"[Counting] 💾 Fetched {len(sessions[:limit])} sessions from local JSON store.")
    return sessions[:limit]


def update_session(session_id: str, data: Dict[str, Any]) -> bool:
    """Update an existing session document in Firestore or local fallback."""
    db = _get_db()
    if db is not None:
        try:
            doc_ref = db.collection("detection_sessions").document(session_id)
            doc_ref.update(data)
            print(f"[Counting] ✅ Session {session_id} updated in Firestore.")
            return True
        except Exception as e:
            print(f"[Counting] ❌ Failed to update Firestore session {session_id} — {e}")

    # Fallback: local JSON file
    try:
        sessions = _load_local_sessions()
        for s in sessions:
            if s["session_id"] == session_id:
                s.update(data)
                _LOCAL_STORE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")
                print(f"[Counting] 💾 Session {session_id} updated in local JSON store.")
                return True
        return False
    except Exception as e:
        print(f"[Counting] ❌ Failed to update local session {session_id} — {e}")
        return False
