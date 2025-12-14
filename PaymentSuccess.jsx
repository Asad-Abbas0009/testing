import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(search);

  const bookingId = q.get("Id") || q.get("bookingId");

  useEffect(() => {
    if (!bookingId) return;

    const poll = async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/bookings/${bookingId}`
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data.status === "CONFIRMED") {
        navigate(`/confirmation?bookingId=${bookingId}`);
      }
    };

    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [bookingId]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Verifying payment…</p>
    </div>
  );
}
