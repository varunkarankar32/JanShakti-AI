"""
Speech Router — Speech-to-text transcription endpoint.
"""

from fastapi import APIRouter, UploadFile, File
from services.speech_service import speech_service

router = APIRouter(prefix="/speech", tags=["Speech"])


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio to text using Whisper.
    Supports: Hindi, Bhojpuri, Tamil, Telugu, and 8+ more Indian languages.
    """
    audio_bytes = await audio.read()
    ext = audio.filename.split(".")[-1] if audio.filename else "wav"
    result = speech_service.transcribe(audio_bytes, ext)
    return result
