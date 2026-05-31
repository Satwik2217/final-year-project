"""
NeuroWell unified brain — answers everything like Gemini, talks like a human.
"""

import re

from services.emotion_companion import (
    _build_emotion_summary,
    _contradiction_response,
    _first_name,
    _is_small_talk,
    _pick,
    _safety_response,
    _conversation_stats,
    FACE_EMOTION_NATURAL,
)
from services.intent_router import classify_intent, has_harsh_self_talk
from services.llm_brain import generate_factual_fallback, generate_llm_response, _strip_robotic
from services.emotion_companion import (
    CBT_CONVERSATIONAL,
    EMOTION_REFLECTIONS,
    _build_quick_replies,
    _memory_line,
    _reflect_text_emotion,
)


def _quiet_emotional_layer(user_text: str, text_emotion: str, distortion: str) -> str | None:
    """Rule 3 — brief emotional note, never blocks the answer."""
    parts = []

    if text_emotion in {"Distress Detected", "Mild Negative"}:
        parts.append(
            _pick([
                "That sounds like a lot to deal with — I hope this helps even a little.",
                "I can tell this weighs on you — take your time with it.",
            ], user_text)
        )

    if has_harsh_self_talk(user_text):
        if "stupid" in user_text.lower():
            parts.append("Also — I noticed you were hard on yourself there. That's your brain being unfair to you, not the truth.")
        elif "always fail" in user_text.lower() or "nothing works" in user_text.lower():
            parts.append("Also — that 'always/nothing' voice is really harsh. One rough moment doesn't define you.")

    if distortion != "None" and distortion in CBT_CONVERSATIONAL:
        parts.append(CBT_CONVERSATIONAL[distortion].split("?")[0] + "?")

    return " ".join(parts) if parts else None


def _face_after_answer(facial_emotion: str, contradiction: dict, user_text: str) -> str | None:
    """Rule 4 — weave face contradiction AFTER main answer."""
    if not contradiction.get("contradiction_detected"):
        return None
    det = contradiction.get("detected_emotions", {})
    face_feel = det.get("facial_emotion_human") or FACE_EMOTION_NATURAL.get(facial_emotion.lower(), "a little heavy")
    if "fine" in user_text.lower() or "okay" in user_text.lower():
        return (
            f"By the way — you mentioned you're fine, but you seem {face_feel} right now. "
            f"That's completely okay. I'm here if you want to talk about anything."
        )
    return None


def _emotional_only_response(
    user_text: str,
    text_emotion: str,
    facial_emotion: str,
    distortion: str,
    emotion_history: list,
    stats: dict,
) -> str:
    parts = []
    memory = _memory_line(emotion_history, stats)
    if memory:
        parts.append(memory)
    parts.append(_reflect_text_emotion(text_emotion, user_text))
    if distortion != "None" and distortion in CBT_CONVERSATIONAL:
        parts.append(CBT_CONVERSATIONAL[distortion])
    elif text_emotion == "Distress Detected":
        parts.append("What's been the hardest part of this for you?")
    return " ".join(parts)


def generate_neurowell_response(
    user_text: str,
    text_emotion: str,
    facial_emotion: str,
    action_units: str,
    distortion: str,
    contradiction: dict,
    safety: dict,
    conversation_messages: list,
    emotion_history: list,
    user_name: str | None,
    rag_context: dict | None = None,
) -> dict:
    stats = _conversation_stats(conversation_messages)
    emotion_summary = _build_emotion_summary(
        text_emotion, facial_emotion, contradiction.get("contradiction_detected", False)
    )
    intent = classify_intent(user_text, text_emotion)

    # ── Safety (Rule 5) ──
    if safety.get("safety_triggered"):
        return {
            "response": _safety_response(user_name),
            "follow_up_suggestions": ["I need help now", "Tell me about helplines", "I'm not safe"],
            "technique_used": "Safety Escalation",
            "emotion_summary": "Crisis · immediate support",
        }

    # ── Small talk ──
    small = _is_small_talk(user_text)
    if small == "greeting":
        name = _first_name(user_name)
        return {
            "response": (f"Hey {name}! " if name else "Hey! ") + "What's on your mind — anything at all, I'm here.",
            "follow_up_suggestions": ["What's the capital of France?", "I've had a rough day", "Explain photosynthesis"],
            "technique_used": "Human Conversation",
            "emotion_summary": emotion_summary,
        }
    if small == "thanks":
        return {
            "response": "Anytime — glad I could help.",
            "follow_up_suggestions": ["One more question", "I'm okay for now"],
            "technique_used": "Human Conversation",
            "emotion_summary": emotion_summary,
        }
    if small == "ack":
        return {
            "response": "Got it. I'm here whenever you need me.",
            "follow_up_suggestions": ["Let's keep going", "Another question"],
            "technique_used": "Human Conversation",
            "emotion_summary": emotion_summary,
        }

    # ── Pure contradiction with no factual ask ──
    if (
        contradiction.get("contradiction_detected")
        and intent == "emotional"
        and contradiction.get("detected_emotions", {}).get("facial_emotion_human")
    ):
        return {
            "response": _contradiction_response(user_text, contradiction, user_name),
            "follow_up_suggestions": ["You're right, I'm not okay", "Something's bothering me"],
            "technique_used": "Contradiction-Aware Empathy",
            "emotion_summary": emotion_summary,
        }

    # ── Try LLM (Gemini) — full knowledge + human tone ──
    llm_answer = generate_llm_response(
        user_text, text_emotion, facial_emotion, distortion, contradiction,
        emotion_history, conversation_messages, user_name, rag_context,
    )

    if llm_answer:
        face_note = _face_after_answer(facial_emotion, contradiction, user_text)
        emotional_note = _quiet_emotional_layer(user_text, text_emotion, distortion) if intent in {"emotional", "mixed"} else None

        parts = [llm_answer]
        if emotional_note and emotional_note not in llm_answer:
            parts.append(emotional_note)
        if face_note and face_note not in llm_answer:
            parts.append(face_note)

        return {
            "response": _strip_robotic(" ".join(parts)),
            "follow_up_suggestions": _build_quick_replies(text_emotion, distortion, contradiction.get("contradiction_detected", False)),
            "technique_used": "NeuroWell LLM · Human Mode",
            "emotion_summary": emotion_summary,
        }

    # ── Fallback without API key ──
    main_answer = None

    if intent in {"factual", "mixed", "conversational"}:
        main_answer = generate_factual_fallback(user_text)

    if not main_answer and intent == "factual":
        main_answer = (
            "That's a good question — I'd want to give you a proper answer. "
            "Add a GEMINI_API_KEY in your .env for full knowledge like ChatGPT. "
            "For now, try rephrasing or ask me something emotional — I'm fully here for that."
        )

    if not main_answer:
        main_answer = _emotional_only_response(
            user_text, text_emotion, facial_emotion, distortion, emotion_history, stats
        )

    face_note = _face_after_answer(facial_emotion, contradiction, user_text)
    emotional_note = _quiet_emotional_layer(user_text, text_emotion, distortion)

    parts = [main_answer]
    if emotional_note and intent in {"emotional", "mixed"} and emotional_note not in main_answer:
        parts.append(emotional_note)
    if face_note:
        parts.append(face_note)

    response = _strip_robotic(" ".join(p.strip() for p in parts if p))

    return {
        "response": response,
        "follow_up_suggestions": _build_quick_replies(text_emotion, distortion, contradiction.get("contradiction_detected", False)),
        "technique_used": "NeuroWell · " + ("Factual" if intent == "factual" else "Emotion-First"),
        "emotion_summary": emotion_summary,
    }
