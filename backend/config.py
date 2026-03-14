import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./janshakti.db")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny, base, small, medium, large
YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "ml/weights/yolov8_damage.pt")
CLASSIFIER_MODEL_PATH = os.getenv("CLASSIFIER_MODEL_PATH", "ml/weights/classifier.pkl")
SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "distilbert-base-uncased-finetuned-sst-2-english")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
API_PREFIX = "/api"

# Auth / JWT
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 days

# Bootstrap leader account (for local setup)
DEFAULT_LEADER_NAME = os.getenv("DEFAULT_LEADER_NAME", "District Leader")
DEFAULT_LEADER_EMAIL = os.getenv("DEFAULT_LEADER_EMAIL", "leader@janshakti.ai")
DEFAULT_LEADER_PASSWORD = os.getenv("DEFAULT_LEADER_PASSWORD", "Leader@123")
