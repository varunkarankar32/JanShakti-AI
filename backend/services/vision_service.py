"""
Vision Service — YOLOv8-based Issue Detection in Photos
Detects: potholes, road damage, garbage dumps, broken infrastructure, water leaks, etc.
Falls back to basic analysis if no trained model is available.
"""

import os
import json
from typing import Dict, List
from PIL import Image
import io
import re
from config import YOLO_MODEL_PATH

# Try to load ultralytics
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[Vision] ultralytics not installed — using simulated detection")


# Damage category mapping for YOLO classes
DAMAGE_CLASSES = {
    0: "pothole",
    1: "road_crack",
    2: "garbage_dump",
    3: "broken_pipe",
    4: "damaged_wall",
    5: "waterlogging",
    6: "broken_streetlight",
    7: "fallen_tree",
}

SEVERITY_THRESHOLDS = {
    "critical": 0.85,
    "high": 0.65,
    "medium": 0.45,
    "low": 0.0,
}

ISSUE_KEYWORDS = {
    "pothole",
    "road",
    "crack",
    "garbage",
    "dump",
    "pipe",
    "water",
    "drain",
    "streetlight",
    "wall",
    "tree",
    "damage",
    "infrastructure",
}


class VisionService:
    def __init__(self, model_path: str = YOLO_MODEL_PATH):
        self.model = None
        self.model_path = model_path
        self.fallback_model = os.getenv("YOLO_FALLBACK_MODEL", "yolov8n.pt")
        self._load_model()

    def _load_model(self):
        if YOLO_AVAILABLE:
            candidates = []

            if self.model_path and os.path.exists(self.model_path):
                candidates.append(self.model_path)

            candidates.append(self.fallback_model)

            for candidate in candidates:
                try:
                    self.model = YOLO(candidate)
                    print(f"[Vision] Loaded YOLO model: {candidate}")
                    return
                except Exception as e:
                    print(f"[Vision] Error loading model '{candidate}': {e}")

        print("[Vision] YOLO model unavailable — using simulated detection")

    def detect(self, image_bytes: bytes) -> Dict:
        """
        Run object detection on an image.
        Returns: {detections, category, severity, confidence}
        """
        if self.model:
            return self._yolo_detect(image_bytes)
        return self._simulated_detect(image_bytes)

    def _normalize_class_name(self, name: str) -> str:
        cleaned = re.sub(r"\s+", "_", str(name).strip().lower())
        return cleaned

    def _is_issue_class(self, cls_name: str) -> bool:
        name = self._normalize_class_name(cls_name)
        return any(token in name for token in ISSUE_KEYWORDS)

    def _yolo_detect(self, image_bytes: bytes) -> Dict:
        """Run actual YOLOv8 inference."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            results = self.model(image, conf=0.25)

            detections = []
            for result in results:
                names = getattr(result, "names", None) or getattr(self.model, "names", {})
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()

                    class_name = names.get(cls_id, DAMAGE_CLASSES.get(cls_id, f"class_{cls_id}"))
                    class_name = self._normalize_class_name(class_name)

                    detection = {
                        "class": str(class_name),
                        "confidence": round(conf, 3),
                        "bbox": {
                            "x1": round(x1, 1),
                            "y1": round(y1, 1),
                            "x2": round(x2, 1),
                            "y2": round(y2, 1),
                        },
                    }
                    detections.append(detection)

            if not detections:
                # If model misses all objects, fall back to heuristic image analysis.
                return self._simulated_detect(image_bytes)

            issue_detections = [d for d in detections if self._is_issue_class(d["class"])]
            if not issue_detections:
                heuristic = self._simulated_detect(image_bytes)
                heuristic["detections"] = detections + heuristic.get("detections", [])
                return heuristic

            # Use highest-confidence detection
            best = max(issue_detections, key=lambda d: d["confidence"])
            severity = self._get_severity(best["confidence"])

            return {
                "detections": detections,
                "category": best["class"].replace("_", " ").title(),
                "severity": severity,
                "confidence": best["confidence"],
            }

        except Exception as e:
            print(f"[Vision] Detection error: {e}")
            return self._simulated_detect(image_bytes)

    def _simulated_detect(self, image_bytes: bytes) -> Dict:
        """Simulated detection for demo purposes."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            width, height = image.size

            # Basic image analysis
            import numpy as np
            img_array = np.array(image.convert("RGB"))
            mean_brightness = img_array.mean()
            dark_pixels = (img_array < 80).sum() / img_array.size

            # Heuristic detection
            detections = []
            if dark_pixels > 0.15:
                detections.append({
                    "class": "pothole",
                    "confidence": round(0.6 + dark_pixels * 0.3, 3),
                    "bbox": {"x1": width * 0.2, "y1": height * 0.3, "x2": width * 0.6, "y2": height * 0.7},
                })

            if mean_brightness < 100:
                detections.append({
                    "class": "road_damage",
                    "confidence": 0.55,
                    "bbox": {"x1": width * 0.1, "y1": height * 0.4, "x2": width * 0.8, "y2": height * 0.8},
                })

            if not detections:
                detections.append({
                    "class": "infrastructure_issue",
                    "confidence": 0.45,
                    "bbox": {"x1": width * 0.15, "y1": height * 0.15, "x2": width * 0.85, "y2": height * 0.85},
                })

            best = max(detections, key=lambda d: d["confidence"])
            severity = self._get_severity(best["confidence"])

            return {
                "detections": detections,
                "category": best["class"].replace("_", " ").title(),
                "severity": severity,
                "confidence": best["confidence"],
            }

        except Exception as e:
            return {
                "detections": [],
                "category": "Infrastructure Issue",
                "severity": "low",
                "confidence": 0.35,
            }

    def _get_severity(self, confidence: float) -> str:
        if confidence >= SEVERITY_THRESHOLDS["critical"]:
            return "critical"
        elif confidence >= SEVERITY_THRESHOLDS["high"]:
            return "high"
        elif confidence >= SEVERITY_THRESHOLDS["medium"]:
            return "medium"
        return "low"


# Singleton
vision_service = VisionService()
