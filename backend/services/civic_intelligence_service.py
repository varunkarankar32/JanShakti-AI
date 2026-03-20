"""
Civic Intelligence Service
Builds proactive alerts, rumor fact-check cards, ward drives, and starvation watch metrics.
"""

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional


RUMOR_KB = [
    {
        "id": "water_supply_shutdown",
        "patterns": ["water supply closed", "water line permanently cut", "no water forever"],
        "fact": "No city-wide permanent water shutdown has been announced.",
        "source": "Municipal Water Board Bulletin",
    },
    {
        "id": "vaccine_drive_cancelled",
        "patterns": ["vaccine drive cancelled", "immunization stopped", "polio drive cancelled"],
        "fact": "Ward immunization campaigns continue as scheduled by health authorities.",
        "source": "District Health Department",
    },
    {
        "id": "flood_gate_open",
        "patterns": ["dam gate opened", "flood release confirmed", "river gate opened"],
        "fact": "No uncontrolled emergency floodgate release is confirmed in official notices.",
        "source": "District Disaster Management Cell",
    },
    {
        "id": "ration_scheme_stopped",
        "patterns": ["ration scheme stopped", "free ration ended", "food scheme cancelled"],
        "fact": "Public ration schemes remain active as per current state notification.",
        "source": "Food and Civil Supplies Department",
    },
]

DISASTER_RULES = [
    {
        "name": "Flood Risk",
        "keywords": ["flood", "waterlogging", "overflow", "drain blocked", "monsoon"],
        "precautions": [
            "Avoid low-lying lanes during heavy rain windows.",
            "Keep drinking water stored for 24 hours.",
            "Use ward helpline for emergency pump requests.",
        ],
    },
    {
        "name": "Heatwave Alert",
        "keywords": ["heatwave", "heat stroke", "extreme heat", "sun stroke"],
        "precautions": [
            "Avoid outdoor exposure between 12 PM and 4 PM.",
            "Ensure hydration points in high-footfall streets.",
            "Deploy mobile health check camps for elderly residents.",
        ],
    },
    {
        "name": "Air Quality Spike",
        "keywords": ["smoke", "air quality", "breathing issue", "pollution"],
        "precautions": [
            "Mask advisory for children and senior citizens.",
            "Restrict waste burning and construction dust hotspots.",
            "Increase roadside water sprinkling frequency.",
        ],
    },
]

EPIDEMIC_RULES = [
    {
        "name": "Vector-Borne Disease Watch",
        "keywords": ["dengue", "malaria", "fever cluster", "mosquito", "stagnant water"],
        "precautions": [
            "Launch anti-larval spraying in vulnerable pockets.",
            "Remove stagnant water from public drains and lots.",
            "Publish ward testing camp schedule within 24 hours.",
        ],
    },
    {
        "name": "Water-Borne Infection Watch",
        "keywords": ["diarrhea", "cholera", "contaminated water", "vomiting", "gastro"],
        "precautions": [
            "Issue boil-water advisory for affected wards.",
            "Deploy chlorination and pipeline spot checks.",
            "Open temporary ORS and hydration support counters.",
        ],
    },
]

DRIVE_BY_CATEGORY = {
    "Garbage & Sanitation": {
        "title": "Ward Cleanliness Mega Drive",
        "playbook": "Door-to-door sanitation sweep with hotspot bin redistribution.",
    },
    "Drainage": {
        "title": "Drain De-Silting Rapid Drive",
        "playbook": "48-hour desilting blitz with monsoon choke-point clearance.",
    },
    "Water Supply": {
        "title": "Pipeline Integrity Drive",
        "playbook": "Leak audit, pressure balancing, and contamination checks ward-wise.",
    },
    "Public Health": {
        "title": "Community Health Safeguard Drive",
        "playbook": "Mobile clinic + preventive awareness camps in dense clusters.",
    },
    "Roads & Potholes": {
        "title": "Critical Mobility Restoration Drive",
        "playbook": "School/hospital route-first pothole repair campaign.",
    },
}


class CivicIntelligenceService:
    def _value(self, item: Any, key: str, default: Any = None) -> Any:
        if isinstance(item, dict):
            return item.get(key, default)
        return getattr(item, key, default)

    def _text(self, complaint: Any) -> str:
        title = str(self._value(complaint, "title", "") or "")
        description = str(self._value(complaint, "description", "") or "")
        return f"{title} {description}".strip().lower()

    def _age_hours(self, complaint: Any, now: Optional[datetime] = None) -> float:
        created_at = self._value(complaint, "created_at")
        if not created_at:
            return 0.0
        ref = now or datetime.now()
        return max(0.0, (ref - created_at).total_seconds() / 3600.0)

    def starvation_watch(self, complaints: List[Any]) -> Dict[str, Any]:
        active = []
        stale_24 = 0
        stale_72 = 0

        for complaint in complaints:
            status = str(self._value(complaint, "status", "") or "")
            if status == "resolved":
                continue

            age_hours = self._age_hours(complaint)
            authority_response = str(self._value(complaint, "authority_response", "") or "").strip()
            leader_note = str(self._value(complaint, "leader_note", "") or "").strip()
            is_unresponded = status in {"open", "assigned"} and not authority_response and not leader_note

            if is_unresponded and age_hours >= 24:
                stale_24 += 1
            if is_unresponded and age_hours >= 72:
                stale_72 += 1

            if is_unresponded and age_hours >= 12:
                active.append(
                    {
                        "ticket_id": self._value(complaint, "ticket_id"),
                        "ward": self._value(complaint, "ward"),
                        "category": self._value(complaint, "category"),
                        "age_hours": round(age_hours, 1),
                        "severity": "critical" if age_hours >= 72 else "high" if age_hours >= 24 else "medium",
                    }
                )

        active.sort(key=lambda x: x["age_hours"], reverse=True)
        return {
            "unresponded_24h": stale_24,
            "unresponded_72h": stale_72,
            "stale_queue": active[:10],
        }

    def proactive_announcements(self, complaints: List[Any]) -> List[Dict[str, Any]]:
        ward_rule_counts: Dict[tuple, int] = defaultdict(int)

        for complaint in complaints:
            status = str(self._value(complaint, "status", "") or "")
            if status == "resolved":
                continue
            ward = self._value(complaint, "ward", "Unknown Ward")
            text = self._text(complaint)

            for rule in DISASTER_RULES + EPIDEMIC_RULES:
                if any(token in text for token in rule["keywords"]):
                    ward_rule_counts[(ward, rule["name"])] += 1

        catalog = {rule["name"]: rule for rule in (DISASTER_RULES + EPIDEMIC_RULES)}
        cards = []
        for (ward, rule_name), count in ward_rule_counts.items():
            rule = catalog[rule_name]
            risk = "critical" if count >= 5 else "high" if count >= 3 else "medium"
            cards.append(
                {
                    "ward": ward,
                    "alert_type": rule_name,
                    "risk": risk,
                    "signal_count": count,
                    "announcement": f"{rule_name} advisory for {ward}: activate precaution protocol.",
                    "precautions": rule["precautions"],
                }
            )

        cards.sort(key=lambda x: (x["signal_count"], x["ward"]), reverse=True)
        return cards[:12]

    def ward_drives(self, complaints: List[Any]) -> List[Dict[str, Any]]:
        unresolved = [
            c
            for c in complaints
            if str(self._value(c, "status", "") or "") != "resolved"
        ]

        ward_category_counts: Dict[str, Counter] = defaultdict(Counter)
        for complaint in unresolved:
            ward = self._value(complaint, "ward", "Unknown Ward")
            category = self._value(complaint, "category", "Others")
            ward_category_counts[ward][category] += 1

        drives = []
        for ward, counts in ward_category_counts.items():
            top_category, load = counts.most_common(1)[0]
            drive = DRIVE_BY_CATEGORY.get(
                top_category,
                {
                    "title": "Ward Response Acceleration Drive",
                    "playbook": "Consolidated task force deployment for dominant complaint category.",
                },
            )
            drives.append(
                {
                    "ward": ward,
                    "focus_category": top_category,
                    "complaint_load": load,
                    "drive_title": drive["title"],
                    "playbook": drive["playbook"],
                }
            )

        drives.sort(key=lambda x: x["complaint_load"], reverse=True)
        return drives[:12]

    def misinfo_alerts(self, complaints: List[Any]) -> List[Dict[str, Any]]:
        alerts = []
        seen = set()

        for complaint in complaints:
            text = self._text(complaint)
            ward = self._value(complaint, "ward", "Unknown Ward")
            ticket_id = self._value(complaint, "ticket_id")
            for rumor in RUMOR_KB:
                if any(pattern in text for pattern in rumor["patterns"]):
                    key = (rumor["id"], ward)
                    if key in seen:
                        continue
                    seen.add(key)
                    severity = "high" if "viral" in text or "forward" in text else "medium"
                    alerts.append(
                        {
                            "rumor_id": rumor["id"],
                            "ward": ward,
                            "ticket_id": ticket_id,
                            "severity": severity,
                            "claim_preview": "Potential rumor signal detected in citizen narrative.",
                            "fact": rumor["fact"],
                            "source": rumor["source"],
                        }
                    )

        return alerts[:12]

    def fact_checks(self, complaints: List[Any]) -> List[Dict[str, Any]]:
        checks = []
        seen = set()

        for complaint in complaints:
            text = self._text(complaint)
            ward = self._value(complaint, "ward", "Unknown Ward")
            for rumor in RUMOR_KB:
                if rumor["id"] in seen:
                    continue
                if any(pattern in text for pattern in rumor["patterns"]):
                    seen.add(rumor["id"])
                    checks.append(
                        {
                            "claim": rumor["patterns"][0],
                            "verdict": "Likely False / Unverified",
                            "fact": rumor["fact"],
                            "source": rumor["source"],
                            "affected_ward": ward,
                            "confidence": 0.8,
                        }
                    )

        return checks[:8]

    def fact_check_text(self, text: str) -> Dict[str, Any]:
        normalized = (text or "").strip().lower()
        if not normalized:
            return {
                "verdict": "No Input",
                "fact": "Provide a rumor or claim to verify.",
                "source": "JanShakti Fact Layer",
                "confidence": 0.0,
            }

        for rumor in RUMOR_KB:
            if any(pattern in normalized for pattern in rumor["patterns"]):
                return {
                    "verdict": "Likely False / Unverified",
                    "fact": rumor["fact"],
                    "source": rumor["source"],
                    "confidence": 0.84,
                }

        return {
            "verdict": "No Known Rumor Match",
            "fact": "No known high-risk rumor pattern matched. Verify with official ward bulletin before sharing.",
            "source": "JanShakti Fact Layer",
            "confidence": 0.58,
        }


civic_intelligence_service = CivicIntelligenceService()
