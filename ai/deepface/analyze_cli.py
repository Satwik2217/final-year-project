# CLI fallback — reads base64 JSON from stdin, prints emotion JSON (used when Flask API is down).
import json
import sys

from emotion_engine import run_analysis_from_base64

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        image_base64 = payload.get("image_base64") or payload.get("imageBase64")
        result = run_analysis_from_base64(image_base64)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({
            "dominant_emotion": "Error",
            "action_units": "None",
            "confidence": 0,
            "engine": "None",
            "emotions": {},
            "error": str(exc),
        }))
        sys.exit(1)
