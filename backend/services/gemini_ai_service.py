"""
Gemini AI Service — Async, investor-grade AI intelligence layer.
Uses Gemini 2.5 Flash for: image understanding, risk assessment, and smart complaint enhancement.
"""

from __future__ import annotations

import base64
import json
import re
import asyncio
from typing import Any, Dict, List, Optional

import httpx

from config import (
    GEMINI_API_KEY,
    GEMINI_API_URL,
    GEMINI_MODEL,
    GEMINI_TIMEOUT,
    GEMINI_VISION_ENABLED,
)


def _guess_mime(name: Optional[str]) -> str:
    n = str(name or "").lower()
    if n.endswith(".png"):
        return "image/png"
    if n.endswith(".webp"):
        return "image/webp"
    if n.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    raw = text.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        # Try fixing trailing commas
        candidate = re.sub(r",\s*([}\]])", r"\1", match.group(0))
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}


def _clamp(val: Any, lo: float, hi: float, default: float) -> float:
    try:
        return max(lo, min(hi, float(val)))
    except Exception:
        return default


class GeminiAIService:
    """Async Gemini 2.5 Flash service for investor-grade AI features."""

    MODEL_NAME = "Gemini 2.5 Flash"

    def __init__(self):
        self.api_key = str(GEMINI_API_KEY or "").strip()
        self.api_url = str(GEMINI_API_URL or "").strip().rstrip("/")
        self.model = str(GEMINI_MODEL or "gemini-2.5-flash").strip()
        self.timeout = max(10, int(GEMINI_TIMEOUT or 30))
        self.enabled = GEMINI_VISION_ENABLED and bool(self.api_key)

    async def _call_gemini(
        self,
        parts: list,
        temperature: float = 0,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        """Low-level async Gemini API call."""
        if not self.enabled or not self.api_key:
            return {"ok": False, "reason": "gemini_not_configured"}

        endpoint = f"{self.api_url}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(endpoint, json=payload)

        if resp.status_code >= 400:
            return {"ok": False, "reason": f"gemini_http_{resp.status_code}"}

        data = resp.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return {"ok": False, "reason": "gemini_no_candidates"}

        content_parts = (candidates[0].get("content") or {}).get("parts") or []
        text_chunks = [
            str(p.get("text", ""))
            for p in content_parts
            if isinstance(p, dict) and p.get("text")
        ]
        raw_text = "\n".join(text_chunks).strip()
        parsed = _extract_json(raw_text)

        return {"ok": True, "raw": raw_text, "parsed": parsed}

    # ──────────────────────────────────────────────
    # 1. IMAGE → COMPLAINT AUTO-FILL
    # ──────────────────────────────────────────────

    async def analyze_image(
        self, image_bytes: bytes, image_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a civic issue image with Gemini 2.5 Flash.
        Returns: description, category, severity, risk_score, risk_level, risk_factors.
        """
        mime = _guess_mime(image_name)
        b64 = base64.b64encode(image_bytes).decode("ascii")

        prompt = (
            "You are an expert AI system for Indian municipal governance. "
            "Analyze this image of a civic/infrastructure issue and return strict JSON:\n"
            "{\n"
            '  "description": "A detailed 2-3 sentence complaint statement describing the issue as a citizen would report it. Be specific about what you see.",\n'
            '  "category": one of ["Roads & Potholes", "Garbage & Sanitation", "Water Supply", "Drainage", "Electricity", "Safety & Security", "Others"],\n'
            '  "severity": one of ["critical", "high", "medium", "low"],\n'
            '  "risk_score": number 0-100 indicating public risk (100=most dangerous),\n'
            '  "risk_level": one of ["Critical", "High", "Medium", "Low"],\n'
            '  "risk_factors": ["factor1", "factor2", "factor3"] — list of specific risks identified,\n'
            '  "risk_reasoning": "One line explaining why this risk score was assigned",\n'
            '  "visible_issues": ["issue1", "issue2"] — what you see in the image,\n'
            '  "recommended_action": "What should the municipality do",\n'
            '  "estimated_affected_people": "approximate number or range"\n'
            "}\n"
            "Rules: No markdown. No disclaimers. JSON only. Be specific and detailed about what you SEE in the image."
        )

        parts = [
            {"text": prompt},
            {"inline_data": {"mime_type": mime, "data": b64}},
        ]

        try:
            result = await self._call_gemini(parts, temperature=0, max_tokens=1024)
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc)[:200],
                "ai_model": self.MODEL_NAME,
            }

        if not result.get("ok"):
            return {
                "success": False,
                "error": result.get("reason", "gemini_error"),
                "ai_model": self.MODEL_NAME,
            }

        parsed = result.get("parsed", {})
        if not parsed:
            return {
                "success": False,
                "error": "Could not parse Gemini response",
                "ai_model": self.MODEL_NAME,
            }

        VALID_CATS = {
            "Roads & Potholes", "Garbage & Sanitation", "Water Supply",
            "Drainage", "Electricity", "Safety & Security", "Others",
        }
        category = str(parsed.get("category", "Others")).strip()
        if category not in VALID_CATS:
            category = "Others"

        severity = str(parsed.get("severity", "medium")).strip().lower()
        if severity not in {"critical", "high", "medium", "low"}:
            severity = "medium"

        risk_level = str(parsed.get("risk_level", "Medium")).strip()
        if risk_level not in {"Critical", "High", "Medium", "Low"}:
            risk_level = "Medium"

        return {
            "success": True,
            "description": str(parsed.get("description", "")).strip()[:500],
            "category": category,
            "severity": severity,
            "risk_score": round(_clamp(parsed.get("risk_score"), 0, 100, 50), 1),
            "risk_level": risk_level,
            "risk_factors": (parsed.get("risk_factors") or [])[:6],
            "risk_reasoning": str(parsed.get("risk_reasoning", "")).strip()[:300],
            "visible_issues": (parsed.get("visible_issues") or [])[:5],
            "recommended_action": str(parsed.get("recommended_action", "")).strip()[:200],
            "estimated_affected_people": str(parsed.get("estimated_affected_people", "")).strip(),
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 2. RISK ASSESSMENT FROM TEXT
    # ──────────────────────────────────────────────

    async def assess_risk(
        self,
        description: str,
        category: str,
        ward: str,
        title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate an investor-grade AI risk assessment for a complaint.
        """
        prompt = (
            "You are a risk assessment AI for Indian municipal governance. "
            "Analyze this civic complaint and return strict JSON:\n"
            "{\n"
            '  "risk_score": number 0-100 (100=most critical public risk),\n'
            '  "risk_level": one of ["Critical", "High", "Medium", "Low"],\n'
            '  "risk_factors": [\n'
            '    {"factor": "name", "severity": "high|medium|low", "description": "brief explanation"}\n'
            "  ],\n"
            '  "public_safety_impact": "brief assessment of danger to public",\n'
            '  "environmental_impact": "brief assessment of environmental harm",\n'
            '  "urgency_hours": number — recommended max response time in hours,\n'
            '  "affected_population": "estimate of affected people",\n'
            '  "escalation_risk": "what happens if not addressed in 48 hours",\n'
            '  "ai_confidence": number 0-1,\n'
            '  "reasoning": "One paragraph explaining the risk assessment"\n'
            "}\n"
            "Rules: No markdown. JSON only. Be specific and data-driven.\n\n"
            f"Category: {category}\n"
            f"Ward: {ward}\n"
            f"Title: {title or 'N/A'}\n"
            f"Complaint: {description[:800]}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0, max_tokens=1024)
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc)[:200],
                "ai_model": self.MODEL_NAME,
            }

        if not result.get("ok"):
            return {
                "success": False,
                "error": result.get("reason", "gemini_error"),
                "ai_model": self.MODEL_NAME,
            }

        parsed = result.get("parsed", {})
        if not parsed:
            return {
                "success": False,
                "error": "Could not parse Gemini response",
                "ai_model": self.MODEL_NAME,
            }

        risk_level = str(parsed.get("risk_level", "Medium")).strip()
        if risk_level not in {"Critical", "High", "Medium", "Low"}:
            risk_level = "Medium"

        raw_factors = parsed.get("risk_factors") or []
        factors: List[Dict[str, str]] = []
        for f in raw_factors[:6]:
            if isinstance(f, dict):
                factors.append({
                    "factor": str(f.get("factor", "")).strip()[:100],
                    "severity": str(f.get("severity", "medium")).strip().lower(),
                    "description": str(f.get("description", "")).strip()[:200],
                })
            elif isinstance(f, str):
                factors.append({"factor": f[:100], "severity": "medium", "description": ""})

        return {
            "success": True,
            "risk_score": round(_clamp(parsed.get("risk_score"), 0, 100, 50), 1),
            "risk_level": risk_level,
            "risk_factors": factors,
            "public_safety_impact": str(parsed.get("public_safety_impact", "")).strip()[:300],
            "environmental_impact": str(parsed.get("environmental_impact", "")).strip()[:300],
            "urgency_hours": round(_clamp(parsed.get("urgency_hours"), 0.5, 336, 24), 1),
            "affected_population": str(parsed.get("affected_population", "")).strip()[:100],
            "escalation_risk": str(parsed.get("escalation_risk", "")).strip()[:300],
            "ai_confidence": round(_clamp(parsed.get("ai_confidence"), 0, 1, 0.7), 3),
            "reasoning": str(parsed.get("reasoning", "")).strip()[:500],
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 3. SMART TEXT ENHANCEMENT
    # ──────────────────────────────────────────────

    async def smart_fill(self, raw_text: str) -> Dict[str, Any]:
        """
        Enhance raw citizen complaint text with AI.
        Returns improved description + auto-detected category & severity.
        """
        prompt = (
            "You are a civic complaint processor for Indian municipal governance. "
            "Take the citizen's raw complaint and return strict JSON:\n"
            "{\n"
            '  "enhanced_description": "A clear, well-written 2-3 sentence complaint statement",\n'
            '  "category": one of ["Roads & Potholes", "Garbage & Sanitation", "Water Supply", "Drainage", "Electricity", "Safety & Security", "Others"],\n'
            '  "severity": one of ["critical", "high", "medium", "low"],\n'
            '  "key_issues": ["issue1", "issue2"] — main problems identified\n'
            "}\n"
            "Rules: No markdown. JSON only. Keep the citizen's intent. Use formal but accessible language.\n\n"
            f"Citizen's raw text: {raw_text[:600]}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0, max_tokens=512)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:200], "ai_model": self.MODEL_NAME}

        if not result.get("ok"):
            return {"success": False, "error": result.get("reason", "gemini_error"), "ai_model": self.MODEL_NAME}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"success": False, "error": "parse_failed", "ai_model": self.MODEL_NAME}

        VALID_CATS = {
            "Roads & Potholes", "Garbage & Sanitation", "Water Supply",
            "Drainage", "Electricity", "Safety & Security", "Others",
        }
        category = str(parsed.get("category", "Others")).strip()
        if category not in VALID_CATS:
            category = "Others"

        return {
            "success": True,
            "enhanced_description": str(parsed.get("enhanced_description", raw_text)).strip()[:500],
            "category": category,
            "severity": str(parsed.get("severity", "medium")).strip().lower(),
            "key_issues": (parsed.get("key_issues") or [])[:5],
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 4. AI PUBLIC COMMUNICATION GENERATOR
    # ──────────────────────────────────────────────

    async def generate_public_communication(
        self,
        comm_type: str,
        ward: str,
        category: str,
        summary_stats: Dict[str, Any],
        context_text: str = "",
    ) -> Dict[str, Any]:
        """
        Generate official public communications using Gemini 2.5 Flash.
        comm_type: 'press_release' | 'social_post' | 'citizen_advisory' | 'awareness_campaign'
        """
        type_instructions = {
            "press_release": (
                "Generate a formal press release for a municipal corporation. "
                "Include: headline, date line, body paragraphs (situation, action taken, future plan), "
                "spokesperson quote, and contact information. Tone: authoritative, transparent, reassuring."
            ),
            "social_post": (
                "Generate 3 social media posts (Twitter/X style, max 280 chars each) for public awareness. "
                "Include relevant emojis, hashtags (#JanShakti #SmartGovernance), and a call-to-action. "
                "Tone: informative, engaging, empathetic."
            ),
            "citizen_advisory": (
                "Generate a citizen advisory notice about an emerging civic issue. "
                "Include: alert level, affected area, issue description, precautionary measures (numbered list), "
                "helpline info, and expected resolution timeline. Tone: urgent but calm."
            ),
            "awareness_campaign": (
                "Generate an awareness campaign brief about a recurring civic problem. "
                "Include: campaign title, key message, target audience, 3 action points for citizens, "
                "and a tagline. Tone: educational, motivating, community-focused."
            ),
        }

        instruction = type_instructions.get(comm_type, type_instructions["press_release"])

        stats_text = ", ".join(f"{k}: {v}" for k, v in summary_stats.items()) if summary_stats else "No stats"

        prompt = (
            "You are an AI communications officer for an Indian municipal corporation. "
            f"{instruction}\n\n"
            "Return strict JSON:\n"
            "{\n"
            '  "title": "headline or campaign title",\n'
            '  "content": "the full generated communication text",\n'
            '  "key_points": ["point1", "point2", "point3"],\n'
            '  "tone": "detected tone of the communication",\n'
            '  "target_audience": "who this is for",\n'
            '  "hashtags": ["#tag1", "#tag2"]\n'
            "}\n"
            "Rules: No markdown inside JSON values. Be specific to the ward and issue data.\n\n"
            f"Ward: {ward}\n"
            f"Category: {category}\n"
            f"Stats: {stats_text}\n"
            f"Context: {context_text[:400]}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0.3, max_tokens=1500)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:200], "ai_model": self.MODEL_NAME}

        if not result.get("ok"):
            return {"success": False, "error": result.get("reason", "gemini_error"), "ai_model": self.MODEL_NAME}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"success": False, "error": "parse_failed", "ai_model": self.MODEL_NAME}

        return {
            "success": True,
            "comm_type": comm_type,
            "title": str(parsed.get("title", "")).strip()[:200],
            "content": str(parsed.get("content", "")).strip()[:3000],
            "key_points": (parsed.get("key_points") or [])[:5],
            "tone": str(parsed.get("tone", "")).strip()[:50],
            "target_audience": str(parsed.get("target_audience", "")).strip()[:100],
            "hashtags": (parsed.get("hashtags") or [])[:6],
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 5. SOCIAL SENTIMENT INTELLIGENCE
    # ──────────────────────────────────────────────

    async def analyze_social_sentiment(
        self,
        complaint_summaries: List[str],
        ward_stats: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Analyze complaint patterns to generate social-media-like sentiment intelligence.
        Uses complaint data as proxy for public sentiment.
        """
        complaints_text = "\n".join(f"- {s}" for s in complaint_summaries[:20])

        stats_text = ", ".join(f"{k}: {v}" for k, v in ward_stats.items()) if ward_stats else "No stats"

        prompt = (
            "You are a public sentiment analyst for Indian municipal governance. "
            "Analyze these citizen complaints and operational data to produce a social sentiment report.\n\n"
            "Return strict JSON:\n"
            "{\n"
            '  "overall_mood": one of ["Very Negative", "Negative", "Mixed", "Positive", "Very Positive"],\n'
            '  "mood_score": number 0-100 (100=very positive),\n'
            '  "trending_issues": [\n'
            '    {"issue": "name", "intensity": "high|medium|low", "direction": "rising|stable|falling"}\n'
            "  ],\n"
            '  "emerging_risks": [\n'
            '    {"risk": "description", "likelihood": "high|medium|low", "affected_area": "ward or area"}\n'
            "  ],\n"
            '  "sentiment_keywords": ["word1", "word2", "word3", "word4", "word5"],\n'
            '  "public_trust_trend": one of ["Improving", "Stable", "Declining"],\n'
            '  "recommended_action": "One actionable recommendation for leaders",\n'
            '  "citizen_pulse_summary": "A 2-sentence summary of what citizens are feeling"\n'
            "}\n"
            "Rules: No markdown. JSON only. Be data-driven. Extrapolate realistic sentiment from complaint patterns.\n\n"
            f"Ward Stats: {stats_text}\n"
            f"Recent Complaints:\n{complaints_text}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0.2, max_tokens=1024)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:200], "ai_model": self.MODEL_NAME}

        if not result.get("ok"):
            return {"success": False, "error": result.get("reason", "gemini_error"), "ai_model": self.MODEL_NAME}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"success": False, "error": "parse_failed", "ai_model": self.MODEL_NAME}

        mood = str(parsed.get("overall_mood", "Mixed")).strip()
        if mood not in {"Very Negative", "Negative", "Mixed", "Positive", "Very Positive"}:
            mood = "Mixed"

        trust_trend = str(parsed.get("public_trust_trend", "Stable")).strip()
        if trust_trend not in {"Improving", "Stable", "Declining"}:
            trust_trend = "Stable"

        raw_trending = parsed.get("trending_issues") or []
        trending = []
        for t in raw_trending[:6]:
            if isinstance(t, dict):
                trending.append({
                    "issue": str(t.get("issue", "")).strip()[:100],
                    "intensity": str(t.get("intensity", "medium")).strip().lower(),
                    "direction": str(t.get("direction", "stable")).strip().lower(),
                })

        raw_risks = parsed.get("emerging_risks") or []
        risks = []
        for r in raw_risks[:5]:
            if isinstance(r, dict):
                risks.append({
                    "risk": str(r.get("risk", "")).strip()[:200],
                    "likelihood": str(r.get("likelihood", "medium")).strip().lower(),
                    "affected_area": str(r.get("affected_area", "")).strip()[:50],
                })

        return {
            "success": True,
            "overall_mood": mood,
            "mood_score": round(_clamp(parsed.get("mood_score"), 0, 100, 50), 1),
            "trending_issues": trending,
            "emerging_risks": risks,
            "sentiment_keywords": [str(k).strip()[:30] for k in (parsed.get("sentiment_keywords") or [])[:8]],
            "public_trust_trend": trust_trend,
            "recommended_action": str(parsed.get("recommended_action", "")).strip()[:300],
            "citizen_pulse_summary": str(parsed.get("citizen_pulse_summary", "")).strip()[:400],
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 6. GOVERNANCE INTELLIGENCE — TWITTER/X ANALYSIS
    # ──────────────────────────────────────────────

    async def analyze_governance_intelligence(
        self,
        tweets: List[Dict[str, str]],
        region: str = "Municipal Region",
    ) -> Dict[str, Any]:
        """
        Full 10-objective governance intelligence analysis from social media posts.
        Issue detection, sentiment, urgency, misinformation, actionable insights, public responses.
        """
        tweets_text = "\n".join(
            f"- @{t.get('username','citizen')}: \"{t.get('text','')}\" "
            f"[{t.get('timestamp','recent')}] ({t.get('location','unknown')})"
            for t in tweets[:30]
        )

        prompt = (
            "You are an AI Governance Intelligence Analyst for an Indian municipal corporation. "
            "Analyze these social media posts (Twitter/X) and produce a COMPREHENSIVE governance intelligence report.\n\n"
            "Return strict JSON:\n"
            "{\n"
            '  "detected_issues": [\n'
            '    {\n'
            '      "issue_name": "Water Supply Disruption",\n'
            '      "category": "Water Supply",\n'
            '      "mention_count": 5,\n'
            '      "sentiment": "Negative",\n'
            '      "sentiment_score": 25,\n'
            '      "urgency": "High",\n'
            '      "priority_score": 82,\n'
            '      "is_viral": false,\n'
            '      "inferred_location": "Ward 7",\n'
            '      "misinformation_status": "Verified Concern",\n'
            '      "immediate_action": "Deploy tankers to affected areas",\n'
            '      "short_term_action": "Repair pipeline within 48h",\n'
            '      "long_term_solution": "Upgrade water distribution network",\n'
            '      "public_response": "We are aware of the water supply issue in Ward 7. Emergency tankers deployed. Pipeline repair underway. Expected restoration: 24h. #JanShakti"\n'
            '    }\n'
            '  ],\n'
            '  "overall_sentiment": "Negative",\n'
            '  "overall_sentiment_score": 35,\n'
            '  "trending_topics": ["water shortage", "road damage", "garbage"],\n'
            '  "viral_alerts": [\n'
            '    {"topic": "topic", "spike_level": "high", "tweet_count": 10, "risk": "description"}\n'
            '  ],\n'
            '  "misinformation_flags": [\n'
            '    {"claim": "the claim text", "status": "Likely Misinformation", "fact": "the actual fact", "source": "data source"}\n'
            '  ],\n'
            '  "top_3_urgent": [\n'
            '    {"issue": "name", "priority_score": 90, "why": "reason"}\n'
            '  ],\n'
            '  "recommended_next_steps": ["step1", "step2", "step3"],\n'
            '  "leader_summary": "A 3-sentence executive summary for the leader"\n'
            "}\n"
            "RULES: Base analysis ONLY on provided tweets. Do NOT hallucinate facts. Merge similar issues. "
            "Prioritize real-world impact over noise. Be concise but precise.\n\n"
            f"Region: {region}\n"
            f"Social Media Posts:\n{tweets_text}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0.2, max_tokens=3000)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:200], "ai_model": self.MODEL_NAME}

        if not result.get("ok"):
            return {"success": False, "error": result.get("reason", "gemini_error"), "ai_model": self.MODEL_NAME}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"success": False, "error": "parse_failed", "ai_model": self.MODEL_NAME}

        # Validate detected issues
        raw_issues = parsed.get("detected_issues") or []
        issues = []
        for issue in raw_issues[:10]:
            if not isinstance(issue, dict):
                continue
            urgency = str(issue.get("urgency", "Medium")).strip()
            if urgency not in {"Low", "Medium", "High", "Critical"}:
                urgency = "Medium"
            sentiment = str(issue.get("sentiment", "Neutral")).strip()
            if sentiment not in {"Positive", "Neutral", "Negative"}:
                sentiment = "Neutral"
            misinfo = str(issue.get("misinformation_status", "Verified Concern")).strip()
            if misinfo not in {"Verified Concern", "Needs Verification", "Likely Misinformation"}:
                misinfo = "Verified Concern"
            issues.append({
                "issue_name": str(issue.get("issue_name", "")).strip()[:120],
                "category": str(issue.get("category", "Others")).strip()[:50],
                "mention_count": int(issue.get("mention_count", 1) or 1),
                "sentiment": sentiment,
                "sentiment_score": round(_clamp(issue.get("sentiment_score"), 0, 100, 50), 1),
                "urgency": urgency,
                "priority_score": round(_clamp(issue.get("priority_score"), 0, 100, 50), 1),
                "is_viral": bool(issue.get("is_viral", False)),
                "inferred_location": str(issue.get("inferred_location", "")).strip()[:50],
                "misinformation_status": misinfo,
                "immediate_action": str(issue.get("immediate_action", "")).strip()[:200],
                "short_term_action": str(issue.get("short_term_action", "")).strip()[:200],
                "long_term_solution": str(issue.get("long_term_solution", "")).strip()[:200],
                "public_response": str(issue.get("public_response", "")).strip()[:300],
            })

        # Validate top 3 urgent
        raw_urgent = parsed.get("top_3_urgent") or []
        urgent = []
        for u in raw_urgent[:3]:
            if isinstance(u, dict):
                urgent.append({
                    "issue": str(u.get("issue", "")).strip()[:100],
                    "priority_score": round(_clamp(u.get("priority_score"), 0, 100, 50), 1),
                    "why": str(u.get("why", "")).strip()[:200],
                })

        # Validate misinformation flags
        raw_misinfo = parsed.get("misinformation_flags") or []
        misinfo_flags = []
        for m in raw_misinfo[:5]:
            if isinstance(m, dict):
                misinfo_flags.append({
                    "claim": str(m.get("claim", "")).strip()[:200],
                    "status": str(m.get("status", "Needs Verification")).strip()[:30],
                    "fact": str(m.get("fact", "")).strip()[:200],
                    "source": str(m.get("source", "")).strip()[:100],
                })

        # Validate viral alerts
        raw_viral = parsed.get("viral_alerts") or []
        viral = []
        for v in raw_viral[:5]:
            if isinstance(v, dict):
                viral.append({
                    "topic": str(v.get("topic", "")).strip()[:80],
                    "spike_level": str(v.get("spike_level", "medium")).strip().lower(),
                    "tweet_count": int(v.get("tweet_count", 0) or 0),
                    "risk": str(v.get("risk", "")).strip()[:200],
                })

        overall_sentiment = str(parsed.get("overall_sentiment", "Mixed")).strip()
        if overall_sentiment not in {"Positive", "Neutral", "Negative", "Mixed"}:
            overall_sentiment = "Mixed"

        return {
            "success": True,
            "detected_issues": issues,
            "overall_sentiment": overall_sentiment,
            "overall_sentiment_score": round(_clamp(parsed.get("overall_sentiment_score"), 0, 100, 50), 1),
            "trending_topics": [str(t).strip()[:40] for t in (parsed.get("trending_topics") or [])[:8]],
            "viral_alerts": viral,
            "misinformation_flags": misinfo_flags,
            "top_3_urgent": urgent,
            "recommended_next_steps": [str(s).strip()[:200] for s in (parsed.get("recommended_next_steps") or [])[:5]],
            "leader_summary": str(parsed.get("leader_summary", "")).strip()[:500],
            "ai_model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 7. AI PRIORITY SCORING (replaces heuristic)
    # ──────────────────────────────────────────────

    async def score_priority(
        self,
        text: str,
        category: str,
        ward: str,
    ) -> Dict[str, Any]:
        """
        Use Gemini 2.5 Flash to score complaint priority.
        Returns urgency, impact, sentiment scores — same schema as Qwen.
        """
        prompt = (
            "You are a civic complaint triage AI for Indian municipal governance. "
            "Analyze this complaint and return strict JSON:\n"
            "{\n"
            '  "urgency": number 0-100 (how time-sensitive is this issue),\n'
            '  "impact": number 0-100 (how many people are affected, proximity to schools/hospitals),\n'
            '  "sentiment_label": "negative"|"neutral"|"positive",\n'
            '  "sentiment_score": number 0-100 (higher = more public frustration),\n'
            '  "confidence": number 0-1,\n'
            '  "reasoning": "short single-line explanation of the scoring"\n'
            "}\n"
            "Rules: No markdown. JSON only. Be data-driven.\n\n"
            f"Category: {category}\n"
            f"Ward: {ward}\n"
            f"Complaint: {text[:800]}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0, max_tokens=512)
        except Exception as exc:
            return {"used": False, "reason": f"gemini_error: {str(exc)[:160]}"}

        if not result.get("ok"):
            return {"used": False, "reason": result.get("reason", "gemini_error")}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"used": False, "reason": "gemini_parse_failed"}

        sentiment_label = str(parsed.get("sentiment_label", "neutral")).strip().lower()
        if sentiment_label not in {"negative", "neutral", "positive"}:
            sentiment_label = "neutral"

        return {
            "used": True,
            "urgency": round(_clamp(parsed.get("urgency"), 0, 100, 50), 1),
            "impact": round(_clamp(parsed.get("impact"), 0, 100, 50), 1),
            "sentiment_label": sentiment_label,
            "sentiment_score": round(_clamp(parsed.get("sentiment_score"), 0, 100, 45), 1),
            "confidence": round(_clamp(parsed.get("confidence"), 0, 1, 0.7), 3),
            "reasoning": str(parsed.get("reasoning", "")).strip()[:300],
            "model": self.MODEL_NAME,
        }

    # ──────────────────────────────────────────────
    # 8. LEADER BRIEF PER COMPLAINT
    # ──────────────────────────────────────────────

    async def generate_leader_brief(
        self,
        description: str,
        category: str,
        ward: str,
        title: str = "",
    ) -> Dict[str, Any]:
        """
        Generate a concise AI analysis brief for leaders to review per complaint.
        """
        prompt = (
            "You are an AI governance advisor for Indian municipal leaders. "
            "Analyze this citizen complaint and produce a concise leadership brief.\n\n"
            "Return strict JSON:\n"
            "{\n"
            '  "summary": "2-3 sentence executive summary of the issue",\n'
            '  "severity": "critical"|"high"|"medium"|"low",\n'
            '  "affected_population": "estimate of people affected",\n'
            '  "root_cause": "likely root cause in one line",\n'
            '  "recommended_action": "specific immediate action for leader",\n'
            '  "escalation_risk": "what happens if not addressed in 48 hours",\n'
            '  "similar_pattern": "does this match any common civic issue pattern",\n'
            '  "citizen_sentiment": "brief read on citizen frustration level"\n'
            "}\n"
            "Rules: No markdown. JSON only. Be specific, actionable, concise.\n\n"
            f"Category: {category}\n"
            f"Ward: {ward}\n"
            f"Title: {title or 'N/A'}\n"
            f"Complaint: {description[:800]}\n"
        )

        parts = [{"text": prompt}]

        try:
            result = await self._call_gemini(parts, temperature=0, max_tokens=1024)
        except Exception as exc:
            return {"success": False, "error": str(exc)[:200], "ai_model": self.MODEL_NAME}

        if not result.get("ok"):
            return {"success": False, "error": result.get("reason", "gemini_error"), "ai_model": self.MODEL_NAME}

        parsed = result.get("parsed", {})
        if not parsed:
            return {"success": False, "error": "parse_failed", "ai_model": self.MODEL_NAME}

        severity = str(parsed.get("severity", "medium")).strip().lower()
        if severity not in {"critical", "high", "medium", "low"}:
            severity = "medium"

        return {
            "success": True,
            "summary": str(parsed.get("summary", "")).strip()[:400],
            "severity": severity,
            "affected_population": str(parsed.get("affected_population", "")).strip()[:100],
            "root_cause": str(parsed.get("root_cause", "")).strip()[:200],
            "recommended_action": str(parsed.get("recommended_action", "")).strip()[:300],
            "escalation_risk": str(parsed.get("escalation_risk", "")).strip()[:300],
            "similar_pattern": str(parsed.get("similar_pattern", "")).strip()[:200],
            "citizen_sentiment": str(parsed.get("citizen_sentiment", "")).strip()[:200],
            "ai_model": self.MODEL_NAME,
        }


# Singleton
gemini_ai_service = GeminiAIService()

