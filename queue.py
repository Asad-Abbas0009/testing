"""
When a message is sent.

A visitor standing at the kiosk must never wait on a messaging service. The
endpoints hand a message to this queue and return straight away; a background
worker does the sending, retries a failure a few times, and gives up quietly
rather than blocking anything.

Deliberately small: a thread, a queue and a retry counter. At a few hundred
visitors a day there is nothing here worth a broker.
"""

from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from utils.logger import get_logger

from .providers import MessageResult, Provider

logger = get_logger(__name__)


@dataclass
class OutboundMessage:
    """One message waiting to go out."""

    to: str
    template: str
    values: List[str]
    # Set for a named-parameter template (Meta parameter_format=NAMED).
    # Left empty for positional templates, including ones with no variables.
    parameter_names: Optional[List[str]] = None
    # Meta media id for an IMAGE header, already uploaded. Never a file path.
    header_media_id: Optional[str] = None
    # Image bytes to upload first when the template header needs a media id.
    header_image: Optional[bytes] = None
    header_mime: str = "image/jpeg"
    # For recording the outcome against the right visit.
    visitor_id: Optional[int] = None
    visit_id: Optional[int] = None
    kind: str = "check_in"

    attempts: int = 0
    # Set when a failed attempt should not be retried before this moment.
    not_before: float = 0.0
    queued_at: float = field(default_factory=time.monotonic)


class MessageQueue:
    """
    A background sender.

    `on_result` is called after each final outcome — success, or the last failed
    attempt — so the caller can record it wherever it keeps history. It runs on
    the worker thread and must not raise; anything it throws is logged and
    swallowed, because a bookkeeping error must not kill the sender.
    """

    def __init__(self, provider: Provider, *, max_attempts: int = 3,
                 retry_delays: tuple = (5.0, 30.0), max_queued: int = 500,
                 on_result: Optional[Callable[[OutboundMessage, MessageResult], None]] = None):
        self.provider = provider
        self.max_attempts = max(1, max_attempts)
        self.retry_delays = retry_delays
        self.on_result = on_result
        self._q: "queue.Queue[OutboundMessage]" = queue.Queue(maxsize=max_queued)
        self._stop = threading.Event()
        self._worker = threading.Thread(target=self._run, name="messages", daemon=True)
        self._worker.start()
        logger.info("Message queue started (provider: %s, %s)",
                    provider.name, "live" if provider.live else "not sending")

    # ── Public ───────────────────────────────────────────────────────────────

    def send(self, message: OutboundMessage) -> bool:
        """
        Put a message on the queue. Returns immediately.

        False means the queue is full — which would take a service that has been
        unreachable for a long time. The message is dropped rather than allowed
        to grow without limit, and said so in the log.
        """
        if not message.to:
            logger.warning("Message skipped: no number for visitor %s", message.visitor_id)
            return False
        try:
            self._q.put_nowait(message)
            return True
        except queue.Full:
            logger.error("Message queue is full (%d waiting) — dropping the message to %s",
                         self._q.qsize(), message.to)
            return False

    @property
    def waiting(self) -> int:
        return self._q.qsize()

    def stop(self) -> None:
        self._stop.set()

    # ── Worker ───────────────────────────────────────────────────────────────

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                message = self._q.get(timeout=0.5)
            except queue.Empty:
                continue

            try:
                # Not due yet: put it back and let something else go first, so a
                # message waiting out its backoff never blocks the rest.
                if message.not_before and time.monotonic() < message.not_before:
                    self._q.put_nowait(message)
                    time.sleep(0.2)
                    continue
                self._attempt(message)
            except Exception:
                logger.exception("Message worker error — dropping this message")
            finally:
                self._q.task_done()

    def _attempt(self, message: OutboundMessage) -> None:
        message.attempts += 1
        try:
            result = self.provider.send(
                message.to, message.template, message.values,
                parameter_names=message.parameter_names,
                header_media_id=message.header_media_id,
                header_image=message.header_image,
                header_mime=message.header_mime,
            )
        except Exception as e:
            result = MessageResult(ok=False, error=f"{type(e).__name__}: {e}")

        if result.ok:
            logger.info("Message sent to %s (%s, attempt %d, id %s)",
                        message.to, message.kind, message.attempts, result.message_id or "-")
            self._record(message, result)
            return

        last_try = message.attempts >= self.max_attempts or not result.retryable
        if last_try:
            logger.error("Message to %s failed for good after %d attempt(s): %s",
                         message.to, message.attempts, result.error)
            self._record(message, result)
            return

        delay = self.retry_delays[min(message.attempts - 1, len(self.retry_delays) - 1)]
        message.not_before = time.monotonic() + delay
        logger.warning("Message to %s failed (%s) — retrying in %.0fs",
                       message.to, result.error, delay)
        try:
            self._q.put_nowait(message)
        except queue.Full:
            logger.error("Queue full — giving up on the message to %s", message.to)
            self._record(message, result)

    def _record(self, message: OutboundMessage, result: MessageResult) -> None:
        if self.on_result is None:
            return
        try:
            self.on_result(message, result)
        except Exception:
            logger.exception("Could not record the outcome of the message to %s", message.to)
