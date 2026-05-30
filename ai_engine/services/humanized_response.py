import hashlib
import re
from functools import lru_cache

from services.rag_engine import get_embedding_model

GREETING_PATTERNS = re.compile(
    r"^(hi|hello|hey|good morning|good evening|good afternoon|yo|sup)[\s!.,?]*$",
    re.I,
)

THANKS_PATTERNS = re.compile(r"^(thanks|thank you|thx|ty)[\s!.,?]*$", re.I)


def _load_dialogue_snippets() -> list[dict]:
    import json
    from pathlib import Path

    base = Path(__file__).resolve().parents[2] / "knowledge"
    snippets = []
    for filename in ("therapeutic_dialogue.json", "contradiction_dialogue.json"):
        path = base / filename
        if path.exists():
            with open(path, encoding="utf-8") as file:
                snippets.extend(json.load(file))
    return snippets


def _seed_dialogue_collection(collection) -> None:
    model = get_embedding_model()
    snippets = _load_dialogue_snippets()
    ids = [item["id"] for item in snippets]
    documents = [f"{item['type']} | {item['technique']} | {item['content']}" for item in snippets]
    embeddings = model.encode(documents).tolist()
    metadatas = [
        {"type": item["type"], "technique": item["technique"], "content": item["content"]}
        for item in snippets
    ]
    collection.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)


@lru_cache(maxsize=1)
def get_dialogue_collection():
    import chromadb
    from pathlib import Path

    chroma_path = Path(__file__).resolve().parents[1] / "chroma_db"
    client = chromadb.PersistentClient(path=str(chroma_path))
    collection = client.get_or_create_collection(name="therapeutic_dialogue")
    if collection.count() == 0:
        _seed_dialogue_collection(collection)
    return collection


def _stable_pick(options: list[str], seed_text: str) -> str:
    if not options:
        return ""
    index = int(hashlib.md5(seed_text.encode()).hexdigest(), 16) % len(options)
    return options[index]


def _retrieve_dialogue(query: str, dialogue_type: str, n: int = 1) -> list[str]:
    collection = get_dialogue_collection()
    model = get_embedding_model()
    embedding = model.encode([f"{dialogue_type} {query}"]).tolist()

    try:
        results = collection.query(
            query_embeddings=embedding,
            n_results=n,
            where={"type": dialogue_type},
        )
    except Exception:
        results = collection.query(query_embeddings=embedding, n_results=n)

    contents = []
    if results.get("metadatas") and results["metadatas"][0]:
        for meta in results["metadatas"][0]:
            if meta and meta.get("content"):
                if not dialogue_type or meta.get("type") == dialogue_type:
                    contents.append(meta["content"])
    return contents


def _humanize_clinical_content(content: str) -> str:
    replacements = [
        ("Ask yourself:", "Maybe ask yourself:"),
        ("Try replacing", "You could try replacing"),
        ("Write down", "If it helps, note"),
        ("List the facts", "Look at the facts"),
        ("Pause and ask:", "Take a breath —"),
        ("Rate the situation", "On a scale of 1–10,"),
        ("Thank you for sharing", "I hear you"),
    ]
    result = content
    for old, new in replacements:
        result = result.replace(old, new)
    return result


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


def _first_name(user_name: str | None) -> str | None:
    if not user_name or user_name.lower() in {"user", "guest"}:
        return None
    return user_name.split()[0]


def _empathic_lead(text: str, text_emotion: str, stats: dict) -> str:
    """Short, natural opener — like ChatGPT — skipped when conversation is ongoing."""
    if not stats["is_first_user_message"]:
        leads = _retrieve_dialogue(text_emotion + " continue conversation", "continue", 4)
        if not leads:
            leads = [
                "Yeah, that makes sense.",
                "I hear you.",
                "That sounds really hard.",
                "Got it — tell me more about that.",
                "Mm, I follow you.",
            ]
        return _stable_pick(leads, text)

    small = _is_small_talk(text)
    name = _first_name(None)

    if small == "greeting":
        return _stable_pick(
            ["Hey! What's going on?", "Hi — how's your day been?", "Hello. What would you like to talk about?"],
            text,
        )
    if small == "thanks":
        return _stable_pick(
            ["Anytime.", "Of course — I'm glad it helped.", "You're welcome. I'm still here if you need me."],
            text,
        )
    if small == "ack":
        return _stable_pick(
            ["Okay. We can pause here, or keep going — whatever you need.", "Sure. I'm here when you're ready."],
            text,
        )

    if text_emotion == "Distress Detected":
        return _stable_pick(
            [
                "That sounds like a lot to carry.",
                "I'm sorry you're going through this.",
                "Oof — that's heavy. I'm listening.",
            ],
            text,
        )
    if text_emotion == "Mild Negative":
        return _stable_pick(
            ["Something's bothering you — want to unpack it?", "Sounds like today's been rough."],
            text,
        )
    return _stable_pick(
        [
            "Thanks for telling me that.",
            "I'm listening.",
            "Okay — go on.",
        ],
        text,
    )


def _subtle_memory(emotion_history: list[dict], stats: dict) -> str | None:
    """Longitudinal hint — only occasionally, never 'welcome back'."""
    if stats["user_count"] < 2 or not emotion_history:
        return None
    if stats["user_count"] % 4 != 0:
        return None

    moods = [e.get("textEmotion") for e in emotion_history[-4:] if e.get("textEmotion") and e.get("textEmotion") != "pending"]
    if len(moods) < 2:
        return None
    return None  # keep memory implicit in RAG; avoid repetitive callbacks


def _reference_last_turn(text: str, stats: dict) -> str | None:
    if stats["user_count"] < 2 or not stats["last_user"]:
        return None
    if _is_small_talk(text):
        return None
    return None


def _build_body(text: str, text_emotion: str, distortion: str, rag_context: dict, stats: dict) -> str:
    parts = []

    if distortion != "None":
        humanized = _retrieve_dialogue(distortion, "humanize", 2)
        insight = _stable_pick(humanized, distortion) if humanized else _humanize_clinical_content(rag_context["content"])
        parts.append(insight)
    elif text_emotion in {"Distress Detected", "Mild Negative"}:
        parts.append(_humanize_clinical_content(rag_context["content"]))
    else:
        snippet = _humanize_clinical_content(rag_context["content"])
        if len(snippet) > 220:
            snippet = snippet[:217].rsplit(" ", 1)[0] + "..."
        parts.append(snippet)

    return " ".join(parts)


def _optional_face_note(facial_emotion: str) -> str | None:
    if facial_emotion in {"No Input", "No Face Detected", "Neutral", "No input"}:
        return None
    notes = {
        "Sadness": "You look a bit down too — I'm not ignoring that.",
        "Sad": "There's some sadness on your face; that's okay.",
        "Angry": "You seem tense — that's valid.",
        "Fear": "You look a little on edge.",
        "Happiness": "There's a bit of warmth in your expression, actually.",
    }
    return notes.get(facial_emotion)


def _maybe_follow_up(text: str, distortion: str, stats: dict, rag_context: dict) -> str | None:
    if _is_small_talk(text) in {"thanks", "ack"}:
        return None
    if stats["user_count"] > 0 and stats["user_count"] % 2 == 1:
        return None

    followups = _retrieve_dialogue(rag_context.get("technique", ""), "followup", 3)
    if not followups:
        followups = ["What part of this feels heaviest right now?", "Want to keep talking about it?"]
    return _stable_pick(followups, text + distortion)


def _build_contradiction_response(
    text: str,
    contradiction: dict,
    rag_context: dict,
    user_name: str | None,
    stats: dict,
) -> str:
    detected = contradiction.get("detected_emotions", {})
    text_feel = detected.get("text_emotion_human", "that you're okay")
    face_feel = detected.get("facial_emotion_human", "something harder")
    ctype = contradiction.get("contradiction_type")
    name = _first_name(user_name)

    if ctype == "words_pain_face_masked":
        core = (
            f"You wrote like you're {text_feel}, but your face looks more like {face_feel} — "
            f"like you're holding it together on the outside."
        )
    elif ctype == "mixed_distress_signals":
        core = (
            f"Your words feel {text_feel}, but I'm picking up {face_feel} in your expression. "
            f"Both can be true."
        )
    else:
        core = (
            f"You said {text_feel}, but I'm noticing {face_feel} when I look at you. "
            f"I don't want to skip over that."
        )

    humanize = _retrieve_dialogue("gentle exploration", "humanize", 1)
    extra = humanize[0] if humanize else _humanize_clinical_content(rag_context.get("content", ""))

    followups = _retrieve_dialogue("contradiction", "contradiction_followup", 2)
    follow = _stable_pick(followups, text) if followups else "What's the feeling underneath?"

    if name and stats["is_first_user_message"]:
        lead = f"{name}, can I mention something gently?"
    elif stats["is_first_user_message"]:
        lead = "Can I mention something gently?"
    else:
        lead = _stable_pick(["One thing I noticed —", "Can I be honest for a second?", "Something caught my attention —"], text)

    return f"{lead} {core} {extra} {follow}"


def generate_humanized_response(
    text: str,
    text_emotion: str,
    facial_emotion: str,
    distortion: str,
    contradiction: dict,
    safety: dict,
    rag_context: dict,
    conversation_messages: list[dict] | None = None,
    emotion_history: list[dict] | None = None,
    user_name: str | None = None,
) -> dict:
    conversation_messages = conversation_messages or []
    emotion_history = emotion_history or []
    stats = _conversation_stats(conversation_messages)
    name = _first_name(user_name)

    if safety["safety_triggered"]:
        lead = "I'm really worried about you." if not name else f"{name}, I'm really worried about you."
        return {
            "response": f"{lead}\n\n{rag_context['content']}",
            "follow_up_suggestions": ["I need help now", "I'm not safe", "Tell me about helplines"],
            "technique_used": "Safety Escalation",
        }

    if contradiction["contradiction_detected"] and contradiction.get("detected_emotions", {}).get("facial_emotion_human"):
        response = _build_contradiction_response(text, contradiction, rag_context, user_name, stats)
        return {
            "response": response,
            "follow_up_suggestions": [
                "You're right, I'm not okay",
                "I didn't realize it showed",
                "I'd rather not talk about it yet",
                "Something has been bothering me",
            ],
            "technique_used": "Gentle Exploration · Contradiction-Aware Empathy",
        }

    parts = []

    lead = _empathic_lead(text, text_emotion, stats)
    if lead:
        parts.append(lead)

    memory = _subtle_memory(emotion_history, stats)
    if memory:
        parts.append(memory)

    body = _build_body(text, text_emotion, distortion, rag_context, stats)
    if body and body not in lead:
        parts.append(body)

    face = _optional_face_note(facial_emotion)
    if face:
        parts.append(face)

    follow = _maybe_follow_up(text, distortion, stats, rag_context)
    if follow:
        parts.append(follow)

    response = " ".join(p.strip() for p in parts if p and p.strip())

    suggestions = _build_quick_replies(distortion, text_emotion, contradiction["contradiction_detected"], stats)

    return {
        "response": response,
        "follow_up_suggestions": suggestions,
        "technique_used": rag_context.get("technique", "Supportive Listening"),
    }


def _build_quick_replies(distortion: str, text_emotion: str, contradiction: bool, stats: dict) -> list[str]:
    if contradiction:
        return ["You're right, I'm not okay", "I'd rather not talk about it yet", "Something is bothering me"]
    if distortion != "None":
        return ["That thought keeps repeating", "Help me challenge this thought", "It feels true even if it isn't"]
    if text_emotion == "Distress Detected":
        return ["It's about work or studies", "I feel overwhelmed", "I just need someone to listen"]
    return ["Tell me more", "Actually, there's more to it", "Can we try a short exercise?", "I'm not sure"]
