import re

FACTUAL_PATTERNS = [
    r"\b(what is|what's|what are|who is|who's|where is|where's|when did|how does|how do|how to|why is|why do|define|explain|tell me about|capital of|meaning of)\b",
    r"\?$",
    r"\b(calculate|solve|write code|python|javascript|formula for)\b",
]

EMOTIONAL_PATTERNS = [
    r"\b(sad|anxious|depressed|lonely|scared|stressed|overwhelmed|hurt|cry|crying|suicid|kill myself|feel like|feeling)\b",
    r"\b(i'm fine|im fine|not okay|i hate myself|stupid|worthless|hopeless)\b",
]

SELF_TALK_PATTERNS = [
    r"\b(i'm so stupid|i am stupid|i always fail|nothing works|i'm worthless|no one cares)\b",
]


def classify_intent(text: str, text_emotion: str) -> str:
    lower = text.lower().strip()

    if any(re.search(p, lower) for p in EMOTIONAL_PATTERNS) and text_emotion in {"Distress Detected", "Mild Negative"}:
        if any(re.search(p, lower) for p in FACTUAL_PATTERNS):
            return "mixed"
        return "emotional"

    if any(re.search(p, lower) for p in FACTUAL_PATTERNS):
        return "factual"

    if "?" in text and len(text.split()) > 3:
        return "factual"

    if text_emotion in {"Distress Detected", "Mild Negative"}:
        return "emotional"

    return "conversational"


def has_harsh_self_talk(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in SELF_TALK_PATTERNS)
