# Seeds ChromaDB with CBT therapy scripts from knowledge/cbt_interventions.json.
from rag_engine import seed_knowledge

if __name__ == "__main__":
    count = seed_knowledge(force=True)
    print(f"Indexed {count} CBT scripts into ChromaDB.")
