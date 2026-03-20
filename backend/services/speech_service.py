"""
Speech Service — Whisper-based Speech-to-Text
Supports Indian languages: Hindi, Bhojpuri, Tamil, Telugu, Marathi, Bengali, etc.
"""

import os
import tempfile
from typing import Dict
from config import WHISPER_MODEL

# Try to load whisper
try:
    import whisper as openai_whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[Speech] whisper not installed — using simulated transcription")


ALLOW_SIMULATED_TRANSCRIPTION = os.getenv("ALLOW_SIMULATED_TRANSCRIPTION", "false").lower() == "true"


SUPPORTED_LANGUAGES = {
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "or": "Odia",
    "ur": "Urdu",
    "en": "English",
}


class SpeechService:
    def __init__(self, model_name: str = WHISPER_MODEL):
        self.model = None
        self.model_name = model_name
        self._load_model()

    def _load_model(self):
        if WHISPER_AVAILABLE:
            for candidate in [self.model_name, "tiny"]:
                try:
                    self.model = openai_whisper.load_model(candidate)
                    self.model_name = candidate
                    print(f"[Speech] Loaded Whisper model: {candidate}")
                    return
                except Exception as e:
                    print(f"[Speech] Error loading Whisper model '{candidate}': {e}")
            print("[Speech] Whisper model initialization failed — simulated mode")
        else:
            print("[Speech] Whisper not available — simulated mode")

    def transcribe(self, audio_bytes: bytes, file_extension: str = "wav") -> Dict:
        """
        Transcribe audio bytes to text.
        Returns: {text, language, duration, confidence}
        """
        if self.model:
            return self._whisper_transcribe(audio_bytes, file_extension)

        if ALLOW_SIMULATED_TRANSCRIPTION:
            return self._simulated_transcribe()

        return self._empty_transcription(
            "Speech transcription model is unavailable. Install/configure Whisper and ffmpeg."
        )

    def _empty_transcription(self, error_message: str) -> Dict:
        return {
            "text": "",
            "language": "unknown",
            "duration": 0.0,
            "confidence": 0.0,
            "error": error_message,
        }

    def _whisper_transcribe(self, audio_bytes: bytes, ext: str) -> Dict:
        """Run Whisper transcription."""
        tmp_path = None
        try:
            # Write to temp file
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            result = self.model.transcribe(tmp_path, task="transcribe", fp16=False)

            # Detect language
            detected_lang = result.get("language", "en")
            lang_name = SUPPORTED_LANGUAGES.get(detected_lang, detected_lang)

            segments = result.get("segments", [])
            duration = segments[-1]["end"] if segments else 0.0
            avg_confidence = (
                sum(s.get("avg_logprob", -0.5) for s in segments) / len(segments)
                if segments else -1.0
            )
            # Convert log prob to approximate confidence
            confidence = max(0.0, min(1.0, 1.0 + avg_confidence))

            return {
                "text": result["text"].strip(),
                "language": lang_name,
                "duration": round(duration, 1),
                "confidence": round(confidence, 3),
            }

        except Exception as e:
            print(f"[Speech] Transcription error: {e}")
            if ALLOW_SIMULATED_TRANSCRIPTION:
                return self._simulated_transcribe()
            return self._empty_transcription(
                "Unable to decode/transcribe audio. Ensure ffmpeg is installed and audio format is supported."
            )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _simulated_transcribe(self) -> Dict:
        """Simulated transcription for demo."""
        return {
            "text": "Hamar gali mein paani ka pipe toot gail ba, teen din se paani bah raha hai",
            "language": "Hindi/Bhojpuri",
            "duration": 28.5,
            "confidence": 0.87,
        }


# Singleton
speech_service = SpeechService()
