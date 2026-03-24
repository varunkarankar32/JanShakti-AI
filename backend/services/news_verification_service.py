"""
News Verification Service
Validates whether a claim is being reported by recent news sources.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Tuple
from urllib.parse import quote_plus
import os
import re
import xml.etree.ElementTree as ET
import asyncio

import httpx


REPUTABLE_DOMAINS = {
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "aljazeera.com",
    "thehindu.com",
    "indianexpress.com",
    "hindustantimes.com",
    "timesofindia.indiatimes.com",
    "ndtv.com",
    "livemint.com",
    "economictimes.indiatimes.com",
    "business-standard.com",
    "theprint.in",
    "ani.in",
}

REPUTABLE_PUBLISHERS = {
    "reuters",
    "associated press",
    "ap news",
    "bbc",
    "al jazeera",
    "the hindu",
    "indian express",
    "hindustan times",
    "times of india",
    "ndtv",
    "mint",
    "economic times",
    "business standard",
    "the print",
    "ani",
}


NEWS_VERIFIER_MODEL = os.getenv(
    "NEWS_VERIFIER_MODEL",
    "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli",
)
NEWS_VERIFIER_ENABLED = os.getenv("NEWS_VERIFIER_ENABLED", "true").lower() == "true"


def _tokens(text: str) -> List[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    words = [w for w in cleaned.split() if len(w) > 2]
    return words[:80]


def _token_overlap_score(a: str, b: str) -> float:
    ta = set(_tokens(a))
    tb = set(_tokens(b))
    if not ta or not tb:
        return 0.0
    return len(ta.intersection(tb)) / len(ta)


def _extract_domain(url: str) -> str:
    if not url:
        return ""
    try:
        host = url.split("//", 1)[1].split("/", 1)[0].lower()
    except Exception:
        return ""
    return host.replace("www.", "")


def _publisher_key(publisher: str, domain: str) -> str:
    pub = (publisher or "").strip().lower()
    if pub:
        return re.sub(r"\s+", " ", pub)
    return (domain or "unknown").strip().lower()


def _is_reputable_source(domain: str, publisher: str) -> bool:
    domain = (domain or "").lower()
    publisher = (publisher or "").lower()

    if domain in REPUTABLE_DOMAINS:
        return True

    return any(name in publisher for name in REPUTABLE_PUBLISHERS)


def _parse_pub_date(raw: str) -> datetime | None:
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _recency_weight(pub_date: datetime | None, now: datetime, lookback_days: int) -> float:
    if not pub_date:
        return 0.75
    age_days = max(0.0, (now - pub_date).total_seconds() / 86400.0)
    bounded = min(float(lookback_days), age_days)
    # Newer evidence gets higher influence, but older in-window evidence still counts.
    return max(0.5, 1.0 - (bounded / max(1.0, float(lookback_days))) * 0.45)


class _ClaimNLI:
    """Lazy-loaded NLI verifier that scores support vs contradiction for claim/evidence pairs."""

    def __init__(self) -> None:
        self._pipeline = None
        self._disabled_reason = "not_initialized"

    def _ensure_pipeline(self) -> bool:
        if self._pipeline is not None:
            return True

        if not NEWS_VERIFIER_ENABLED:
            self._disabled_reason = "nli_disabled"
            return False

        try:
            from transformers import pipeline  # type: ignore
        except Exception:
            self._disabled_reason = "transformers_missing"
            return False

        try:
            self._pipeline = pipeline(
                "text-classification",
                model=NEWS_VERIFIER_MODEL,
                return_all_scores=True,
            )
            self._disabled_reason = ""
            return True
        except Exception as exc:
            self._disabled_reason = f"nli_load_failed: {str(exc)[:120]}"
            self._pipeline = None
            return False

    def is_enabled(self) -> bool:
        return self._ensure_pipeline()

    @property
    def disabled_reason(self) -> str:
        return self._disabled_reason

    def score_pair(self, claim: str, evidence: str) -> Dict[str, float]:
        if not self._ensure_pipeline() or self._pipeline is None:
            return {"support": 0.0, "contradiction": 0.0, "neutral": 1.0}

        premise = str(evidence or "").strip()[:800]
        hypothesis = str(claim or "").strip()[:420]
        if not premise or not hypothesis:
            return {"support": 0.0, "contradiction": 0.0, "neutral": 1.0}

        text = f"premise: {premise} hypothesis: {hypothesis}"
        try:
            rows = self._pipeline(text)
        except Exception:
            return {"support": 0.0, "contradiction": 0.0, "neutral": 1.0}

        labels = rows[0] if rows and isinstance(rows[0], list) else rows
        support = 0.0
        contradiction = 0.0
        neutral = 0.0

        for item in labels or []:
            label = str(item.get("label", "")).lower()
            score = float(item.get("score", 0.0) or 0.0)
            if "entail" in label:
                support = max(support, score)
            elif "contrad" in label:
                contradiction = max(contradiction, score)
            elif "neutral" in label:
                neutral = max(neutral, score)

        residue = max(0.0, 1.0 - (support + contradiction + neutral))
        neutral += residue
        return {
            "support": min(1.0, max(0.0, support)),
            "contradiction": min(1.0, max(0.0, contradiction)),
            "neutral": min(1.0, max(0.0, neutral)),
        }


claim_nli = _ClaimNLI()


class NewsVerificationService:
    async def verify_claim(
        self,
        claim_text: str,
        region_hint: str = "India",
        lookback_days: int = 7,
    ) -> Dict[str, Any]:
        claim = str(claim_text or "").strip()
        if not claim:
            return {
                "success": False,
                "error": "empty_claim",
                "provider": "news_site_lookup",
            }

        days = max(1, min(30, int(lookback_days or 7)))
        query = f"{claim} {region_hint} when:{days}d"
        rss_url = (
            "https://news.google.com/rss/search?"
            f"q={quote_plus(query)}&hl=en-IN&gl=IN&ceid=IN:en"
        )

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(rss_url)
        except Exception as exc:
            return {
                "success": False,
                "error": f"news_fetch_failed: {str(exc)[:180]}",
                "provider": "news_site_lookup",
            }

        if resp.status_code >= 400:
            return {
                "success": False,
                "error": f"news_http_{resp.status_code}",
                "provider": "news_site_lookup",
            }

        try:
            root = ET.fromstring(resp.text)
        except Exception:
            return {
                "success": False,
                "error": "news_rss_parse_failed",
                "provider": "news_site_lookup",
            }

        now = datetime.now(timezone.utc)
        threshold = now - timedelta(days=days)
        candidates: List[Tuple[float, Dict[str, Any], bool]] = []

        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_raw = (item.findtext("pubDate") or "").strip()
            source_name = (item.findtext("source") or "").strip()

            if not title or not link:
                continue

            published_at = _parse_pub_date(pub_raw)
            if published_at and published_at < threshold:
                continue

            domain = _extract_domain(link)
            is_reputable = _is_reputable_source(domain, source_name)

            # Match claim against headline + source name for rough relevance.
            score = _token_overlap_score(claim, f"{title} {source_name}")
            if score < 0.18:
                continue

            source = {
                "title": title[:200],
                "publisher": source_name[:120] or domain[:120],
                "url": link[:500],
                "published_hint": pub_raw[:80] or "unknown",
                "relevance": f"Headline overlap score: {score:.2f}",
                "domain": domain,
                "published_at": published_at,
            }
            candidates.append((score, source, is_reputable))

        candidates.sort(key=lambda row: row[0], reverse=True)
        top = candidates[:10]

        # Run NLI claim-vs-headline scoring only on top matches for stronger evidence logic.
        nli_enabled = claim_nli.is_enabled()
        nli_rows: List[Dict[str, float]] = []
        if nli_enabled:
            nli_rows = await asyncio.gather(
                *[
                    asyncio.to_thread(
                        claim_nli.score_pair,
                        claim,
                        f"{row[1].get('title', '')}. Source: {row[1].get('publisher', '')}",
                    )
                    for row in top
                ]
            )
        else:
            nli_rows = [{"support": 0.0, "contradiction": 0.0, "neutral": 1.0} for _ in top]

        sources: List[Dict[str, str]] = []
        weighted_support = 0.0
        weighted_contradiction = 0.0
        weighted_mass = 0.0

        for (overlap, source, is_reputable), nli_score in zip(top, nli_rows):
            recency = _recency_weight(source.get("published_at"), now, days)
            reputation = 1.18 if is_reputable else 0.86
            weight = max(0.25, overlap) * recency * reputation

            support = float(nli_score.get("support", 0.0) or 0.0)
            contradiction = float(nli_score.get("contradiction", 0.0) or 0.0)

            weighted_support += support * weight
            weighted_contradiction += contradiction * weight
            weighted_mass += weight

            evidence_note = f"Overlap {overlap:.2f}"
            if nli_enabled:
                evidence_note = (
                    f"Overlap {overlap:.2f}, support {support:.2f}, contradiction {contradiction:.2f}"
                )

            sources.append(
                {
                    "title": source.get("title", "")[:200],
                    "publisher": source.get("publisher", "")[:120],
                    "url": source.get("url", "")[:500],
                    "published_hint": source.get("published_hint", "unknown")[:80],
                    "relevance": evidence_note[:220],
                }
            )

        listed_count = len(top)
        reputable_count = sum(1 for _, _, rep in top if rep)
        unique_publishers = len(
            {
                _publisher_key(src.get("publisher", ""), src.get("domain", ""))
                for _, src, _ in top
                if src.get("publisher") or src.get("domain")
            }
        )

        if weighted_mass > 0:
            support_score = weighted_support / weighted_mass
            contradiction_score = weighted_contradiction / weighted_mass
        else:
            support_score = 0.0
            contradiction_score = 0.0

        evidence_strength = (
            min(1.0, listed_count / 6.0) * 0.45
            + min(1.0, reputable_count / 3.0) * 0.35
            + min(1.0, unique_publishers / 4.0) * 0.20
        )

        if (
            listed_count >= 3
            and reputable_count >= 1
            and (support_score >= 0.55 or not nli_enabled)
            and contradiction_score <= 0.38
        ):
            verdict = "Likely True"
            confidence = min(
                0.96,
                0.45
                + evidence_strength * 0.32
                + support_score * 0.23
                + (0.06 if nli_enabled else 0.0),
            )
            summary = (
                f"The claim appears in {listed_count} recent news listing(s) within the last {days} day(s), "
                f"including {reputable_count} reputable source(s) across {unique_publishers} publisher(s)."
            )
            signal = "Recent coverage found across multiple sources."
            listed_last_week = True
        elif contradiction_score >= 0.5 and listed_count >= 2:
            verdict = "Likely False"
            confidence = min(0.9, 0.42 + contradiction_score * 0.42 + evidence_strength * 0.16)
            summary = (
                f"Recent coverage signals show weak support and stronger contradiction cues for this claim "
                f"(support {support_score:.2f}, contradiction {contradiction_score:.2f}). "
                "Treat this as likely false unless official evidence emerges."
            )
            signal = "Recent reporting appears to contradict the claim."
            listed_last_week = True
        elif listed_count >= 1:
            verdict = "Partly True"
            confidence = min(0.78, 0.42 + evidence_strength * 0.28 + support_score * 0.12)
            summary = (
                f"The claim appears in {listed_count} recent listing(s) within the last {days} day(s). "
                "Signals are mixed or limited, so cross-verification with additional credible sources is recommended."
            )
            signal = "Limited recent reporting signal found."
            listed_last_week = True
        else:
            verdict = "Insufficient Evidence"
            confidence = 0.24
            summary = (
                f"No reliable recent news listing matched this claim in the last {days} day(s). "
                "Treat it as unverified until credible reporting appears."
            )
            signal = "No matching recent reporting found."
            listed_last_week = False

        actions = [
            "Check PIB and official ministry handles for primary confirmation.",
            "Look for at least two independent credible publications before sharing.",
            "If no recent coverage exists, flag as unverified.",
        ]

        metadata: Dict[str, Any] = {
            "listed_count": listed_count,
            "reputable_count": reputable_count,
            "unique_publishers": unique_publishers,
            "support_score": round(support_score, 3),
            "contradiction_score": round(contradiction_score, 3),
            "nli_enabled": nli_enabled,
            "nli_model": NEWS_VERIFIER_MODEL if nli_enabled else None,
        }
        if not nli_enabled and claim_nli.disabled_reason:
            metadata["nli_status"] = claim_nli.disabled_reason

        return {
            "success": True,
            "provider": "hybrid_news_nli_v1",
            "claim": claim[:2000],
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "fact_summary": summary,
            "is_listed_last_week": listed_last_week,
            "last_week_signal_summary": signal,
            "possible_fact_check_actions": actions,
            "sources": sources,
            "ai_model": "News + NLI Claim Verifier",
            "verification_metadata": metadata,
        }


news_verification_service = NewsVerificationService()
