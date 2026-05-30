import json
import os
from pathlib import Path

from functools import lru_cache

KNOWLEDGE_PATH = Path(__file__).resolve().parents[2] / "knowledge" / "cbt_interventions.json"
CHROMA_PATH = Path(__file__).resolve().parents[1] / "chroma_db"


@lru_cache(maxsize=1)
def get_embedding_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_chroma_collection():
    import chromadb

    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collection = client.get_or_create_collection(name="cbt_interventions")
    if collection.count() == 0:
        seed_collection(collection)
    return collection


def load_knowledge() -> list[dict]:
    with open(KNOWLEDGE_PATH, encoding="utf-8") as file:
        return json.load(file)


def seed_collection(collection) -> None:
    model = get_embedding_model()
    docs = load_knowledge()
    ids = [item["id"] for item in docs]
    documents = [
        f"{item['distortion']} | {item['technique']} | {item['content']}"
        for item in docs
    ]
    embeddings = model.encode(documents).tolist()
    metadatas = [
        {
            "distortion": item["distortion"],
            "technique": item["technique"],
            "content": item["content"],
        }
        for item in docs
    ]
    collection.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)


def retrieve_cbt_context(text: str, distortion: str, contradiction: bool, safety_triggered: bool) -> dict:
    collection = get_chroma_collection()
    model = get_embedding_model()

    if safety_triggered:
        query = "crisis safety suicide helpline"
    elif contradiction:
        query = "emotional masking contradiction fine but sad"
    elif distortion != "None":
        query = f"{distortion} {text}"
    else:
        query = text

    embedding = model.encode([query]).tolist()
    results = collection.query(query_embeddings=embedding, n_results=1)

    metadata = results["metadatas"][0][0] if results["metadatas"] and results["metadatas"][0] else {}
    doc_id = results["ids"][0][0] if results["ids"] and results["ids"][0] else "general"

    return {
        "source_id": doc_id,
        "technique": metadata.get("technique", "Supportive Listening"),
        "content": metadata.get("content", "Thank you for sharing. I am here to support you."),
        "distortion": metadata.get("distortion", distortion),
    }


def generate_grounded_response(
    text: str,
    text_emotion: str,
    facial_emotion: str,
    distortion: str,
    contradiction: dict,
    safety: dict,
    rag_context: dict,
) -> str:
    if safety["safety_triggered"]:
        return rag_context["content"]

    parts = []

    if contradiction["contradiction_detected"]:
        parts.append(contradiction["contradiction_message"])

    if distortion != "None":
        parts.append(f"I notice a pattern of {distortion.lower()} in what you shared.")
    elif text_emotion == "Distress Detected":
        parts.append("It sounds like you may be going through a difficult emotional experience.")

    parts.append(rag_context["content"])

    if facial_emotion not in {"No Input", "No Face Detected", "Neutral"}:
        parts.append(
            f"From your visual channel, I am picking up signals consistent with {facial_emotion.lower()} "
            f"({rag_context['technique']} exercise suggested)."
        )

    return " ".join(parts)
