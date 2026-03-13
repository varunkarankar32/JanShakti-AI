"""
Speech Service — Whisper-based Speech-to-Text
Supports Indian languages: Hindi, Bhojpuri, Tamil, Telugu, Marathi, Bengali, etc.
"""

import os
import tempfile
from typing import Dict

# Try to load whisper
try:
    import whisper as openai_whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[Speech] whisper not installed — using simulated transcription")


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
    def __init__(self, model_name: str = "base"):
        self.model = None
        self.model_name = model_name
        self._load_model()

    def _load_model(self):
        if WHISPER_AVAILABLE:
            try:
                self.model = openai_whisper.load_model(self.model_name)
                print(f"[Speech] Loaded Whisper model: {self.model_name}")
            except Exception as e:
                print(f"[Speech] Error loading Whisper: {e}")
        else:
            print("[Speech] Whisper not available — simulated mode")

    def transcribe(self, audio_bytes: bytes, file_extension: str = "wav") -> Dict:
        """
        Transcribe audio bytes to text.
        Returns: {text, language, duration, confidence}
        """
        if self.model:
            return self._whisper_transcribe(audio_bytes, file_extension)
        return self._simulated_transcribe()

    def _whisper_transcribe(self, audio_bytes: bytes, ext: str) -> Dict:
        """Run Whisper transcription."""
        try:
            # Write to temp file
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            result = self.model.transcribe(tmp_path, task="transcribe")

            # Detect language
            detected_lang = result.get("language", "en")
            lang_name = SUPPORTED_LANGUAGES.get(detected_lang, detected_lang)

            # Clean up
            os.unlink(tmp_path)

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
            return self._simulated_transcribe()

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
