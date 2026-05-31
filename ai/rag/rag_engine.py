# ChromaDB RAG engine — embeds and retrieves CBT therapy scripts using all-MiniLM-L6-v2.
import json
import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

CHROMA_DIR = Path(__file__).parent / "chroma_db"
KNOWLEDGE_FILE = Path(__file__).parent.parent.parent / "knowledge" / "cbt_interventions.json"

_embedding_fn = None
_collection = None


def _get_collection():
    global _embedding_fn, _collection
    if _collection is not None:
        return _collection

    _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    _collection = client.get_or_create_collection(
        name="cbt_scripts",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def seed_knowledge(force: bool = False) -> int:
    """Load CBT JSON into ChromaDB. Returns number of documents indexed."""
    collection = _get_collection()
    if collection.count() > 0 and not force:
        return collection.count()

    if not KNOWLEDGE_FILE.exists():
        raise FileNotFoundError(f"Knowledge file not found: {KNOWLEDGE_FILE}")

    with open(KNOWLEDGE_FILE, encoding="utf-8") as f:
        entries = json.load(f)

    if force and collection.count() > 0:
        existing = collection.get()
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

    ids, documents, metadatas = [], [], []
    for entry in entries:
        doc_id = entry["id"]
        text = (
            f"Distortion: {entry['distortion']}. "
            f"Technique: {entry['technique']}. "
            f"{entry['content']}"
        )
        ids.append(doc_id)
        documents.append(text)
        metadatas.append(
            {
                "distortion": entry["distortion"],
                "technique": entry["technique"],
                "keywords": ",".join(entry.get("keywords", [])),
            }
        )

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def retrieve_context(query: str, distortion: str = "None", top_k: int = 2) -> dict:
    """Retrieve the most relevant CBT script for grounding Gemini responses."""
    try:
        collection = _get_collection()
        if collection.count() == 0:
            seed_knowledge()

        where_filter = None
        if distortion and distortion not in {"None", "Crisis", "Emotional Masking"}:
            where_filter = {"distortion": distortion}

        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter if where_filter else None,
        )

        if not results["documents"] or not results["documents"][0]:
            results = collection.query(query_texts=[query], n_results=top_k)

        docs = results["documents"][0] if results["documents"] else []
        metas = results["metadatas"][0] if results["metadatas"] else []
        ids = results["ids"][0] if results["ids"] else []

        combined = "\n\n".join(docs) if docs else ""
        source_id = ids[0] if ids else "none"
        technique = metas[0].get("technique", "Supportive Listening") if metas else "Supportive Listening"

        return {
            "content": combined,
            "source_id": source_id,
            "technique": technique,
            "source_ids": ids,
        }
    except Exception as exc:
        return {
            "content": "",
            "source_id": "error",
            "technique": "Supportive Listening",
            "source_ids": [],
            "error": str(exc),
        }
