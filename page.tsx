"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CheckoutFailedScreen } from "@/components/CheckoutFailedScreen";
import { FaceScanScreen } from "@/components/FaceScanScreen";
import { LandingScreen } from "@/components/LandingScreen";
import { PassGeneratedScreen } from "@/components/PassGeneratedScreen";
import { VisitorDetailsScreen } from "@/components/VisitorDetailsScreen";
import { useBrowserCamera } from "@/hooks/useBrowserCamera";
import { useIdleReset } from "@/hooks/useIdleReset";
import { useVisionSystem } from "@/hooks/useVisionSystem";
import {
  getScanStatus,
  getScreenForState,
  visitorReducer,
} from "@/lib/stateMachine";
import {
  FORM_IDLE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  SCAN_TIMEOUT_MS,
  type FieldErrors,
  type VisitorFormData,
  type VisitorRecord,
} from "@/lib/types";
import { friendlyScanCaption } from "@/lib/kioskCopy";

/** Number of distinct days the visitor has checked in (1 if unknown). */
async function fetchVisitCount(apiBase: string, userId: string | number): Promise<number> {
  try {
    const res = await fetch(`${apiBase}/visitor/${encodeURIComponent(String(userId))}/visits`);
    if (!res.ok) return 1;
    const data = await res.json();
    return typeof data.total_visits === "number" && data.total_visits > 0 ? data.total_visits : 1;
  } catch {
    return 1;
  }
}

/**
 * Manual entry switch (NEXT_PUBLIC_MANUAL_ENTRY in frontend-new/.env.local;
 * "false" turns it off). When on, the landing page always shows the link, and a
 * DENIED check-in opens the form directly.
 */
const MANUAL_ENTRY_ENABLED = process.env.NEXT_PUBLIC_MANUAL_ENTRY !== "false";
/** Printed on the badge: a pass is issued once and carried for a year. */
const PASS_VALIDITY = "1 Year";

const initialState = {
  visitorState: "IDLE" as const,
  mode: null as "checkin" | "checkout" | null,
  capturedPhoto: null as string | null,
  visitor: null,
  pendingForm: null as VisitorFormData | null,
};

/**
 * Kiosk root component: routes between the four screens and orchestrates a visit.
 *
 * - Landing: the visitor picks Check-in or Check-out -> POST /camera/start.
 * - Face scan: useBrowserCamera streams frames to the backend; useVisionSystem
 *   polls GET /state. The backend decides liveness, smile and recognition.
 * - When /state becomes GRANTED: capture a photo, POST /camera/stop, then
 *     check-in  + recognised   -> fetch bookings -> pass screen
 *     check-in  + unrecognised -> registration form -> POST /register -> pass screen
 *     check-out + recognised   -> POST /log_exit -> checkout pass screen
 *     check-out + unrecognised, with no open visit, or a scan that failed
 *       outright -> CheckoutFailedScreen (retry / check in / back)
 * - DENIED after 1.5 s: check-in opens manual entry; check-out returns to
 *   landing. Inactivity resets after IDLE_TIMEOUT_MS (the form gets the longer
 *   FORM_IDLE_TIMEOUT_MS), except during the scan,
 *   which is capped by SCAN_TIMEOUT_MS instead.
 * - Manual entry (registration form with its own camera -> POST
 *   /register/manual) is linked from the landing page; it can be switched off
 *   with NEXT_PUBLIC_MANUAL_ENTRY=false.
 */
export default function KioskApp() {
  const [state, dispatch] = useReducer(visitorReducer, initialState);
  const screen = getScreenForState(state.visitorState);
  const { data, error, API_BASE } = useVisionSystem();
  const faceScanActive = screen === "face-scan" && !state.capturedPhoto;
  const { videoRef, cameraError, isLive, capturePhoto, stopStream } = useBrowserCamera({
    active: faceScanActive,
    apiBase: API_BASE,
  });

  // Refs to avoid stale closures in async handlers
  const prevBackendStateRef = useRef<string>("");
  const modeRef = useRef(state.mode);
  const isStartingRef = useRef(false);
  // Prevents the registration form from being submitted twice while a request is in flight.
  const isSubmittingRef = useRef(false);
  const capturePhotoRef = useRef(capturePhoto);
  capturePhotoRef.current = capturePhoto;

  useEffect(() => {
    modeRef.current = state.mode;
  }, [state.mode]);

  // Manual entry: fallback when the face scan does not work. Opens the
  // registration form with its own camera; the visitor takes a photo there and
  // is registered via POST /register/manual (never /register, which would use
  // the last face the vision loop scanned).
  const [manualMode, setManualMode] = useState(false);
  // Shown on the registration form, e.g. when the captured face was lost and
  // the visitor has to take a photo instead.
  const [formNotice, setFormNotice] = useState<string | null>(null);
  // Consecutive failed check-out scans, so the kiosk can stop suggesting
  // "try again" to someone it will never be able to recognise.
  const [checkoutAttempts, setCheckoutAttempts] = useState(0);
  useEffect(() => {
    if (state.visitorState === "IDLE") setManualMode(false);
  }, [state.visitorState]);

  // Check-out could not be completed: either the face was not recognised, or
  // it was, but the visitor had no open visit (see CheckoutFailedScreen).
  const [checkoutFailure, setCheckoutFailure] = useState<
    { reason: "not_recognised" | "not_checked_in" | "scan_failed"; name?: string } | null
  >(null);

  const openManualEntry = useCallback(() => {
    setManualMode(true);
    dispatch({ type: "RECOGNITION_COMPLETE", match: false });
  }, []);

  const reset = useCallback(() => {
    stopStream();
    fetch(`${API_BASE}/camera/stop`, { method: "POST" }).catch(() => {});
    prevBackendStateRef.current = "";
    dispatch({ type: "RESET" });
  }, [API_BASE, stopStream]);

  // Inactivity reset for the screens the visitor touches. Not the scan screen:
  // a face scan involves no touching, so the timer would cut it off (the scan
  // has its own SCAN_TIMEOUT_MS below).
  // The form gets a longer fuse than the pass screen — see the two constants.
  useIdleReset(
    reset,
    state.visitorState !== "IDLE" && screen !== "face-scan",
    screen === "visitor-details" ? FORM_IDLE_TIMEOUT_MS : IDLE_TIMEOUT_MS
  );

  // Safety net for a visitor who walks away mid-scan.
  useEffect(() => {
    if (screen !== "face-scan") return;
    const t = setTimeout(() => {
      console.warn("Face scan timed out after", SCAN_TIMEOUT_MS, "ms — resetting");
      reset();
    }, SCAN_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [screen, reset]);

  const handleStart = useCallback(
    async (mode: "checkin" | "checkout") => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setCheckoutFailure(null);
      prevBackendStateRef.current = "";
      dispatch({ type: mode === "checkin" ? "START_CHECKIN" : "START_CHECKOUT" });
      try {
        await fetch(`${API_BASE}/camera/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: mode === "checkin" ? "check-in" : "check-out",
            source: "browser",
          }),
        });
      } catch (e) {
        console.warn("Failed to start camera:", e);
      } finally {
        isStartingRef.current = false;
      }
    },
    [API_BASE]
  );

  // React to backend state changes while scanning. Only a CHANGE to GRANTED or
  // DENIED triggers anything (prevBackendStateRef filters repeated polls).
  useEffect(() => {
    if (!data || screen !== "face-scan") return;
    const backendState = data.state;
    if (backendState === prevBackendStateRef.current) return;
    prevBackendStateRef.current = backendState;

    if (backendState !== "GRANTED" && backendState !== "DENIED") return;

    if (backendState === "GRANTED") {
      const snapshot = data;
      const captureAndFinish = async () => {
        // The backend keeps the frame where the visitor smiled most. Prefer it:
        // the browser's own grab happens once GRANTED arrives, by which time
        // most people have relaxed or looked away. It lives in memory on the
        // backend for this session only, so it is fetched now, not linked to.
        let photo: string | null = null;
        if (snapshot?.smile_photo) {
          try {
            const res = await fetch(`${API_BASE}${snapshot.smile_photo}`);
            if (res.ok) {
              const blob = await res.blob();
              photo = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch {
            // Fall through to the browser's own grab below.
          }
        }

        // Grab still from browser camera before stopping
        if (!photo) photo = (await capturePhotoRef.current?.()) ?? null;
        if (!photo) {
          try {
            const res = await fetch(`${API_BASE}/video_frame`);
            const blob = await res.blob();
            photo = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error("Failed to capture photo:", e);
          }
        }

        stopStream();
        try {
          await fetch(`${API_BASE}/camera/stop`, { method: "POST" });
        } catch {}

        // Always set the captured photo in state first
        dispatch({ type: "CAPTURE_COMPLETE", photo });

        const visitorInfo = snapshot.visitor_info as any;

        if (visitorInfo) {
          // Recognised visitor. A check-out only makes sense if they have a
          // visit open: the backend says so, and we tell them rather than
          // wishing goodbye to someone who never checked in.
          if (modeRef.current === "checkout") {
            try {
              const res = await fetch(`${API_BASE}/log_exit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visitor_id: visitorInfo.id }),
              });
              const exit = await res.json();
              if (exit?.not_checked_in) {
                setCheckoutAttempts((n) => n + 1);
                setCheckoutFailure({ reason: "not_checked_in", name: visitorInfo.name });
                dispatch({ type: "RESET" });
                return;
              }
            } catch {
              // Backend unreachable: fall through and show the pass.
            }
          }

          const visitorEmail = visitorInfo.email || "";
          const totalVisits = await fetchVisitCount(API_BASE, visitorInfo.id);

          dispatch({
            type: "RECOGNITION_COMPLETE",
            match: true,
            visitor: {
              id: String(visitorInfo.id),
              name: visitorInfo.name,
              phone: visitorInfo.phone || "—",
              email: visitorEmail || "—",
              department: visitorInfo.department || "",
              passToken: visitorInfo.pass_token || "",
              purpose:
                modeRef.current === "checkout"
                  ? "Departure"
                  : visitorInfo.purpose || "General Visit",
              validFor: PASS_VALIDITY,
              lastVisit: new Date().toLocaleString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
              totalVisits,
              photoUrl: photo,
              storedPhotoUrl: visitorInfo.photo_url
                ? `${API_BASE}${visitorInfo.photo_url}`
                : null,
              isReturning: true,
            },
          });
        } else if (modeRef.current === "checkout") {
          // Check-out cannot sign out an unknown visitor. Show the fallback
          // screen (retry / check in / back) instead of a blocking alert.
          setCheckoutAttempts((n) => n + 1);
          setCheckoutFailure({ reason: "not_recognised" });
          dispatch({ type: "RESET" });
        } else {
          // Check-in — new visitor, send to registration form
          dispatch({ type: "RECOGNITION_COMPLETE", match: false });
        }
      };

      captureAndFinish();
    } else {
      // DENIED — stop the camera and, after a short pause to show the result,
      // give the visitor somewhere to go: manual entry for a check-in (the
      // backend's hint says so), and for a check-out the same fallback screen
      // the other failures use, rather than dropping them back on the landing
      // page with no explanation.
      stopStream();
      fetch(`${API_BASE}/camera/stop`, { method: "POST" }).catch(() => {});
      setTimeout(() => {
        if (modeRef.current === "checkout") {
          setCheckoutAttempts((n) => n + 1);
          setCheckoutFailure({ reason: "scan_failed" });
          dispatch({ type: "RESET" });
        } else if (MANUAL_ENTRY_ENABLED) {
          openManualEntry();
        } else {
          dispatch({ type: "RESET" });
        }
      }, 1500);
    }
  }, [data, screen, API_BASE, stopStream, openManualEntry]);

  /**
   * Sends the form. Returns the backend's per-field messages when it rejects
   * the details, so the form can mark the fields; returns nothing otherwise.
   */
  const handleSubmitRegistration = async (
    form: VisitorFormData,
    manualPhoto: string | null = null
  ): Promise<FieldErrors | void> => {
    if (isSubmittingRef.current) return;
    if (manualMode && !manualPhoto) {
      alert("Please take a photo first.");
      return;
    }
    isSubmittingRef.current = true;
    try {
      // The visitor columns the kiosk actually uses; label/host/role were
      // dropped from the schema (host duplicated department).
      const fields = {
        name: form.fullName,
        phone: form.mobile,
        email: form.email || "",
        location: form.location || "",
        purpose: form.purpose,
        department: form.department || "",
        consent: form.consent,
      };
      // Manual entry sends its own photo; the normal flow uses the scanned face.
      const response = await fetch(`${API_BASE}/register${manualMode ? "/manual" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualMode ? { ...fields, image: manualPhoto } : fields),
      });

      const resData = await response.json();
      // Require both a 2xx status and {status: "ok", visitor_id}, so a failed
      // registration is never shown as a badge.
      const newVisitorId = resData?.visitor_id ?? resData?.user_id;
      if (!response.ok || resData?.status !== "ok" || !newVisitorId) {
        // This face belongs to a visitor the front desk has blocked. Say so
        // plainly and send them there; retrying cannot help.
        if (response.status === 403 || resData?.blocked) {
          setFormNotice(
            resData?.message || "This visitor is blocked. Please see the front desk."
          );
          return;
        }

        // The details themselves were rejected. Hand the messages back so the
        // form can mark each field — this is not a reason to switch to manual
        // entry, and the scanned face is still good.
        if (response.status === 422 && resData?.errors) {
          setFormNotice(null);
          return resData.errors as FieldErrors;
        }

        // The scanned face is gone (the backend restarted, or the session was
        // cleared). Retrying the same way can only fail again, so switch the
        // form to manual entry — everything typed so far is kept, and the
        // visitor just takes a photo.
        if (response.status === 422 && !manualMode) {
          setManualMode(true);
          setFormNotice(
            "We lost the photo from your scan. Please take one with the camera on the left, then press NEXT."
          );
          return;
        }
        throw new Error(resData?.message || "Registration failed");
      }
      setFormNotice(null);

      const visitor: VisitorRecord = {
        id: String(newVisitorId),
        name: form.fullName,
        phone: form.mobile,
        email: form.email || "—",
        department: form.department || "",
        passToken: resData.pass_token || "",
        purpose: form.purpose || "General Visit",
        validFor: PASS_VALIDITY,
        lastVisit: new Date().toLocaleString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        totalVisits: 1,
        photoUrl: manualMode ? manualPhoto : state.capturedPhoto,
        storedPhotoUrl: resData.photo_url ? `${API_BASE}${resData.photo_url}` : null,
        isReturning: false,
      };

      if (manualMode && resData.face_enrolled === false) {
        alert(
          "Registered. No face could be found in the photo, so this visitor " +
            "will not be recognised automatically next time."
        );
      }
      dispatch({ type: "BADGE_READY", visitor });
    } catch (err) {
      console.error("Registration Error:", err);
      setFormNotice(
        "We couldn't save your details just now. Please try again, or ask at the front desk."
      );
    } finally {
      isSubmittingRef.current = false;
    }
  };

  if (checkoutFailure) {
    return (
      <CheckoutFailedScreen
        reason={checkoutFailure.reason}
        visitorName={checkoutFailure.name}
        attempts={checkoutAttempts}
        onRetry={() => handleStart("checkout")}
        onCheckIn={() => handleStart("checkin")}
        onHome={() => {
          setCheckoutFailure(null);
          setCheckoutAttempts(0);
          reset();
        }}
      />
    );
  }

  if (screen === "landing") {
    return (
      <LandingScreen
        onCheckIn={() => handleStart("checkin")}
        onCheckOut={() => handleStart("checkout")}
        onManualEntry={MANUAL_ENTRY_ENABLED ? openManualEntry : undefined}
        disabled={isStartingRef.current}
      />
    );
  }

  if (screen === "face-scan") {
    // "recognizing" = smile accepted, recognition still running. The backend
    // reports VERIFYING with access_granted=true during its recognition hold,
    // which distinguishes it from still waiting for a smile. The RECOGNIZING
    // visitorState covers the moment after GRANTED while the photo is captured
    // and bookings are fetched.
    const recognizing =
      (!!data?.access_granted &&
        (data.state === "VERIFYING" || data.state === "GRANTED")) ||
      state.visitorState === "RECOGNIZING";

    return (
      <FaceScanScreen
        phase={recognizing ? "recognizing" : "scanning"}
        status={friendlyScanCaption(data?.hint, state.mode) || getScanStatus(state.visitorState)}
        capturedPhoto={state.capturedPhoto}
        videoRef={videoRef}
        useBrowserVideo
        hasError={!!error}
        cameraError={cameraError}
        cameraLive={isLive && !cameraError}
        mode={state.mode ?? "checkin"}
      />
    );
  }

  if (screen === "visitor-details") {
    return (
      <VisitorDetailsScreen
        photoUrl={state.capturedPhoto}
        apiBase={API_BASE}
        onBack={() => {
          if (!manualMode) {
            fetch(`${API_BASE}/camera/stop`, { method: "POST" }).catch(() => {});
          }
          setFormNotice(null);
          dispatch({ type: "RESET" });
        }}
        onSubmit={handleSubmitRegistration}
        manual={manualMode}
        notice={formNotice}
      />
    );
  }

  if (screen === "pass-generated" && state.visitor) {
    return (
      <PassGeneratedScreen
        visitor={state.visitor}
        mode={state.mode ?? "checkin"}
        apiBase={API_BASE}
        onDone={reset}
      />
    );
  }

  return null;
}
