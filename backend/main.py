"""
JanShakti.AI — FastAPI Backend
AI-powered citizen governance platform backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from config import API_PREFIX, UPLOAD_DIR
from database import init_db

# Create upload directory
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("ml/weights", exist_ok=True)

# Initialize FastAPI
app = FastAPI(
    title="JanShakti.AI API",
    description="AI-powered citizen governance platform — Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for Vercel/HF Spaces
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from routers import complaints, nlp, priority, sentiment, vision, speech, reports, dashboard, whatsapp, auth

app.include_router(complaints.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(nlp.router, prefix=API_PREFIX)
app.include_router(priority.router, prefix=API_PREFIX)
app.include_router(sentiment.router, prefix=API_PREFIX)
app.include_router(vision.router, prefix=API_PREFIX)
app.include_router(speech.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(whatsapp.router, prefix=API_PREFIX)


@app.on_event("startup")
def startup():
    """Initialize database tables on startup."""
    init_db()
    print("=" * 60)
    print("  JanShakti.AI Backend — Running")
    print("  API Docs:  http://localhost:8000/docs")
    print("  ReDoc:     http://localhost:8000/redoc")
    print("=" * 60)


@app.get("/")
def root():
    return {
        "name": "JanShakti.AI API",
        "version": "1.0.0",
        "description": "AI-powered citizen governance platform",
        "docs": "/docs",
        "endpoints": {
            "complaints": f"{API_PREFIX}/complaints",
            "auth_signup": f"{API_PREFIX}/auth/signup",
            "auth_login": f"{API_PREFIX}/auth/login",
            "auth_leader_login": f"{API_PREFIX}/auth/leader/login",
            "nlp_classify": f"{API_PREFIX}/nlp/classify",
            "priority_score": f"{API_PREFIX}/priority/score",
            "sentiment_analyze": f"{API_PREFIX}/sentiment/analyze",
            "vision_detect": f"{API_PREFIX}/vision/detect",
            "speech_transcribe": f"{API_PREFIX}/speech/transcribe",
            "report_generate": f"{API_PREFIX}/reports/generate",
            "dashboard_stats": f"{API_PREFIX}/dashboard/stats",
            "whatsapp_webhook": f"{API_PREFIX}/whatsapp/webhook",
            "whatsapp_test": f"{API_PREFIX}/whatsapp/test",
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "janshakti-ai-backend"}
