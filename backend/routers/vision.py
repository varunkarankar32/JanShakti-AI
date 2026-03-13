"""
Vision Router — Image detection endpoint.
"""

from fastapi import APIRouter, UploadFile, File
from services.vision_service import vision_service

router = APIRouter(prefix="/vision", tags=["Vision"])


@router.post("/detect")
async def detect_issues(image: UploadFile = File(...)):
    """
    Detect infrastructure issues in uploaded photo using YOLOv8.
    Returns: detected objects, category, severity, confidence.
    """
    image_bytes = await image.read()
    result = vision_service.detect(image_bytes)
    return result
