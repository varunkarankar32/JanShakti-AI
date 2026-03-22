"""
WhatsApp Router — Webhook endpoint for Twilio/Meta WhatsApp Business API.

Twilio sends POST requests to /api/whatsapp/webhook when a message arrives.
We process it through the WhatsApp bot service and return the response.
"""

from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional
import hmac
import hashlib

from database import get_db
from services.whatsapp_service import whatsapp_bot

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Bot"])


@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
    Body: str = Form(""),
    From: str = Form(""),
    To: str = Form(""),
    MediaUrl0: Optional[str] = Form(None),
    MediaContentType0: Optional[str] = Form(None),
    NumMedia: str = Form("0"),
):
    """
    Twilio WhatsApp Webhook — receives incoming messages.

    Twilio POST fields:
      - From: "whatsapp:+919876543210"
      - Body: message text
      - MediaUrl0: URL of attached media
      - MediaContentType0: MIME type
      - NumMedia: number of media attachments
    """
    phone = From
    message = Body
    media_url = MediaUrl0
    media_type = MediaContentType0

    # Process through bot
    response_text = whatsapp_bot.handle_message(
        phone=phone,
        message=message,
        media_url=media_url,
        media_type=media_type,
        db=db,
    )

    # Return TwiML response (for Twilio)
    try:
        from twilio.twiml.messaging_response import MessagingResponse
        twiml = MessagingResponse()
        twiml.message(response_text)
        return PlainTextResponse(str(twiml), media_type="text/xml")
    except ImportError:
        # Fallback: return plain JSON
        return {"response": response_text}


@router.post("/webhook/meta")
async def meta_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Meta WhatsApp Business API Webhook — alternative to Twilio.

    Meta sends JSON payloads:
    {
      "entry": [{
        "changes": [{
          "value": {
            "messages": [{
              "from": "919876543210",
              "text": {"body": "hello"},
              "type": "text"
            }]
          }
        }]
      }]
    }
    """
    body = await request.json()

    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return {"status": "no messages"}

        msg = messages[0]
        phone = f"whatsapp:+{msg.get('from', '')}"
        msg_type = msg.get("type", "text")

        text = ""
        media_url = None
        media_type = None

        if msg_type == "text":
            text = msg.get("text", {}).get("body", "")
        elif msg_type == "image":
            media_url = msg.get("image", {}).get("url", "")
            media_type = "image/jpeg"
            text = msg.get("image", {}).get("caption", "")
        elif msg_type == "audio":
            media_url = msg.get("audio", {}).get("url", "")
            media_type = "audio/ogg"

        response_text = whatsapp_bot.handle_message(
            phone=phone,
            message=text,
            media_url=media_url,
            media_type=media_type,
            db=db,
        )

        return {"response": response_text}

    except Exception as e:
        print(f"[WhatsApp Meta] Error: {e}")
        return {"error": str(e)}


@router.get("/webhook/meta")
async def meta_verify_webhook(request: Request):
    """
    Meta Webhook Verification — required during setup.
    Meta sends GET with hub.verify_token and hub.challenge.
    """
    import os
    verify_token = os.getenv("META_VERIFY_TOKEN", "janshakti-verify-token")

    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if mode == "subscribe" and token == verify_token:
        return PlainTextResponse(challenge)

    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/send")
async def send_whatsapp_message(
    phone: str,
    ticket_id: str,
    status: str,
    message: str = "",
):
    """
    Admin endpoint — send proactive status update to citizen.
    Used by dashboard/automated systems to notify citizens.
    """
    result = whatsapp_bot.send_status_update(
        phone=phone,
        ticket_id=ticket_id,
        status=status,
        message=message,
    )
    return {"status": "sent", "message": result}


@router.get("/test")
def test_bot(
    message: str = "hello",
    phone: str = "whatsapp:+919999999999",
    db: Session = Depends(get_db),
):
    """Test bot logic with real DB persistence for complaint flow."""
    normalized_phone = phone.strip() if phone else "whatsapp:+919999999999"
    if not normalized_phone.startswith("whatsapp:"):
        normalized_phone = f"whatsapp:{normalized_phone}"

    response = whatsapp_bot.handle_message(
        phone=normalized_phone,
        message=message,
        db=db,
    )
    return {"input": message, "phone": normalized_phone, "response": response}
