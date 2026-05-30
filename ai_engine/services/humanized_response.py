import hashlib
import re
from functools import lru_cache

from services.rag_engine import get_embedding_model


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


def _mirror_user_words(text: str) -> str:
    cleaned = text.strip().rstrip(".")
    if len(cleaned) < 8:
        return f"When you say \"{cleaned},\" I can sense there's something meaningful behind that."
    if len(cleaned) > 120:
        cleaned = cleaned[:117] + "..."
    return f"When you share something like \"{cleaned},\" it tells me this is really affecting you."


def _personalize(text: str, user_name: str | None) -> str:
    if not user_name or user_name.lower() in {"user", "guest"}:
        return text
    if text.startswith("Welcome back"):
        return text.replace("Welcome back", f"Welcome back, {user_name}")
    return text


def _reference_history(conversation_messages: list[dict], emotion_history: list[dict]) -> str:
    if conversation_messages and len(conversation_messages) >= 2:
        prior = [m for m in conversation_messages if m.get("sender") == "user"][-2:]
        if len(prior) >= 1 and len(conversation_messages) >= 4:
            return "I've been following what you've shared in this conversation, and I want you to know I'm paying attention — not just to your words, but to how you're feeling over time."

    if emotion_history and len(emotion_history) >= 2:
        moods = [e.get("textEmotion") for e in emotion_history[-3:] if e.get("textEmotion")]
        unique = [m for m in dict.fromkeys(moods) if m and m != "pending"]
        if len(unique) >= 2:
            return f"I remember from our recent sessions that your emotional landscape has shifted — you've moved through {', '.join(unique).lower()}. That continuity matters."

    return ""


def _humanize_clinical_content(content: str) -> str:
    replacements = [
        ("Ask yourself:", "You might gently ask yourself:"),
        ("Try replacing", "Maybe try replacing"),
        ("Write down", "If it helps, jot down"),
        ("List the facts", "It can help to list the facts"),
        ("Pause and ask:", "Take a breath, and consider:"),
        ("Rate the situation", "If you had to rate this moment"),
    ]
    result = content
    for old, new in replacements:
        result = result.replace(old, new)
    return result


def _extract_key_phrase(text: str) -> str:
    words = re.findall(r"\b[\w']+\b", text.lower())
    emotional = {"sad", "anxious", "stressed", "lonely", "worried", "overwhelmed", "tired", "scared", "fine", "okay"}
    found = [w for w in words if w in emotional]
    return found[0] if found else ""


def _build_contradiction_response(
    text: str,
    contradiction: dict,
    rag_context: dict,
    user_name: str | None,
) -> str:
    """Dedicated human response when text and face emotions conflict (Synopsis 3.3)."""
    detected = contradiction.get("detected_emotions", {})
    text_feel = detected.get("text_emotion_human", "one thing")
    face_feel = detected.get("facial_emotion_human")
    ctype = contradiction.get("contradiction_type")
    name = user_name.split()[0] if user_name and user_name.lower() not in {"user", "guest"} else None

    openers = _retrieve_dialogue("contradiction gentle honest caring", "contradiction", 2)
    reassure = _retrieve_dialogue("fine when hurting human", "contradiction", 2)
    invites = _retrieve_dialogue("no judgment safe space", "contradiction", 1)
    followups = _retrieve_dialogue("truth how today really been", "contradiction_followup", 2)
    humanize = _retrieve_dialogue("gentle exploration emotional masking", "humanize", 1)

    parts = []

    # Warm, human opener — like a friend checking in
    if openers:
        opener = _stable_pick(openers, text)
        if name and not opener.lower().startswith(name.lower()):
            opener = f"{name}, {opener[0].lower() + opener[1:]}" if opener else opener
        parts.append(opener)
    elif name:
        parts.append(f"{name}, I want to check in with you about something I noticed.")
    else:
        parts.append("I want to check in with you about something I noticed.")

    # Explicitly name BOTH detected emotions — core synopsis requirement
    if ctype == "words_pain_face_masked":
        parts.append(
            f"In your message, I hear {text_feel}. "
            f"But when I look at you, your expression seems to show {face_feel} — "
            f"almost like you're trying to stay composed even though something is weighing on you."
        )
    elif ctype == "mixed_distress_signals":
        parts.append(
            f"What you wrote sounds {text_feel}, "
            f"but your face is showing me something closer to {face_feel}. "
            f"Both can be true at once — sometimes words and feelings don't line up neatly."
        )
    else:
        parts.append(
            f"You told me {text_feel}, and I want to respect that. "
            f"At the same time, I'm noticing {face_feel} in your expression — "
            f"and I don't think I should ignore that."
        )

    # Empathetic acknowledgment — not clinical
    if reassure:
        parts.append(_stable_pick(reassure, text + "reassure"))
    else:
        parts.append(
            "It's so common to say we're okay when we're not. "
            "That doesn't mean you're pretending — it often means you're protecting yourself."
        )

    # RAG-grounded gentle exploration
    if humanize:
        parts.append(humanize[0])
    else:
        parts.append(_humanize_clinical_content(rag_context.get("content", "")))

    if invites:
        parts.append(invites[0])

    follow_up = _stable_pick(followups, text) if followups else "What's the feeling you've been carrying that 'fine' doesn't quite cover?"
    parts.append(follow_up)

    return "\n\n".join(p for p in parts if p.strip())


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

    if safety["safety_triggered"]:
        opener = _retrieve_dialogue("crisis safety support", "opener", 1)
        opener_text = opener[0] if opener else "I'm really worried about you, and I want you to be safe."
        return {
            "response": f"{opener_text}\n\n{rag_context['content']}",
            "follow_up_suggestions": ["I need help now", "I'm not safe", "Tell me about helplines"],
            "technique_used": "Safety Escalation",
        }

    # ── Contradiction path: dedicated empathetic response (Synopsis 3.3) ──
    if contradiction["contradiction_detected"] and contradiction.get("detected_emotions", {}).get("facial_emotion_human"):
        response = _build_contradiction_response(text, contradiction, rag_context, user_name)
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

    # Opener — warm and human
    openers = _retrieve_dialogue(text, "opener", 3)
    if not openers:
        openers = ["Thank you for opening up to me. I'm listening."]
    parts.append(_personalize(_stable_pick(openers, text), user_name))

    # Longitudinal memory reference (synopsis RAG memory)
    history_ref = _reference_history(conversation_messages, emotion_history)
    if history_ref:
        parts.append(history_ref)

    # Reflect user's words — makes it feel like someone is listening
    key = _extract_key_phrase(text)
    if key or len(text) > 15:
        parts.append(_mirror_user_words(text))

    # RAG-grounded CBT — woven naturally
    if distortion != "None":
        parts.append(f"Something in what you shared reminds me of a thinking pattern many people go through — {distortion.lower()}. You're not alone in that.")
        humanized = _retrieve_dialogue(distortion, "humanize", 2)
        if humanized:
            parts.append(_stable_pick(humanized, distortion))
        else:
            parts.append(_humanize_clinical_content(rag_context["content"]))
    elif text_emotion == "Distress Detected":
        parts.append("It sounds like you're carrying something heavy right now, and that weight is real.")
        parts.append(_humanize_clinical_content(rag_context["content"]))
    else:
        parts.append(_humanize_clinical_content(rag_context["content"]))

    # Facial note — only when no contradiction (contradiction path already covers both)
    if facial_emotion not in {"No Input", "No Face Detected", "Neutral", "No input"}:
        face_note = {
            "Sadness": "There's a tenderness in your expression — I'm noticing that, and it matters.",
            "Sad": "I can see some sadness in your face, and I want you to know that's okay to feel.",
            "Angry": "You seem tense right now. Sometimes anger is just pain wearing armor.",
            "Fear": "You look a little on edge — and that makes sense if things feel uncertain.",
            "Happiness": "There's a warmth in your expression. I'm glad a little of that is showing.",
        }
        parts.append(face_note.get(facial_emotion, f"I can sense {facial_emotion.lower()} in your expression, and I'm here with you."))

    # Follow-up question — conversational closure
    followups = _retrieve_dialogue(rag_context.get("technique", "Supportive Listening"), "followup", 3)
    if not followups:
        followups = ["What would feel most helpful to talk about next?"]
    follow_up = _stable_pick(followups, text + distortion)

    closings = _retrieve_dialogue("supportive listening", "closing", 2)
    closing = closings[0] if closings else "Take your time — I'm here."

    response = "\n\n".join(p for p in parts if p.strip())
    response += f"\n\n{follow_up}"

    # Quick reply suggestions based on context
    suggestions = _build_quick_replies(distortion, text_emotion, contradiction["contradiction_detected"])

    return {
        "response": response,
        "follow_up_suggestions": suggestions,
        "technique_used": rag_context.get("technique", "Supportive Listening"),
    }


def _build_quick_replies(distortion: str, text_emotion: str, contradiction: bool) -> list[str]:
    if contradiction:
        return ["Actually, I'm not okay", "I'd rather not talk about it", "Something is bothering me", "Can we explore that?"]
    if distortion != "None":
        return ["That thought keeps repeating", "I want to challenge this thought", "It feels true even if I know it's not", "Can we try an exercise?"]
    if text_emotion == "Distress Detected":
        return ["It's about work or studies", "I feel overwhelmed", "I don't know where to start", "I just need someone to listen"]
    return ["Tell me more", "I had a better moment today", "Can we try a CBT exercise?", "I'm not sure how I feel"]
