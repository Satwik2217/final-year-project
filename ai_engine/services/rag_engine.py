import json
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
        query = "crisis safety suicide helpline immediate support"
    elif contradiction:
        query = "emotional masking contradiction fine but sad gentle exploration"
    elif distortion != "None":
        query = f"{distortion} CBT intervention {text}"
    else:
        query = f"supportive listening empathy {text}"

    embedding = model.encode([query]).tolist()
    results = collection.query(query_embeddings=embedding, n_results=3)

    metadatas = results["metadatas"][0] if results.get("metadatas") and results["metadatas"][0] else []
    ids = results["ids"][0] if results.get("ids") and results["ids"][0] else []

    primary = metadatas[0] if metadatas else {}
    secondary = metadatas[1] if len(metadatas) > 1 else {}

    combined_content = primary.get("content", "I'm here with you.")
    if secondary.get("content") and not safety_triggered:
        combined_content = f"{primary.get('content', '')} {secondary.get('content', '')}".strip()

    return {
        "source_id": ids[0] if ids else "general",
        "source_ids": ids,
        "technique": primary.get("technique", "Supportive Listening"),
        "content": combined_content,
        "distortion": primary.get("distortion", distortion),
        "secondary_technique": secondary.get("technique"),
    }
