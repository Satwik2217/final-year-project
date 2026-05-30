"""Re-seed ChromaDB dialogue collections when new knowledge files are added."""
from pathlib import Path

import chromadb

from services.humanized_response import _load_dialogue_snippets, _seed_dialogue_collection


def reseed_dialogue():
    chroma_path = Path(__file__).resolve().parent / "chroma_db"
    client = chromadb.PersistentClient(path=str(chroma_path))
    try:
        client.delete_collection("therapeutic_dialogue")
    except Exception:
        pass
    collection = client.get_or_create_collection(name="therapeutic_dialogue")
    _seed_dialogue_collection(collection)
    print(f"Reseeded therapeutic_dialogue with {collection.count()} snippets")


if __name__ == "__main__":
    reseed_dialogue()
