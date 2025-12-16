import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/* =========================================================
   CREATE BOOKING
   ========================================================= */
router.post("/", async (req, res) => {
  const {
    slotId,
    name,
    email,
    mobile_no,
    amount_paid,
    seats,

    // ✅ workshop data
    company_name,
    workshop_title,
    venue
  } = req.body;

  if (
    !slotId ||
    !name ||
    !Array.isArray(seats) ||
    seats.length !== 1
  ) {
    return res.status(400).json({ error: "Invalid booking data" });
  }

  const seatId = Number(seats[0]);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    /* 1️⃣ Create booking (PENDING_PAYMENT) */
    const [b] = await conn.query(
      `
      INSERT INTO bookings
      (
        slot_id,
        name,
        email,
        mobile_no,
        amount_paid,
        currency,
        status,
        company_name,
        workshop_title,
        venue
      )
      VALUES (?, ?, ?, ?, ?, 'INR', 'PENDING_PAYMENT', ?, ?, ?)
      `,
      [
        slotId,
        name,
        email,
        mobile_no,
        amount_paid,
        company_name || null,
        workshop_title || null,
        venue || null
      ]
    );

    const bookingId = b.insertId;

    /* 2️⃣ Lock seat (UNIQUE(slot_id, seat_id) enforces safety) */
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
      status: "PENDING_PAYMENT"
    });

  } catch (err) {
    await conn.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Seat already booked. Please choose another slot."
      });
    }

    console.error("BOOKING_FAILED:", err);
    res.status(500).json({ error: "BOOKING_FAILED" });

  } finally {
    conn.release();
  }
});

/* =========================================================
   PAYMENT CALLBACK (AICOG SERVER)
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

    // 🔁 Idempotent callback
    if (booking.status !== "PENDING_PAYMENT") {
      await conn.rollback();
      return res.json({ ok: true });
    }

    const failed =
      paymentStatus === "failed" ||
      paymentStatus === "cancelled";

    if (failed) {
      /* ❌ Payment failed → release seat */
      await conn.query(
        `
        UPDATE bookings
        SET status = 'CANCELLED', payment_ref = ?
        WHERE id = ?
        `,
        [transactionId, bookingId]
      );

      await conn.query(
        `DELETE FROM booking_seats WHERE booking_id = ?`,
        [bookingId]
      );
    } else {
      /* ✅ Payment success */
      await conn.query(
        `
        UPDATE bookings
        SET status = 'CONFIRMED', payment_ref = ?
        WHERE id = ?
        `,
        [transactionId, bookingId]
      );
    }

    await conn.commit();
    res.json({ ok: true });

  } catch (err) {
    await conn.rollback();
    console.error("CALLBACK_FAILED:", err);
    res.status(500).json({ error: "CALLBACK_FAILED" });
  } finally {
    conn.release();
  }
});

/* =========================================================
   FETCH BOOKING (CONFIRMATION + QR PAGE)
   ========================================================= */
// router.get("/:id", async (req, res) => {
//   const bookingId = Number(req.params.id);
//   if (!Number.isInteger(bookingId)) {
//     return res.status(400).json({ error: "Invalid bookingId" });
//   }

//   const conn = await pool.getConnection();
//   try {
//     const [[row]] = await conn.query(
//       `
//       SELECT
//         b.id                AS bookingId,
//         b.name              AS userName,
//         b.email             AS userEmail,
//         b.mobile_no         AS userMobile,
//         b.amount_paid       AS amount,
//         b.status,
//         b.company_name,
//         b.workshop_title,
//         b.venue,
//         s.session_date      AS date,
//         s.start_time,
//         s.end_time,
//         bs.seat_id          AS seatNumber
//       FROM bookings b
//       JOIN slots s ON s.id = b.slot_id
//       JOIN booking_seats bs ON bs.booking_id = b.id
//       WHERE b.id = ?
//       `,
//       [bookingId]
//     );

//     if (!row) {
//       return res.status(404).json({ error: "Booking not found" });
//     }

//     res.json(row);

//   } finally {
//     conn.release();
//   }
// });
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

        b.company_name,
        b.workshop_title,
        b.venue,

        s.session_date AS date,
        s.start_time,
        s.end_time,

        bs.seat_id AS seatNumber
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      LEFT JOIN booking_seats bs ON bs.booking_id = b.id
      WHERE b.id = ?
      `,
      [bookingId]
    );

    if (!row) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(row);
  } finally {
    conn.release();
  }
});

export default router;
