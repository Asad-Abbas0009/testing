"""
WhatsApp Cloud API (Meta) — the provider that actually sends.

One POST per message to

    https://graph.facebook.com/<version>/<phone number id>/messages

A business cannot send free text to somebody who has not messaged it first, so
every check-in message is a **template** approved by Meta in advance: the
wording is fixed on their side and only the {{1}}, {{2}} … values travel with
each send. That is why this takes a template name and a list of values rather
than a finished sentence.

Uses urllib from the standard library rather than adding a dependency: the
payload is a small piece of JSON and the queue already handles retries.
"""

from __future__ import annotations

import json
import secrets
import urllib.error
import urllib.request
from typing import List, Optional

from utils.logger import get_logger

from .providers import MessageResult, Provider

logger = get_logger(__name__)

# Meta error codes that no amount of retrying will fix. Everything else — a
# timeout, a rate limit, a 500 — is worth another attempt.
#   131026  message undeliverable (the number is not on WhatsApp)
#   131030  not on the test number's allowed list — someone has to add it first
#   131047  outside the 24-hour window and no template applies
#   131051  unsupported message type
#   132000-132015  template problems: missing, wrong parameter count, not approved
_PERMANENT_CODES = {131026, 131030, 131047, 131051, 132000, 132001, 132005,
                    132007, 132012, 132015}


class WhatsAppCloudProvider(Provider):
    """Sends through Meta's own Cloud API."""

    name = "meta"

    def __init__(self, token: str, phone_number_id: str, *,
                 api_version: str = "v21.0", language: str = "en",
                 timeout: float = 10.0):
        self.token = (token or "").strip()
        self.phone_number_id = (phone_number_id or "").strip()
        self.api_version = api_version
        self.language = language
        self.timeout = timeout
        self._url = (f"https://graph.facebook.com/{self.api_version}/"
                     f"{self.phone_number_id}/messages")
        if not self.token or not self.phone_number_id:
            logger.error(
                "WhatsApp provider is missing its settings (token: %s, phone number id: "
                "%s) — messages will fail until both are set in Backend/.env",
                "set" if self.token else "MISSING",
                "set" if self.phone_number_id else "MISSING",
            )

    @property
    def live(self) -> bool:
        return bool(self.token and self.phone_number_id)

    def send(self, to: str, template: str, values: List[str], *,
             parameter_names: Optional[List[str]] = None,
             header_media_id: Optional[str] = None,
             header_image: Optional[bytes] = None,
             header_mime: str = "image/jpeg") -> MessageResult:
        if not self.live:
            return MessageResult(
                ok=False, retryable=False,
                error="WhatsApp is not configured (token or phone number id missing)")

        if header_image and not header_media_id:
            uploaded = self._upload_media(header_image, header_mime or "image/jpeg")
            if not uploaded.ok:
                return uploaded
            header_media_id = uploaded.message_id

        payload = self.build_payload(
            to, template, values,
            parameter_names=parameter_names,
            header_media_id=header_media_id,
        )

        request = urllib.request.Request(
            self._url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8") or "{}")
            message_id = (body.get("messages") or [{}])[0].get("id", "")
            return MessageResult(ok=True, message_id=message_id, raw=body)

        except urllib.error.HTTPError as e:
            return self._from_http_error(e)
        except urllib.error.URLError as e:
            # No route to Meta: the site's connection, not the message.
            return MessageResult(ok=False, error=f"Could not reach WhatsApp: {e.reason}")
        except Exception as e:
            return MessageResult(ok=False, error=f"{type(e).__name__}: {e}")

    def build_payload(self, to: str, template: str, values: List[str], *,
                      parameter_names: Optional[List[str]] = None,
                      header_media_id: Optional[str] = None) -> dict:
        """
        Meta template body. Parameter count follows `values`.

        Positional templates get {"type","text"} only. Named templates also get
        parameter_name, one per value, in the same order. A template with no
        variables must omit the body component; an empty list is rejected.

        header_media_id is a Meta media id from _upload_media. A filesystem
        path or localhost URL is never placed here.
        """
        payload = {
            "messaging_product": "whatsapp",
            # Meta wants digits only, no "+".
            "to": to.lstrip("+"),
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": self.language},
            },
        }
        components = []
        if header_media_id:
            components.append({
                "type": "header",
                "parameters": [{
                    "type": "image",
                    "image": {"id": str(header_media_id)},
                }],
            })
        if values:
            names = parameter_names or []
            parameters = []
            for index, value in enumerate(values):
                parameter = {"type": "text", "text": str(value)}
                if index < len(names) and names[index]:
                    parameter["parameter_name"] = str(names[index])
                parameters.append(parameter)
            components.append({"type": "body", "parameters": parameters})
        if components:
            payload["template"]["components"] = components
        return payload

    def _upload_media(self, image: bytes, mime: str = "image/jpeg") -> MessageResult:
        """
        Upload image bytes to Meta /{phone-number-id}/media and return the id.

        The id is what an IMAGE-header template accepts. The request body is the
        image itself, never a local path or a URL.
        """
        if not image:
            return MessageResult(ok=False, retryable=False, error="No image to upload")

        boundary = "vms-media-" + secrets.token_hex(8)
        filename = "visitor-pass.jpg" if "jpeg" in mime or "jpg" in mime else "visitor-pass.png"
        fields = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="messaging_product"\r\n\r\n'
            "whatsapp\r\n"
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="type"\r\n\r\n'
            f"{mime}\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {mime}\r\n\r\n"
        ).encode("utf-8")
        body = fields + image + f"\r\n--{boundary}--\r\n".encode("utf-8")
        url = (f"https://graph.facebook.com/{self.api_version}/"
               f"{self.phone_number_id}/media")
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=max(self.timeout, 30.0)) as response:
                payload = json.loads(response.read().decode("utf-8") or "{}")
            media_id = str(payload.get("id") or "")
            if not media_id:
                return MessageResult(ok=False, error="WhatsApp media upload returned no id",
                                     raw=payload)
            logger.info("WhatsApp media uploaded (%d bytes)", len(image))
            return MessageResult(ok=True, message_id=media_id, raw=payload)
        except urllib.error.HTTPError as e:
            return self._from_http_error(e)
        except urllib.error.URLError as e:
            return MessageResult(ok=False, error=f"Could not reach WhatsApp: {e.reason}")
        except Exception as e:
            return MessageResult(ok=False, error=f"{type(e).__name__}: {e}")

    # ── Errors ───────────────────────────────────────────────────────────────

    def _from_http_error(self, e: "urllib.error.HTTPError") -> MessageResult:
        try:
            body = json.loads(e.read().decode("utf-8") or "{}")
        except Exception:
            body = {}
        error = body.get("error") or {}
        code = error.get("code")
        title = error.get("error_user_title") or ""
        message = error.get("message") or f"HTTP {e.code}"
        detail = (error.get("error_data") or {}).get("details")
        if detail:
            message = f"{message} — {detail}"

        # A bad token or a template that does not exist is a configuration
        # problem: retrying sends the same broken request three times.
        permanent = (
            e.code in (400, 401, 403)
            and (code in _PERMANENT_CODES or e.code in (401, 403))
        ) or code in _PERMANENT_CODES

        # Code, title and message only — never the token, app secret, verify
        # token, or Authorization header.
        logger.error(
            "WhatsApp API error HTTP %s code %s title %s: %s",
            e.code, code if code is not None else "-", title or "-", message,
        )
        stored = message
        if title:
            stored = f"{title}: {stored}"
        if code is not None:
            stored = f"[{code}] {stored}"
        return MessageResult(ok=False, error=stored, retryable=not permanent,
                             raw=body)
