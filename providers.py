"""
How a message leaves the building.

One class per service. Everything above this file works with `Provider`, so the
service can be changed in Backend/.env without touching the kiosk, the queue or
the endpoints.

A note on WhatsApp, for whoever adds the real provider: a business cannot send
free text to someone who has not messaged it first. Business-initiated messages
use a template approved by Meta in advance, with the wording fixed and only the
{{1}}, {{2}} … values filled in per visitor. That is why send() takes a template
name and a list of values rather than a finished sentence.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class MessageResult:
    """What happened to one send attempt."""

    ok: bool
    # The service's own id for the message, for matching up delivery reports.
    message_id: str = ""
    error: str = ""
    # False when retrying cannot help: a number that is not on WhatsApp, a
    # template that was rejected. The queue gives up on these immediately
    # instead of burning three attempts on a certain failure.
    retryable: bool = True
    raw: Dict[str, Any] = field(default_factory=dict)


class Provider:
    """The interface every messaging service implements."""

    name = "base"

    def send(self, to: str, template: str, values: List[str], *,
             parameter_names: Optional[List[str]] = None,
             header_media_id: Optional[str] = None,
             header_image: Optional[bytes] = None,
             header_mime: str = "image/jpeg") -> MessageResult:
        raise NotImplementedError

    @property
    def live(self) -> bool:
        """True when messages actually leave the building."""
        return False


class LogOnlyProvider(Provider):
    """
    Writes the message to the log instead of sending it.

    The default until the WhatsApp account is live. Everything else behaves
    exactly as it will in production — the trigger, the queue, the retries, the
    recorded outcome — so the only untested step on the day the credentials
    arrive is the HTTP call itself.
    """

    name = "log"

    def send(self, to: str, template: str, values: List[str], *,
             parameter_names: Optional[List[str]] = None,
             header_media_id: Optional[str] = None,
             header_image: Optional[bytes] = None,
             header_mime: str = "image/jpeg") -> MessageResult:
        logger.info(
            "[MESSAGE] would send to %s | template=%s | values=%s",
            to, template, " | ".join(values),
        )
        return MessageResult(ok=True, message_id=f"log-{int(time.time() * 1000)}")


class DisabledProvider(Provider):
    """Sends nothing and says so once per message, for a site that does not want it."""

    name = "none"

    def send(self, to: str, template: str, values: List[str], *,
             parameter_names: Optional[List[str]] = None,
             header_media_id: Optional[str] = None,
             header_image: Optional[bytes] = None,
             header_mime: str = "image/jpeg") -> MessageResult:
        return MessageResult(ok=False, error="Messaging is switched off", retryable=False)


def get_provider(name: str) -> Provider:
    """
    The provider named in MESSAGING_PROVIDER, or the log-only one.

    An unknown name falls back to log-only rather than raising: a typo in a
    setting must not stop the kiosk from checking visitors in.
    """
    key = (name or "").strip().lower()

    if key in ("meta", "whatsapp", "cloud"):
        # Imported here so a site with no WhatsApp account never loads it.
        from core.config import CONFIG
        from .whatsapp import WhatsAppCloudProvider
        return WhatsAppCloudProvider(
            CONFIG.messaging.WHATSAPP_TOKEN,
            CONFIG.messaging.WHATSAPP_PHONE_NUMBER_ID,
            api_version=CONFIG.messaging.WHATSAPP_API_VERSION,
            language=CONFIG.messaging.WHATSAPP_LANGUAGE,
        )

    providers = {
        "log": LogOnlyProvider,
        "none": DisabledProvider,
        "": LogOnlyProvider,
    }
    chosen = providers.get(key)
    if chosen is None:
        logger.warning(
            "Unknown MESSAGING_PROVIDER %r — falling back to log-only. Add the "
            "provider to core/messaging/providers.py when its credentials arrive.",
            name,
        )
        chosen = LogOnlyProvider
    return chosen()
