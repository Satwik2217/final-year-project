# Shared emotion analysis engine — DeepFace + OpenCV used by Flask API and CLI fallback.
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


def decode_base64_image(image_base64: str):
    try:
        if not image_base64:
            return None
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        raw = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def format_emotion(name: str) -> str:
    return name.strip().capitalize()


def pick_active_emotion(emotions: dict) -> tuple[str, float]:
    if not emotions:
        return "neutral", 0.0

    ranked = sorted(emotions.items(), key=lambda item: float(item[1]), reverse=True)
    top_name, top_score = ranked[0]
    top_score = float(top_score)

    if len(ranked) > 1:
        second_name, second_score = ranked[1]
        second_score = float(second_score)
    else:
        second_name, second_score = "neutral", 0.0

    if top_name.lower() == "neutral":
        if second_score >= 12 and (top_score - second_score) <= 25:
            return second_name, second_score
        if top_score < 45 and second_score >= 10:
            return second_name, second_score
        for name, score in ranked[1:]:
            if name.lower() != "neutral" and float(score) >= 18:
                return name, float(score)

    return top_name, top_score


def analyze_with_deepface(frame):
    try:
        from deepface import DeepFace

        result = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            align=True,
            silent=True,
        )
        if isinstance(result, list):
            result = result[0]

        emotions = result.get("emotion", {}) or {}
        dominant_raw, confidence = pick_active_emotion(emotions)
        dominant = format_emotion(dominant_raw)

        return {
            "dominant_emotion": dominant,
            "action_units": FACS_MAP.get(dominant_raw.lower(), "Neutral Baseline"),
            "confidence": round(confidence, 2),
            "engine": "DeepFace",
            "emotions": {k: round(float(v), 2) for k, v in emotions.items()},
        }
    except Exception as exc:
        import sys
        print(f"DeepFace analyze error: {exc}", file=sys.stderr)
        return None


def analyze_with_opencv(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(48, 48))

    if len(faces) == 0:
        return {
            "dominant_emotion": "No Face Detected",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "OpenCV",
            "emotions": {},
        }

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    roi = cv2.resize(gray[y : y + h, x : x + w], (96, 96))

    upper = roi[0:42, :]
    lower = roi[52:96, :]
    mouth = roi[62:88, 28:68]

    upper_var = float(np.var(upper))
    lower_var = float(np.var(lower))
    mouth_mean = float(np.mean(mouth))
    eye_mean = float(np.mean(upper[12:32, 24:72]))
    cheek_mean = float(np.mean(roi[38:58, 8:88]))

    scores = {
        "happy": 0.0,
        "sad": 0.0,
        "angry": 0.0,
        "fear": 0.0,
        "surprise": 0.0,
        "neutral": 10.0,
    }

    if mouth_mean > eye_mean + 8 and lower_var > 180:
        scores["happy"] += 35 + min(lower_var / 10, 25)
    if eye_mean < cheek_mean - 6 and upper_var > 220:
        scores["sad"] += 30 + min(upper_var / 15, 25)
    if upper_var > 320 and eye_mean < mouth_mean - 5:
        scores["angry"] += 28 + min(upper_var / 20, 22)
    if upper_var > 280 and lower_var > 280:
        scores["surprise"] += 25 + min((upper_var + lower_var) / 25, 30)
    if upper_var > 260 and eye_mean > mouth_mean + 5:
        scores["fear"] += 22 + min(upper_var / 18, 20)

    dominant_raw, confidence = pick_active_emotion(scores)
    dominant = format_emotion(dominant_raw)

    return {
        "dominant_emotion": dominant,
        "action_units": FACS_MAP.get(dominant_raw.lower(), "Neutral Baseline"),
        "confidence": round(min(confidence, 99), 2),
        "engine": "OpenCV",
        "emotions": {k: round(v, 2) for k, v in scores.items()},
        "faces_detected": len(faces),
    }


def run_analysis_from_base64(image_base64: str) -> dict:
    if not image_base64:
        return {
            "dominant_emotion": "No Input",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "None",
            "emotions": {},
        }

    frame = decode_base64_image(image_base64)
    if frame is None:
        return {
            "dominant_emotion": "Invalid Image",
            "action_units": "None",
            "confidence": 0.0,
            "engine": "None",
            "emotions": {},
        }

    result = analyze_with_deepface(frame)
    if result:
        return result
    return analyze_with_opencv(frame)


def run_analysis(frame):
    result = analyze_with_deepface(frame)
    if result:
        return result
    return analyze_with_opencv(frame)
