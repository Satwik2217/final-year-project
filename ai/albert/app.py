# Flask API on port 5002 — BART cognitive distortion detection via HuggingFace Transformers.
import os
from dotenv import load_dotenv

# Try to load .env from several potential locations
env_paths = [
    os.path.join(os.path.dirname(__file__), ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", "server", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "..", ".env")
]
for path in env_paths:
    if os.path.exists(path):
        load_dotenv(path)
        break

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import sys
import logging

# Suppress Hugging Face hub warnings
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("transformers").setLevel(logging.ERROR)

from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rag"))
from rag_engine import retrieve_context, add_to_history  # noqa: E402

app = Flask(__name__)
CORS(app)

DISTORTION_LABELS = [
    "Overgeneralization / All-or-Nothing Thinking",
    "Catastrophizing",
    "Mind Reading",
    "Emotional Reasoning",
    "Should Statements",
    "Mental Filter / Discounting Positives",
    "None",
]

_classifier = None


def get_classifier():
    global _classifier
    if _classifier is None:
        from transformers import pipeline

        # Switched from ALBERT to BART for better zero-shot accuracy
        _classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            device=-1,
        )
    return _classifier


def keyword_fallback(text: str) -> str:
    lower = text.lower()
    rules = [
        (["always", "never", "everything", "nothing"], "Overgeneralization / All-or-Nothing Thinking"),
        (["worst", "disaster", "ruined", "can't handle", "fall apart"], "Catastrophizing"),
        (["they think", "judging me", "they hate", "they don't care"], "Mind Reading"),
        (["should", "must", "have to", "ought to"], "Should Statements"),
        (["feels like", "must be true because i feel"], "Emotional Reasoning"),
        (["worthless", "failed", "messed up", "nothing good"], "Mental Filter / Discounting Positives"),
    ]
    for keywords, label in rules:
        if any(k in lower for k in keywords):
            return label
    return "None"


@app.get("/health")
def health():
    return jsonify({"status": "online", "service": "BART Distortion API", "port": 5002})


@app.post("/analyze")
def analyze():
    try:
        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()

        if not text:
            return jsonify({"cognitive_distortion": "None", "confidence": 0.0, "engine": "BART"})

        try:
            clf = get_classifier()
            result = clf(text, DISTORTION_LABELS, multi_label=False)
            label = result["labels"][0]
            score = round(float(result["scores"][0]), 3)
            if score < 0.25:
                label = keyword_fallback(text)
                score = 0.5

            return jsonify({
                "cognitive_distortion": label,
                "confidence": score,
                "engine": "BART",
                "scores": {l: round(float(s), 3) for l, s in zip(result["labels"], result["scores"])}
            })
        except Exception as e:
            return jsonify({
                "cognitive_distortion": keyword_fallback(text),
                "confidence": 0.4,
                "engine": "BART-Fallback",
                "error": str(e)
            })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.post("/rag/retrieve")
def rag_retrieve():
    try:
        data = request.get_json(silent=True) or {}
        query = data.get("query", "")
        distortion = data.get("distortion", "None")
        user_id = data.get("user_id")
        
        result = retrieve_context(query, distortion=distortion, user_id=user_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/rag/add")
def rag_add():
    try:
        data = request.get_json(silent=True) or {}
        user_id = data.get("user_id")
        session_id = data.get("session_id")
        text = data.get("text")
        distortion = data.get("distortion", "None")
        
        if user_id and session_id and text:
            add_to_history(user_id, session_id, text, distortion)
            return jsonify({"status": "success"})
        return jsonify({"status": "ignored", "reason": "missing data"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def warm_up_rag():
    """Pre-initialize RAG embedding model on startup to avoid timeout on first request."""
    try:
        from rag_engine import _get_collections
        knowledge, _ = _get_collections()
        print(f"[ALBERT] RAG engine warmed up. ChromaDB has {knowledge.count()} documents.")
    except Exception as e:
        print(f"[ALBERT] Warning: RAG warmup failed: {e}")


if __name__ == "__main__":
    warm_up_rag()
    app.run(host="0.0.0.0", port=5002, debug=False)
