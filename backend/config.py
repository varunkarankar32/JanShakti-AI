import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

def _fix_db_url(url: str) -> str:
    if not url:
        return url
    
    # SQLAlchemy requires 'postgresql://' instead of 'postgres://'
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    # Fix unescaped '@' or other symbols in passwords (e.g. Supabase passwords)
    if url.startswith("postgresql://") and url.count("@") > 1:
        import urllib.parse
        prefix, host_part = url.rsplit("@", 1)
        parts = prefix.split("://", 1)
        if len(parts) == 2:
            scheme, auth_part = parts
            if ":" in auth_part:
                user, password = auth_part.split(":", 1)
                password = urllib.parse.quote(password)
                url = f"{scheme}://{user}:{password}@{host_part}"
                
    # Fix IPv6 Supabase connection dropping in Render: Switch to connection pooler (IPv4)
    if "supabase.co" in url and ":5432" in url:
        url = url.replace(":5432", ":6543")
        
    return url

DATABASE_URL = _fix_db_url(os.getenv("DATABASE_URL", "sqlite:///./janshakti.db"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium, large
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "ml/weights/yolov8_damage.pt")
CLASSIFIER_MODEL_PATH = os.getenv("CLASSIFIER_MODEL_PATH", "ml/weights/classifier.pkl")
SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "distilbert-base-uncased-finetuned-sst-2-english")
QWEN_PRIORITY_ENABLED = os.getenv("QWEN_PRIORITY_ENABLED", "true").lower() == "true"
QWEN_PRIORITY_MODEL = os.getenv("QWEN_PRIORITY_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")
QWEN_PRIORITY_MAX_NEW_TOKENS = int(os.getenv("QWEN_PRIORITY_MAX_NEW_TOKENS", "220"))
QWEN_API_PROVIDER = os.getenv("QWEN_API_PROVIDER", "auto")  # auto|local|openrouter
QWEN_API_URL = os.getenv("QWEN_API_URL", "https://openrouter.ai/api/v1/chat/completions")
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
QWEN_API_MODEL = os.getenv("QWEN_API_MODEL", "qwen/qwen3-4b:free")
QWEN_API_TIMEOUT = int(os.getenv("QWEN_API_TIMEOUT", "45"))
QWEN_API_REFERER = os.getenv("QWEN_API_REFERER", "")
QWEN_API_TITLE = os.getenv("QWEN_API_TITLE", "JanShakti-AI")
GEMINI_VISION_ENABLED = os.getenv("GEMINI_VISION_ENABLED", "true").lower() == "true"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_URL = os.getenv("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/models")
GEMINI_TIMEOUT = int(os.getenv("GEMINI_TIMEOUT", "30"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
API_PREFIX = "/api"
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# Auth / JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

# Bootstrap leader account (for local setup)
DEFAULT_LEADER_NAME = os.getenv("DEFAULT_LEADER_NAME", "District Leader")
DEFAULT_LEADER_EMAIL = os.getenv("DEFAULT_LEADER_EMAIL", "leader@janshakti.ai")
DEFAULT_LEADER_PASSWORD = os.getenv("DEFAULT_LEADER_PASSWORD", "Leader@123")

# Bootstrap authority account (for local setup)
DEFAULT_AUTHORITY_NAME = os.getenv("DEFAULT_AUTHORITY_NAME", "Ward Authority")
DEFAULT_AUTHORITY_EMAIL = os.getenv("DEFAULT_AUTHORITY_EMAIL", "authority@janshakti.ai")
DEFAULT_AUTHORITY_PASSWORD = os.getenv("DEFAULT_AUTHORITY_PASSWORD", "Authority@123")

# Bootstrap admin account (for local setup)
DEFAULT_ADMIN_NAME = os.getenv("DEFAULT_ADMIN_NAME", "System Admin")
DEFAULT_ADMIN_EMAIL = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@janshakti.ai")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "Admin@123")

# Optional SMTP config for leader -> authority email dispatch
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
