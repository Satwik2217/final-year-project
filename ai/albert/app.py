# Flask API on port 5002 — ALBERT cognitive distortion detection via HuggingFace Transformers.
import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rag"))
from rag_engine import retrieve_context  # noqa: E402

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

        _classifier = pipeline(
            "zero-shot-classification",
            model="textattack/albert-base-v2-snli-mnli",
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
    return jsonify({"status": "online", "service": "ALBERT Distortion API", "port": 5002})


@app.post("/analyze")
def analyze():
    try:
        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()

        if not text:
            return jsonify({"cognitive_distortion": "None", "confidence": 0.0, "engine": "ALBERT"})

        try:
            clf = get_classifier()
            result = clf(text, DISTORTION_LABELS, multi_label=False)
            label = result["labels"][0]
            score = round(float(result["scores"][0]), 3)
            if score < 0.25:
                label = keyword_fallback(text)
                score = 0.5
        except Exception:
            label = keyword_fallback(text)
            score = 0.5

        return jsonify(
            {
                "cognitive_distortion": label,
                "confidence": score,
                "engine": "ALBERT",
            }
        )
    except Exception as exc:
        return jsonify({"error": f"ALBERT analysis failed: {exc}"}), 500


@app.post("/rag/retrieve")
def rag_retrieve():
    try:
        data = request.get_json(silent=True) or {}
        query = data.get("query", "")
        distortion = data.get("distortion", "None")
        context = retrieve_context(query, distortion)
        return jsonify(context)
    except Exception as exc:
        return jsonify({"error": f"RAG retrieval failed: {exc}", "content": "", "source_id": "error"}), 500


def warm_up_rag():
    """Pre-initialize RAG embedding model on startup to avoid timeout on first request."""
    try:
        from rag_engine import _get_collection
        collection = _get_collection()
        print(f"[ALBERT] RAG engine warmed up. ChromaDB has {collection.count()} documents.")
    except Exception as e:
        print(f"[ALBERT] Warning: RAG warmup failed: {e}")


if __name__ == "__main__":
    warm_up_rag()
    app.run(host="0.0.0.0", port=5002, debug=False)
