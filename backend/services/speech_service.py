"""
Speech Service — Whisper-based Speech-to-Text
Supports Indian languages: Hindi, Bhojpuri, Tamil, Telugu, Marathi, Bengali, etc.
"""

import os
import io
import wave
import tempfile
from typing import Dict
from config import WHISPER_MODEL

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

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
            ext = (ext or "wav").lower().strip(".")

            # Write to temp file
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            result = self.model.transcribe(tmp_path, task="transcribe", fp16=False)

        except Exception as e:
            print(f"[Speech] File transcription error: {e}")

            # Whisper depends on ffmpeg for file decoding. For wav uploads,
            # attempt direct PCM decoding to keep transcription available.
            result = self._transcribe_wav_bytes(audio_bytes, ext)
            if result is None:
                if ALLOW_SIMULATED_TRANSCRIPTION:
                    return self._simulated_transcribe()
                return self._empty_transcription(
                    "Unable to decode/transcribe audio. Ensure ffmpeg is installed and audio format is supported."
                )

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        return self._format_result(result)

    def _format_result(self, result: Dict) -> Dict:
        text = (result.get("text") or "").strip()

        if not text:
            return self._empty_transcription("No speech detected in uploaded audio.")

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
            "text": text,
            "language": lang_name,
            "duration": round(duration, 1),
            "confidence": round(confidence, 3),
        }

    def _transcribe_wav_bytes(self, audio_bytes: bytes, ext: str):
        if ext != "wav" or not NUMPY_AVAILABLE:
            return None

        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                frame_rate = wav_file.getframerate()
                frame_count = wav_file.getnframes()
                frames = wav_file.readframes(frame_count)

            if sample_width == 2:
                pcm = np.frombuffer(frames, dtype=np.int16).astype(np.float32)
                pcm = pcm / 32768.0
            elif sample_width == 1:
                pcm = np.frombuffer(frames, dtype=np.uint8).astype(np.float32)
                pcm = (pcm - 128.0) / 128.0
            else:
                return None

            if channels > 1:
                pcm = pcm.reshape(-1, channels).mean(axis=1)

            if frame_rate != 16000:
                duration = len(pcm) / float(frame_rate)
                if duration <= 0:
                    return None
                target_length = max(1, int(duration * 16000))
                x_old = np.linspace(0.0, duration, num=len(pcm), endpoint=False)
                x_new = np.linspace(0.0, duration, num=target_length, endpoint=False)
                pcm = np.interp(x_new, x_old, pcm).astype(np.float32)

            return self.model.transcribe(pcm, task="transcribe", fp16=False)
        except Exception as e:
            print(f"[Speech] WAV fallback transcription error: {e}")
            return None

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
