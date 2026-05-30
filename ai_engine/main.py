from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.pipeline import run_pipeline

app = FastAPI(title="NeuroWell AI Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str
    image_base64: Optional[str] = None
    session_history: Optional[list] = None


@app.get("/health")
def health():
    return {"status": "online", "engine": "NeuroWell AI Engine v1.0"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    result = run_pipeline(
        text=request.text,
        image_base64=request.image_base64,
        session_history=request.session_history or [],
    )
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
