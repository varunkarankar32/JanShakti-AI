"""
WhatsApp Bot Service — Conversational Complaint Filing & Status Updates
Uses Twilio WhatsApp API (or Meta WhatsApp Business API).

Flow:
  1. Citizen sends "hi" → Bot greets + shows menu
  2. Citizen says "complaint" → Bot starts complaint flow (category → ward → description)
  3. Citizen says "status" → Bot asks for ticket ID → returns live status
  4. Citizen sends photo → Bot runs AI vision detection + auto-files complaint
  5. Citizen sends voice note → Bot transcribes via Whisper + auto-files complaint

Session state is stored in-memory (dict). For production, use Redis.
"""

import os
import uuid
import json
import httpx
from typing import Dict, Optional
from datetime import datetime

# Try Twilio
try:
    from twilio.rest import Client as TwilioClient
    from twilio.twiml.messaging_response import MessagingResponse
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    print("[WhatsApp] twilio not installed — bot will work in webhook-only mode")


# ============================================================
# CONVERSATION STATE MACHINE
# ============================================================

class ConversationState:
    """Tracks where each user is in the complaint-filing flow."""
    IDLE = "idle"
    AWAITING_CATEGORY = "awaiting_category"
    AWAITING_WARD = "awaiting_ward"
    AWAITING_DESCRIPTION = "awaiting_description"
    AWAITING_LOCATION = "awaiting_location"
    AWAITING_TICKET_ID = "awaiting_ticket_id"


CATEGORIES = [
    "Water Supply", "Roads & Potholes", "Drainage", "Electricity",
    "Garbage & Sanitation", "Safety & Security", "Public Health"
]

WARDS = [f"Ward {i}" for i in range(1, 26)]

MENU_TEXT = (
    "🏛️ *जनशक्ति.AI — Citizen Governance Bot*\n\n"
    "नमस्ते! I can help you:\n\n"
    "1️⃣ *File a Complaint* — Type `complaint`\n"
    "2️⃣ *Check Status* — Type `status`\n"
    "3️⃣ *Send Photo* — Attach a photo of the issue\n"
    "4️⃣ *Voice Complaint* — Send a voice note\n\n"
    "Type *help* anytime to see this menu again."
)

CATEGORY_TEXT = (
    "📋 *Select Category:*\n\n"
    + "\n".join(f"{i+1}. {cat}" for i, cat in enumerate(CATEGORIES))
    + "\n\n_Reply with the number (1-7)_"
)

WARD_TEXT = (
    "📍 *Select your Ward:*\n\n"
    "Reply with your ward number (1-25)\n"
    "Example: `5` for Ward 5"
)


class WhatsAppBotService:
    def __init__(self):
        # In-memory session store {phone_number: {state, data}}
        # For production, replace with Redis
        self.sessions: Dict[str, Dict] = {}

        # Twilio client (optional)
        self.twilio_client = None
        self.twilio_from = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        if TWILIO_AVAILABLE:
            account_sid = os.getenv("TWILIO_ACCOUNT_SID")
            auth_token = os.getenv("TWILIO_AUTH_TOKEN")
            if account_sid and auth_token:
                self.twilio_client = TwilioClient(account_sid, auth_token)
                print(f"[WhatsApp] Twilio client initialized")

    def _get_session(self, phone: str) -> Dict:
        if phone not in self.sessions:
            self.sessions[phone] = {
                "state": ConversationState.IDLE,
                "data": {},
                "last_active": datetime.now().isoformat(),
            }
        self.sessions[phone]["last_active"] = datetime.now().isoformat()
        return self.sessions[phone]

    def _reset_session(self, phone: str):
        self.sessions[phone] = {
            "state": ConversationState.IDLE,
            "data": {},
            "last_active": datetime.now().isoformat(),
        }

    # ============================================================
    # MAIN MESSAGE HANDLER
    # ============================================================

    def handle_message(
        self,
        phone: str,
        message: str,
        media_url: Optional[str] = None,
        media_type: Optional[str] = None,
        db=None,
    ) -> str:
        """
        Process incoming WhatsApp message and return response text.

        Args:
            phone: User's phone number (e.g. "whatsapp:+919876543210")
            message: Text message content
            media_url: URL of attached media (image/audio)
            media_type: MIME type of media
            db: SQLAlchemy database session

        Returns:
            Response text to send back to user
        """
        session = self._get_session(phone)
        state = session["state"]
        msg = message.strip().lower()

        # Handle media (photos / voice)
        if media_url:
            if media_type and "image" in media_type:
                return self._handle_photo(phone, media_url, db)
            elif media_type and ("audio" in media_type or "ogg" in media_type):
                return self._handle_voice(phone, media_url, db)

        # Global commands (work in any state)
        if msg in ["hi", "hello", "hey", "start", "menu", "help", "namaste"]:
            self._reset_session(phone)
            return MENU_TEXT

        if msg in ["cancel", "reset", "back"]:
            self._reset_session(phone)
            return "❌ Cancelled. Type *help* to see the menu."

        # State machine
        if state == ConversationState.IDLE:
            return self._handle_idle(phone, msg, db)

        elif state == ConversationState.AWAITING_CATEGORY:
            return self._handle_category_selection(phone, msg)

        elif state == ConversationState.AWAITING_WARD:
            return self._handle_ward_selection(phone, msg)

        elif state == ConversationState.AWAITING_DESCRIPTION:
            return self._handle_description(phone, message, db)  # Keep original case

        elif state == ConversationState.AWAITING_TICKET_ID:
            return self._handle_ticket_lookup(phone, message, db)

        return MENU_TEXT

    # ============================================================
    # STATE HANDLERS
    # ============================================================

    def _handle_idle(self, phone: str, msg: str, db=None) -> str:
        if msg in ["1", "complaint", "file complaint", "complain", "shikayat"]:
            session = self._get_session(phone)
            session["state"] = ConversationState.AWAITING_CATEGORY
            return CATEGORY_TEXT

        elif msg in ["2", "status", "check status", "track", "ticket"]:
            session = self._get_session(phone)
            session["state"] = ConversationState.AWAITING_TICKET_ID
            return "🔍 *Check Complaint Status*\n\nPlease enter your Ticket ID:\n_Example: TKT-A1B2C3_"

        elif msg in ["3", "photo"]:
            return "📸 Please send a photo of the issue. I'll auto-detect the problem using AI."

        elif msg in ["4", "voice", "audio"]:
            return "🎤 Please send a voice note describing your issue. I'll transcribe and file it."

        return MENU_TEXT

    def _handle_category_selection(self, phone: str, msg: str) -> str:
        session = self._get_session(phone)

        # Accept number or text
        try:
            idx = int(msg) - 1
            if 0 <= idx < len(CATEGORIES):
                session["data"]["category"] = CATEGORIES[idx]
                session["state"] = ConversationState.AWAITING_WARD
                return f"✅ Category: *{CATEGORIES[idx]}*\n\n{WARD_TEXT}"
        except ValueError:
            # Try matching by text
            for cat in CATEGORIES:
                if msg in cat.lower():
                    session["data"]["category"] = cat
                    session["state"] = ConversationState.AWAITING_WARD
                    return f"✅ Category: *{cat}*\n\n{WARD_TEXT}"

        return f"❌ Invalid selection. Please pick 1-{len(CATEGORIES)}.\n\n{CATEGORY_TEXT}"

    def _handle_ward_selection(self, phone: str, msg: str) -> str:
        session = self._get_session(phone)

        try:
            ward_num = int(msg)
            if 1 <= ward_num <= 25:
                session["data"]["ward"] = f"Ward {ward_num}"
                session["state"] = ConversationState.AWAITING_DESCRIPTION
                return (
                    f"✅ Ward: *Ward {ward_num}*\n\n"
                    "📝 *Describe your complaint:*\n\n"
                    "Type your issue in detail. You can write in English or Hindi.\n"
                    "_Example: Water pipe burst near main road, flooding for 2 days_"
                )
        except ValueError:
            pass

        return "❌ Please enter a valid ward number (1-25)."

    def _handle_description(self, phone: str, description: str, db=None) -> str:
        session = self._get_session(phone)

        if len(description.strip()) < 10:
            return "❌ Please provide more detail (at least 10 characters)."

        session["data"]["description"] = description.strip()
        session["data"]["title"] = description.strip()[:80]

        # File the complaint
        return self._create_complaint(phone, session["data"], db)

    def _handle_ticket_lookup(self, phone: str, ticket_id: str, db=None) -> str:
        session = self._get_session(phone)
        ticket_id = ticket_id.strip().upper()

        if db:
            from models.complaint import Complaint
            complaint = db.query(Complaint).filter(
                Complaint.ticket_id == ticket_id
            ).first()

            if complaint:
                status_emoji = {
                    "open": "🔴",
                    "assigned": "🟡",
                    "in_progress": "🟠",
                    "verification": "🔵",
                    "resolved": "🟢",
                }.get(complaint.status.value, "⚪")

                self._reset_session(phone)
                return (
                    f"📋 *Complaint Status*\n\n"
                    f"🎫 Ticket: *{complaint.ticket_id}*\n"
                    f"📂 Category: {complaint.category}\n"
                    f"📍 Ward: {complaint.ward}\n"
                    f"{status_emoji} Status: *{complaint.status.value.replace('_', ' ').title()}*\n"
                    f"⚡ Priority: {complaint.priority.value}\n"
                    f"🤖 AI Score: {complaint.ai_score}/100\n"
                    f"📅 Filed: {complaint.created_at.strftime('%d %b %Y') if complaint.created_at else 'N/A'}\n"
                    + (f"👷 Assigned: {complaint.assigned_to}\n" if complaint.assigned_to else "")
                    + (f"✅ Resolved: {complaint.resolved_at.strftime('%d %b %Y')}\n" if complaint.resolved_at else "")
                    + "\nType *help* to return to menu."
                )

        self._reset_session(phone)
        return (
            f"❌ Ticket *{ticket_id}* not found.\n\n"
            "Please check the ID and try again, or type *help* for the menu."
        )

    # ============================================================
    # PHOTO & VOICE HANDLERS
    # ============================================================

    def _handle_photo(self, phone: str, media_url: str, db=None) -> str:
        """Process photo — run AI vision detection and auto-file complaint."""
        try:
            # Download image
            response = httpx.get(media_url, timeout=30)
            image_bytes = response.content

            # Run vision AI
            from services.vision_service import vision_service
            result = vision_service.detect(image_bytes)

            category_map = {
                "Pothole": "Roads & Potholes",
                "Road Crack": "Roads & Potholes",
                "Road Damage": "Roads & Potholes",
                "Garbage Dump": "Garbage & Sanitation",
                "Broken Pipe": "Water Supply",
                "Waterlogging": "Drainage",
                "Broken Streetlight": "Electricity",
                "Damaged Wall": "Safety & Security",
                "Infrastructure Issue": "Roads & Potholes",
            }

            detected = result.get("category", "Unknown")
            severity = result.get("severity", "medium")
            confidence = result.get("confidence", 0)
            category = category_map.get(detected, "Roads & Potholes")

            # Auto-file complaint
            data = {
                "title": f"[Photo] {detected} detected via WhatsApp",
                "description": f"AI-detected issue: {detected} (severity: {severity}, confidence: {confidence:.0%}). Submitted via WhatsApp photo.",
                "category": category,
                "ward": "Ward 1",  # Default — will ask user to confirm
                "input_mode": "image",
            }

            ticket_id = self._create_complaint_from_data(phone, data, db)

            return (
                f"📸 *AI Photo Analysis*\n\n"
                f"🔍 Detected: *{detected}*\n"
                f"⚠️ Severity: *{severity.title()}*\n"
                f"🎯 Confidence: {confidence:.0%}\n"
                f"📂 Category: {category}\n\n"
                f"✅ *Complaint auto-filed!*\n"
                f"🎫 Ticket: *{ticket_id}*\n\n"
                f"Track status anytime by typing *status*."
            )

        except Exception as e:
            print(f"[WhatsApp] Photo processing error: {e}")
            return "❌ Could not process the photo. Please try again or describe the issue in text."

    def _handle_voice(self, phone: str, media_url: str, db=None) -> str:
        """Process voice note — transcribe via Whisper and auto-file."""
        try:
            # Download audio
            response = httpx.get(media_url, timeout=30)
            audio_bytes = response.content

            # Transcribe
            from services.speech_service import speech_service
            result = speech_service.transcribe(audio_bytes, "ogg")

            text = result.get("text", "")
            language = result.get("language", "Unknown")

            if not text or len(text) < 5:
                return "❌ Could not transcribe the audio. Please try again or type your complaint."

            # Classify the transcribed text
            from services.nlp_service import nlp_service
            category, confidence = nlp_service.classify(text)

            data = {
                "title": f"[Voice] {text[:80]}",
                "description": f"{text}\n\n[Transcribed from {language} voice note via WhatsApp]",
                "category": category,
                "ward": "Ward 1",
                "input_mode": "voice",
            }

            ticket_id = self._create_complaint_from_data(phone, data, db)

            return (
                f"🎤 *Voice Transcription*\n\n"
                f"🗣️ Language: {language}\n"
                f"📝 Text: _{text}_\n\n"
                f"📂 Auto-category: *{category}* ({confidence:.0%})\n\n"
                f"✅ *Complaint filed!*\n"
                f"🎫 Ticket: *{ticket_id}*\n\n"
                f"Track status anytime by typing *status*."
            )

        except Exception as e:
            print(f"[WhatsApp] Voice processing error: {e}")
            return "❌ Could not process the voice note. Please try again or type your complaint."

    # ============================================================
    # COMPLAINT CREATION
    # ============================================================

    def _create_complaint(self, phone: str, data: Dict, db=None) -> str:
        """Create complaint in DB and return confirmation message."""
        ticket_id = self._create_complaint_from_data(phone, data, db)

        category = data.get("category", "Unknown")
        ward = data.get("ward", "Unknown")
        description = data.get("description", "")[:100]

        self._reset_session(phone)

        return (
            f"✅ *Complaint Filed Successfully!*\n\n"
            f"🎫 Ticket ID: *{ticket_id}*\n"
            f"📂 Category: {category}\n"
            f"📍 Ward: {ward}\n"
            f"📝 Issue: _{description}_\n\n"
            f"🤖 Our AI will prioritize your complaint and assign it to the nearest field team.\n\n"
            f"📲 Track status anytime — just type *status* and enter your ticket ID.\n\n"
            f"Type *help* to return to menu."
        )

    def _create_complaint_from_data(self, phone: str, data: Dict, db=None) -> str:
        """Insert complaint into database. Returns ticket ID."""
        ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"

        if db:
            try:
                from models.complaint import Complaint, ComplaintStatus, PriorityLevel, InputMode
                from services.nlp_service import nlp_service
                from services.priority_engine import priority_engine
                from services.sentiment_service import sentiment_service

                description = data.get("description", "")
                category = data.get("category", "Others")

                # AI processing
                ai_category, ai_confidence = nlp_service.classify(description)
                priority_result = priority_engine.calculate_score(
                    text=description,
                    category=category,
                    ward=data.get("ward", "Ward 1"),
                    recurrence_count=0,
                    social_mentions=0,
                )
                sentiment_result = sentiment_service.analyze(description)

                input_mode_str = data.get("input_mode", "text")
                try:
                    input_mode = InputMode(input_mode_str)
                except ValueError:
                    input_mode = InputMode.TEXT

                complaint = Complaint(
                    ticket_id=ticket_id,
                    title=data.get("title", description[:80]),
                    description=description,
                    category=category,
                    ward=data.get("ward", "Ward 1"),
                    location=data.get("location", ""),
                    citizen_name=data.get("citizen_name", ""),
                    citizen_phone=phone.replace("whatsapp:", ""),
                    priority=PriorityLevel(priority_result["priority"]),
                    ai_score=priority_result["score"],
                    urgency_score=priority_result["urgency"],
                    impact_score=priority_result["impact"],
                    recurrence_score=priority_result["recurrence"],
                    sentiment_score=priority_result["sentiment"],
                    ai_category=ai_category,
                    ai_entities=json.dumps({}),
                    status=ComplaintStatus.OPEN,
                    input_mode=input_mode,
                )

                db.add(complaint)
                db.commit()

            except Exception as e:
                print(f"[WhatsApp] DB error: {e}")
                db.rollback()

        return ticket_id

    # ============================================================
    # OUTBOUND NOTIFICATIONS
    # ============================================================

    def send_status_update(self, phone: str, ticket_id: str, status: str, message: str = ""):
        """Send proactive status update to citizen via WhatsApp."""
        status_emoji = {
            "open": "🔴", "assigned": "🟡", "in_progress": "🟠",
            "verification": "🔵", "resolved": "🟢",
        }.get(status, "⚪")

        text = (
            f"📢 *Complaint Update*\n\n"
            f"🎫 Ticket: *{ticket_id}*\n"
            f"{status_emoji} New Status: *{status.replace('_', ' ').title()}*\n"
            + (f"\n💬 {message}" if message else "")
            + "\n\nType *status* to see full details."
        )

        if self.twilio_client:
            try:
                self.twilio_client.messages.create(
                    body=text,
                    from_=self.twilio_from,
                    to=f"whatsapp:{phone}" if not phone.startswith("whatsapp:") else phone,
                )
                print(f"[WhatsApp] Sent update to {phone}")
            except Exception as e:
                print(f"[WhatsApp] Send error: {e}")

        return text


# Singleton
whatsapp_bot = WhatsAppBotService()
