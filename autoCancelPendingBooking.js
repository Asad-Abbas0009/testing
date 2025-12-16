import { pool } from "../db.js";

export async function autoCancelPendingBookings() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Find expired pending bookings
    const [rows] = await conn.query(
      `
      SELECT id
      FROM bookings
      WHERE status = 'PENDING_PAYMENT'
        AND created_at < (NOW() - INTERVAL 10 MINUTE)
      FOR UPDATE
      `
    );

    if (rows.length === 0) {
      await conn.rollback();
      return;
    }

    const bookingIds = rows.map(r => r.id);

    // 2️⃣ Cancel bookings
    await conn.query(
      `
      UPDATE bookings
      SET status = 'CANCELLED'
      WHERE id IN (?)
      `,
      [bookingIds]
    );

    // 3️⃣ 🔥 RELEASE SEATS (THIS WAS MISSING)
    await conn.query(
      `
      DELETE FROM booking_seats
      WHERE booking_id IN (?)
      `,
      [bookingIds]
    );

    await conn.commit();

    console.log(
      `[AUTO-CANCEL] Cancelled & released seats for ${bookingIds.length} booking(s)`
    );

  } catch (err) {
    await conn.rollback();
    console.error("[AUTO-CANCEL ERROR]", err);
  } finally {
    conn.release();
  }
}
