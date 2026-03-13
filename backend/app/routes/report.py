"""
Report route — GET /report/{session_id}
Generates a PDF report for a detection session using reportlab.
"""

import io
import os
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable


router = APIRouter()


def _get_db():
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
                return firestore.client()

        creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "../shared/config/firebase_config.json")
        project_id = os.getenv("FIREBASE_PROJECT_ID", "box-detection-system")

        abs_creds = os.path.abspath(creds_path)
        if not os.path.exists(abs_creds):
            # Log only if it hasn't been logged frequently
            return None

        if not firebase_admin._apps:
            cred = credentials.Certificate(abs_creds)
            firebase_admin.initialize_app(cred, {"projectId": project_id})

        return firestore.client()
    except Exception as e:
        print(f"[Report] ❌ Firebase initialization skipped: {e}")
        return None


def _fetch_session(session_id: str) -> Optional[Dict[str, Any]]:
    db = _get_db()
    if db:
        try:
            doc = db.collection("detection_sessions").document(session_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"[Report] ❌ Firestore fetch error: {e}")

    # Fallback: local JSON
    local_store = Path(__file__).parent.parent.parent / "data" / "sessions.json"
    if local_store.exists():
        try:
            sessions = json.loads(local_store.read_text(encoding="utf-8"))
            for s in sessions:
                if s.get("session_id") == session_id:
                    return s
        except Exception as e:
            print(f"[Report] ❌ Local store fallback error: {e}")

    return None


def _generate_pdf(session: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4, 
        topMargin=1.5 * cm, 
        bottomMargin=1.5 * cm,
        leftMargin=2 * cm, 
        rightMargin=2 * cm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10,
        alignment=0 # Left align
    )
    
    headline_style = ParagraphStyle(
        'Headline',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor("#475569"),
        spaceBefore=12,
        spaceAfter=8
    )

    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        leading=14
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#1e293b"),
        fontName='Helvetica-Bold',
        leading=14
    )

    story = []

    # --- Header Section ---
    story.append(Paragraph("Box Detection System", title_style))
    story.append(Paragraph("Automated Industrial Analytics Report", label_style))
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceBefore=0, spaceAfter=20))

    # --- Session Summary Section ---
    story.append(Paragraph("Session Information", headline_style))
    
    # Session Details Grid
    meta_data = [
        [Paragraph("<b>Session ID</b>", label_style), Paragraph(session.get('session_id', 'N/A'), value_style)],
        [Paragraph("<b>Timestamp</b>", label_style), Paragraph(session.get('started_at', 'N/S'), value_style)],
        [Paragraph("<b>Source</b>", label_style), Paragraph(session.get('video_source', 'N/A'), value_style)],
    ]
    
    meta_table = Table(meta_data, colWidths=[4 * cm, 12 * cm])
    meta_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.8 * cm))

    # --- Statistics Section ---
    story.append(Paragraph("Detection Statistics", headline_style))
    story.append(Spacer(1, 0.2 * cm))

    frames = session.get("frames_processed", 0)
    boxes = session.get("total_boxes_detected", 0)
    peak = session.get("peak_count", 0)
    avg = session.get("average_boxes_per_frame", 0.0)

    data = [
        ["Metric", "Result"],
        ["Total Boxes Detected", f"{boxes} units"],
        ["Total Frames Processed", f"{frames} frames"],
        ["Peak Detection Count", f"{peak} boxes/frame"],
        ["Average Flow Rate", f"{avg:.2f} boxes/frame"],
    ]

    stats_table = Table(data, colWidths=[9 * cm, 7 * cm])
    stats_table.setStyle(TableStyle([
        # Header Style
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        
        # Row Styles
        ("FONTNAME", (0, 1), (0, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8fafc"), colors.white]),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        
        # Borders
        ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#0f172a")),
        ("GRID", (0, 1), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))

    story.append(stats_table)
    story.append(Spacer(1, 1.5 * cm))

    # --- Footer ---
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    footer_style = ParagraphStyle('Footer', parent=styles['Italic'], fontSize=8, textColor=colors.grey, alignment=1)
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1")))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        f"This report was generated automatically on {now} UTC by the PBS Box Detection AI System.<br/>"
        "Confidential industrial data — For internal use only.",
        footer_style
    ))

    doc.build(story)
    return buffer.getvalue()


@router.get("/report/{session_id}")
async def generate_report(session_id: str):
    """Generate and return a PDF report for a given session_id."""
    session = _fetch_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    try:
        pdf_bytes = _generate_pdf(session)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=report_{session_id[:8]}.pdf"}
        )
    except Exception as e:
        print(f"[Report] ❌ PDF generation error: {e}")
        raise HTTPException(status_code=500, detail="Error generating PDF report.")
