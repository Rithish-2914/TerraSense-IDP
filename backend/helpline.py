"""
TerraSense citizen helpline - Twilio voice webhook.

A caller dials the Twilio number, hears the greeting, and the call is logged
to an in-memory feed that the dashboard polls so the control room lights up
live. See the note near the bottom for where the <Gather> transcription step
goes next.

Kept in its own blueprint so app.py stays close to upstream.
"""

import os
import threading
import time
from collections import deque
from datetime import datetime

from flask import Blueprint, Response, jsonify, request
from twilio.twiml.voice_response import VoiceResponse
from twilio.request_validator import RequestValidator

helpline = Blueprint("helpline", __name__)

_CALL_LOG = deque(maxlen=50)
_CALL_LOCK = threading.Lock()
_CALL_SEQ = 0


def _record_call(values):
    """Append one inbound call to the live feed and return the record."""
    global _CALL_SEQ

    now = datetime.now()
    city = (values.get("FromCity") or "").strip().title()
    state = (values.get("FromState") or "").strip().upper()
    country = (values.get("FromCountry") or "").strip().upper()
    origin = ", ".join(p for p in (city, state or country) if p)

    with _CALL_LOCK:
        _CALL_SEQ += 1
        record = {
            "seq": _CALL_SEQ,
            "id": f"TR-1077-{_CALL_SEQ:04d}",
            "call_sid": values.get("CallSid") or f"local-{int(time.time())}",
            "phone": values.get("From") or "Unknown caller",
            "origin": origin or "Location withheld",
            "received_at": now.isoformat(timespec="seconds"),
            "received_display": now.strftime("%H:%M:%S"),
            "status": "ringing",
            "channel": "Twilio voice · 1077",
        }
        _CALL_LOG.append(record)

    return record

GREETING = os.getenv(
    "HELPLINE_GREETING",
    "Thank you for calling the TerraSense city helpline. What is your emergency?",
)
VOICE = os.getenv("HELPLINE_VOICE", "Polly.Aditi")
LANGUAGE = os.getenv("HELPLINE_LANGUAGE", "en-IN")


def _twiml(response: VoiceResponse) -> Response:
    return Response(str(response), mimetype="text/xml")


def _signature_ok() -> bool:
    """
    Twilio signs every webhook with the account auth token. Verifying it stops
    anyone who guesses the ngrok URL from driving the line.

    Skipped when TWILIO_AUTH_TOKEN is unset (local curl testing) or when
    TWILIO_VALIDATE_SIGNATURE=false, which is useful if a proxy rewrites the
    URL Twilio signed.
    """
    token = os.getenv("TWILIO_AUTH_TOKEN")
    if not token or os.getenv("TWILIO_VALIDATE_SIGNATURE", "true").lower() == "false":
        return True

    validator = RequestValidator(token)
    signature = request.headers.get("X-Twilio-Signature", "")

    url = request.url
    if request.headers.get("X-Forwarded-Proto") == "https":
        url = url.replace("http://", "https://", 1)

    return validator.validate(url, request.form.to_dict(), signature)


@helpline.route("/", methods=["POST"])
@helpline.route("/voice", methods=["POST", "GET"])
@helpline.route("/voice/incoming", methods=["POST", "GET"])
@helpline.route("/api/voice/incoming", methods=["POST", "GET"])
def incoming_call():
    """Twilio incoming call webhook. Speaks the greeting, then hangs up."""
    if not _signature_ok():
        return Response("Invalid Twilio signature", status=403)

    record = _record_call(request.values)
    print(f"[helpline] incoming call {record['id']} from {record['phone']} ({record['origin']})")

    response = VoiceResponse()
    response.pause(length=1)
    response.say(GREETING, voice=VOICE, language=LANGUAGE)
    response.hangup()
    return _twiml(response)


@helpline.route("/api/voice/calls", methods=["GET"])
def voice_calls():
    """
    Live feed the dashboard polls. Pass ?since=<seq> to get only the calls
    logged after that sequence number; the response always reports the latest
    sequence so the client can pass it straight back on the next poll.
    """
    try:
        since = int(request.args.get("since", 0))
    except (TypeError, ValueError):
        since = 0

    with _CALL_LOCK:
        calls = [c for c in _CALL_LOG if c["seq"] > since]
        latest = _CALL_SEQ

    return jsonify({
        "status": "success",
        "latest_seq": latest,
        "count": len(calls),
        "calls": calls,
    })


@helpline.route("/api/voice/calls/clear", methods=["POST"])
def clear_calls():
    """
    Empties the live feed and rewinds the sequence. The dashboard notices the
    sequence going backwards and resets its own cursor, so the board clears on
    both sides without needing a page reload.
    """
    global _CALL_SEQ

    with _CALL_LOCK:
        cleared = len(_CALL_LOG)
        _CALL_LOG.clear()
        _CALL_SEQ = 0

    return jsonify({"status": "success", "cleared": cleared, "latest_seq": 0})


@helpline.route("/api/voice/calls/simulate", methods=["POST"])
def simulate_call():
    """
    Drops a synthetic call onto the same feed, so the live console can be
    demonstrated without dialling the number (or burning trial credit).
    """
    data = request.get_json(silent=True) or {}
    record = _record_call({
        "From": data.get("from") or "+91 98410 77412",
        "FromCity": data.get("city") or "Tiruchirappalli",
        "FromState": data.get("state") or "TN",
        "CallSid": data.get("call_sid"),
    })
    return jsonify({"status": "success", "call": record})


@helpline.route("/api/voice/status", methods=["GET"])
def voice_status():
    """Config check - hit this before a demo to confirm the line is wired up."""
    return {
        "configured": bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN")),
        "twilio_number": os.getenv("TWILIO_PHONE_NUMBER") or None,
        "signature_validation": bool(os.getenv("TWILIO_AUTH_TOKEN"))
        and os.getenv("TWILIO_VALIDATE_SIGNATURE", "true").lower() != "false",
        "greeting": GREETING,
        "voice": VOICE,
        "webhook_path": "/api/voice/incoming",
    }
