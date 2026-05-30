import os
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

from functools import lru_cache
from transformers import pipeline

DISTORTION_RULES = [
    ("Catastrophizing", ["worst", "disaster", "ruined", "can't handle", "fall apart", "terrible", "hopeless"]),
    ("Overgeneralization / All-or-Nothing Thinking", ["always", "never", "everything", "nothing", "everyone", "no one"]),
    ("Mind Reading", ["they think", "everyone thinks", "judging me", "they hate", "they don't care"]),
    ("Should Statements", ["should", "must", "have to", "ought to", "shouldn't"]),
    ("Mental Filter", ["only bad", "nothing good", "worthless", "messed up", "failure"]),
    ("Emotional Reasoning", ["feels like", "must be true because i feel", "i feel so"]),
]

POSITIVE_WORDS = {"fine", "okay", "ok", "good", "great", "happy", "well", "alright", "better"}
POSITIVE_FACE_EMOTIONS = {"happy", "happiness", "surprise"}
NEGATIVE_FACE_EMOTIONS = {
    "sad", "sadness", "angry", "anger", "fear", "fearful", "disgust", "distress detected",
}


@lru_cache(maxsize=1)
def get_sentiment_pipeline():
    return pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")


def detect_cognitive_distortion(text: str) -> str:
    lower = text.lower()
    for distortion, keywords in DISTORTION_RULES:
        if any(keyword in lower for keyword in keywords):
            return distortion
    return "None"


def map_text_emotion(label: str, score: float) -> str:
    if label.upper() == "POSITIVE" and score >= 0.7:
        return "Positive"
    if label.upper() == "NEGATIVE" and score >= 0.6:
        return "Distress Detected"
    if label.upper() == "NEGATIVE":
        return "Mild Negative"
    return "Balanced"


def analyze_text(text: str) -> dict:
    nlp = get_sentiment_pipeline()
    prediction = nlp(text)[0]
    distortion = detect_cognitive_distortion(text)
    text_emotion = map_text_emotion(prediction["label"], prediction["score"])

    return {
        "sentiment_label": prediction["label"],
        "confidence_score": round(float(prediction["score"]), 3),
        "text_emotion": text_emotion,
        "cognitive_distortion": distortion,
    }
