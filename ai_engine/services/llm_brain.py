import os
import re
import urllib.parse
import urllib.request
import json

from services.neurowell_prompt import NEUROWELL_SYSTEM_PROMPT

ROBOTIC_OPENERS = re.compile(
    r"^(Certainly!|Of course!|Sure!|Absolutely!|Great question!|As an AI[^.]*\.|I'm an AI[^.]*\.|As a language model[^.]*\.)\s*",
    re.I,
)


def _strip_robotic(text: str) -> str:
    cleaned = text.strip()
    for _ in range(3):
        cleaned = ROBOTIC_OPENERS.sub("", cleaned).strip()
    return cleaned


def _build_context_block(
    user_text: str,
    text_emotion: str,
    facial_emotion: str,
    contradiction: dict,
    distortion: str,
    emotion_history: list,
    conversation_messages: list,
    user_name: str | None,
    rag_context: dict | None,
) -> str:
    lines = [f"User message: {user_text}"]

    if user_name:
        lines.append(f"User's name: {user_name.split()[0]}")

    lines.append(f"Detected text emotion: {text_emotion}")

    if facial_emotion and facial_emotion not in {"No Input", "No Face Detected", "Neutral"}:
        lines.append(f"Facial emotion detected: {facial_emotion}")
    else:
        lines.append("Facial emotion: not provided — ignore facial rules.")

    if contradiction.get("contradiction_detected"):
        det = contradiction.get("detected_emotions", {})
        lines.append(
            f"CONTRADICTION: user words suggest '{det.get('text_emotion_human')}' "
            f"but expression suggests '{det.get('facial_emotion_human')}'. Weave in gently AFTER answering."
        )

    if distortion and distortion != "None":
        lines.append(f"Cognitive distortion hint: {distortion}")

    if rag_context and rag_context.get("content"):
        lines.append(f"CBT knowledge (use only if emotionally relevant): {rag_context['content'][:300]}")

    if emotion_history:
        recent = emotion_history[:3]
        summaries = [e.get("emotionSummary") or e.get("textEmotion") for e in recent if e]
        if summaries:
            lines.append(f"Recent emotional history: {', '.join(str(s) for s in summaries if s)}")

    if conversation_messages:
        tail = conversation_messages[-4:]
        conv = " | ".join(f"{m.get('sender')}: {m.get('text', '')[:80]}" for m in tail)
        lines.append(f"Recent conversation: {conv}")

    return "\n".join(lines)


def _call_gemini(system: str, user_context: str) -> str | None:
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
            system_instruction=system,
        )
        response = model.generate_content(user_context)
        return _strip_robotic(response.text.strip())
    except Exception as exc:
        print(f"Gemini unavailable: {exc}")
        return None


def _wikipedia_snippet(query: str) -> str | None:
    try:
        title = query.strip().split("?")[0]
        for prefix in ("what is ", "what's ", "who is ", "tell me about ", "explain "):
            if title.lower().startswith(prefix):
                title = title[len(prefix):]
        title = title.strip().title().replace(" ", "_")[:80]
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        req = urllib.request.Request(url, headers={"User-Agent": "NeuroWell/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            extract = data.get("extract")
            if extract:
                return extract
    except Exception:
        pass
    return None


def _local_factual_answer(text: str) -> str | None:
    lower = text.lower()
    facts = {
        "capital of usa": "Washington, D.C. — it's been the U.S. capital since 1800, actually a pretty interesting bit of history.",
        "capital of india": "New Delhi — it's the seat of all three branches of India's government.",
        "capital of france": "Paris — one of the most visited cities in the world, and yeah, that's the capital.",
        "capital of uk": "London — the UK doesn't have a single written constitution, but London's definitely the capital.",
        "speed of light": "About 299,792 km per second in a vacuum — fast enough to circle Earth roughly 7.5 times in one second.",
        "photosynthesis": "Plants use sunlight, water, and CO₂ to make glucose and oxygen — basically how most life on Earth gets its energy.",
    }
    for key, answer in facts.items():
        if key in lower:
            return answer
    wiki = _wikipedia_snippet(text)
    if wiki:
        first = wiki.split(". ")[0] + "."
        return f"Right, so — {first}"
    return None


def generate_llm_response(
    user_text: str,
    text_emotion: str,
    facial_emotion: str,
    distortion: str,
    contradiction: dict,
    emotion_history: list,
    conversation_messages: list,
    user_name: str | None,
    rag_context: dict | None = None,
) -> str | None:
    context = _build_context_block(
        user_text, text_emotion, facial_emotion, contradiction,
        distortion, emotion_history, conversation_messages, user_name, rag_context,
    )

    gemini_reply = _call_gemini(NEUROWELL_SYSTEM_PROMPT, context)
    if gemini_reply:
        return gemini_reply

    return None


def generate_factual_fallback(user_text: str) -> str | None:
    return _local_factual_answer(user_text)
