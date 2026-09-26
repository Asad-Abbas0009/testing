"""
VMS kiosk backend — FastAPI server and vision pipeline (entry point).

Run from the Backend/ directory:  python api.py   (serves on CONFIG.api.PORT, default 8007)

One VisionSystem instance owns the whole pipeline. A background thread
(_run_loop) processes every new camera frame:

    QR scan -> face presence -> FaceMesh landmarks -> quality gate
      -> liveness (LivenessDetector) -> smile (blendshape or geometric detector)
      -> face recognition (ArcFace in a background thread, match in PostgreSQL)

DecisionEngine holds the access state; get_state() turns it into GET /state,
holding GRANTED back until recognition has answered. It also writes the
SIGN_IN / SIGN_OUT row, at the moment GRANTED is reported — a scan that is
abandoned or denied is never recorded as a visit.

HTTP routes used by the kiosk frontend:
    POST /camera/start   new visitor session (mode check-in / check-out)
    POST /camera/frame   JPEG frame upload from the browser camera
    GET  /state          pipeline state, polled every 200 ms
    POST /camera/stop    reset after a result
    POST /register       enrol a new visitor with the captured face
    POST /log_exit       record a check-out
    GET  /video_frame    single JPEG of the latest frame (photo fallback)
Staff-only routes (all need the X-Admin-Key header):
    GET  /admin/presence  who is on site now, with time on site
    GET  /admin/visits    visits for a day, with duration
    GET  /admin/visitors  search enrolled visitors
    GET    /admin/trends                visits per day over a period
    GET    /admin/visitors/all          everyone enrolled, with totals
    GET    /admin/visitor/<id>          one visitor: profile, stats, visits
    PATCH  /admin/visitor/<id>          correct their details
    POST   /admin/visitor/<id>/status   block or reinstate
    POST   /admin/visitor/<id>/consent  record or clear consent
    POST   /admin/checkout-all          close every open visit
    POST   /admin/visitor/<id>/merge    fold a duplicate record into this one
    DELETE /admin/visitor/<id>          erase the visitor
    POST /admin/checkout  check a visitor out by hand
    GET  /admin/logs      raw activity rows
    GET  /snapshots/<f>   one visitor photo (or a signed link)
Reception board: GET /board — who is on site, no key (BOARD_ENABLED).
Other routes: POST /reset.
"""
import base64
import hashlib
import secrets
import hmac
import json
import os
import cv2
import threading
import time
import numpy as np
import mediapipe as mp
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import Body, Depends, FastAPI, Header, HTTPException, Response, Request
import psycopg2
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from core.camera.camera_service import CameraService
from core.vision.face_detector import FaceDetector
from core.vision.smile_detector import SmileDetector
from core.vision.blendshape_smile_detector import BlendshapeSmileDetector
from core.vision.liveness_detector import LivenessDetector
from core.vision.face_recognizer import FaceRecognizer
from core.messaging import MessageQueue, OutboundMessage, get_provider
from core.validation import ValidationError, clean_profile_edit, clean_registration
from core.engine.decision_engine import DecisionEngine, AccessState
from core.database.db_service import DatabaseService
from core.config import CONFIG, TIMEZONE
from utils.logger import get_logger, setup_logging

# Install console + rotating file logging (logs/vms.log) before anything logs.
setup_logging()

logger = get_logger(__name__)

# ── Recognition tuning (all overridable via environment variables) ────────────

# Minimum gap between recognition attempts while the visitor is still unidentified.
# Only one attempt runs at a time; this spaces out the retries.
RECOGNITION_RETRY_SEC = float(os.environ.get("RECOGNITION_RETRY_SEC", "0.35"))

# Minimum time get_state() holds GRANTED back for an unrecognised visitor in
# check-in mode (released after this once enough answers have arrived).
RECOGNITION_GRACE_SEC = float(os.environ.get("RECOGNITION_GRACE_SEC", "0.6"))
# Two uses: (1) the minimum hold in check-out mode, where "not recognised" is a
# dead end, and (2) how long after GRANTED the loop may still START new
# recognition attempts. The hard upper bound on any hold is RECOGNITION_WAIT_MAX_SEC.
RECOGNITION_GRACE_MAX_SEC = float(os.environ.get("RECOGNITION_GRACE_MAX_SEC", "2.6"))

# Number of recent per-attempt embeddings averaged (then re-normalised) before
# matching. Averaging reduces the effect of a single blurred or off-angle frame.
RECOGNITION_FUSE_FRAMES = int(os.environ.get("RECOGNITION_FUSE_FRAMES", "3"))

# Consecutive processed frames without a face before the visitor counts as gone
# (liveness reset, identity cleared). Short drop-outs while someone moves are
# ignored. At the kiosk's ~15 fps upload rate, 8 frames is about half a second.
FACE_LOST_FRAMES = int(os.environ.get("FACE_LOST_FRAMES", "8"))

# How get_state() waits for recognition once the smile is accepted:
# MIN_ANSWERS  completed lookups (match or no-match) needed before concluding
#              "not recognised" (a match releases immediately).
# WAIT_MAX_SEC hard upper bound on the hold, so the kiosk can never stall.
# SLOW_MS      attempts slower than this are logged as a warning.
RECOGNITION_MIN_ANSWERS = int(os.environ.get("RECOGNITION_MIN_ANSWERS", "2"))
RECOGNITION_WAIT_MAX_SEC = float(os.environ.get("RECOGNITION_WAIT_MAX_SEC", "6.0"))
RECOGNITION_SLOW_MS = float(os.environ.get("RECOGNITION_SLOW_MS", "1500"))

# How long the kiosk has to collect a check-out the recognition thread already
# recorded, before that closure is considered stale (see _pending_checkout_ack).
# It only bounds one hand-off within a single scan, so seconds are plenty.
EXIT_DEDUP_SEC = float(os.environ.get("EXIT_DEDUP_SEC", "30"))

# A second face this tall (as a fraction of frame height) counts as another
# person at the kiosk rather than someone in the background. The quality gate
# needs 0.20 for the visitor themselves, so this is deliberately lower.
BYSTANDER_FACE_HEIGHT = float(os.environ.get("BYSTANDER_FACE_HEIGHT", "0.12"))

# The reception wall board (GET /board) shows who is in the building without a
# key — a list nobody can reach during a fire alarm is no use. It carries names
# and how long people have been here, never contact details. Turn it off, or
# drop the photos, where the screen is visible to the public.
BOARD_ENABLED = os.environ.get("BOARD_ENABLED", "true").strip().lower() in ("1", "true", "yes")
BOARD_SHOW_PHOTOS = os.environ.get("BOARD_SHOW_PHOTOS", "true").strip().lower() in ("1", "true", "yes")

# Visitor messages: a check-in confirmation sent to the visitor's own phone.
# Nothing here blocks the kiosk — the queue takes the message and the endpoint
# returns. Until the WhatsApp account is live the provider is "log", which
# writes what it would have sent.
def _record_message(message, result) -> None:
    """
    Write the outcome of a message to the activity log.

    Runs on the queue's worker thread once a message has either been sent or
    failed for the last time, so the staff panel can say what happened and
    offer to send it again.
    """
    if message.visitor_id is None:
        return
    try:
        vision.db.log_event(
            message.visitor_id, "MESSAGE", visit_id=message.visit_id,
            meta={
                "kind": message.kind,
                "status": "sent" if result.ok else "failed",
                "to": message.to,
                "template": message.template,
                "provider": messages.provider.name,
                "attempts": message.attempts,
                "message_id": result.message_id,
                "error": result.error,
                "kiosk": KIOSK_ID,
            },
        )
    except Exception as e:
        logger.error("Could not log the message to %s: %s", message.to, e)


messages = MessageQueue(
    get_provider(CONFIG.messaging.PROVIDER),
    max_attempts=CONFIG.messaging.MAX_ATTEMPTS,
    on_result=_record_message,
)


def notify_check_in(visitor: Dict[str, Any], visit_id: Optional[int] = None,
                    department: str = "", badge_image: Optional[bytes] = None,
                    badge_mime: str = "image/jpeg") -> bool:
    """
    Queue the check-in confirmation for a visitor who has just arrived.

    Called after the visit is open, so a message is only ever sent for a
    check-in that is actually on record. The image is the kiosk visitor badge,
    already drawn for this check-in — this function does not draw another card.
    Failures are the queue's problem: this returns immediately either way.
    """
    if not CONFIG.messaging.ENABLED:
        return False
    phone = str(visitor.get("phone") or "").strip()
    if not phone:
        logger.info("No number on file for visitor %s — no check-in message",
                    visitor.get("id"))
        return False
    if not badge_image:
        logger.info(
            "Check-in message for visitor %s waits for the kiosk badge image",
            visitor.get("id"),
        )
        return False

    try:
        from zoneinfo import ZoneInfo
        when = datetime.now(ZoneInfo(TIMEZONE)).strftime("%I:%M %p").lstrip("0")
    except Exception:
        when = datetime.now(timezone.utc).strftime("%I:%M %p").lstrip("0")

    visitor_id = visitor.get("id")
    visitor_name = str(visitor.get("name") or "Visitor")
    visitor_id_text = str(visitor_id) if visitor_id is not None else ""
    department_text = department or str(visitor.get("department") or "reception")
    # Header image is the badge the kiosk already rendered for this check-in.
    messages.send(OutboundMessage(
        to=phone,
        template=CONFIG.messaging.CHECKIN_TEMPLATE,
        values=[
            visitor_name,
            visitor_id_text,
            when,
            department_text,
        ],
        parameter_names=[
            "visitor_name",
            "visitor_id",
            "checkin_time",
            "department",
        ],
        header_image=badge_image,
        header_mime=badge_mime or "image/jpeg",
        visitor_id=visitor_id,
        visit_id=visit_id,
        kind="check_in",
    ))
    return True


# Which terminal wrote a visit, for sites that run more than one kiosk.
KIOSK_ID = os.environ.get("KIOSK_ID", "main-reception")

# ── Security ─────────────────────────────────────────────────────────────────

# Pass QR codes. A code only grants access when it carries a token this backend
# issued and signed (see issue_pass_token): "<user id>.<expiry>.<signature>".
# A plain {"id": ...} code is rejected, so a printed or guessed id is useless.
QR_ACCESS_ENABLED = os.environ.get("QR_ACCESS_ENABLED", "true").strip().lower() in ("1", "true", "yes")
# HMAC key for those tokens. Without it none can be issued or verified, so QR
# entry is simply unavailable — a kiosk cannot accidentally run unprotected.
PASS_SIGNING_KEY = os.environ.get("PASS_SIGNING_KEY", "").strip()
# How long an issued pass stays valid. A badge is printed once and the visitor
# carries it, so the default is a year; shorten it where passes should expire
# sooner. Losing a badge means the pass is valid until it expires, so keep the
# visitor's record blocked (visitors.status) rather than relying on the clock.
PASS_TOKEN_TTL_SEC = float(os.environ.get("PASS_TOKEN_TTL_SEC", str(365 * 24 * 3600)))


def issue_pass_token(user_id: Any) -> str:
    """
    Signed pass token for a visitor, or "" when signing is not configured.

    Issued only as the result of a verified interaction (a completed
    registration, or a face that has just passed liveness + smile), never on
    request, so a token cannot be minted for an arbitrary visitor id.
    """
    if not PASS_SIGNING_KEY:
        return ""
    try:
        uid = int(user_id)
    except (TypeError, ValueError):
        return ""
    body = f"{uid}.{int(time.time() + PASS_TOKEN_TTL_SEC)}"
    sig = hmac.new(PASS_SIGNING_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def verify_pass_token(token: str) -> Optional[int]:
    """Visitor id from a valid, unexpired token; None if missing, forged or stale."""
    if not PASS_SIGNING_KEY or not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    uid_s, exp_s, sig = parts
    body = f"{uid_s}.{exp_s}"
    expected = hmac.new(PASS_SIGNING_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        if int(exp_s) < time.time():
            return None
        return int(uid_s)
    except ValueError:
        return None

# Key required by the staff-only endpoints (GET /admin/logs and the visitor
# snapshots), sent as the X-Admin-Key header. Both hold personal data and
# neither is used by the kiosk UI, so while this is unset they stay closed.
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY", "").strip()

app = FastAPI()

# Visitor snapshots (paths are stored in logs.snapshot_path) live here. They are
# photographs of people, so they are served by the guarded route below rather
# than mounted as public static files.
if not os.path.exists("snapshots"):
    os.makedirs("snapshots")
SNAPSHOT_DIR = Path("snapshots").resolve()


def require_admin(x_admin_key: str = Header(default="")) -> None:
    """
    Gate for the staff-only endpoints. Without ADMIN_API_KEY set, they are
    closed to everyone: the backend listens on the network and these expose
    visitor names, emails and face photos.
    """
    if not ADMIN_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Staff endpoints are disabled. Set ADMIN_API_KEY in Backend/.env to enable them.",
        )
    if not x_admin_key or not hmac.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key")


# A browser cannot put a key on an <img> request, so photo links are signed and
# short-lived instead (see snapshot_url). The signing key is the pass key or the
# admin key when either is configured; otherwise a random one generated at
# startup, which is enough for links the page fetches straight away.
SNAPSHOT_TOKEN_TTL_SEC = float(os.environ.get("SNAPSHOT_TOKEN_TTL_SEC", "3600"))
LINK_SIGNING_KEY = PASS_SIGNING_KEY or ADMIN_API_KEY or secrets.token_hex(32)


def snapshot_url(snapshot_path: str) -> str:
    """
    Signed, expiring URL for one snapshot, or "" when there is no image.

    Used by the staff dashboard and by the kiosk, which prints the visitor's
    enrolment photo on their badge.
    """
    if not snapshot_path:
        return ""
    name = Path(str(snapshot_path).replace("\\", "/")).name
    if not (SNAPSHOT_DIR / name).is_file():
        return ""
    exp = int(time.time() + SNAPSHOT_TOKEN_TTL_SEC)
    body = f"{name}.{exp}"
    sig = hmac.new(LINK_SIGNING_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"/snapshots/{name}?exp={exp}&sig={sig}"


def _snapshot_link_valid(name: str, exp: str, sig: str) -> bool:
    if not exp or not sig:
        return False
    expected = hmac.new(LINK_SIGNING_KEY.encode(), f"{name}.{exp}".encode(),
                        hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        return int(exp) >= time.time()
    except ValueError:
        return False


@app.get("/snapshots/{filename}")
def get_snapshot(filename: str, exp: str = "", sig: str = "",
                 x_admin_key: str = Header(default="")):
    """
    One visitor snapshot (staff only): either the X-Admin-Key header, or the
    signed ?exp=&sig= link handed out with the staff listings.
    """
    if not _snapshot_link_valid(filename, exp, sig):
        require_admin(x_admin_key)
    path = (SNAPSHOT_DIR / filename).resolve()
    # Never serve anything outside the snapshots directory.
    if path.parent != SNAPSHOT_DIR or not path.is_file():
        raise HTTPException(status_code=404, detail="No such snapshot")
    return FileResponse(path, media_type="image/jpeg")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CONFIG.api.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VisionSystem:
    """
    Owns the models, the camera input and the per-visitor state.

    Threads: _run_loop (started in __init__) processes frames; each recognition
    attempt runs _run_recognition in its own short-lived thread; FastAPI
    handlers call get_state(), reset() and the ingest/registration helpers.
    Shared per-visitor fields are guarded by self._lock.

    A "session" is one kiosk visit: reset() increments _session_id, and results
    from recognition threads of an older session are discarded.
    """

    def __init__(self):
        self.cam = CameraService()
        self.detector = FaceDetector()
        self.smile_det = SmileDetector()
        # Smile scoring backend (SMILE_BACKEND in core/config.py). The blendshape
        # detector only produces the smile score; FaceMesh below still feeds
        # liveness, the quality gate and recognition.
        self.bs_smile = None
        if CONFIG.smile.BACKEND == "blendshape":
            self.bs_smile = BlendshapeSmileDetector()
            if not self.bs_smile.available:
                # Fall back to the geometric detector, and switch to its
                # threshold (the two detectors score on different scales).
                logger.warning(
                    "Blendshape smile model unavailable (%s) — falling back to the "
                    "geometric smile detector with threshold %.2f",
                    self.bs_smile.last_error, CONFIG.smile.GEOMETRY_THRESHOLD,
                )
                self.bs_smile = None
                CONFIG.smile.THRESHOLD = CONFIG.smile.GEOMETRY_THRESHOLD
        logger.info(
            "Smile backend: %s (threshold %.2f)",
            "blendshape" if self.bs_smile else "geometry", CONFIG.smile.THRESHOLD,
        )
        self.liveness = LivenessDetector()
        self.recognizer = FaceRecognizer()
        self.db = DatabaseService()
        self.engine = DecisionEngine()
        self.qr_detector = cv2.QRCodeDetector()
        # Still-image FaceMesh for manual-entry photos. Separate from the video-mode
        # mesh used by the vision loop, created on first use, one call at a time.
        self._photo_mesh = None
        self._photo_mesh_lock = threading.Lock()
        
        self._session_id = 0
        self._recognition_running = False
        
        # FaceMesh: the landmark source shared by the quality gate, liveness,
        # the geometric smile detector and face alignment. One face, video mode.
        # reset() replaces it between visitors, so every use is guarded: closing
        # one while the vision loop is inside process() kills the loop thread.
        self._mesh_lock = threading.Lock()
        self._mp_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            # Two, not one: with a single slot the pipeline would silently pick
            # one of two people and act on the wrong visitor. The loop refuses
            # to proceed while more than one face is close enough to count.
            max_num_faces=2,
            refine_landmarks=True,
            min_detection_confidence=0.3,
            min_tracking_confidence=0.3
        )
        
        self.frame_count = 0
        self.last_frame = None
        self.last_embedding = None
        self.recognized_visitor = None

        # Enrolment buffer: the latest embedding + frame from recognition, used
        # by POST /register. The kiosk calls /camera/stop (reset) before showing
        # the registration form, so these deliberately survive reset(). They are
        # cleared by POST /camera/start (new visitor) and kept after a successful
        # registration so a repeated submit resolves to the same user.
        self.pending_embedding = None
        self.pending_frame = None
        # Best smile of this session, for the confirmation screen only.
        self._best_smile_frame = None
        self._best_smile_score = 0.0
        # Lowest session id allowed to write the enrolment buffer. /camera/start
        # raises it, so a late thread from the previous visitor cannot overwrite it.
        self._pending_floor = 0

        self.running = False
        self._lock = threading.Lock()
        self.liveness_started = False
        self._browser_mode = CONFIG.camera.SOURCE == "browser"

        # Timestamp of the last frame processed by _run_loop, so the same frame
        # is never processed twice.
        self._last_processed_ts = None
        # When the last recognition attempt started (spacing: RECOGNITION_RETRY_SEC).
        self._last_recognition_ts = 0.0
        # Recent embeddings for the current visitor (up to RECOGNITION_FUSE_FRAMES),
        # averaged before matching. Cleared whenever the visitor changes.
        self._emb_buffer = []
        # Consecutive processed frames with no face (see FACE_LOST_FRAMES).
        self._no_face_frames = 0
        # Recognition lookups that completed (match or no-match) for the current
        # visitor. get_state() holds GRANTED until this reaches MIN_ANSWERS.
        self._rec_attempts_done = 0
        # User ids whose SIGN_IN/SIGN_OUT row + snapshot were already written this
        # session (by get_state() when GRANTED is reported), so one visit is
        # logged once. Cleared in reset().
        self._logged_this_session = set()
        # One departure is handled twice: the recognition thread closes the
        # visit, then the kiosk's /log_exit arrives for the same scan. This
        # holds the closure the kiosk has not acknowledged yet, so that second
        # call confirms the check-out instead of reporting the visitor as never
        # checked in — and so a *later* scan, which is a new intent, is told the
        # truth rather than being wished goodbye again.
        #   visitor_id -> {"visit_id", "minutes", "at"}
        # Each entry is used once. Not cleared by reset(), because the kiosk
        # calls /camera/stop before /log_exit.
        self._pending_checkout_ack = {}
        # When get_state() first saw GRANTED while holding for recognition, and
        # whether that hold has been released (so the release happens once).
        self._granted_at = None
        self._grace_released = False
        from core.camera.frame_buffer import FrameBuffer
        # Latest frame uploaded by the browser; camera_live is false once it is
        # more than 3 s old.
        self.browser_buffer = FrameBuffer(stale_threshold=3.0)

        # Snapshot images are written here (relative to the working directory)
        self.snapshot_dir = Path("snapshots")
        self.snapshot_dir.mkdir(exist_ok=True)
        
        # Start the vision loop now; a local webcam is only opened by /camera/start
        # when source is "local".
        self.running = True
        threading.Thread(target=self._run_loop, daemon=True).start()

    def embedding_from_photo(self, frame: np.ndarray):
        """
        Face embedding from a single still photo (manual entry), or None if no
        usable face is found. Same alignment + ArcFace model as live recognition.
        """
        with self._photo_mesh_lock:
            if self._photo_mesh is None:
                self._photo_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                )
            result = self._photo_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if not result.multi_face_landmarks:
            return None
        aligned = self.recognizer.align_face(frame, result.multi_face_landmarks[0].landmark)
        if aligned is None:
            return None
        return self.recognizer.get_embedding(aligned)

    def _record_visit(self, visitor: Dict[str, Any], action: str, session_id: int) -> None:
        """
        Open or close this visitor's visit (runs in its own thread).

        A check-in opens a visit row and a check-out closes it, so a visit is a
        record rather than something inferred later by pairing log rows. No
        photo is taken here: the reference photo is captured once, at
        registration (see POST /register).
        """
        visitor_id = visitor["id"]
        try:
            checkin_department = ""
            if action == "SIGN_OUT":
                closed = self.db.close_visit(visitor_id, method="face")
                visit_id = closed["visit_id"] if closed else None
                if closed is not None:
                    # Wait for the kiosk's /log_exit to collect this.
                    with self._lock:
                        self._pending_checkout_ack[visitor_id] = {
                            "visit_id": closed["visit_id"],
                            "minutes": closed["minutes"],
                            "at": time.monotonic(),
                        }
                if closed is None:
                    # Nothing to close: they never checked in, or the visit was
                    # expired earlier. The kiosk tells them so (see /log_exit).
                    logger.info("Check-out for visitor %s who had no open visit", visitor_id)
                    self.db.log_event(visitor_id, "SIGN_OUT",
                                      meta={"no_open_visit": True, "kiosk": KIOSK_ID})
                    return
            else:
                # Purpose and department belong to the visit. A returning
                # visitor keeps what they gave on their last visit until the
                # kiosk asks again.
                last = self.db.last_visit_details(visitor_id)
                checkin_department = str(last.get("department") or "")
                visit_id = self.db.open_visit(
                    visitor_id,
                    purpose=last.get("purpose"),
                    department=last.get("department"),
                    kiosk_id=KIOSK_ID,
                )
            self.db.log_event(visitor_id, action, visit_id=visit_id,
                              meta={"mode": self.engine.mode, "kiosk": KIOSK_ID})
            logger.info("[AI] %s recorded for %s (visit %s)", action, visitor.get("name"), visit_id)
            # The visit is on record, so the visitor can be told about it.
            if action != "SIGN_OUT":
                notify_check_in(visitor, visit_id, checkin_department)
        except Exception as e:
            # Let the visitor through; the row can be missing, the kiosk cannot hang.
            logger.error("Failed to record %s for %s: %s", action, visitor_id, e)
            with self._lock:
                if session_id == self._session_id:
                    self._logged_this_session.discard(visitor_id)

    def enrolment_photo_url(self, visitor_id) -> str:
        """Signed link to the visitor's reference photo, or "" if they have none."""
        try:
            path = self.db.enrolment_photo_path(int(visitor_id))
        except Exception as e:
            logger.debug("Could not look up the enrolment photo for %s: %s", visitor_id, e)
            return ""
        return snapshot_url(path) if path else ""

    def save_enrolment_photo(self, frame: np.ndarray, visitor_id: int) -> str:
        """
        Save the visitor's reference photo and record it.

        This is the only image the kiosk keeps: taken once, at registration.
        Check-ins and check-outs identify people against the stored embedding,
        so photographing them again each time would pile up biometric data
        without answering any question the visit record cannot.

        A visitor who registers again (the duplicate guard recognised their
        face) already has a reference picture, so nothing new is written.
        """
        try:
            if self.db.has_enrolment_photo(visitor_id):
                logger.info("Visitor %s already has a reference photo — keeping it", visitor_id)
                return ""
        except Exception as e:
            logger.warning("Could not check for an existing reference photo: %s", e)

        filename = f"{visitor_id}_{int(time.time())}_ENROLMENT.jpg"
        path = self.snapshot_dir / filename
        cv2.imwrite(str(path), frame)
        try:
            data = path.read_bytes()
            self.db.save_photo(
                visitor_id, str(path), kind="enrolment",
                sha256=hashlib.sha256(data).hexdigest(), size=len(data),
            )
        except Exception as e:
            logger.error("Saved %s but could not record it: %s", path, e)
        return str(path)

    def _run_recognition(self, aligned_face, frame, landmarks, session_id):
        """
        One recognition attempt (runs in its own thread).

        embedding -> enrolment buffer -> fuse with recent embeddings ->
        db.find_match -> on a match: recognized_visitor. Every step is timed and
        logged. Results are dropped if the session changed meanwhile. The visit
        visit itself is opened or closed later, by get_state() (see _record_visit).
        """
        t_start = time.monotonic()
        try:
            emb = self.recognizer.get_embedding(aligned_face)
            emb_ms = (time.monotonic() - t_start) * 1000
            if emb is None:
                logger.warning("[AI] Recognition attempt produced no embedding (%.0f ms)", emb_ms)
            if emb is not None:
                with self._lock:
                    # Update the enrolment buffer before the session check: the
                    # kiosk often calls /camera/stop (new session id) while this
                    # attempt is still running, yet /register still needs this
                    # face. _pending_floor stops threads from before the latest
                    # /camera/start from writing it.
                    if session_id >= self._pending_floor:
                        self.pending_embedding = emb
                        self.pending_frame = frame

                    if session_id != self._session_id:
                        # Session ended while ArcFace ran: log it and stop here.
                        logger.warning(
                            "[AI] Recognition attempt abandoned before lookup: session %d "
                            "ended while ArcFace ran (embedding %.0f ms)", session_id, emb_ms,
                        )
                        return
                    self.last_embedding = emb

                    # Add to the rolling buffer and match on the average of the
                    # recent embeddings rather than on one frame.
                    self._emb_buffer.append(emb)
                    if len(self._emb_buffer) > RECOGNITION_FUSE_FRAMES:
                        self._emb_buffer.pop(0)
                    fused = np.mean(np.asarray(self._emb_buffer, dtype=np.float32), axis=0)
                    n_fused = len(self._emb_buffer)

                norm = float(np.linalg.norm(fused))
                if norm > 1e-10:
                    fused = fused / norm

                t_lookup = time.monotonic()
                match = self.db.find_match(fused)
                lookup_ms = (time.monotonic() - t_lookup) * 1000
                total_ms = (time.monotonic() - t_start) * 1000

                with self._lock:
                    current = session_id == self._session_id
                    if current:
                        # Count every answer (match or no-match); get_state()
                        # waits for RECOGNITION_MIN_ANSWERS of them.
                        self._rec_attempts_done += 1
                        if match:
                            self.recognized_visitor = match

                timing = f"embedding={emb_ms:.0f}ms lookup={lookup_ms:.0f}ms total={total_ms:.0f}ms"
                if not current:
                    logger.warning(
                        "[AI] Recognition attempt abandoned after lookup: session %d ended "
                        "(%s, result=%s)", session_id, timing,
                        f"{match.get('name')} {match.get('similarity', -1.0):.3f}" if match else "no match",
                    )
                    return
                if match:
                    logger.info(
                        "[AI] Matched %s (id=%s) similarity=%.3f from %d fused frame(s) [%s]",
                        match.get("name"), match.get("id"),
                        match.get("similarity", -1.0), n_fused, timing,
                    )
                else:
                    logger.info("[AI] No match from %d fused frame(s) [%s]", n_fused, timing)
                if total_ms > RECOGNITION_SLOW_MS:
                    logger.warning("[AI] Slow recognition attempt: %s", timing)
                # Recognising someone is not yet a visit: the visit row is
                # opened or closed by get_state() once the result is actually
                # reported as GRANTED (see _record_visit), so a scan that is
                # abandoned or ends in DENIED is never recorded as a visit.
        except Exception as e:
            logger.error(f"Background recognition error: {e}")
        finally:
            with self._lock:
                if session_id == self._session_id:
                    self._recognition_running = False

    def start_local_camera(self) -> None:
        """Open the local OpenCV webcam (CAMERA_SOURCE / source "local")."""
        if not self.cam.is_active():
            self.cam.start()

    def stop_local_camera(self) -> None:
        """Release the OpenCV webcam so other apps can use it."""
        self.cam.stop()

    def ingest_browser_frame(self, frame: np.ndarray) -> None:
        """Store a decoded frame uploaded by the kiosk browser (POST /camera/frame)."""
        self.browser_buffer.update(frame, time.monotonic())

    def _acquire_frame(self):
        """(frame, timestamp) from the browser buffer or the local webcam."""
        if self._browser_mode:
            return self.browser_buffer.get_latest()
        if not self.cam.is_active():
            return None, None
        return self.cam.get_frame()

    def _run_loop(self):
        """
        Vision loop: runs forever in a daemon thread, processing each new frame
        once.

        Every pass is wrapped: an error here used to kill the thread outright,
        and a dead vision loop looks exactly like a kiosk that never sees
        anyone — frames still arrive, the camera still reads as live, and the
        scan simply never progresses. Better to log the frame and carry on.
        """
        previous_state = AccessState.IDLE

        while self.running:
            try:
                frame, frame_ts = self._acquire_frame()
                if frame is None:
                    time.sleep(0.01)
                    continue

                # Skip a frame that was already processed (the browser buffer keeps
                # returning its last frame until a new one arrives).
                if frame_ts is not None and frame_ts == self._last_processed_ts:
                    # engine.tick() must still run so GRANTED/DENIED auto-resets.
                    self.engine.tick()
                    time.sleep(0.005)
                    continue
                self._last_processed_ts = frame_ts

                self.frame_count += 1
                self.engine.tick()
                h, w = frame.shape[:2]

                state_now = self.engine.get_state().state
                # The engine auto-reset GRANTED/DENIED -> IDLE (tick). Clear the
                # visitor data it does not own, so the next person is recognised afresh.
                if state_now == AccessState.IDLE and previous_state in (AccessState.GRANTED, AccessState.DENIED):
                    logger.info("[AI] FSM auto-reset detected — clearing visitor identity.")
                    with self._lock:
                        self.recognized_visitor = None
                        self.last_embedding = None
                        self._emb_buffer = []
                        self._rec_attempts_done = 0
                        self._granted_at = None
                        self._grace_released = False
                    state_now = AccessState.IDLE
                previous_state = state_now

                # 0. QR CODE (every 2nd frame): a pass QR whose "t" field holds a
                #    token this backend signed loads that visitor and forces
                #    GRANTED, skipping liveness and smile. Anything else — an
                #    unsigned {"id": ...}, a forged or expired token — is ignored.
                if QR_ACCESS_ENABLED and PASS_SIGNING_KEY and self.frame_count % 2 == 0:
                    qr_val, _, _ = self.qr_detector.detectAndDecode(frame)
                    if qr_val:
                        try:
                            data = json.loads(qr_val)
                        except Exception:
                            data = None
                        if isinstance(data, dict):
                            user_id = verify_pass_token(str(data.get("t") or ""))
                            if user_id is not None:
                                match = self.db.get_visitor(user_id)
                                if match:
                                    with self._lock:
                                        self.recognized_visitor = match
                                    self.engine.trigger_manual_override()
                                    logger.info("[QR] Valid pass for %s (id=%s)",
                                                match["name"], user_id)
                                else:
                                    logger.warning("[QR] Valid pass for unknown user id=%s", user_id)
                            elif data.get("id") or data.get("t"):
                                logger.warning(
                                    "[QR] Rejected pass code: no valid signature "
                                    "(unsigned, forged or expired)"
                                )

                # 1. FACE PRESENCE + LANDMARKS: while IDLE, run the cheap FaceDetector
                #    (every 2nd frame) and only run FaceMesh once it finds a face;
                #    otherwise run FaceMesh on every frame.
                has_face = False
                if state_now != AccessState.IDLE:
                    has_face = True
                else:
                    # Checking every 2nd frame keeps the reaction to a new visitor quick.
                    if self.frame_count % 2 == 0:
                        bbox, conf = self.detector.detect(frame)
                        if bbox is not None:
                            has_face = True

                if has_face:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    with self._mesh_lock:
                        mesh_results = self._mp_mesh.process(rgb)
                else:
                    mesh_results = None

                # Get current state from engine
                state_now = self.engine.get_state().state

                if mesh_results and mesh_results.multi_face_landmarks:
                    self._no_face_frames = 0
                    if self.frame_count % 30 == 0: print("[AI] Landmarks Active")

                    # Faces close enough to be the visitor rather than someone
                    # walking past in the background.
                    faces = [f.landmark for f in mesh_results.multi_face_landmarks]
                    heights = [abs(f[10].y - f[152].y) for f in faces]
                    near = [f for f, h in zip(faces, heights) if h >= BYSTANDER_FACE_HEIGHT]

                    if len(near) > 1:
                        # Two people in front of the camera: acting now would
                        # check in — or check out — whichever face happened to
                        # come first. Wait until one of them steps aside.
                        self.engine.notify_quality(False, "One person at a time, please")
                        with self._lock:
                            self.last_frame = frame
                        continue

                    # The largest face is the one standing at the kiosk.
                    landmarks = near[0] if near else faces[int(np.argmax(heights))]
                    self.engine.notify_face_detected() 
                
                    # Refresh state after notification
                    state_now = self.engine.get_state().state
                
                    # --- QUALITY GATE (skips the rest of this frame on failure) ---
                    # a) Proximity: forehead-to-chin must span at least 20% of frame height
                    face_height = abs(landmarks[10].y - landmarks[152].y)
                    if face_height < 0.20:
                        self.engine.notify_quality(False, "Please move closer to the camera")
                        with self._lock: self.last_frame = frame
                        continue
                
                    # b) Brightness: mean pixel value must be at least 35
                    avg_brightness = np.mean(frame)
                    if avg_brightness < 35:
                        self.engine.notify_quality(False, "Lighting is too low")
                        with self._lock: self.last_frame = frame
                        continue
                    # If we passed quality, clear previous warnings and start liveness
                    self.engine.notify_quality(True, "")
                
                    if state_now == AccessState.FACE_DETECTED:
                        self.engine.notify_liveness_started()
                        state_now = self.engine.get_state().state 
                        print(f"[AI] Face Ready -> Entering {state_now.name}")
                
                    # 2. LIVENESS (LIVENESS_CHALLENGE): LivenessDetector on these landmarks
                    if state_now == AccessState.LIVENESS_CHALLENGE:
                        if not self.liveness_started:
                            self.liveness.start_challenge()
                            self.liveness_started = True
                            print("[AI] Liveness Challenge Started")
                    
                        res = self.liveness.update(landmarks, w, h)
                        if res.timed_out: 
                            self.liveness_started = False
                            print("[AI] Liveness Timed Out")
                        
                        self.engine.notify_liveness_result(
                            passed=res.passed,
                            timed_out=res.timed_out,
                            blink_count=res.blink_count,
                            head_moved=res.head_moved,
                            hint=res.hint
                        )
                    
                        # Check if liveness just passed to update state_now for the next check
                        if res.passed:
                            print("[AI] Liveness Passed!")
                            state_now = self.engine.get_state().state

                    # 3. SMILE (VERIFYING): score every frame with the active backend;
                    #    the engine smooths it and decides GRANTED.
                    if state_now == AccessState.VERIFYING:
                        if self.bs_smile is not None:
                            score = self.bs_smile.predict_frame(frame, landmarks)
                        else:
                            score = self.smile_det.predict(landmarks, w, h)
                        self.engine.update_smile(score)

                        # Keep the frame where the visitor smiled most, purely to
                        # show them on the confirmation screen. The grab the kiosk
                        # takes itself happens after GRANTED, by which time most
                        # people have already relaxed or looked away. Memory only:
                        # nothing is written to disk, and reset() clears it when the
                        # next visitor steps up.
                        with self._lock:
                            if score > self._best_smile_score:
                                self._best_smile_score = float(score)
                                self._best_smile_frame = frame.copy()

                    # 4. RECOGNITION: runs alongside liveness and smile, in a background
                    #    thread, until the visitor is identified.
                    with self._lock:
                        rec_vis = self.recognized_visitor
                        rec_run = self._recognition_running
                        sess_id = self._session_id
                        granted_at = self._granted_at
                    # Attempts may also start in GRANTED (the smile can finish before
                    # recognition does), but only within RECOGNITION_GRACE_MAX_SEC of
                    # get_state() first holding GRANTED back.
                    if state_now == AccessState.GRANTED:
                        recognition_allowed = (
                            granted_at is None
                            or (time.monotonic() - granted_at) < RECOGNITION_GRACE_MAX_SEC
                        )
                    else:
                        recognition_allowed = True

                    if recognition_allowed and state_now in (
                        AccessState.FACE_DETECTED, AccessState.LIVENESS_CHALLENGE,
                        AccessState.VERIFYING, AccessState.GRANTED,
                    ) and rec_vis is None:
                        # One attempt at a time, at most every RECOGNITION_RETRY_SEC.
                        if not rec_run and (time.monotonic() - self._last_recognition_ts) >= RECOGNITION_RETRY_SEC:
                            # Align in this thread (needs the landmarks); embedding and
                            # matching run in the background thread.
                            aligned_face = self.recognizer.align_face(frame, landmarks)
                            if aligned_face is not None:
                                self._last_recognition_ts = time.monotonic()
                                with self._lock:
                                    self._recognition_running = True
                            
                                # Start background thread for embedding extraction and matching
                                threading.Thread(
                                    target=self._run_recognition,
                                    args=(aligned_face, frame, landmarks, sess_id),
                                    daemon=True
                                ).start()
                else:
                    # No face this frame. Only treat the visitor as gone after
                    # FACE_LOST_FRAMES consecutive misses.
                    self._no_face_frames += 1
                    if self._no_face_frames >= FACE_LOST_FRAMES:
                        self.engine.notify_face_lost()
                        self.liveness.reset()
                        self.liveness_started = False
                        with self._lock:
                            self.recognized_visitor = None
                            self.last_embedding = None
                            # Face gone — the next person to appear must not inherit
                            # frames fused from this one.
                            self._emb_buffer = []
                            self._rec_attempts_done = 0

                with self._lock:
                    self.last_frame = frame

            except Exception:
                # A dead vision loop looks exactly like a kiosk that never sees
                # anyone: frames still arrive, the camera still reads as live,
                # and the scan simply never progresses. Log the frame and go on.
                logger.exception("[AI] Vision loop error — skipping this frame")
                time.sleep(0.05)

    def get_display_frame(self):
        """Latest processed frame, else the latest local-camera frame (used by GET /video_frame)."""
        with self._lock:
            frame = self.last_frame
        if frame is not None:
            return frame
        frame, _ = self.cam.get_preview_frame()
        return frame

    def is_camera_live(self) -> bool:
        """True if a recent frame exists (browser: uploaded within 3 s; local: camera running)."""
        if self._browser_mode:
            frame, _ = self.browser_buffer.get_latest()
            return frame is not None and not self.browser_buffer.is_stale()
        frame, _ = self.cam.get_preview_frame()
        return frame is not None and self.cam.is_active()

    def get_state(self) -> Dict[str, Any]:
        """Build the GET /state payload (see the hold rules in the comments below)."""
        engine_state = self.engine.get_state()
        # One lock around the whole hold decision: _granted_at / _grace_released
        # are also reset by the vision thread, and the check-then-set below must
        # not interleave with that. (Lock order vision -> engine, as in reset().)
        with self._lock:
            visitor = self.recognized_visitor
            rec_running = self._recognition_running

            # Recognition hold. When the engine is GRANTED but nobody is recognised
            # yet, report VERIFYING (with access_granted=true, which the kiosk shows as
            # "identifying you") instead of GRANTED, so the kiosk never acts on
            # GRANTED without visitor_info before recognition has answered.
            # Released when:
            #   - a match arrives (next branch), or
            #   - at least RECOGNITION_MIN_ANSWERS lookups have answered AND the mode
            #     floor has passed (RECOGNITION_GRACE_SEC check-in,
            #     RECOGNITION_GRACE_MAX_SEC check-out), or
            #   - RECOGNITION_WAIT_MAX_SEC has elapsed (safety limit).
            reported_state = engine_state.state
            if engine_state.state == AccessState.GRANTED and visitor is None:
                now = time.monotonic()
                if self._granted_at is None:
                    self._granted_at = now
                elapsed = now - self._granted_at

                # Check-out waits longer: an unrecognised check-out can only show
                # "Please check in first", whereas check-in falls back to registration.
                checkout = self.engine.mode == "check-out"
                floor = RECOGNITION_GRACE_MAX_SEC if checkout else RECOGNITION_GRACE_SEC
                answers = self._rec_attempts_done
                # Whether a lookup is in flight does not matter here: retries are
                # frequent, so waiting on them would stall new visitors.
                waiting = answers < RECOGNITION_MIN_ANSWERS or elapsed < floor
                if waiting and elapsed < RECOGNITION_WAIT_MAX_SEC:
                    reported_state = AccessState.VERIFYING
                    # Keep pushing back the engine's auto-reset so GRANTED is not lost
                    # (and the visitor not asked to smile again) during the hold.
                    self.engine.restart_result_timer()
                elif not self._grace_released:
                    # Release once, restarting the countdown so GRANTED stays visible
                    # for the full RESULT_DISPLAY_SEC.
                    self._grace_released = True
                    self.engine.restart_result_timer()
                    if waiting:
                        logger.warning(
                            "[AI] Recognition hold hit the %.1f s safety limit "
                            "(answers=%d, lookup in flight=%s) — continuing as unrecognised",
                            RECOGNITION_WAIT_MAX_SEC, answers, rec_running,
                        )
                    else:
                        logger.info(
                            "[AI] Released GRANTED as unrecognised after %.2f s hold "
                            "(%d recognition answer(s), no match, mode=%s)",
                            elapsed, answers, self.engine.mode,
                        )
            elif engine_state.state == AccessState.GRANTED and visitor is not None:
                # A match arrived during the hold: release once with a full display
                # window and log the wait.
                if self._granted_at is not None and not self._grace_released:
                    self._grace_released = True
                    self.engine.restart_result_timer()
                    logger.info(
                        "[AI] Released GRANTED: recognised %s after %.2f s hold",
                        visitor.get("name"), time.monotonic() - self._granted_at,
                    )
            elif engine_state.state != AccessState.GRANTED:
                self._granted_at = None
                self._grace_released = False

            # The visit is recorded here, where GRANTED is actually reported to
            # the kiosk: liveness and smile have passed (or a pass QR was shown)
            # and the visitor is identified. Once per visitor per session.
            pending_visit = None
            if reported_state == AccessState.GRANTED and visitor is not None:
                if visitor["id"] not in self._logged_this_session:
                    self._logged_this_session.add(visitor["id"])
                    action = "SIGN_OUT" if self.engine.mode == "check-out" else "SIGN_IN"
                    # The closure itself is recorded by _record_visit below.
                    pass
                    pending_visit = (visitor, action, self._session_id)

        # Off the polling path: the visit row is written in its own thread so
        # /state stays fast.
        if pending_visit is not None:
            threading.Thread(target=self._record_visit, args=pending_visit, daemon=True).start()

        # The visitor has passed liveness + smile and been identified, so their
        # pass carries the signed token printed into the badge QR code, and a
        # link to the photo taken when they registered — the badge shows the
        # same picture every time, however long ago that was.
        if reported_state == AccessState.GRANTED and visitor is not None:
            visitor = dict(visitor)
            visitor["pass_token"] = issue_pass_token(visitor.get("id"))
            visitor["photo_url"] = self.enrolment_photo_url(visitor.get("id"))

        return {
            "state": reported_state.name,
            "smile_smoothed": engine_state.smile_smoothed,
            "smile_frames": engine_state.smile_frames_above,
            "attempt": engine_state.attempt,
            "max_attempts": engine_state.max_attempts,
            "hint": engine_state.hint if engine_state.quality_ok else engine_state.quality_reason,
            "access_granted": engine_state.access_granted,
            "liveness_passed": engine_state.liveness_passed,
            "liveness_blinks": engine_state.liveness_blinks,
            "quality_ok": engine_state.quality_ok,
            "camera_live": self.is_camera_live(),
            "visitor_info": visitor,
            # Set once access is granted: a link to the frame where this visitor
            # smiled most, for the confirmation screen. "" when there is none.
            "smile_photo": smile_photo_url(self._session_id)
                           if (reported_state == AccessState.GRANTED
                               and self._best_smile_frame is not None) else "",
        }

    def reset(self):
        """
        Start a new session: bump _session_id and clear per-visitor state
        (engine, liveness, identity, fusion buffer, counters, frame buffers).
        Keeps the enrolment buffer (pending_*) and any check-out the kiosk
        has not acknowledged yet.
        """
        with self._lock:
            self._session_id += 1
            self._recognition_running = False
            self.engine.reset()
            self.liveness.reset()
            self.smile_det.reset()
            if self.bs_smile is not None:
                self.bs_smile.reset()
            self.cam.clear_buffer()
            self.browser_buffer.clear()
            self.liveness_started = False
            self.recognized_visitor = None
            self.last_embedding = None
            self._best_smile_frame = None
            self._best_smile_score = 0.0
            self._granted_at = None
            self._grace_released = False
            # Fused frames belong to one visitor only.
            self._emb_buffer = []
            self._no_face_frames = 0
            self._rec_attempts_done = 0
            self._logged_this_session = set()
            # No retry cooldown carried over into the new session.
            self._last_recognition_ts = 0.0

        # Recreate FaceMesh (outside self._lock): in video mode its tracking
        # state from the previous session can stop it detecting the next face.
        # Swapped under _mesh_lock, so the old one is never closed while the
        # vision loop is part-way through a frame with it.
        with self._mesh_lock:
            old_mesh = self._mp_mesh
            self._mp_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=2,
                refine_landmarks=True,
                min_detection_confidence=0.3,
                min_tracking_confidence=0.3,
            )
            try:
                old_mesh.close()
            except Exception:
                pass

# Single shared instance; the vision loop starts when this module is imported.
vision = VisionSystem()

@app.on_event("startup")
async def startup_event():
    """Print the active camera source once the server is up."""
    mode = "browser (getUserMedia)" if vision._browser_mode else "local (OpenCV)"
    print(f"[System] AI Core Initialized — camera source: {mode}")

# The database refuses rows that break its own rules (migration 015). That is a
# backstop for a bug in the application, not something a visitor should ever see
# as a server error, so it comes back as "please check this" rather than a 500.
_CONSTRAINT_MESSAGES = {
    "visitors_name_ck":   "A visitor needs a name of 2 to 80 characters.",
    "visitors_email_ck":  "That email address does not look right.",
    "visitors_phone_ck":  "That phone number does not look right.",
    "visitors_status_ck": "A visitor can only be active or blocked.",
}


@app.exception_handler(psycopg2.errors.CheckViolation)
def _check_violation(request: Request, exc: psycopg2.errors.CheckViolation):
    name = getattr(getattr(exc, "diag", None), "constraint_name", "") or ""
    message = _CONSTRAINT_MESSAGES.get(name, "Those details were refused by the database.")
    logger.error("Constraint %s rejected a write on %s: %s", name or "?", request.url.path, exc)
    return JSONResponse(status_code=422,
                        content={"status": "error", "message": message,
                                 "errors": {name.replace("visitors_", "").replace("_ck", ""): message}})


SMILE_PHOTO_TTL_SEC = 120.0


def smile_photo_url(session_id: int) -> str:
    """
    Signed, short-lived link to one session's smile frame.

    Signed like the snapshot links, so the frame cannot be pulled by anyone who
    guesses the address. Takes no lock of its own: get_state() calls it while
    already holding vision._lock, and that lock is not reentrant.
    """
    exp = int(time.time() + SMILE_PHOTO_TTL_SEC)
    body = f"smile.{session_id}.{exp}"
    sig = hmac.new(LINK_SIGNING_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"/smile_photo?sess={session_id}&exp={exp}&sig={sig}"


@app.get("/smile_photo")
async def get_smile_photo(sess: int = 0, exp: str = "", sig: str = ""):
    """
    The frame in which the visitor smiled most, for the kiosk to show on the
    confirmation screen.

    Held in memory for the current session only — never written to disk, and
    gone the moment the next visitor starts. A request for an older session
    gets 404 rather than somebody else's face.
    """
    expected = hmac.new(LINK_SIGNING_KEY.encode(), f"smile.{sess}.{exp}".encode(),
                        hashlib.sha256).hexdigest()[:32]
    if not exp or not sig or not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Bad link")
    try:
        if int(exp) < time.time():
            raise HTTPException(status_code=403, detail="Link expired")
    except ValueError:
        raise HTTPException(status_code=403, detail="Bad link")

    with vision._lock:
        frame = None if vision._session_id != sess else vision._best_smile_frame
    if frame is None:
        raise HTTPException(status_code=404, detail="No smile frame for this session")

    ok, buffer = await run_in_threadpool(
        cv2.imencode, ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, CONFIG.camera.JPEG_QUALITY]
    )
    if not ok or buffer is None:
        raise HTTPException(status_code=503, detail="Could not encode the frame")
    return Response(content=buffer.tobytes(), media_type="image/jpeg",
                    headers={"Cache-Control": "no-store"})


@app.get("/state")
async def get_state():
    """Pipeline state for the kiosk (polled every 200 ms)."""
    return vision.get_state()

def _blocked_match(embedding) -> Optional[int]:
    """
    The id of a blocked visitor this face belongs to, if any.

    Recognition ignores blocked visitors, so without this check a blocked
    person would simply not be recognised at the kiosk and could enrol again
    under a new record.
    """
    if embedding is None:
        return None
    try:
        match = vision.db.find_match(embedding, threshold=vision.db.DUPLICATE_THRESHOLD,
                                     include_blocked=True)
    except Exception as e:
        logger.error("Blocked-visitor check failed: %s", e)
        return None
    if match and str(match.get("status")) != "active":
        return match["id"]
    return None


def _badge_image_bytes(image: Any) -> tuple:
    """JPEG or PNG bytes from the kiosk badge capture. Rejects anything else."""
    raw = str(image or "").strip()
    if "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=422, detail="Badge image is not valid base64")
    if len(data) < 100 or len(data) > 4_000_000:
        raise HTTPException(status_code=422, detail="Badge image is missing or too large")
    if data[:2] == b"\xff\xd8":
        return data, "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return data, "image/png"
    raise HTTPException(status_code=422, detail="Badge image must be a JPEG or PNG")


@app.post("/checkin/badge")
def checkin_badge(payload: Dict[str, Any] = Body(...)):
    """
    Queue the check-in WhatsApp message using the badge the kiosk just drew.

    The image is the existing visitor pass (PrintBadgeModal), captured on the
    pass screen. This route does not draw a second card.
    """
    try:
        visitor_id = int(payload.get("visitor_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A numeric visitor_id is required")
    badge, mime = _badge_image_bytes(payload.get("image"))
    visitor = vision.db.get_visitor(visitor_id)
    if visitor is None:
        raise HTTPException(status_code=404, detail="No such visitor")
    open_visit = None
    try:
        open_visit = vision.db.open_visit_for(visitor_id)
    except Exception as e:
        logger.error("Could not read the open visit for %s: %s", visitor_id, e)
    queued = notify_check_in(
        visitor,
        (open_visit or {}).get("id"),
        (open_visit or {}).get("department") or "",
        badge_image=badge,
        badge_mime=mime,
    )
    return {"status": "ok", "queued": queued}


@app.post("/register")
def register_user(payload: Dict[str, Any], response: Response):
    """
    Enrol the visitor currently in front of the kiosk (JSON form fields in the body).

    Uses the face captured during the scan — the embedding and the photo from
    the same frame. db.register_visitor() inserts a visitor and their face,
    or reuses the existing record if that face is already enrolled. Saves the
    enrolment photo, opens the visit and logs REGISTRATION.
    Returns {"status": "ok", "visitor_id"}; 422 with a message per field if the
    form is wrong, or if no face was captured.
    Declared sync so the database work runs off the event loop.
    """
    # This endpoint takes no key, so nothing here can be assumed about the body.
    try:
        data = clean_registration(payload)
    except ValidationError as e:
        logger.info("Registration rejected: %s", e)
        response.status_code = 422
        return {"status": "error", "message": "Please check the form.", "errors": e.errors}
    data["created_via"] = "kiosk"
    with vision._lock:
        # The kiosk calls /camera/stop before showing the form, and reset() clears
        # last_embedding, so the enrolment buffer is the usual source here.
        #
        # Embedding and photo are taken as a pair, both from the recognition
        # attempt that produced them. Reading the photo from the newest camera
        # frame instead would store whatever was in front of the lens when
        # scanning stopped — a different face, if someone stepped in at the end.
        if vision.pending_embedding is not None:
            last_emb = vision.pending_embedding
            last_frm = vision.pending_frame
        else:
            last_emb = vision.last_embedding
            last_frm = vision.last_frame
    blocked = _blocked_match(last_emb)
    if blocked is not None:
        logger.warning("Registration refused: face matches blocked visitor %s", blocked)
        response.status_code = 403
        return {"status": "error", "blocked": True,
                "message": "This visitor is blocked. Please see the front desk."}

    if last_emb is not None:
        visitor_id = vision.db.register_visitor(data, last_emb)
        # Consent is given on the form, at the moment the face is enrolled.
        if data.get("consent"):
            vision.db.set_consent(visitor_id, True)
        # The enrolment photo: taken once, kept as the visitor's reference
        # picture. Later check-ins do not add more images of the same face.
        snap_path = ""
        if last_frm is not None:
            snap_path = vision.save_enrolment_photo(last_frm, visitor_id)

        visit_id = vision.db.open_visit(
            visitor_id,
            purpose=data.get("purpose"),
            department=data.get("department"),
            kiosk_id=KIOSK_ID,
        )
        vision.db.log_event(visitor_id, "REGISTRATION", visit_id=visit_id,
                            snapshot_path=snap_path)
        notify_check_in({"id": visitor_id, "name": data.get("name"),
                         "phone": data.get("phone")},
                        visit_id, data.get("department", ""))
        # Clear the live capture but keep the enrolment buffer, so a repeated
        # submit finds the same face, hits the duplicate guard and returns the
        # same user_id. /camera/start clears the buffer for the next visitor.
        with vision._lock:
            vision.last_embedding = None
            vision.last_frame = None
        logger.info("Registered visitor id=%s name=%s", visitor_id, data.get("name"))
        return {"status": "ok", "visitor_id": visitor_id, "user_id": visitor_id,
                "pass_token": issue_pass_token(visitor_id),
                "photo_url": vision.enrolment_photo_url(visitor_id)}

    # Non-2xx status so the kiosk treats it as a failure (nothing was saved).
    logger.error("Registration failed for %s — no face embedding available", data.get("name"))
    response.status_code = 422
    return {"status": "error", "message": "No face embedding captured"}

@app.post("/register/manual")
def register_manual(payload: Dict[str, Any], response: Response):
    """
    Manual entry: register a visitor from a photo taken on the registration form,
    for when the automatic face scan does not work. Body: the same form fields as
    /register plus "image" (a JPEG data URL).

    If a face is found in the photo, it is stored as that visitor's face (the
    duplicate guard in db.register_visitor applies, and the visitor can be
    recognised next time).
    If not, the visitor is still registered, without face data. Either way the
    photo is saved as the REGISTRATION snapshot.
    Returns {"status": "ok", "user_id", "face_enrolled"}; 422 if the photo or
    name is missing. Declared sync so the image work runs off the event loop.
    """
    image = str(payload.get("image") or "")
    if "," in image:                       # strip "data:image/jpeg;base64,"
        image = image.split(",", 1)[1]
    frame = None
    try:
        raw = base64.b64decode(image)
        frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception:
        frame = None
    if frame is None:
        response.status_code = 422
        return {"status": "error", "message": "A photo is required for manual entry"}

    # Same rules as the kiosk form; reception can register a visitor who has
    # not given a phone number, but consent is still asked for.
    try:
        data = clean_registration(payload, require_phone=False)
    except ValidationError as e:
        logger.info("Manual entry rejected: %s", e)
        response.status_code = 422
        return {"status": "error", "message": "Please check the form.", "errors": e.errors}

    data["created_via"] = "manual"
    embedding = vision.embedding_from_photo(frame)
    blocked = _blocked_match(embedding)
    if blocked is not None:
        logger.warning("Manual entry refused: face matches blocked visitor %s", blocked)
        response.status_code = 403
        return {"status": "error", "blocked": True,
                "message": "This visitor is blocked. Please see the front desk."}

    if embedding is not None:
        # allow_face_update=False: manual entry has no liveness check, so a
        # photo of an enrolled visitor must not add to their stored faces.
        visitor_id = vision.db.register_visitor(data, embedding, allow_face_update=False,
                                                source="manual")
    else:
        logger.warning("Manual entry for %s: no face found in the photo", data.get("name"))
        visitor_id = vision.db.register_visitor_without_face(data)

    if data.get("consent"):
        vision.db.set_consent(visitor_id, True)

    snap_path = vision.save_enrolment_photo(frame, visitor_id)
    visit_id = vision.db.open_visit(
        visitor_id,
        purpose=data.get("purpose"),
        department=data.get("department"),
        kiosk_id=KIOSK_ID,
    )
    vision.db.log_event(visitor_id, "REGISTRATION", visit_id=visit_id, snapshot_path=snap_path)
    notify_check_in({"id": visitor_id, "name": data.get("name"), "phone": data.get("phone")},
                    visit_id, data.get("department", ""))
    logger.info("Manual entry registered visitor id=%s name=%s face_enrolled=%s",
                visitor_id, data.get("name"), embedding is not None)
    return {"status": "ok", "visitor_id": visitor_id, "user_id": visitor_id,
            "face_enrolled": embedding is not None,
            "pass_token": issue_pass_token(visitor_id),
            "photo_url": vision.enrolment_photo_url(visitor_id)}

@app.get("/visitor/{visitor_id}/visits")
def visitor_visits(visitor_id: int):
    """
    {"user_id", "total_visits"}: distinct days the visitor has checked in (at
    least 1). Shown on the pass. Falls back to 1 on a database error.
    Declared sync so the database call runs off the event loop.
    """
    try:
        total = vision.db.count_visits(visitor_id)
    except Exception as e:
        logger.error("Visit count failed for visitor %s: %s", visitor_id, e)
        total = 1
    return {"visitor_id": visitor_id, "total_visits": total}

@app.post("/log_exit")
def log_exit(payload: Dict[str, Any]):
    """
    Record a check-out for {"visitor_id"} (called by the kiosk after a
    recognised check-out).

    Returns {"closed": true, "minutes"} when the visit is now closed — whether
    this call closed it or the recognition thread already had. Returns
    {"closed": false, "not_checked_in": true} when the visitor had no visit
    open at all, so the kiosk can say so instead of wishing them goodbye.
    Declared sync so the database work runs off the event loop.
    """
    visitor_id = payload.get("visitor_id", payload.get("user_id"))
    if not visitor_id:
        return {"status": "error", "message": "Missing visitor_id"}
    try:
        uid = int(visitor_id)
    except (TypeError, ValueError):
        return {"status": "error", "message": "visitor_id must be a number"}

    closed = vision.db.close_visit(uid, method="face")
    if closed is not None:
        vision.db.log_event(uid, "SIGN_OUT", visit_id=closed["visit_id"],
                            meta={"source": "log_exit", "kiosk": KIOSK_ID})
        return {"status": "ok", "closed": True, "minutes": closed["minutes"]}

    # Nothing open. If the recognition thread closed a visit for this scan and
    # the kiosk has not collected it yet, this call is the other half of that
    # one departure. Collecting it consumes the entry, so a *second* check-out
    # scan afterwards is correctly told they are not checked in.
    with vision._lock:
        ack = vision._pending_checkout_ack.pop(uid, None)
    if ack is not None and (time.monotonic() - ack["at"]) < EXIT_DEDUP_SEC:
        logger.info("log_exit: visit %s for visitor %s was closed by this scan",
                    ack["visit_id"], uid)
        return {"status": "ok", "closed": True, "deduplicated": True,
                "minutes": ack["minutes"]}

    logger.info("log_exit: visitor %s was not checked in", uid)
    vision.db.log_event(uid, "SIGN_OUT", meta={"source": "log_exit",
                                               "kiosk": KIOSK_ID,
                                               "no_open_visit": True})
    return {"status": "ok", "closed": False, "not_checked_in": True}

@app.post("/reset")
def reset_system():
    """Reset the vision state (not called by the current kiosk frontend)."""
    vision.reset()
    return {"status": "ok"}

def _local_today() -> str:
    """Today's date in the kiosk's timezone (the server clock runs on UTC)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(TIMEZONE)).date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def _with_photo(rows: list) -> list:
    """Replace each row's stored snapshot path with a signed URL for the dashboard."""
    out = []
    for row in rows:
        row = dict(row)
        row["photo"] = snapshot_url(row.pop("snapshot_path", "") or "")
        out.append(row)
    return out


@app.get("/whatsapp/webhook")
def whatsapp_verify(request: Request):
    """
    Meta's one-time check that this URL belongs to whoever configured it.

    It calls with the verify token typed into the dashboard; echoing the
    challenge back proves the two match. Anything else gets 403.
    """
    params = request.query_params
    mode = params.get("hub.mode", "")
    token = params.get("hub.verify_token", "")
    challenge = params.get("hub.challenge", "")

    expected = CONFIG.messaging.WHATSAPP_VERIFY_TOKEN
    if not expected:
        logger.error("Webhook verification attempted but WHATSAPP_VERIFY_TOKEN is not set")
        raise HTTPException(status_code=503, detail="Webhook is not configured")
    if mode != "subscribe" or not hmac.compare_digest(token, expected):
        logger.warning("Webhook verification refused (mode=%s)", mode)
        raise HTTPException(status_code=403, detail="Verification failed")

    logger.info("WhatsApp webhook verified by Meta")
    return Response(content=challenge, media_type="text/plain")


@app.post("/whatsapp/webhook")
async def whatsapp_events(request: Request,
                          x_hub_signature_256: str = Header(default="")):
    """
    Delivery and read receipts from WhatsApp.

    Meta signs every call with the app secret, so a forged POST can be turned
    away. Always answers 200 once the call is accepted: an error here makes Meta
    retry, and a receipt is not worth a retry storm.
    """
    body = await request.body()

    secret = CONFIG.messaging.WHATSAPP_APP_SECRET
    if secret:
        expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(x_hub_signature_256 or "", expected):
            logger.warning("Webhook call refused: signature does not match")
            raise HTTPException(status_code=403, detail="Bad signature")
    else:
        logger.warning("Webhook call accepted unverified — WHATSAPP_APP_SECRET is not set")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception:
        return {"status": "ignored"}

    updated = 0
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value") or {}
            for status in value.get("statuses", []):
                message_id = status.get("id", "")
                state = status.get("status", "")
                errors = status.get("errors") or []
                detail = errors[0].get("title", "") if errors else ""
                try:
                    if vision.db.update_message_status(message_id, state, detail):
                        updated += 1
                except Exception as e:
                    logger.error("Could not record the receipt for %s: %s", message_id, e)
            # A visitor writing back. Nothing acts on it yet; logged so a reply
            # is not silently lost.
            for message in value.get("messages", []):
                logger.info("WhatsApp reply from %s: %s", message.get("from", "?"),
                            (message.get("text") or {}).get("body", "")[:120])

    if updated:
        logger.info("WhatsApp receipts recorded: %d", updated)
    return {"status": "ok", "updated": updated}


@app.get("/board")
def board():
    """
    Who is in the building, for the reception wall display. No key: this is the
    evacuation list, and it has to be readable the moment it is needed.

    Deliberately narrow — name, department, arrival and time on site, plus the
    reference photo unless BOARD_SHOW_PHOTOS is off. No phone, no email, no
    visitor ids.
    """
    if not BOARD_ENABLED:
        raise HTTPException(status_code=404, detail="The board is switched off")
    try:
        vision.db.expire_open_visits()
        rows = vision.db.get_presence()
    except Exception as e:
        logger.error("Board query failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")

    people = [
        {
            "name": r.get("name") or "Visitor",
            "department": r.get("department") or "",
            "purpose": r.get("purpose") or "",
            "since": r.get("since"),
            "minutes": r.get("minutes"),
            "photo": snapshot_url(r.get("snapshot_path") or "") if BOARD_SHOW_PHOTOS else "",
        }
        for r in rows
    ]
    return {"status": "ok", "on_site": len(people), "people": people,
            "as_of": datetime.now(timezone.utc).isoformat()}


@app.get("/admin/presence")
def admin_presence(_: None = Depends(require_admin)):
    """
    Who is on site right now: visitors whose latest SIGN_IN has no SIGN_OUT or
    EXIT after it, with how long they have been here. `stale` marks a visit
    older than PRESENCE_MAX_HOURS — almost certainly someone who left without
    checking out. This is the evacuation list. Staff only.
    """
    try:
        # Anyone still "inside" after PRESENCE_MAX_HOURS never checked out; the
        # visit is closed as expired so the evacuation list stays truthful.
        vision.db.expire_open_visits()
        rows = _with_photo(vision.db.get_presence())
    except Exception as e:
        logger.error("Presence query failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")
    expired = _with_photo(vision.db.expired_visits())
    return {
        "status": "ok",
        "on_site": len(rows),
        # People who left today without checking out. Their visit is closed
        # (an open one would sit on the evacuation list forever), so the count
        # comes from those closures rather than from the presence list.
        "not_checked_out": len(expired),
        "visitors": rows,
        "expired": expired,
    }


@app.get("/admin/visits")
def admin_visits(day: str = "", q: str = "", limit: int = 200,
                 _: None = Depends(require_admin)):
    """
    Visits for one day (default today), newest first: arrival, departure and
    minutes on site, plus anyone still inside from an earlier day. `q` filters
    by name, phone or email. Staff only.
    """
    try:
        rows = _with_photo(vision.db.get_visits(day=day or None, query=q, limit=limit))
    except Exception as e:
        logger.error("Visits query failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")
    # A visit closed as auto_expired was capped at PRESENCE_MAX_HOURS because
    # nobody checked out; averaging those in would report a stay nobody made.
    real = [r["minutes"] for r in rows
            if r["minutes"] is not None and r["checkout_method"] != "auto_expired"]
    expired = sum(1 for r in rows if r["checkout_method"] == "auto_expired")
    return {
        "status": "ok",
        "day": day or _local_today(),
        "count": len(rows),
        "still_in": sum(1 for r in rows if r["minutes"] is None),
        "not_checked_out": expired,
        "average_minutes": int(sum(real) / len(real)) if real else None,
        "visits": rows,
    }


@app.get("/admin/trends")
def admin_trends(days: int = 14, _: None = Depends(require_admin)):
    """
    Visits per day over the last `days` days, with the averages and the repeat
    rate for the period. Staff only.
    """
    try:
        data = vision.db.trends(days)
        data["longest_visits"] = _with_photo(data["longest_visits"])
        return {"status": "ok", **data}
    except Exception as e:
        logger.error("Trends query failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")


@app.get("/admin/visitors")
def admin_visitors(q: str = "", limit: int = 20, _: None = Depends(require_admin)):
    """
    Search enrolled visitors by name, phone or email (staff only).

    For browsing everybody rather than finding one person, see
    /admin/visitors/all — this one answers an empty query with nothing.
    """
    try:
        return {"status": "ok", "visitors": vision.db.search_visitors(q, limit=limit)}
    except Exception as e:
        logger.error("Visitor search failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")


@app.get("/admin/visitors/all")
def admin_visitors_all(q: str = "", sort: str = "recent", status: str = "",
                       limit: int = 25, offset: int = 0,
                       _: None = Depends(require_admin)):
    """
    Everyone enrolled in the system, a page at a time (staff only).

    Answers "how many people are registered, and who are they" — with the
    totals for the whole system alongside the page, so the header does not
    move as the filters change.
    """
    try:
        data = vision.db.list_visitors(q=q, sort=sort, status=status,
                                       limit=limit, offset=offset)
    except Exception as e:
        logger.error("Visitor listing failed: %s", e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")
    data["visitors"] = _with_photo(data["visitors"])
    return {"status": "ok", **data}


@app.post("/admin/checkout")
def admin_checkout(payload: Dict[str, Any], _: None = Depends(require_admin)):
    """
    Check a visitor out by hand (staff only), for when the face scan will not
    work. Closes their open visit and reports how long they were on site.
    """
    raw = payload.get("visitor_id", payload.get("user_id"))
    try:
        uid = int(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="A numeric visitor_id is required")

    visitor = vision.db.get_visitor(uid)
    if not visitor:
        raise HTTPException(status_code=404, detail="No such visitor")

    closed = vision.db.close_visit(uid, method="staff")
    if closed is None:
        return {"status": "ok", "already_out": True, "name": visitor.get("name"),
                "message": f"{visitor.get('name')} is not currently checked in."}

    vision.db.log_event(uid, "SIGN_OUT", visit_id=closed["visit_id"],
                        meta={"source": "staff", "kiosk": KIOSK_ID})
    # Nothing for the kiosk to acknowledge: staff closed this one, and any
    # earlier closure the kiosk never collected is now stale.
    with vision._lock:
        vision._pending_checkout_ack.pop(uid, None)
    logger.info("Manual check-out by staff: %s (id=%s) after %s min",
                visitor.get("name"), uid, closed["minutes"])
    return {"status": "ok", "already_out": False, "name": visitor.get("name"),
            "minutes": closed["minutes"]}


@app.post("/admin/checkout-all")
def admin_checkout_all(_: None = Depends(require_admin)):
    """
    Close every open visit (staff only) — the end-of-day sweep for people who
    left without checking out. Each is recorded as a staff check-out.
    """
    closed = vision.db.close_all_open_visits(method="staff")
    for row in closed:
        try:
            vision.db.log_event(row["visitor_id"], "SIGN_OUT", visit_id=row["visit_id"],
                                meta={"source": "staff_sweep", "kiosk": KIOSK_ID})
        except Exception as e:
            logger.error("Could not log the sweep for visitor %s: %s", row["visitor_id"], e)
    with vision._lock:
        for row in closed:
            vision._pending_checkout_ack.pop(row["visitor_id"], None)
    return {"status": "ok", "closed": len(closed),
            "visitors": [{"name": r["name"], "minutes": r["minutes"]} for r in closed]}


@app.get("/admin/visitor/{visitor_id}")
def admin_visitor(visitor_id: int, _: None = Depends(require_admin)):
    """
    One visitor's record for the staff panel: profile, how often and how long
    they visit, and their visit history. Staff only.
    """
    try:
        profile = vision.db.visitor_profile(visitor_id)
    except Exception as e:
        logger.error("Visitor profile failed for %s: %s", visitor_id, e)
        raise HTTPException(status_code=503, detail="Could not read the visitor database")
    if profile is None:
        raise HTTPException(status_code=404, detail="No such visitor")

    profile["photo"] = snapshot_url(profile.pop("snapshot_path", "") or "")
    # Other records with the same phone or email — usually one person enrolled
    # twice because the face was not recognised on a later visit.
    try:
        profile["duplicates"] = vision.db.contact_duplicates(visitor_id)
    except Exception as e:
        logger.error("Duplicate lookup failed for %s: %s", visitor_id, e)
        profile["duplicates"] = []
    # What the visitor was last sent, so staff can answer "did they get it?"
    try:
        profile["last_message"] = vision.db.last_message(visitor_id)
    except Exception as e:
        logger.error("Message lookup failed for %s: %s", visitor_id, e)
        profile["last_message"] = None
    return {"status": "ok", "visitor": profile}


@app.post("/admin/visitor/{visitor_id}/message")
def admin_visitor_message(visitor_id: int, _: None = Depends(require_admin)):
    """
    Send this visitor their check-in confirmation again (staff only).

    For the visitor at the desk saying it never arrived. Uses their current
    visit when they are inside, so the message describes the visit they are on
    rather than an old one.
    """
    visitor = vision.db.get_visitor(visitor_id)
    if visitor is None:
        raise HTTPException(status_code=404, detail="No such visitor")
    if not (visitor.get("phone") or "").strip():
        raise HTTPException(status_code=422, detail="No phone number on this record")
    if not CONFIG.messaging.ENABLED:
        raise HTTPException(status_code=503, detail="Messaging is switched off")

    open_visit = vision.db.open_visit_for(visitor_id)
    queued = notify_check_in(visitor, open_visit.get("id") if open_visit else None,
                             (open_visit or {}).get("department", ""))
    logger.info("Staff asked for the check-in message to be sent again to visitor %s", visitor_id)
    return {"status": "ok", "queued": queued, "name": visitor.get("name")}


@app.post("/admin/visitor/{visitor_id}/merge")
def admin_visitor_merge(visitor_id: int, payload: Dict[str, Any],
                        _: None = Depends(require_admin)):
    """
    Fold another visitor record into this one (staff only): the same person,
    enrolled twice. Body: {"merge": <the id to absorb>}.

    Everything moves to this record — visits, faces, photos, log entries — and
    the other is deleted. There is no undo.
    """
    try:
        drop_id = int(payload.get("merge"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Which record should be merged in?")
    if drop_id == visitor_id:
        raise HTTPException(status_code=422, detail="A record cannot be merged into itself")

    result = vision.db.merge_visitors(visitor_id, drop_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No such visitor")

    try:
        vision.db.log_event(visitor_id, "MERGE", meta={
            "merged_id": drop_id, "merged_name": result["dropped_name"],
            "visits": result["visits"], "faces": result["faces"], "kiosk": KIOSK_ID,
        })
    except Exception as e:
        logger.error("Could not log the merge of %s into %s: %s", drop_id, visitor_id, e)

    # Face matching reads the table directly, so the moved faces are live for
    # the next scan with nothing further to refresh.
    return {"status": "ok", **result}


@app.post("/admin/visitor/{visitor_id}/status")
def admin_visitor_status(visitor_id: int, payload: Dict[str, Any],
                         _: None = Depends(require_admin)):
    """
    Block or reinstate a visitor (staff only).

    A blocked visitor is skipped by recognition, so the kiosk will not check
    them in — and because the duplicate guard still knows their face, they
    cannot get around it by registering again.
    """
    status = str(payload.get("status") or "").strip().lower()
    if status not in ("active", "blocked"):
        raise HTTPException(status_code=422, detail="status must be 'active' or 'blocked'")
    if not vision.db.set_status(visitor_id, status):
        raise HTTPException(status_code=404, detail="No such visitor")
    return {"status": "ok", "visitor_status": status}


@app.post("/admin/visitor/{visitor_id}/consent")
def admin_visitor_consent(visitor_id: int, payload: Dict[str, Any],
                          _: None = Depends(require_admin)):
    """Record or clear the visitor's consent to their face being stored (staff only)."""
    given = bool(payload.get("given", True))
    if not vision.db.set_consent(visitor_id, given):
        raise HTTPException(status_code=404, detail="No such visitor")
    return {"status": "ok", "consent": given}


@app.patch("/admin/visitor/{visitor_id}")
def admin_visitor_update(visitor_id: int, payload: Dict[str, Any],
                         _: None = Depends(require_admin)):
    """Correct a visitor's name, phone, email or location (staff only)."""
    try:
        fields = clean_profile_edit(payload)
    except ValidationError as e:
        # One message per field, so the panel can mark the offending input.
        raise HTTPException(status_code=422, detail={"message": "Please check the details.",
                                                    "errors": e.errors})
    if not vision.db.update_visitor_details(visitor_id, fields):
        raise HTTPException(status_code=404, detail="No such visitor")
    return {"status": "ok"}


@app.delete("/admin/visitor/{visitor_id}")
def admin_visitor_delete(visitor_id: int, _: None = Depends(require_admin)):
    """
    Erase a visitor (staff only): their face, visits and photos go, and the
    activity log keeps its rows without naming them. For privacy requests —
    there is no undo.
    """
    removed = vision.db.delete_visitor(visitor_id)
    if removed is None:
        raise HTTPException(status_code=404, detail="No such visitor")

    # The rows are gone; take the image files with them.
    deleted_files = 0
    for key in removed["files"]:
        try:
            path = (SNAPSHOT_DIR / Path(str(key).replace("\\", "/")).name).resolve()
            if path.parent == SNAPSHOT_DIR and path.is_file():
                path.unlink()
                deleted_files += 1
        except OSError as e:
            logger.warning("Could not delete %s: %s", key, e)

    with vision._lock:
        vision._pending_checkout_ack.pop(visitor_id, None)
        if vision.recognized_visitor and vision.recognized_visitor.get("id") == visitor_id:
            vision.recognized_visitor = None
    return {"status": "ok", "name": removed["name"], "visits": removed["visits"],
            "photos_deleted": deleted_files}


@app.get("/admin/logs")
def get_logs(_: None = Depends(require_admin)):
    """Newest 500 activity log rows with visitor details (staff only; needs
    X-Admin-Key). [] on database error."""
    try:
        return vision.db.get_logs()
    except Exception as e:
        logger.error(f"Error fetching admin logs: {e}")
        return []

@app.post("/camera/start")
def start_camera(payload: Optional[Dict[str, Any]] = Body(default=None)):
    """
    Start a new visitor session. Body: {"mode": "check-in"|"check-out",
    "source": "browser"|"local"} (both optional).

    Resets the pipeline, clears the enrolment buffer, sets the engine mode and
    the frame source. In local mode it opens the webcam and waits up to 3 s for
    a frame. Returns the mode, source and camera_live. Declared sync because
    resetting the pipeline (and waiting for a local webcam) blocks.
    """
    data = payload or {}
    mode = data.get("mode", "check-in")
    source = str(data.get("source", CONFIG.camera.SOURCE)).lower()

    vision.reset()
    # New visitor: drop the previous visitor's enrolment buffer.
    with vision._lock:
        vision.pending_embedding = None
        vision.pending_frame = None
        # Threads from earlier sessions may no longer write the buffer.
        vision._pending_floor = vision._session_id
    vision.engine.set_mode(mode)
    vision._browser_mode = source == "browser"

    if vision._browser_mode:
        vision.stop_local_camera()
    else:
        vision.start_local_camera()
        for _ in range(30):
            if vision.is_camera_live():
                break
            time.sleep(0.1)

    return {
        "status": "ok",
        "mode": mode,
        "source": "browser" if vision._browser_mode else "local",
        "camera_live": vision.is_camera_live(),
    }


@app.post("/camera/frame")
async def ingest_browser_frame(request: Request):
    """JPEG body from the kiosk browser (~15 fps). Decoded and stored as the latest frame (browser mode only)."""
    if not vision._browser_mode:
        return {"status": "ignored", "message": "Backend is in local camera mode"}

    body = await request.body()
    if not body:
        return {"status": "error", "message": "Empty frame body"}

    arr = np.frombuffer(body, dtype=np.uint8)
    # Decoding is CPU work: off the event loop, so frame uploads cannot delay
    # /state polling.
    frame = await run_in_threadpool(cv2.imdecode, arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "error", "message": "Invalid JPEG frame"}

    vision.ingest_browser_frame(frame)
    return {"status": "ok"}

@app.post("/camera/stop")
def stop_camera():
    """Reset the vision state after a result (starts a new session id). Does not close a local webcam."""
    try:
        vision.reset()
        return {"status": "ok"}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/video_frame")
async def video_frame():
    """Latest frame as a JPEG (black 640x480 if none). The kiosk uses it only when it cannot grab its own photo."""
    try:
        frame = vision.get_display_frame()
        if frame is not None:
            ret, buffer = await run_in_threadpool(
                cv2.imencode, '.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, CONFIG.camera.JPEG_QUALITY]
            )
            if ret and buffer is not None:
                return Response(
                    content=buffer.tobytes(),
                    media_type="image/jpeg",
                    headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
                )
        # No frame available: return a black image
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        ret, buffer = cv2.imencode('.jpg', blank, [cv2.IMWRITE_JPEG_QUALITY, CONFIG.camera.JPEG_QUALITY])
        return Response(content=buffer.tobytes(), media_type="image/jpeg")
    except Exception as e:
        logger.error(f"video_frame error: {e}")
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        ret, buffer = cv2.imencode('.jpg', blank, [cv2.IMWRITE_JPEG_QUALITY, 50])
        return Response(content=buffer.tobytes(), media_type="image/jpeg")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=CONFIG.api.PORT)
