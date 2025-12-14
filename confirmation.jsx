import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import QRCode from "qrcode";

export default function Confirmation() {
  const { search } = useLocation();
  const bookingId = new URLSearchParams(search).get("bookingId");

  const [booking, setBooking] = useState(null);
  const [qrCodeData, setQrCodeData] = useState("");

  const API_BASE =
    import.meta.env.VITE_API_URL || "https://onesimulation.site";

  /* ======================================================
     FETCH BOOKING FROM BACKEND
     ====================================================== */
  useEffect(() => {
    if (!bookingId) return;

    fetch(`${API_BASE}/api/bookings/${bookingId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Booking not found");
        return res.json();
      })
      .then((data) => setBooking(data))
      .catch((err) => console.error(err));
  }, [bookingId]);

  /* ======================================================
     GENERATE QR CODE
     ====================================================== */
  useEffect(() => {
    if (!booking) return;

    const generateQRCode = async () => {
      const qrData = {
        bookingId: booking.bookingId,
        userName: booking.userName,
        userEmail: booking.userEmail,
        userMobile: booking.userMobile,
        seatNumber: booking.seatNumber,
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        timestamp: Date.now()
      };

      const qr = await QRCode.toDataURL(JSON.stringify(qrData));
      setQrCodeData(qr);
    };

    generateQRCode();
  }, [booking]);

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading booking details…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-4 px-4">
      <div className="max-w-2xl mx-auto">

        {/* SUCCESS HEADER */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Booking Confirmed!</h1>
          <p className="text-sm text-gray-600">
            Your seat has been reserved successfully.
          </p>
        </div>

        {/* DETAILS CARD */}
        <div className="bg-white rounded-xl shadow-lg p-5 mb-4">
          <h2 className="font-semibold mb-2">Booking Details</h2>
          <p className="text-sm text-gray-500">
            Booking ID: {booking.bookingId}
          </p>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <h3 className="font-semibold mb-2">Attendee</h3>
              <p>{booking.userName}</p>
              <p>{booking.userMobile}</p>
              <p>{booking.userEmail}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Slot</h3>
              <p>Date: {booking.date}</p>
              <p>
                Time: {booking.start_time} - {booking.end_time}
              </p>
              <p>Seat: {booking.seatNumber}</p>
              <p className="font-bold text-green-600">
                ₹{booking.amount}
              </p>
            </div>
          </div>

          {/* QR */}
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
