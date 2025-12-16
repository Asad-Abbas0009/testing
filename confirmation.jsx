import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import QRCode from "qrcode";

export default function Confirmation() {
  const { search } = useLocation();
  const bookingId = new URLSearchParams(search).get("bookingId");

  const [booking, setBooking] = useState(null);
  const [qrCodeData, setQrCodeData] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE =
    import.meta.env.VITE_API_URL || "https://onesimulation.site";

  /* ======================================================
     FETCH BOOKING FROM BACKEND (SOURCE OF TRUTH)
     ====================================================== */
  useEffect(() => {
    if (!bookingId) {
      setError("Invalid booking link");
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/bookings/${bookingId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Booking not found");
        return res.json();
      })
      .then((data) => {
        setBooking(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Booking not found or expired");
        setLoading(false);
      });
  }, [bookingId]);

  /* ======================================================
     GENERATE QR CODE (ONLY IF CONFIRMED)
     ====================================================== */
  useEffect(() => {
    if (!booking || booking.status !== "CONFIRMED") return;

    const generateQRCode = async () => {
      const qrPayload = {
        bookingId: booking.bookingId,
        workshop: booking.workshop_title,
        simulator: booking.company_name,
        venue: booking.venue,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        seat: booking.seatNumber,
        attendee: booking.userName,
        mobile: booking.userMobile,
        timestamp: Date.now()
      };

      const qr = await QRCode.toDataURL(
        JSON.stringify(qrPayload),
        { width: 200, margin: 2 }
      );

      setQrCodeData(qr);
    };

    generateQRCode();
  }, [booking]);

  /* ======================================================
     STATES
     ====================================================== */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading booking details…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        {error}
      </div>
    );
  }

  /* ======================================================
     UI
     ====================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-4 px-4">
      <div className="max-w-2xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3
              ${booking.status === "CONFIRMED" ? "bg-green-500" : "bg-yellow-500"}`}
          >
            ✓
          </div>

          <h1 className="text-2xl font-bold">
            {booking.status === "CONFIRMED"
              ? "Booking Confirmed!"
              : "Payment Pending"}
          </h1>

          <p className="text-sm text-gray-600">
            Booking ID: {booking.bookingId}
          </p>
        </div>

        {/* DETAILS */}
        <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <h3 className="font-semibold mb-2">Attendee</h3>
              <p>{booking.userName}</p>
              <p>{booking.userMobile}</p>
              <p>{booking.userEmail}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Workshop</h3>
              <p>{booking.company_name}</p>
              <p>{booking.workshop_title}</p>
              <p>{booking.venue}</p>
              <p>
                {booking.date} <br />
                {booking.start_time} - {booking.end_time}
              </p>
              <p className="font-bold text-green-600">
                ₹{booking.amount}
              </p>
            </div>
          </div>

          {/* QR CODE */}
          {booking.status === "CONFIRMED" && (
            <div className="mt-6 text-center">
              <h3 className="font-semibold mb-2">
                Venue Verification QR Code
              </h3>

              {qrCodeData && (
                <img
                  src={qrCodeData}
                  alt="QR Code"
                  className="mx-auto w-32 h-32"
                />
              )}
            </div>
          )}

          {booking.status !== "CONFIRMED" && (
            <div className="mt-4 text-center text-yellow-600 text-sm">
              Please complete payment to activate QR code.
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Print
          </button>

          <Link
            to="/"
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
