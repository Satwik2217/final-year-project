CRISIS_PATTERNS = [
    "suicide",
    "suicidal",
    "kill myself",
    "end my life",
    "want to die",
    "self harm",
    "self-harm",
    "hurt myself",
    "don't want to live",
    "do not want to live",
]


def evaluate_safety(text: str, text_emotion: str, facial_emotion: str) -> dict:
    lower = text.lower()
    crisis = any(pattern in lower for pattern in CRISIS_PATTERNS)

    severity = 0
    if crisis:
        severity = 10
    elif text_emotion == "Distress Detected":
        severity = 6
    elif text_emotion == "Mild Negative":
        severity = 4
    elif facial_emotion.lower() in {"sad", "sadness", "angry", "anger", "fear", "fearful"}:
        severity = max(severity, 5)

    return {
        "risk_level": "high" if crisis else ("medium" if severity >= 6 else "low"),
        "severity_score": severity,
        "safety_triggered": crisis,
        "safety_status": "Alert" if crisis else ("Caution" if severity >= 6 else "Secure"),
    }
