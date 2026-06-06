# NeuroWell — Multimodal AI Mental Health Chatbot

Final Year Project · B.Tech CSE · United Institute of Technology, Prayagraj

Multimodal mental wellness companion with **text + facial emotion analysis**, **BART-based zero-shot cognitive distortion detection**, **contradiction-aware empathy**, **RAG-grounded interventions (CBT knowledge + User History)**, **safety escalation**, and **longitudinal MongoDB + Vector memory**.

## Architecture

```
client/          React.js frontend          → port 3000
server/          Node.js Express backend    → port 5000
ai/deepface/     Flask DeepFace API         → port 5001
ai/albert/       Flask BART + RAG API       → port 5002
ai/rag/          ChromaDB + sentence-transformers embeddings (Knowledge + History)
knowledge/       CBT therapy scripts (JSON)
```

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **MongoDB** running locally or Atlas URI
- **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)

## Installation

```bash
# 1. Install all dependencies (root, client, server, Python)
npm run install:all

# 2. Seed ChromaDB with CBT scripts
npm run seed:rag

# 3. Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env — set MONGO_URI, JWT_SECRET, GEMINI_API_KEY
```

### server/.env

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/neurowell
JWT_SECRET=your_long_random_secret
GEMINI_API_KEY=your_gemini_api_key
DEEPFACE_API_URL=http://localhost:5001
ALBERT_API_URL=http://localhost:5002
```

### client/.env

```
REACT_APP_API_URL=http://localhost:5000
```

## Run Everything

From the project root:

```bash
npm start
```

This starts all four services concurrently:
- React → http://localhost:3000
- Express → http://localhost:5000
- DeepFace Flask → http://localhost:5001
- ALBERT Flask → http://localhost:5002

## Features

| Feature | Description |
|---------|-------------|
| JWT Auth | Register/login with bcrypt-hashed passwords |
| Gemini Streaming | Word-by-word AI responses via SSE |
| Webcam Emotion | DeepFace + OpenCV, frame every 3s with consent toggle |
| ALBERT Distortion | Cognitive distortion detection via HuggingFace |
| RAG Grounding | ChromaDB + all-MiniLM-L6-v2 retrieves CBT scripts |
| Contradiction | Detects when text says "fine" but face shows sadness |
| Safety Layer | Crisis keywords bypass Gemini, show helplines immediately |
| Emotion Dashboard | Recharts line chart of emotional trends |
| Graceful Fallback | Works text-only if DeepFace/ALBERT/Gemini unavailable |

## API Endpoints

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT token

### Sessions (authenticated)
- `GET /api/sessions` — list user sessions
- `POST /api/sessions` — create session
- `GET /api/sessions/:id/messages` — get messages
- `POST /api/sessions/:id/messages` — send message (non-streaming)
- `POST /api/sessions/:id/messages/stream` — send message with Gemini SSE streaming
- `POST /api/sessions/:id/face` — analyze webcam frame

### Analytics
- `GET /api/analytics/emotions` — emotion history for dashboard

## Crisis Helplines (India)

- **iCall:** 9152987821
- **Vandrevala Foundation:** 1860-2662-345
- **Tele-MANAS:** 14416

## Project Structure

```
Final-Year-Project Web App/
├── client/                 React frontend
├── server/                 Express backend
├── ai/
│   ├── deepface/           Facial emotion Flask API
│   ├── albert/             ALBERT distortion Flask API
│   └── rag/                ChromaDB setup + retrieval
├── knowledge/              CBT intervention JSON
├── package.json            Root scripts (concurrently)
└── README.md
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB connection failed | Start MongoDB or update `MONGO_URI` |
| DeepFace slow on first run | First request downloads models — wait ~30s |
| ALBERT slow on first run | Downloads `textattack/albert-base-v2-snli-mnli` |
| Gemini errors | Verify `GEMINI_API_KEY` in `server/.env` |
| Webcam not working | Enable consent toggle; allow browser camera permission |

## License

Final Year Project — B.Tech CSE, AKTU 2025–26
