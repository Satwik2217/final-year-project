from services.text_analysis import NEGATIVE_FACE_EMOTIONS, POSITIVE_WORDS


def detect_contradiction(text: str, text_emotion: str, facial_emotion: str) -> dict:
    lower = text.lower()
    face = facial_emotion.lower()

    says_positive = any(word in lower for word in POSITIVE_WORDS)
    face_lower = face.lower()
    face_negative = face_lower in NEGATIVE_FACE_EMOTIONS and face_lower != "neutral"

    text_positive = text_emotion in {"Positive", "Balanced"}
    contradiction = (says_positive and face_negative) or (text_positive and face_negative)

    message = ""
    if contradiction:
        message = (
            "I notice your words suggest you are okay, but your expression may show something different. "
            "It is completely valid to not be fine even when we say we are. Would you like to explore what you are really feeling?"
        )

    return {
        "contradiction_detected": contradiction,
        "contradiction_message": message,
    }
