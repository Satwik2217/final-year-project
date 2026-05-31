import hashlib
import re

from services.rag_engine import get_embedding_model

GREETING_PATTERNS = re.compile(
    r"^(hi|hello|hey|good morning|good evening|good afternoon|yo|sup)[\s!.,?]*$",
    re.I,
)
THANKS_PATTERNS = re.compile(r"^(thanks|thank you|thx|ty)[\s!.,?]*$", re.I)


def _conversation_stats(conversation_messages: list[dict]) -> dict:
    user_msgs = [m for m in conversation_messages if m.get("sender") in ("user", "User")]
    ai_msgs = [m for m in conversation_messages if m.get("sender") in ("ai", "bot", "AI")]
    return {
        "user_count": len(user_msgs),
        "ai_count": len(ai_msgs),
        "last_user": user_msgs[-1]["text"] if user_msgs else None,
        "last_ai": ai_msgs[-1]["text"] if ai_msgs else None,
        "is_first_user_message": len(user_msgs) == 0,
    }


def _is_small_talk(text: str) -> str | None:
    t = text.strip()
    if GREETING_PATTERNS.match(t):
        return "greeting"
    if THANKS_PATTERNS.match(t):
        return "thanks"
    if t.lower() in {"ok", "okay", "k", "cool", "got it", "alright"}:
        return "ack"
    return None

# ── Emotion vocabulary (human, never clinical) ──────────────────────────────

TEXT_EMOTION_FEELINGS = {
    "Distress Detected": "hurting or under a lot of strain",
    "Mild Negative": "a bit low or unsettled",
    "Positive": "lighter or more hopeful",
    "Balanced": "steady, maybe holding things together",
}

FACE_EMOTION_NATURAL = {
    "sad": "a little heavy-hearted",
    "sadness": "a little heavy-hearted",
    "angry": "tense or frustrated",
    "anger": "tense or frustrated",
    "fear": "on edge or anxious",
    "fearful": "on edge or anxious",
    "happy": "warmer than your words might suggest",
    "happiness": "warmer than your words might suggest",
    "surprise": "caught off guard",
    "disgust": "uncomfortable",
    "neutral": "quiet and guarded",
    "contempt": "guarded",
}

CBT_CONVERSATIONAL = {
    "Catastrophizing": (
        "It sounds like your mind is jumping to the worst-case scenario right now — "
        "that's such a human thing to do when you're scared. Want to zoom out together for a second?"
    ),
    "Overgeneralization / All-or-Nothing Thinking": (
        "I'm noticing some 'always' and 'never' in what you said — "
        "want to explore if there might be any exceptions, even tiny ones?"
    ),
    "Mind Reading": (
        "It sounds like you're assuming what others think without being sure — "
        "that can feel so isolating. What do you actually know for certain here?"
    ),
    "Should Statements": (
        "There's a lot of pressure in those 'shoulds' — "
        "what if you gave yourself the same kindness you'd give a friend?"
    ),
    "Mental Filter": (
        "It feels like your mind is only seeing what went wrong — "
        "even one small okay moment counts. Can you think of one?"
    ),
    "Emotional Reasoning": (
        "Because it feels true doesn't always mean it is — "
        "your feeling is valid, but the story might be harsher than reality."
    ),
}

EMOTION_REFLECTIONS = {
    "Distress Detected": [
        "That sounds really tough — and it makes complete sense that you'd feel this way.",
        "I hear the weight in what you're sharing. You don't have to carry it alone right now.",
        "Something about this is clearly hitting you hard — I'm glad you're letting it out here.",
    ],
    "Mild Negative": [
        "Sounds like something's been sitting with you — not huge maybe, but real.",
        "There's a quiet unease in what you shared, and that's worth paying attention to.",
        "I pick up that today's been a bit rough for you.",
    ],
    "Positive": [
        "It's really good to hear a lighter note from you — I hope you can let yourself feel that.",
        "There's something hopeful in what you said, and I'm glad it's showing up.",
    ],
    "Balanced": [
        "You sound steady right now — I'm here either way, whether things stay calm or get heavier.",
        "I hear you. Tell me more about what's behind that.",
    ],
}


def _pick(options: list[str], seed: str) -> str:
    if not options:
        return ""
    i = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(options)
    return options[i]


def _first_name(name: str | None) -> str | None:
    if not name or name.lower() in {"user", "guest"}:
        return None
    return name.split()[0]


def _normalize_face(face: str) -> str:
    return face.lower() if face else "no input"


def _face_available(face: str) -> bool:
    return face not in {"no input", "no face detected", "neutral", ""}


def _build_emotion_summary(text_emotion: str, facial_emotion: str, contradiction: bool) -> str:
    text_feel = TEXT_EMOTION_FEELINGS.get(text_emotion, text_emotion.lower())
    face_key = _normalize_face(facial_emotion)
    face_feel = FACE_EMOTION_NATURAL.get(face_key)

    if contradiction and face_feel:
        return f"Text: {text_feel} · Expression: {face_feel} · Mismatch detected"
    if face_feel and _face_available(face_key):
        return f"Text: {text_feel} · Expression: {face_feel}"
    return f"Text: {text_feel}"


def _memory_line(emotion_history: list[dict], stats: dict) -> str | None:
    """Use saved MongoDB emotion history for continuity."""
    if not emotion_history or stats.get("user_count", 0) < 2:
        return None

    recent = [e for e in emotion_history if e.get("textEmotion") and e.get("textEmotion") != "pending"]
    if len(recent) < 2:
        return None

    # Reference a past user message if stored
    for entry in recent[1:4]:
        past_text = entry.get("userText") or entry.get("user_text")
        past_emotion = entry.get("textEmotion") or entry.get("text_emotion")
        if past_text and len(past_text) > 10 and past_emotion in {"Distress Detected", "Mild Negative"}:
            snippet = past_text[:60] + ("..." if len(past_text) > 60 else "")
            return f"Last time you mentioned something similar — about \"{snippet}\" — how has that been since?"

    # Trend: more distress recently
    moods = [e.get("textEmotion") for e in recent[:5]]
    distress_count = sum(1 for m in moods if m in {"Distress Detected", "Mild Negative"})
    if distress_count >= 3:
        return "I've noticed you've been carrying a heavier emotional load in our recent chats — that matters to me."

    # Progress: less distress
    if moods[0] in {"Positive", "Balanced"} and any(m in {"Distress Detected", "Mild Negative"} for m in moods[2:]):
        return "You seem a bit steadier than before — and honestly, that kind of shift takes real effort."

    return None


def _reflect_text_emotion(text_emotion: str, user_text: str) -> str:
    reflections = EMOTION_REFLECTIONS.get(text_emotion, EMOTION_REFLECTIONS["Balanced"])
    base = _pick(reflections, user_text + text_emotion)

    # Add topic-specific warmth from their words
    lower = user_text.lower()
    if any(w in lower for w in ["exam", "study", "college", "work", "job"]):
        base += " Pressure around work or studies can eat at you in quiet ways."
    elif any(w in lower for w in ["lonely", "alone", "no one"]):
        base += " Loneliness has a way of making everything feel louder."
    elif any(w in lower for w in ["family", "parents", "friend"]):
        base += " Relationships can stir up the deepest feelings."

    return base


def _weave_face_naturally(facial_emotion: str, text_emotion: str, action_units: str) -> str | None:
    if not _face_available(_normalize_face(facial_emotion)):
        return None

    face_key = _normalize_face(facial_emotion)
    face_feel = FACE_EMOTION_NATURAL.get(face_key, face_key)

    if text_emotion in {"Distress Detected", "Mild Negative"}:
        return f"And you seem {face_feel} too — I'm holding space for all of that."

    if text_emotion in {"Positive", "Balanced"}:
        return f"You seem {face_feel} as you say that — I'm noticing the whole picture, not just the words."

    return f"There's something {face_feel} in how you're coming across, and I don't want to skip over it."


def _contradiction_response(
    user_text: str,
    contradiction: dict,
    user_name: str | None,
) -> str:
    detected = contradiction.get("detected_emotions", {})
    text_feel = detected.get("text_emotion_human", "that you're okay")
    face_feel = detected.get("facial_emotion_human", "heavy-hearted")
    name = _first_name(user_name)

    lead = f"{name}, " if name else ""

    return (
        f"{lead}I notice you said you're fine, but you seem a little {face_feel} right now — "
        f"and that's completely okay. A lot of people say they're okay when they're not ready to say they're hurting. "
        f"Do you want to talk about what's really going on?"
    )


def _safety_response(user_name: str | None) -> str:
    name = _first_name(user_name)
    lead = f"{name}, what" if name else "What"
    return (
        f"{lead} you just shared is really important, and I want you to know I'm taking it seriously. You matter. "
        f"Please reach out to iCall India: 9152987821 or Vandrevala Foundation: 1860-2662-345 — "
        f"they're available 24/7 and will listen without judgment. Tele-MANAS: 14416."
    )


def _soft_close(user_text: str, text_emotion: str, distortion: str) -> str:
    closes = [
        "What's the part of this that feels heaviest right now?",
        "Want to keep going? I'm here.",
        "Take your time — what else is on your mind?",
        "How long has this feeling been with you?",
    ]
    if distortion != "None":
        closes = ["Want to gently question that thought together?", "Does that story feel 100% true, or mostly true when you're low?"]
    if text_emotion == "Distress Detected":
        closes = ["What do you need most in this moment — to be heard, or to figure out a next step?", "I'm here. What would help even a little?"]
    return _pick(closes, user_text)


def generate_emotion_first_response(
    user_text: str,
    text_emotion: str,
    facial_emotion: str,
    action_units: str,
    distortion: str,
    contradiction: dict,
    safety: dict,
    conversation_messages: list[dict],
    emotion_history: list[dict],
    user_name: str | None,
) -> dict:
    stats = _conversation_stats(conversation_messages)
    emotion_summary = _build_emotion_summary(text_emotion, facial_emotion, contradiction.get("contradiction_detected", False))

    if safety.get("safety_triggered"):
        return {
            "response": _safety_response(user_name),
            "follow_up_suggestions": ["I need help now", "I'm not safe", "Tell me about helplines"],
            "technique_used": "Safety Escalation",
            "emotion_summary": "Crisis · immediate support",
        }

    if contradiction.get("contradiction_detected") and contradiction.get("detected_emotions", {}).get("facial_emotion_human"):
        return {
            "response": _contradiction_response(user_text, contradiction, user_name),
            "follow_up_suggestions": ["You're right, I'm not okay", "Something's been bothering me", "I'd rather not say yet"],
            "technique_used": "Contradiction-Aware Empathy",
            "emotion_summary": emotion_summary,
        }

    parts = []

    # Small talk — stay human, brief
    small = _is_small_talk(user_text)
    if small == "greeting":
        name = _first_name(user_name)
        hi = f"Hey {name}! " if name else "Hey! "
        return {
            "response": hi + "What's been on your mind lately?",
            "follow_up_suggestions": ["I've had a rough day", "Just checking in", "Can we talk?"],
            "technique_used": "Supportive Listening",
            "emotion_summary": emotion_summary,
        }
    if small == "thanks":
        return {
            "response": "Anytime — really. I'm glad you reached out. I'm still here if you need me.",
            "follow_up_suggestions": ["Actually, there's more", "I'm okay for now", "Can we keep talking?"],
            "technique_used": "Supportive Listening",
            "emotion_summary": emotion_summary,
        }
    if small == "ack":
        return {
            "response": "Okay. No rush — we can pause here or keep going, whatever you need.",
            "follow_up_suggestions": ["Let's keep going", "I need a moment", "There's something else"],
            "technique_used": "Supportive Listening",
            "emotion_summary": emotion_summary,
        }

    # Memory from saved emotions (MongoDB longitudinal data)
    memory = _memory_line(emotion_history, stats)
    if memory and stats.get("user_count", 0) >= 2:
        parts.append(memory)

    # Core: reflect EMOTION first, not just restate words
    parts.append(_reflect_text_emotion(text_emotion, user_text))

    # Face — woven naturally when available
    face_line = _weave_face_naturally(facial_emotion, text_emotion, action_units)
    if face_line and not contradiction.get("contradiction_detected"):
        parts.append(face_line)

    # CBT — conversational, only when distortion detected
    if distortion != "None":
        cbt = CBT_CONVERSATIONAL.get(distortion)
        if cbt:
            parts.append(cbt)
        elif "always" in user_text.lower() or "never" in user_text.lower():
            parts.append(CBT_CONVERSATIONAL["Overgeneralization / All-or-Nothing Thinking"])

    # Courage acknowledgment for vulnerable shares
    if text_emotion == "Distress Detected" and len(user_text) > 40:
        parts.append("...and honestly, that takes real courage to say.")

    # Soft close — always end with invitation
    parts.append(_soft_close(user_text, text_emotion, distortion))

    response = " ".join(p.strip() for p in parts if p.strip())

    # Cap length ~2-5 sentences feel (roughly 500 chars)
    if len(response) > 520:
        sentences = re.split(r"(?<=[.!?])\s+", response)
        response = " ".join(sentences[:5])

    quick = _build_quick_replies(text_emotion, distortion, contradiction.get("contradiction_detected", False))

    return {
        "response": response,
        "follow_up_suggestions": quick,
        "technique_used": "CBT · " + distortion if distortion != "None" else "Emotion-First Support",
        "emotion_summary": emotion_summary,
    }


def _build_quick_replies(text_emotion: str, distortion: str, contradiction: bool) -> list[str]:
    if contradiction:
        return ["You're right, I'm not okay", "Something's been bothering me", "I'd rather not say yet"]
    if distortion != "None":
        return ["That thought keeps looping", "Help me challenge it", "It feels true when I'm low"]
    if text_emotion == "Distress Detected":
        return ["I feel overwhelmed", "It's about someone I care about", "I just need to vent"]
    return ["Tell me more", "There's more to it", "I'm not sure how I feel", "Can we sit with this?"]
