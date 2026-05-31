# Flask API on port 5001 — DeepFace + OpenCV real-time facial emotion detection.
import threading

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from emotion_engine import decode_base64_image, run_analysis, run_analysis_from_base64

app = Flask(__name__)
CORS(app)

_deepface_ready = False


def _warmup_models():
    global _deepface_ready
    try:
        dummy = np.full((224, 224, 3), 128, dtype=np.uint8)
        result = run_analysis(dummy)
        if result.get("engine") == "DeepFace":
            _deepface_ready = True
        print("Emotion models warmed up:", result.get("engine"))
    except Exception as exc:
        print(f"Warmup skipped: {exc}")


threading.Thread(target=_warmup_models, daemon=True).start()


@app.get("/health")
def health():
    return jsonify({
        "status": "online",
        "service": "DeepFace Emotion API",
        "port": 5001,
        "deepface_ready": _deepface_ready,
    })


@app.post("/analyze")
def analyze():
    try:
        data = request.get_json(silent=True) or {}
        image_base64 = data.get("image_base64") or data.get("imageBase64")
        return jsonify(run_analysis_from_base64(image_base64))
    except Exception as exc:
        return jsonify({"error": f"Analysis failed: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=True)
