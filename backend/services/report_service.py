"""
Report Generator Service — AI-generated weekly reports for ward officers.
Compiles complaint data, resolution rates, citizen feedback into structured reports.
"""

from datetime import datetime, timedelta
from statistics import median
from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from models.complaint import Complaint, ComplaintStatus, PriorityLevel


class ReportService:
    def _resolve_period_window(
        self,
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> Tuple[datetime, datetime]:
        now = datetime.now()

        if date_to:
            end_date = datetime.fromisoformat(date_to)
            # If user sends a date-only value, include the full day.
            if len(date_to.strip()) <= 10:
                end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            end_date = now

        if date_from:
            start_date = datetime.fromisoformat(date_from)
        else:
            start_date = end_date - timedelta(days=7)

        if start_date > end_date:
            raise ValueError("date_from must be before or equal to date_to")

        return start_date, end_date

    def generate_ward_report(
        self,
        db: Session,
        ward: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict:
        """Generate a concise period report for a ward (from date to date)."""

        start_date, end_date = self._resolve_period_window(date_from, date_to)
        period = f"{start_date.strftime('%d %b %Y')} to {end_date.strftime('%d %b %Y')}"

        raised = (
            db.query(Complaint)
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at >= start_date)
            .filter(Complaint.created_at <= end_date)
            .all()
        )

        solved = (
            db.query(Complaint)
            .filter(Complaint.ward == ward)
            .filter(Complaint.resolved_at.isnot(None))
            .filter(Complaint.resolved_at >= start_date)
            .filter(Complaint.resolved_at <= end_date)
            .all()
        )

        backlog_start = (
            db.query(Complaint)
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at < start_date)
            .filter(
                or_(
                    Complaint.resolved_at.is_(None),
                    Complaint.resolved_at >= start_date,
                )
            )
            .count()
        )

        backlog_end = (
            db.query(Complaint)
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at <= end_date)
            .filter(
                or_(
                    Complaint.resolved_at.is_(None),
                    Complaint.resolved_at > end_date,
                )
            )
            .count()
        )

        raised_count = len(raised)
        solved_count = len(solved)
        resolution_rate = round((solved_count / raised_count * 100.0) if raised_count else 0.0, 1)

        avg_rating = round(
            (sum(c.rating for c in solved if c.rating is not None) / len([c for c in solved if c.rating is not None]))
            if any(c.rating is not None for c in solved)
            else 0.0,
            2,
        )

        resolution_hours = [
            (c.resolved_at - c.created_at).total_seconds() / 3600.0
            for c in solved
            if c.resolved_at and c.created_at
        ]
        avg_resolution_hours = round((sum(resolution_hours) / len(resolution_hours)) if resolution_hours else 0.0, 1)
        median_resolution_hours = round(float(median(resolution_hours)), 1) if resolution_hours else 0.0

        p0_raised = len([c for c in raised if c.priority == PriorityLevel.P0])
        p1_raised = len([c for c in raised if c.priority == PriorityLevel.P1])
        in_progress = len([c for c in raised if c.status == ComplaintStatus.IN_PROGRESS])
        open_count = len([c for c in raised if c.status == ComplaintStatus.OPEN])

        stale_over_72h = (
            db.query(Complaint)
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at <= end_date - timedelta(hours=72))
            .filter(Complaint.status != ComplaintStatus.RESOLVED)
            .filter(
                and_(
                    or_(Complaint.authority_response.is_(None), Complaint.authority_response == ""),
                    or_(Complaint.leader_note.is_(None), Complaint.leader_note == ""),
                )
            )
            .count()
        )

        category_rows = (
            db.query(Complaint.category, func.count(Complaint.id))
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at >= start_date)
            .filter(Complaint.created_at <= end_date)
            .group_by(Complaint.category)
            .order_by(func.count(Complaint.id).desc())
            .all()
        )
        top_categories = [{"category": row[0], "count": int(row[1])} for row in category_rows[:3]]

        mode_rows = (
            db.query(Complaint.input_mode, func.count(Complaint.id))
            .filter(Complaint.ward == ward)
            .filter(Complaint.created_at >= start_date)
            .filter(Complaint.created_at <= end_date)
            .group_by(Complaint.input_mode)
            .all()
        )
        input_mix = {str(row[0].value if hasattr(row[0], "value") else row[0]): int(row[1]) for row in mode_rows}

        stats = {
            "date_from": start_date.date().isoformat(),
            "date_to": end_date.date().isoformat(),
            "issues_raised": raised_count,
            "issues_solved": solved_count,
            "in_progress": in_progress,
            "open": open_count,
            "resolution_rate": resolution_rate,
            "citizen_satisfaction": avg_rating,
            "avg_resolution_hours": avg_resolution_hours,
            "median_resolution_hours": median_resolution_hours,
            "p0_raised": p0_raised,
            "p1_raised": p1_raised,
            "backlog_at_start": backlog_start,
            "backlog_at_end": backlog_end,
            "net_backlog_change": backlog_end - backlog_start,
            "stale_over_72h": stale_over_72h,
            "top_categories": top_categories,
            "input_mix": input_mix,
        }

        report_text = self._format_report(ward, period, stats)

        return {
            "report_text": report_text,
            "ward": ward,
            "period": period,
            "stats": stats,
        }

    def _format_report(self, ward: str, period: str, stats: Dict) -> str:
        """Format a concise leadership summary."""
        backlog_direction = "increased" if stats["net_backlog_change"] > 0 else "reduced" if stats["net_backlog_change"] < 0 else "unchanged"
        top_category_text = ", ".join(
            f"{item['category']} ({item['count']})" for item in stats.get("top_categories", [])
        ) or "No major concentration"

        lines = [
            "=" * 56,
            f"WARD PERFORMANCE BRIEF - {ward}",
            f"Period: {period}",
            "=" * 56,
            f"Raised: {stats['issues_raised']} | Solved: {stats['issues_solved']} | Resolution: {stats['resolution_rate']}%",
            f"Open in period: {stats['open']} | In progress: {stats['in_progress']}",
            f"Citizen satisfaction: {stats['citizen_satisfaction']}/5.0",
            f"Avg resolution: {stats['avg_resolution_hours']}h | Median: {stats['median_resolution_hours']}h",
            f"P0 raised: {stats['p0_raised']} | P1 raised: {stats['p1_raised']}",
            f"Backlog start: {stats['backlog_at_start']} -> end: {stats['backlog_at_end']} ({backlog_direction})",
            f"Stale >72h unresolved: {stats['stale_over_72h']}",
            f"Top categories: {top_category_text}",
            f"Input mix: {stats.get('input_mix', {})}",
            "=" * 56,
        ]

        return "\n".join(lines)

    def generate_fallback_report(self, ward: str) -> Dict:
        """Generate a demo report when no DB data is available."""
        stats = {
            "date_from": (datetime.now() - timedelta(days=7)).date().isoformat(),
            "date_to": datetime.now().date().isoformat(),
            "issues_raised": 46,
            "issues_solved": 23,
            "in_progress": 8,
            "open": 15,
            "p0_raised": 2,
            "p1_raised": 5,
            "resolution_rate": 50.0,
            "citizen_satisfaction": 4.2,
            "avg_resolution_hours": 55.2,
            "median_resolution_hours": 42.0,
            "backlog_at_start": 31,
            "backlog_at_end": 24,
            "net_backlog_change": -7,
            "stale_over_72h": 3,
            "top_categories": [
                {"category": "Water Supply", "count": 14},
                {"category": "Roads & Potholes", "count": 10},
                {"category": "Drainage", "count": 7},
            ],
            "input_mix": {"text": 18, "voice": 15, "photo": 13},
        }

        period = f"{(datetime.now() - timedelta(days=7)).strftime('%b %d')} — {datetime.now().strftime('%b %d, %Y')}"
        report_text = self._format_report(ward, period, stats)

        return {
            "report_text": report_text,
            "ward": ward,
            "period": period,
            "stats": stats,
        }


# Singleton
report_service = ReportService()
