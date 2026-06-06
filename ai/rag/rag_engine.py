# ChromaDB RAG engine — embeds and retrieves CBT therapy scripts using all-MiniLM-L6-v2.
import json
import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

CHROMA_DIR = Path(__file__).parent / "chroma_db"
KNOWLEDGE_FILE = Path(__file__).parent.parent.parent / "knowledge" / "cbt_interventions.json"

_embedding_fn = None
_knowledge_collection = None
_history_collection = None


def _get_collections():
    global _embedding_fn, _knowledge_collection, _history_collection
    if _knowledge_collection is not None and _history_collection is not None:
        return _knowledge_collection, _history_collection

    _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    
    _knowledge_collection = client.get_or_create_collection(
        name="cbt_scripts",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    
    _history_collection = client.get_or_create_collection(
        name="user_history",
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    
    return _knowledge_collection, _history_collection


def seed_knowledge(force: bool = False) -> int:
    """Load CBT JSON into ChromaDB. Returns number of documents indexed."""
    knowledge, _ = _get_collections()
    if knowledge.count() > 0 and not force:
        return knowledge.count()

    if not KNOWLEDGE_FILE.exists():
        raise FileNotFoundError(f"Knowledge file not found: {KNOWLEDGE_FILE}")

    with open(KNOWLEDGE_FILE, encoding="utf-8") as f:
        entries = json.load(f)

    if force and knowledge.count() > 0:
        existing = knowledge.get()
        if existing["ids"]:
            knowledge.delete(ids=existing["ids"])

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

    knowledge.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def add_to_history(user_id: str, session_id: str, text: str, distortion: str = "None"):
    """Store user interaction for future RAG retrieval (innovation claim)."""
    try:
        _, history = _get_collections()
        doc_id = f"{session_id}_{os.urandom(4).hex()}"
        history.add(
            ids=[doc_id],
            documents=[text],
            metadatas=[{
                "user_id": user_id,
                "session_id": session_id,
                "distortion": distortion,
                "type": "user_input"
            }]
        )
    except Exception as e:
        print(f"Error saving to RAG history: {e}")


def retrieve_context(query: str, distortion: str = "None", user_id: str = None, top_k: int = 2) -> dict:
    """Retrieve relevant CBT scripts AND past user history for grounding Gemini."""
    try:
        knowledge, history = _get_collections()
        if knowledge.count() == 0:
            seed_knowledge()

        # 1. Retrieve from Knowledge Base (CBT Scripts)
        where_filter = None
        if distortion and distortion not in {"None", "Crisis", "Emotional Masking"}:
            where_filter = {"distortion": distortion}

        results = knowledge.query(
            query_texts=[query],
            n_results=top_k,
            where=where_filter if where_filter else None,
        )

        if not results["documents"] or not results["documents"][0]:
            results = knowledge.query(query_texts=[query], n_results=top_k)

        docs = results["documents"][0] if results["documents"] else []
        metas = results["metadatas"][0] if results["metadatas"] else []
        ids = results["ids"][0] if results["ids"] else []

        # 2. Retrieve from User History (Long-term Context)
        history_docs = []
        if user_id:
            h_results = history.query(
                query_texts=[query],
                n_results=1,
                where={"user_id": user_id}
            )
            if h_results["documents"] and h_results["documents"][0]:
                history_docs = h_results["documents"][0]

        # Combine Knowledge + History
        context_parts = []
        if docs:
            context_parts.append("RELEVANT CBT KNOWLEDGE:\n" + "\n\n".join(docs))
        if history_docs:
            context_parts.append("PAST USER CONTEXT:\n" + "\n\n".join(history_docs))

        combined = "\n\n---\n\n".join(context_parts)
        source_id = ids[0] if ids else "none"
        technique = metas[0].get("technique", "Supportive Listening") if metas else "Supportive Listening"

        return {
            "context": combined,
            "source_id": source_id,
            "technique": technique,
        }
    except Exception as exc:
        print(f"RAG retrieval error: {exc}")
        return {
            "context": "",
            "source_id": "none",
            "technique": "Supportive Listening",
        }
