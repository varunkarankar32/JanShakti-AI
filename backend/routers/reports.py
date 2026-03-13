"""
Reports Router — AI-generated report endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.schemas import ReportRequest, ReportResponse
from services.report_service import report_service
from database import get_db

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/generate", response_model=ReportResponse)
def generate_report(request: ReportRequest, db: Session = Depends(get_db)):
    """
    Generate an AI-compiled weekly report for a ward.
    Aggregates complaint data, resolution rates, and citizen feedback.
    """
    try:
        result = report_service.generate_ward_report(
            db=db,
            ward=request.ward,
            date_from=request.date_from,
            date_to=request.date_to,
        )
    except Exception:
        # Fallback demo report
        result = report_service.generate_fallback_report(request.ward)

    return ReportResponse(**result)
