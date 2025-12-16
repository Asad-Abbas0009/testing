import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getSeats,
  resolveSlotId,
  createBookingSimple
} from "../api/client";
import TimeSlotGrid from "../components/TimeSlotGrid";
import BookingSummaryCard from "../components/BookingSummaryCard";
import UserDetailsModal from "../components/UserDetailsModal";

function cx(...a){ return a.filter(Boolean).join(" "); }
function f12(hhmm="00:00"){
  const [h,m]=(hhmm||"00:00").split(":").map(Number);
  const am=h<12?"AM":"PM";
  const h12=((h+11)%12)+1;
  return `${h12}:${String(m).padStart(2,"0")} ${am}`;
}

export default function SeatSelection() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(search);

  const slotIdRaw   = q.get("slotId") || "";
  const start       = q.get("start") || "";
  const end         = q.get("end") || "";
  const basePrice   = Number(q.get("price") || 0);
  const workshopId  = q.get("workshopId") || q.get("centerId") || "c1";
  const date        = q.get("date") || new Date().toISOString().slice(0,10);
  const workshopTitle = q.get("workshopTitle") || "Workshop";
  const companyName = q.get("companyName") || "Company";

  // UI state
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null); // mini-slot index 0..3
  const [selectedSeatId, setSelectedSeatId] = useState(null);     // REAL seat id from API
  const [showUserDetailsPopup, setShowUserDetailsPopup] = useState(false);
  const [userDetails, setUserDetails] = useState({ name: "", mobile: "", email: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Backend state
  const [resolvedSlotId, setResolvedSlotId] = useState(slotIdRaw);
  const [seatsRaw, setSeatsRaw] = useState([]);   // [{id,displayNo,status,price,...}] from API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);

  // OTP states
  const [otpSent, setOtpSent] = useState(false); // Track if OTP has been sent
  const [emailVerified, setEmailVerified] = useState(false); // Track if email is verified via OTP
  const [otp, setOtp] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(null);

  // ---------- Validators (shared by UI + submit) ----------
  const onlyDigits   = (s) => String(s || "").replace(/[^\d]/g, "");
  const validName    = (n) => String(n || "").trim().length >= 2;
  const validMobile  = (m) => /^[6-9]\d{9}$/.test(onlyDigits(m).slice(-10)); // India 10-digit starting 6–9
  const validEmail   = (e) => /\S+@\S+\.\S+/.test(String(e || "").trim());

  const isNameValid   = validName(userDetails.name);
  const isMobileValid = validMobile(userDetails.mobile);
  const isEmailValid  = validEmail(userDetails.email);
  // Can confirm booking only after: valid details + OTP verified + terms accepted
  const canConfirmBooking = isNameValid && isMobileValid && isEmailValid && emailVerified && acceptedTerms && !booking && selectedTimeSlot !== null && !!selectedSeatId;
  // Can send OTP if email is valid and OTP not sent yet
  const canSendOtp = isEmailValid && !otpSent && !sendingOtp;

  // ---------- Build 4×15min mini-slots from the hour ----------
  const generateTimeSlots = () => {
    if (!start) {
      const defaultSlots = [];
      for (let i = 0; i < 4; i++) {
        const startMin = i * 15;
        const endMin = (i + 1) * 15;
        const startTime = `09:${String(startMin).padStart(2, '0')}`;
        const endTime = `09:${String(endMin).padStart(2, '0')}`;
        defaultSlots.push({
          id: i,
          startTime,
          endTime,
          displayStart: f12(startTime),
          displayEnd: f12(endTime),
        });
      }
      return defaultSlots;
    }
    const [startHour, startMin] = start.split(':').map(Number);
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const slotStartMin = startMin + (i * 15);
      const slotEndMin = startMin + ((i + 1) * 15);
      const slotStartHour = startHour + Math.floor(slotStartMin / 60);
      const slotEndHour = startHour + Math.floor(slotEndMin / 60);
      const finalStartMin = slotStartMin % 60;
      const finalEndMin = slotEndMin % 60;
      const startTime = `${String(slotStartHour).padStart(2,'0')}:${String(finalStartMin).padStart(2,'0')}`;
      const endTime   = `${String(slotEndHour).padStart(2,'0')}:${String(finalEndMin).padStart(2,'0')}`;
      slots.push({
        id: i,
        startTime,
        endTime,
        displayStart: f12(startTime),
        displayEnd: f12(endTime),
      });
    }
    return slots;
  };
  const timeSlots = useMemo(generateTimeSlots, [start]);

  // ---------- Resolve slotId if missing ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      if (resolvedSlotId) return;
      if (!workshopId || !date || !start) return;
      try {
        const id = await resolveSlotId(workshopId, date, start, end || undefined);
        if (!alive) return;
        setResolvedSlotId(String(id));
      } catch {
        if (!alive) return;
        setError("Could not resolve showtime. Please go back and pick another time.");
      }
    })();
    return () => { alive = false; };
  }, [resolvedSlotId, workshopId, date, start, end]);

  // ---------- Load seats for this slot (DB truth) ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!resolvedSlotId) { setLoading(false); return; }
      try {
        setLoading(true);
        setError("");
        const data = await getSeats(resolvedSlotId);
        if (!alive) return;
        const list = Array.isArray(data?.seats) ? data.seats : [];
        setSeatsRaw(list);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load seats");
        setSeatsRaw([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [resolvedSlotId]);

  // ---------- Map mini-slot index (0..3) -> seat info from DB ----------
  const miniSeatStatus = useMemo(() => {
    const byIndex = {};
    const sorted = [...seatsRaw].sort((a, b) => {
      const ai = (a.displayNo ?? a.col_number ?? 0);
      const bi = (b.displayNo ?? b.col_number ?? 0);
      return ai - bi;
    });
    // only first 4 seats map to 4 mini-slots
    sorted.slice(0, 4).forEach((s, idx) => {
      byIndex[idx] = {
        id: Number(s.id),
        status: s.status, // "AVAILABLE" | "BOOKED"
        displayNo: s.displayNo ?? s.col_number ?? (idx + 1),
        price: s.price ?? basePrice
      };
    });
    return byIndex;
  }, [seatsRaw, basePrice]);

  // Clear selection if it becomes invalid
  useEffect(() => {
    if (selectedTimeSlot != null) {
      const info = miniSeatStatus[selectedTimeSlot];
      if (!info || info.status !== "AVAILABLE") {
        setSelectedTimeSlot(null);
        setSelectedSeatId(null);
      }
    }
  }, [miniSeatStatus, selectedTimeSlot]);

  const total = selectedTimeSlot != null
    ? (miniSeatStatus[selectedTimeSlot]?.price ?? basePrice)
    : basePrice || 0;

  function openUserDetailsPopup() {
    if (selectedTimeSlot == null || !selectedSeatId) return;
    setAcceptedTerms(false); // Reset terms acceptance on each booking attempt
    setShowUserDetailsPopup(true);
    // Reset OTP state when opening popup
    setOtpSent(false);
    setOtp("");
    setOtpStatus("");
    setOtpAttemptsLeft(null);
    setEmailVerified(false);
  }

  // ---------- OTP helpers using fetch (no axios) ----------
  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

  async function handleSendOtp() {
    if (!isEmailValid) {
      setOtpStatus("Please enter a valid email address first");
      return;
    }

    setSendingOtp(true);
    setOtpStatus("");
    try {
      const res = await fetch(`${API_BASE}/api/otps/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userDetails.email.trim() })
      });
      const data = await res.json();
      if (data && data.ok) {
        setOtpSent(true);
        setOtpStatus("OTP sent to your email. Please check your inbox.");
        if (typeof data.attempts !== "undefined") setOtpAttemptsLeft(data.attempts);
      } else {
        setOtpStatus(data?.error || "Failed to send OTP.");
      }
    } catch (err) {
      console.error("SEND OTP ERR", err);
      setOtpStatus("Failed to send OTP. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleResendOtp() {
    if (!isEmailValid) return;
    setOtpStatus("");
    setSendingOtp(true);
    try {
      const res = await fetch(`${API_BASE}/api/otps/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userDetails.email.trim() })
      });
      const data = await res.json();
      if (data && data.ok) {
        setOtpStatus("OTP resent to your email.");
        setOtp(""); // Clear previous OTP input
      } else {
        setOtpStatus(data?.error || "Resend failed");
      }
    } catch (err) {
      console.error("RESEND ERR", err);
      setOtpStatus("Resend failed. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp || otp.trim().length !== 6) {
      setOtpStatus("Please enter the 6-digit OTP");
      return;
    }

    if (!isEmailValid) {
      setOtpStatus("Please enter a valid email address");
      return;
    }

    setVerifyingOtp(true);
    setOtpStatus("");

    try {
      const res = await fetch(`${API_BASE}/api/otps/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userDetails.email.trim(),
          otp: String(otp).trim()
        })
      });

      const data = await res.json();

      if (data && data.ok) {
        // Email verified - enable terms checkbox and booking button
        setEmailVerified(true);
        setOtpStatus("Email verified successfully ✅");
      } else {
        setOtpStatus(data?.error || "Invalid or expired OTP");
      }
    } catch (err) {
      console.error("VERIFY ERR", err);
      setOtpStatus("OTP verification failed. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }


  // ---------- Create booking (after OTP verification and terms acceptance) ----------
  async function confirmBooking() {
    if (!validName(userDetails.name) || !validMobile(userDetails.mobile) || !validEmail(userDetails.email)) {
      alert('Please enter a valid name, 10-digit mobile, and email.');
      return;
    }
    if (!emailVerified) {
      alert('Please verify your email with OTP first.');
      return;
    }
    if (!acceptedTerms) {
      alert('Please accept the terms and conditions to proceed.');
      return;
    }
    if (selectedTimeSlot === null || !selectedSeatId) {
      alert('Please select a 15-minute mini-slot');
      return;
    }

    try {
      setBooking(true);
      setError("");

      // const payload = {
      //   slotId: Number(resolvedSlotId || 0),
      //   name: userDetails.name.trim(),
      //   email: userDetails.email.trim(),
      //   mobile_no: userDetails.mobile.trim(),
      //   seats: [Number(selectedSeatId)],
      //   amount_paid: total,
      //   payment_ref: `demo_${Date.now()}`
      // };

      const payload = {
        slotId: Number(resolvedSlotId || 0),
        name: userDetails.name.trim(),
        email: userDetails.email.trim(),
        mobile_no: userDetails.mobile.trim(),
        seats: [Number(selectedSeatId)],
        amount_paid: total,

  // ✅ NEW — persist workshop data
        company_name: companyName,
        workshop_title: workshopTitle,
        venue: q.get("venue") || ""
      };

      const resp = await createBookingSimple(payload); // expects 201 and booking id

      const bookingId = resp.bookingId ?? resp.id ?? resp.insertId ?? resp.data?.bookingId ?? resp.data?.id;
      const bookingAmount = resp.amount ?? resp.amount_paid ?? total;

      // Validate booking ID and amount before redirect
      if (!bookingId || bookingAmount <= 0) {
        throw new Error("Invalid booking information. Please try again.");
      }

      // Build return URL for payment gateway to redirect back to
      const returnUrl = `${window.location.origin}/payment-success`;
      
      // Sanitize values for URL
      const sanitizedBookingId = String(bookingId).replace(/[^0-9]/g, '');
      const sanitizedAmount = Number(bookingAmount).toFixed(2);
      
      // Redirect to payment page with booking_id, amount, and return URL
      // Note: The AICOG payment page should be configured to redirect back to returnUrl after Razorpay payment
      const paymentUrl = `https://aicog2026registration.conferencesinternational.in/payment/?Id=${sanitizedBookingId}&amount=${sanitizedAmount}&returnUrl=${encodeURIComponent(returnUrl)}`;
      
      // Store booking details in sessionStorage for after payment return
      const slot = timeSlots[selectedTimeSlot];
      const bookingData = {
        bookingId: String(bookingId),
        companyName: String(companyName).slice(0, 200),
        workshopTitle: String(workshopTitle).slice(0, 200),
        venue: String(q.get("venue") || "").slice(0, 200),
        date: String(date).slice(0, 20),
        startTime: slot ? String(slot.displayStart).slice(0, 20) : "",
        endTime: slot ? String(slot.displayEnd).slice(0, 20) : "",
        seatNumber: slot ? String(`${slot.displayStart}–${slot.displayEnd}`).slice(0, 50) : "",
        amount: String(bookingAmount),
        userName: String(userDetails.name.trim()).slice(0, 100),
        userMobile: String(userDetails.mobile.trim()).slice(0, 20),
        userEmail: String(userDetails.email.trim()).slice(0, 100)
      };
      
      try {
        sessionStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      } catch (storageError) {
        console.warn("Failed to store booking data in sessionStorage:", storageError);
        // Continue anyway - we can still work with URL parameters
      }

      // Redirect to external payment page
      window.location.href = paymentUrl;
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Seat got taken. Please pick another mini-slot.";
      alert(msg);

      // Refresh seats
      try {
        const data = await getSeats(resolvedSlotId);
        const list = Array.isArray(data?.seats) ? data.seats : [];
        setSeatsRaw(list);
      } catch {}
    } finally {
      setBooking(false);
    }
  }

  function goBack(){ navigate(-1); }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-600">Loading seats...</p>
      </div>
    </div>
  );
  if (error && !showUserDetailsPopup) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Error</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="mr-1 rounded px-2 py-1 text-gray-700 hover:bg-gray-100" aria-label="Back">‹</button>
          <div className="h-9 w-56 rounded bg-gray-900 text-white grid place-items-center text-sm font-semibold">{companyName}</div>
          <div className="flex-1 h-9 min-w-[280px] ml-3 rounded bg-sky-200 text-gray-900 grid place-items-center text-sm font-semibold">
            {workshopTitle}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Ads Section */}
        <div className="w-full h-32 mb-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
          <div className="text-white text-center">
            <h3 className="text-xl font-bold mb-2">Advertisement Space</h3>
            <p className="text-sm opacity-90">Ads will run here</p>
          </div>
        </div>

        {/* 15-minute mini-slots (DB-driven availability) */}
        <TimeSlotGrid
          timeSlots={timeSlots}
          miniSeatStatus={miniSeatStatus}
          selectedTimeSlot={selectedTimeSlot}
          onSlotSelect={(slotIndex, seatId) => {
            setSelectedTimeSlot(slotIndex);
            setSelectedSeatId(seatId);
          }}
        />

        {/* Booking Summary Card */}
        <BookingSummaryCard
          companyName={companyName}
          workshopTitle={workshopTitle}
          selectedTimeSlot={selectedTimeSlot}
          timeSlots={timeSlots}
          total={total}
          onBookClick={openUserDetailsPopup}
          booking={booking}
          disabled={selectedTimeSlot === null}
        />
      </main>

      <footer className="sticky bottom-0 z-10 border-t bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between" aria-live="polite">
          <div className="text-sm">
            {selectedTimeSlot !== null ? (
              <>Selected: <span className="font-semibold">1</span> • Total: <span className="font-semibold">₹ {total}</span></>
            ) : "Select a 15-minute mini-slot to continue"}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 rounded-lg border"
              onClick={() => { setSelectedTimeSlot(null); setSelectedSeatId(null); }}
              disabled={selectedTimeSlot===null}
            >
              Clear
            </button>
            <button
              className="px-5 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              onClick={openUserDetailsPopup}
              disabled={selectedTimeSlot===null || booking}
            >
              {booking ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        </div>
      </footer>

      {/* User Details Modal */}
      <UserDetailsModal
        isOpen={showUserDetailsPopup}
        onClose={() => {
          setShowUserDetailsPopup(false);
          // Reset OTP state when closing popup
          setOtpSent(false);
          setOtp("");
          setOtpStatus("");
          setEmailVerified(false);
          setOtpAttemptsLeft(null);
          setAcceptedTerms(false);
        }}
        userDetails={userDetails}
        setUserDetails={setUserDetails}
        isNameValid={isNameValid}
        isMobileValid={isMobileValid}
        isEmailValid={isEmailValid}
        otpSent={otpSent}
        setOtpSent={setOtpSent}
        emailVerified={emailVerified}
        setEmailVerified={setEmailVerified}
        otp={otp}
        setOtp={setOtp}
        otpStatus={otpStatus}
        setOtpStatus={setOtpStatus}
        sendingOtp={sendingOtp}
        verifyingOtp={verifyingOtp}
        otpAttemptsLeft={otpAttemptsLeft}
        acceptedTerms={acceptedTerms}
        setAcceptedTerms={setAcceptedTerms}
        canConfirmBooking={canConfirmBooking}
        onConfirmBooking={confirmBooking}
        booking={booking}
        error={error}
        onSendOtp={handleSendOtp}
        onResendOtp={handleResendOtp}
        onVerifyOtp={handleVerifyOtp}
        canSendOtp={canSendOtp}
      />
    </div>
  );
}
