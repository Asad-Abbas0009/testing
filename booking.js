import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* =========================================================
   CREATE BOOKING
   ========================================================= */
router.post("/", async (req, res) => {
  const { slotId, name, email, mobile_no, amount_paid, seats } = req.body;

  if (!slotId || !name || !Array.isArray(seats) || seats.length !== 1) {
    return res.status(400).json({ error: "Invalid booking data" });
  }

  const seatId = Number(seats[0]);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Create booking
    const [b] = await conn.query(
      `
      INSERT INTO bookings
      (slot_id, name, email, mobile_no, amount_paid, currency, status)
      VALUES (?, ?, ?, ?, ?, 'INR', 'PENDING_PAYMENT')
      `,
      [slotId, name, email, mobile_no, amount_paid]
    );

    const bookingId = b.insertId;

    await conn.query(
      `
      INSERT INTO booking_seats
      (booking_id, slot_id, seat_id, seat_price)
      VALUES (?, ?, ?, ?)
      `,
      [bookingId, slotId, seatId, amount_paid]
    );

    await conn.commit();

    res.status(201).json({
      bookingId,
      amount: amount_paid,
      paymentUrl:
        `https://aicog2026registration.conferencesinternational.in/payment/?Id=${bookingId}&amount=${amount_paid}`
    });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "BOOKING_FAILED" });
  } finally {
    conn.release();
  }
});

/* =========================================================
   PAYMENT CALLBACK (CALLED BY AICOG SERVER)
   ========================================================= */
router.post("/payment-callback", async (req, res) => {
  const { bookingId, transactionId, paymentStatus } = req.body;

  if (!bookingId || !transactionId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[booking]] = await conn.query(
      `SELECT status FROM bookings WHERE id = ? FOR UPDATE`,
      [bookingId]
    );

    if (!booking) {
      await conn.rollback();
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === "CONFIRMED") {
      await conn.rollback();
      return res.json({ ok: true });
    }

    const finalStatus =
      paymentStatus === "failed" || paymentStatus === "cancelled"
        ? "CANCELLED"
        : "CONFIRMED";

    await conn.query(
      `
      UPDATE bookings
      SET status = ?, payment_ref = ?
      WHERE id = ?
      `,
      [finalStatus, transactionId, bookingId]
    );

    await conn.commit();
    res.json({ ok: true });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "CALLBACK_FAILED" });
  } finally {
    conn.release();
  }
});

/* =========================================================
   FETCH BOOKING (USED BY FRONTEND)
   ========================================================= */
router.get("/:id", async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ error: "Invalid bookingId" });
  }

  const conn = await pool.getConnection();
  try {
    const [[row]] = await conn.query(
      `
      SELECT
        b.id AS bookingId,
        b.name AS userName,
        b.email AS userEmail,
        b.mobile_no AS userMobile,
        b.amount_paid AS amount,
        b.status,
        s.session_date AS date,
        s.start_time,
        s.end_time,
        bs.seat_id AS seatNumber
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      JOIN booking_seats bs ON bs.booking_id = b.id
      WHERE b.id = ?
      `,
      [bookingId]
    );

    if (!row) return res.status(404).json({ error: "Booking not found" });
    res.json(row);

  } finally {
    conn.release();
  }
});

export default router;
