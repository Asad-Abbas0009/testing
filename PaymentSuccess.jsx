import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const q = new URLSearchParams(search);

  const bookingId = q.get("Id") || q.get("bookingId");

  useEffect(() => {
    if (!bookingId) {
      navigate("/");
      return;
    }

    // go directly to confirmation
    navigate(`/confirmation?bookingId=${bookingId}`);
  }, [bookingId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to confirmation…</p>
    </div>
  );
}
