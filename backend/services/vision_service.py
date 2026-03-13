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


class VisionService:
    def __init__(self, model_path: str = "ml/weights/yolov8_damage.pt"):
        self.model = None
        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        if YOLO_AVAILABLE and os.path.exists(self.model_path):
            try:
                self.model = YOLO(self.model_path)
                print(f"[Vision] Loaded YOLOv8 model from {self.model_path}")
            except Exception as e:
                print(f"[Vision] Error loading model: {e}")
        else:
            print("[Vision] No YOLO model found — using simulated detection")

    def detect(self, image_bytes: bytes) -> Dict:
        """
        Run object detection on an image.
        Returns: {detections, category, severity, confidence}
        """
        if self.model:
            return self._yolo_detect(image_bytes)
        return self._simulated_detect(image_bytes)

    def _yolo_detect(self, image_bytes: bytes) -> Dict:
        """Run actual YOLOv8 inference."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            results = self.model(image, conf=0.25)

            detections = []
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()

                    detection = {
                        "class": DAMAGE_CLASSES.get(cls_id, f"class_{cls_id}"),
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
                return {
                    "detections": [],
                    "category": "Unknown",
                    "severity": "low",
                    "confidence": 0.0,
                }

            # Use highest-confidence detection
            best = max(detections, key=lambda d: d["confidence"])
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
                "category": "Unknown",
                "severity": "low",
                "confidence": 0.0,
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
