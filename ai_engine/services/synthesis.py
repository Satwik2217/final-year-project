from services.text_analysis import NEGATIVE_FACE_EMOTIONS, POSITIVE_FACE_EMOTIONS, POSITIVE_WORDS

# Human-readable labels for user-facing responses (never say "AI" or "channel")
TEXT_EMOTION_LABELS = {
    "Positive": "light or upbeat",
    "Balanced": "calm and steady",
    "Mild Negative": "a bit low or unsettled",
    "Distress Detected": "worried, sad, or under strain",
}

FACE_EMOTION_LABELS = {
    "sadness": "sadness",
    "sad": "sadness",
    "angry": "tension or frustration",
    "anger": "tension or frustration",
    "fear": "anxiety or unease",
    "fearful": "anxiety or unease",
    "disgust": "discomfort",
    "happiness": "warmth or relief",
    "happy": "warmth or relief",
    "neutral": "a quiet, guarded stillness",
    "surprise": "surprise",
}


def _humanize_text_emotion(text_emotion: str, user_text: str) -> str:
    lower = user_text.lower()
    if any(w in lower for w in POSITIVE_WORDS):
        return "that you're doing okay"
    return TEXT_EMOTION_LABELS.get(text_emotion, "something you're putting into words")


def _humanize_face_emotion(facial_emotion: str) -> str | None:
    if facial_emotion in {"No Input", "No Face Detected", "No input", "Neutral"}:
        return None
    key = facial_emotion.lower()
    return FACE_EMOTION_LABELS.get(key, facial_emotion.lower())


def _face_is_negative(facial_emotion: str) -> bool:
    return facial_emotion.lower() in NEGATIVE_FACE_EMOTIONS


def _face_is_positive(facial_emotion: str) -> bool:
    return facial_emotion.lower() in POSITIVE_FACE_EMOTIONS


def detect_contradiction(text: str, text_emotion: str, facial_emotion: str) -> dict:
    lower = text.lower()
    face_human = _humanize_face_emotion(facial_emotion)
    text_human = _humanize_text_emotion(text_emotion, text)

    says_positive = any(word in lower for word in POSITIVE_WORDS)
    text_positive = text_emotion in {"Positive", "Balanced"}
    text_distressed = text_emotion in {"Distress Detected", "Mild Negative"}
    face_negative = _face_is_negative(facial_emotion)
    face_positive = _face_is_positive(facial_emotion)

    contradiction = False
    contradiction_type = None

    # Synopsis case: "I'm fine" but face shows sadness
    if face_human and ((says_positive or text_positive) and face_negative):
        contradiction = True
        contradiction_type = "words_calm_face_pain"

    # Hidden distress: words sound okay but face shows strong negative signal
    elif face_human and text_positive and face_negative:
        contradiction = True
        contradiction_type = "words_calm_face_pain"

    # Masking: text sounds distressed but face shows forced positivity
    elif face_human and text_distressed and face_positive:
        contradiction = True
        contradiction_type = "words_pain_face_masked"

    # Direct conflict: distressed text vs clearly different face emotion
    elif face_human and text_distressed and face_negative:
        face_key = facial_emotion.lower()
        if face_key in {"angry", "anger", "fear", "fearful"} and "sad" not in lower:
            contradiction = True
            contradiction_type = "mixed_distress_signals"

    detected = {
        "text_emotion_raw": text_emotion,
        "facial_emotion_raw": facial_emotion,
        "text_emotion_human": text_human,
        "facial_emotion_human": face_human,
    }

    message = ""
    if contradiction and face_human:
        message = _build_contradiction_preview(text_human, face_human, contradiction_type)

    return {
        "contradiction_detected": contradiction,
        "contradiction_type": contradiction_type,
        "contradiction_message": message,
        "detected_emotions": detected,
    }


def _build_contradiction_preview(text_human: str, face_human: str, contradiction_type: str | None) -> str:
    if contradiction_type == "words_pain_face_masked":
        return (
            f"Your words carry {text_human}, but your expression looks like it's holding something back — "
            f"I sense {face_human} there too."
        )
    if contradiction_type == "mixed_distress_signals":
        return (
            f"I'm picking up {text_human} in what you wrote, but your face is telling me something slightly different — "
            f"more like {face_human}."
        )
    return (
        f"You said {text_human}, but what I'm seeing in your expression feels more like {face_human}."
    )
