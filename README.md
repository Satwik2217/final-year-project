# NeuroWell — Beyond Generative AI

Final Year Project · B.Tech CSE · United Institute of Technology, Prayagraj

NeuroWell is the name of our final‑year project — a multimodal mental wellness companion that goes beyond generative AI. It’s designed to combine text analysis, facial emotion recognition, cognitive distortion detection, and empathetic interventions into one integrated system.

## Architecture

```
frontend (React + Vite)  →  backend (Express + MongoDB)  →  ai_engine (FastAPI + Python)
                                    ↓
                              EmotionLog / Session / Message
                                    ↓
                              ChromaDB (RAG knowledge base)
```

### Synopsis pipeline (Chapter 3)

| Step | Implementation |
|------|----------------|
| 3.1 User input | React dashboard + optional webcam (consent modal) |
| 3.2 Dual-channel | DistilBERT text + DeepFace/OpenCV vision |
| 3.3 Contradiction | `services/synthesis.py` |
| 3.4 CBT intervention | RAG over `knowledge/cbt_interventions.json` |
| 3.5 Safety check | Crisis keywords → helpline modal |
| 3.6 Persistence | MongoDB sessions, messages, emotion logs |

## Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas (or local MongoDB)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with MONGO_URI and JWT_SECRET
npm start
```

Runs on **http://localhost:5000**

### 2. AI Engine (Python)

```bash
cd ai_engine
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Optional — better facial emotion (heavy):
# pip install deepface

python main.py
```

Runs on **http://localhost:8000**

First run downloads DistilBERT and embedding models (~500MB).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Runs on **http://localhost:5173**

## Environment variables

**backend/.env**
```
MONGO_URI=...
JWT_SECRET=...
AI_SERVICE_URL=http://localhost:8000
```

**frontend/.env**
```
VITE_API_URL=http://localhost:5000
```

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | JWT login |
| `GET /api/sessions` | List therapy sessions |
| `POST /api/sessions/:id/messages` | Send message + multimodal AI analysis |
| `GET /api/analytics/emotion-history` | Longitudinal mood data |
| `POST http://localhost:8000/analyze` | Python AI pipeline |

## Team

Satwik Mishra · Parikshit Pandey · Rishabh Sharma · Ayush Mishra

Guided by Dr. Ankita Srivastava

## Disclaimer

NeuroWell is an academic research prototype. It is **not** a replacement for licensed mental health care. Crisis resources: Tele-MANAS **14416**, iCall **9152987821**.
