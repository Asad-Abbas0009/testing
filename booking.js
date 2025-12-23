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

    // ✅ NEW FIELD
    registration_id,

    // workshop data
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

    /* 0️⃣ Get slot date first to check bookings for that specific date */
    const [slotRows] = await conn.query(
      `SELECT session_date FROM slots WHERE id = ? LIMIT 1`,
      [slotId]
    );

    if (!slotRows || slotRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Slot not found" });
    }

    const slotDate = slotRows[0].session_date;
    const slotDateStr = slotDate instanceof Date 
      ? slotDate.toISOString().split('T')[0] 
      : String(slotDate).split('T')[0];

    /* 1️⃣ Check daily booking limit (max 3 bookings per day per email/mobile for the slot's date) */
    const [existingBookings] = await conn.query(
      `
      SELECT COUNT(*) as count
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      WHERE (b.email = ? OR b.mobile_no = ?)
        AND DATE(s.session_date) = ?
        AND b.status IN ('CONFIRMED', 'PENDING_PAYMENT')
      `,
      [email, mobile_no, slotDateStr]
    );

    const bookingCount = existingBookings[0]?.count || 0;
    if (bookingCount >= 3) {
      await conn.rollback();
      return res.status(429).json({
        error: `Daily booking limit reached for ${slotDateStr}. You can book a maximum of 3 slots per day.`,
        limit: 3,
        current: bookingCount,
        date: slotDateStr
      });
    }

    /* 2️⃣ Create booking (PENDING_PAYMENT) */
    const [b] = await conn.query(
      `
      INSERT INTO bookings
      (
        slot_id,
        name,
        email,
        mobile_no,
        registration_id,
        amount_paid,
        currency,
        status,
        company_name,
        workshop_title,
        venue
      )
      VALUES (?, ?, ?, ?, ?, ?, 'INR', 'PENDING_PAYMENT', ?, ?, ?)
      `,
      [
        slotId,
        name,
        email,
        mobile_no,
        registration_id || null,
        amount_paid,
        company_name || null,
        workshop_title || null,
        venue || null
      ]
    );

    const bookingId = b.insertId;

    /* 3️⃣ Lock seat */
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
   PAYMENT CALLBACK
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

    if (booking.status !== "PENDING_PAYMENT") {
      await conn.rollback();
      return res.json({ ok: true });
    }

    const failed =
      paymentStatus === "failed" ||
      paymentStatus === "cancelled";

    if (failed) {
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
   FETCH BOOKING
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
        b.registration_id AS registrationId,
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
