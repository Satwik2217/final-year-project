# Flask API on port 5001 — DeepFace + OpenCV real-time facial emotion detection.
import os
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TF logging

import threading
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from deepface import DeepFace

from emotion_engine import decode_base64_image

app = Flask(__name__)
CORS(app)

_deepface_ready = False
MODELS_PATH = "ai/deepface/weights"   # <-- local weights folder


def run_analysis(image_array):
    """Run DeepFace analysis directly on a numpy image array."""
    from emotion_engine import analyze_with_deepface, analyze_with_opencv
    result = analyze_with_deepface(image_array)
    if result:
        return result
    return analyze_with_opencv(image_array)


def run_analysis_from_base64(image_base64):
    """Decode base64 image and run DeepFace analysis."""
    from emotion_engine import decode_base64_image
    img = decode_base64_image(image_base64)
    if img is None:
        return {
            "dominant_emotion": "Invalid Image",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "None",
            "emotions": {},
        }
    return run_analysis(img)


def _warmup_models():
    global _deepface_ready
    try:
        # Create a more realistic warmup with OpenCV face-like pattern
        import cv2
        dummy = np.full((224, 224, 3), 128, dtype=np.uint8)
        # Draw ellipse to simulate face-like region
        cv2.ellipse(dummy, (112, 100), (60, 80), 0, 0, 360, (200, 180, 160), -1)
        cv2.ellipse(dummy, (85, 85), (15, 10), 0, 0, 360, (100, 100, 100), -1)
        cv2.ellipse(dummy, (139, 85), (15, 10), 0, 0, 360, (100, 100, 100), -1)
        result = run_analysis(dummy)
        if result and result.get("dominant_emotion") and result.get("dominant_emotion") != "No Face Detected":
            _deepface_ready = True
            print("Emotion models warmed up:", result.get("dominant_emotion"))
        else:
            print("Emotion models warmed up: using fallback")
            _deepface_ready = True  # Enable anyway, fallback is available
    except Exception as exc:
        print(f"Warmup skipped: {exc}")
        _deepface_ready = True  # Enable anyway, fallback is available


threading.Thread(target=_warmup_models, daemon=True).start()


@app.get("/health")
def health():
    return jsonify({
        "status": "online",
        "service": "DeepFace Emotion API",
        "port": 5001,
        "deepface_ready": _deepface_ready,
        "version": "1.2.0-ULTRA-ROBUST",
        "last_updated": "2026-06-03 16:30"
    })


@app.post("/analyze")
def analyze():
    """Analyze face emotions from base64 image. Always returns 200 with error field if failed."""
    try:
        data = request.get_json(silent=True) or {}
        image_base64 = data.get("image_base64") or data.get("imageBase64")
        
        if not image_base64:
             return jsonify({
                "dominant_emotion": "No Input",
                "action_units": "None",
                "confidence": 0.0,
                "engine": "None",
                "emotions": {},
                "error": "Missing image_base64 in request body"
            })
            
        result = run_analysis_from_base64(image_base64)
        return jsonify(result)
        
    except Exception as exc:
        import sys
        import traceback
        print(f"CRITICAL: /analyze route failed: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        
        return jsonify({
            "dominant_emotion": "Server Error",
            "action_units": "None",
            "confidence": 0,
            "engine": "Error",
            "emotions": {},
            "error": f"Internal Server Error: {str(exc)}"
        }) # Removed the 500 status code to prevent main server from throwing hard errors


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
