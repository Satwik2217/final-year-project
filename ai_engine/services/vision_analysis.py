import base64
import io

import cv2
import numpy as np
from PIL import Image

FACS_MAP = {
    "angry": "AU4 + AU5 + AU7",
    "anger": "AU4 + AU5 + AU7",
    "disgust": "AU9 + AU15",
    "fear": "AU1 + AU2 + AU4 + AU5 + AU20",
    "fearful": "AU1 + AU2 + AU4 + AU5 + AU20",
    "happy": "AU6 + AU12",
    "happiness": "AU6 + AU12",
    "sad": "AU4 + AU15",
    "sadness": "AU4 + AU15",
    "surprise": "AU1 + AU2 + AU5 + AU26",
    "neutral": "Neutral Baseline",
}


def decode_base64_image(image_base64: str | None) -> np.ndarray | None:
    if not image_base64:
        return None

    try:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        raw = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def analyze_with_deepface(frame: np.ndarray) -> dict | None:
    try:
        from deepface import DeepFace

        result = DeepFace.analyze(frame, actions=["emotion"], enforce_detection=False)
        if isinstance(result, list):
            result = result[0]
        emotions = result.get("emotion", {})
        dominant = result.get("dominant_emotion", "neutral")
        confidence = emotions.get(dominant, 0)
        return {
            "dominant_emotion": dominant.capitalize(),
            "action_units": FACS_MAP.get(dominant.lower(), "Neutral Baseline"),
            "confidence": round(float(confidence), 2),
            "engine": "DeepFace",
        }
    except Exception:
        return None


def analyze_with_opencv(frame: np.ndarray) -> dict:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        return {
            "dominant_emotion": "No Face Detected",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "OpenCV",
        }

    brightness = float(np.mean(gray))
    if brightness < 70:
        emotion = "Sadness"
        aus = "AU4 + AU15"
    elif brightness > 170:
        emotion = "Happiness"
        aus = "AU6 + AU12"
    else:
        emotion = "Neutral"
        aus = "Neutral Baseline"

    return {
        "dominant_emotion": emotion,
        "action_units": aus,
        "confidence": 0.55,
        "engine": "OpenCV",
        "faces_detected": len(faces),
    }


def analyze_facial(image_base64: str | None) -> dict:
    frame = decode_base64_image(image_base64)
    if frame is None:
        return {
            "dominant_emotion": "No Input",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "None",
        }

    deepface_result = analyze_with_deepface(frame)
    if deepface_result:
        return deepface_result

    return analyze_with_opencv(frame)
