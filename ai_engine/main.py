from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.pipeline import run_pipeline

app = FastAPI(title="NeuroWell AI Engine", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConversationMessage(BaseModel):
    sender: str
    text: str


class AnalyzeRequest(BaseModel):
    text: str
    image_base64: Optional[str] = None
    session_history: Optional[list] = None
    conversation_messages: Optional[list[ConversationMessage]] = None
    user_name: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "online", "engine": "NeuroWell Humanized RAG Engine v1.1"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    conversation = [
        {"sender": m.sender, "text": m.text}
        for m in (request.conversation_messages or [])
    ]
    result = run_pipeline(
        text=request.text,
        image_base64=request.image_base64,
        session_history=request.session_history or [],
        conversation_messages=conversation,
        user_name=request.user_name,
    )
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
