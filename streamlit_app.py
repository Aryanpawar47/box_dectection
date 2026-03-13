import streamlit as st
import cv2
import numpy as np
import os
import sys
from pathlib import Path
from PIL import Image
import tempfile
import time

# Add backend to path so we can reuse existing services
backend_path = str(Path(__file__).parent / "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

# Import our existing logic
try:
    from app.services.detection_service import detect_boxes_in_frame
    from app.services.counting_service import DetectionSession, save_session_to_firebase, get_recent_sessions
    from app.utils.video_stream import extract_frames_from_file
except ImportError as e:
    st.error(f"Import Error: {e}. Make sure you are running from the project root.")
    st.stop()

# Page configuration
st.set_page_config(
    page_title="AI Box Detection System",
    page_icon="📦",
    layout="wide"
)

# Custom CSS for industrial look
st.markdown("""
    <style>
    .main { background-color: #f8fafc; }
    .stMetric { background-color: white; padding: 15px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stTitle { color: #1e293b; font-weight: 800; }
    </style>
    """, unsafe_allow_html=True)

st.title("📦 AI Box Detection Dashboard")
st.markdown("Automated industrial box counting and monitoring powered by YOLOv8.")

# Sidebar - Configuration
st.sidebar.header("Settings")
conf_threshold = st.sidebar.slider("Confidence Threshold", 0.1, 1.0, 0.5, 0.05)
model_type = st.sidebar.selectbox("Model Type", ["Standard (YOLOv8n)", "Custom (if available)"])

# Tabs for different views
tab_detect, tab_history = st.tabs(["🚀 Real-time Detection", "📊 History & Analytics"])

with tab_detect:
    col_input, col_output = st.columns([1, 1])
    
    with col_input:
        st.subheader("Upload Stream")
        uploaded_file = st.file_uploader("Choose an image or video...", type=["jpg", "jpeg", "png", "mp4", "avi", "mov"])
        
        if uploaded_file:
            file_type = uploaded_file.type.split('/')[0]
            st.info(f"Processing {file_type}: {uploaded_file.name}")
            
            if st.button("Start Analysis"):
                if file_type == 'image':
                    # Process Image
                    file_bytes = np.asarray(bytearray(uploaded_file.read()), dtype=np.uint8)
                    frame = cv2.imdecode(file_bytes, 1)
                    
                    with st.spinner("Analyzing frame..."):
                        result = detect_boxes_in_frame(frame, confidence_threshold=conf_threshold)
                        
                        # Show results in column 2
                        with col_output:
                            st.subheader("Detection Result")
                            st.image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), caption="Original", use_container_width=True)
                            
                            # Re-decode annotated if we had it, or draw again for clarity
                            from app.utils.image_processing import draw_bounding_boxes
                            annotated = draw_bounding_boxes(frame, result.boxes, result.labels, result.confidences)
                            st.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), caption="Annotated", use_container_width=True)
                            
                            st.metric("Boxes Detected", result.box_count)
                            
                            # Save to Firebase
                            session = DetectionSession(video_source=uploaded_file.name)
                            session.record_frame(result)
                            doc_id = save_session_to_firebase(session)
                            if doc_id:
                                st.success(f"Session saved! ID: {doc_id}")

                elif file_type == 'video':
                    # Process Video
                    tfile = tempfile.NamedTemporaryFile(delete=False)
                    tfile.write(uploaded_file.read())
                    
                    st_frame = st.empty()
                    progress_bar = st.progress(0)
                    
                    session = DetectionSession(video_source=uploaded_file.name)
                    
                    # We sample frames
                    frames = list(extract_frames_from_file(tfile.name, sample_fps=2))
                    total_frames = len(frames)
                    
                    for i, frame in enumerate(frames):
                        result = detect_boxes_in_frame(frame, confidence_threshold=conf_threshold)
                        session.record_frame(result)
                        
                        # Show live update
                        from app.utils.image_processing import draw_bounding_boxes
                        annotated = draw_bounding_boxes(frame, result.boxes, result.labels, result.confidences)
                        st_frame.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), use_container_width=True)
                        
                        progress_bar.progress((i + 1) / total_frames)
                        time.sleep(0.01) # Small delay for visual effect
                    
                    st.success("Video processing complete!")
                    st.metric("Total Box Count (Summed Frames)", session.total_boxes_detected)
                    st.metric("Peak Count", session.peak_count)
                    
                    # Save to Firebase
                    doc_id = save_session_to_firebase(session)
                    if doc_id:
                        st.balloons()
                        st.success(f"Video session saved to database!")

with tab_history:
    st.subheader("Recent Detection Sessions")
    
    if st.button("Refresh History"):
        sessions = get_recent_sessions(limit=10)
        if not sessions:
            st.warning("No session history found.")
        else:
            for s in sessions:
                with st.expander(f"Session: {s.get('video_source')} - {s.get('started_at')[:16]}"):
                    c1, c2, c3 = st.columns(3)
                    c1.metric("Boxes", s.get("total_boxes_detected", 0))
                    c2.metric("Peak", s.get("peak_count", 0))
                    c3.metric("Frames", s.get("frames_processed", 0))
                    
                    if st.button("Download Report", key=s.get('session_id')):
                        st.info("Generating PDF report...")
                        # This could call the report generation logic if available
                        st.write(f"Session ID: {s.get('session_id')}")

# Footer
st.markdown("---")
st.caption("PBS Box Detection AI v1.0 | Built with Streamlit & YOLOv8")
