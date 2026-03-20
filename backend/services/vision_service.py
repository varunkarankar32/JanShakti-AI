"""
Vision Service — YOLOv8-based issue detection in photos.
Detects civic infrastructure problems and falls back to lightweight heuristics
when a specialized model is unavailable.
"""

import os
from typing import Dict, Optional
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
    "traffic_light",
    "light",
    "wall",
    "tree",
    "damage",
    "infrastructure",
}

GENERIC_CLASS_TO_ISSUE = {
    "traffic_light": "broken_streetlight",
    "fire_hydrant": "broken_pipe",
    "potted_plant": "fallen_tree",
    "trash_can": "garbage_dump",
    "bench": "damaged_wall",
}

FILENAME_HINT_TO_ISSUE = {
    "street": "broken_streetlight",
    "light": "broken_streetlight",
    "lamp": "broken_streetlight",
    "garbage": "garbage_dump",
    "trash": "garbage_dump",
    "waste": "garbage_dump",
    "pipe": "broken_pipe",
    "leak": "broken_pipe",
    "water": "waterlogging",
    "drain": "waterlogging",
    "tree": "fallen_tree",
    "wall": "damaged_wall",
    "road": "road_damage",
    "pothole": "pothole",
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

    def detect(self, image_bytes: bytes, image_name: Optional[str] = None) -> Dict:
        """
        Run object detection on an image.
        Returns: {detections, category, severity, confidence}
        """
        if self.model:
            return self._yolo_detect(image_bytes, image_name=image_name)
        return self._simulated_detect(image_bytes, image_name=image_name)

    def _normalize_class_name(self, name: str) -> str:
        cleaned = re.sub(r"\s+", "_", str(name).strip().lower())
        return cleaned

    def _is_issue_class(self, cls_name: str) -> bool:
        name = self._normalize_class_name(cls_name)
        return any(token in name for token in ISSUE_KEYWORDS)

    def _yolo_detect(self, image_bytes: bytes, image_name: Optional[str] = None) -> Dict:
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
                mapped_generic = []
                for detection in detections:
                    mapped_cls = GENERIC_CLASS_TO_ISSUE.get(detection["class"])
                    if not mapped_cls:
                        continue
                    mapped = dict(detection)
                    mapped["class"] = mapped_cls
                    mapped_generic.append(mapped)

                if mapped_generic:
                    best = max(mapped_generic, key=lambda d: d["confidence"])
                    return {
                        "detections": detections,
                        "category": best["class"].replace("_", " ").title(),
                        "severity": self._get_severity(best["confidence"]),
                        "confidence": best["confidence"],
                    }

                heuristic = self._simulated_detect(image_bytes, image_name=image_name)
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
            return self._simulated_detect(image_bytes, image_name=image_name)

    def _simulated_detect(self, image_bytes: bytes, image_name: Optional[str] = None) -> Dict:
        """Simulated detection for demo purposes."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            width, height = image.size

            filename_hint_class = None
            if image_name:
                lowered_name = str(image_name).lower()
                for token, cls_name in FILENAME_HINT_TO_ISSUE.items():
                    if token in lowered_name:
                        filename_hint_class = cls_name
                        break

            # Basic image analysis
            import numpy as np
            img_array = np.array(image.convert("RGB"))
            mean_brightness = img_array.mean()
            dark_pixels = (img_array < 80).sum() / img_array.size

            # Heuristic detection
            detections = []
            if filename_hint_class:
                detections.append({
                    "class": filename_hint_class,
                    "confidence": 0.74,
                    "bbox": {"x1": width * 0.2, "y1": height * 0.2, "x2": width * 0.8, "y2": height * 0.8},
                })

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
