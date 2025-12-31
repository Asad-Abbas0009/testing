import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/** Validate/normalize center code (safer: trim + tolerant) */
function normalizeCenterCode(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (/^c\d+$/.test(s)) return s;       // c1, c2, c3...
  if (/^\d+$/.test(s)) return `c${s}`;   // 1 -> c1
  throw new Error("INVALID_CENTER_CODE");
}

/** Quick YYYY-MM-DD check */
function isISODate(x) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(x || ""));
}

/**
 * ---------- DEADLOCK-SAFE SEAT INSERT ----------
 */
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 40;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Insert seats safely with retries
 */
async function insertSeatsWithRetries(pool, centerId, rowLabel, colsArray, seatType = "REGULAR", basePrice = 0, isActive = 1) {
  if (!Array.isArray(colsArray) || colsArray.length === 0) return;

  const placeholders = colsArray.map(() => "(?,?,?,?,?,?)").join(", ");
  const params = [];
  for (const col of colsArray) {
    params.push(centerId, rowLabel, col, seatType, basePrice, isActive);
  }

  const sql = `
    INSERT INTO seats (center_id, row_label, col_number, seat_type, base_price, is_active)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE id = id
  `;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [result] = await pool.query(sql, params);
      return result;
    } catch (err) {
      if (err && err.code === "ER_LOCK_DEADLOCK") {
        if (attempt === MAX_RETRIES) throw err;
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 30);
        await sleep(backoff + jitter);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Helper: resolve center code-or-id to numeric center_id
 * Returns numeric id or null if not found.
 */
async function resolveCenterId(rawCenter) {
  try {
    const normalizedCode = normalizeCenterCode(rawCenter);
    // find numeric id by code
    const [rows] = await pool.query(
      `SELECT id FROM centers WHERE LOWER(code) = LOWER(?) LIMIT 1`,
      [normalizedCode]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0].id;
  } catch (err) {
    // If normalize throws INVALID_CENTER_CODE and raw is numeric, we might want to try numeric parsing:
    if (err?.message === "INVALID_CENTER_CODE") {
      // try numeric
      if (/^\d+$/.test(String(rawCenter || "").trim())) {
        const num = Number(String(rawCenter).trim());
        // verify exists
        const [rows] = await pool.query(`SELECT id FROM centers WHERE id = ? LIMIT 1`, [num]);
        if (rows && rows.length) return rows[0].id;
      }
    }
    throw err;
  }
}

/**
 * GET /api/slots/seats/:slotId
 * Return seats for a slot (6 seats for regular centers, 40 seats for c37, c38)
 */
router.get("/seats/:slotId", async (req, res) => {
  const slotId = Number(req.params.slotId);
  if (!slotId) return res.status(400).json({ message: "Invalid slotId" });

  try {
    const [slotRows] = await pool.query(
      "SELECT id, center_id, price, status FROM slots WHERE id = ? LIMIT 1",
      [slotId]
    );
    const slot = slotRows && slotRows[0];
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    // Check center code to determine seat count
    const [centerRows] = await pool.query(
      "SELECT code FROM centers WHERE id = ? LIMIT 1",
      [slot.center_id]
    );
    const centerCode = centerRows && centerRows[0]?.code?.toLowerCase();
    
    // Centers c37, c38 need 40 seats, others use 6 seats
    const isSpecialCenter = centerCode === "c37" || centerCode === "c38";
    const seatCount = isSpecialCenter ? 40 : 6;
    const cols = Array.from({ length: seatCount }, (_, i) => i + 1);
    
    // Make sure seats exist
    await insertSeatsWithRetries(pool, slot.center_id, "MS", cols);

    const [seats] = await pool.query(
      `SELECT id, col_number
         FROM seats
        WHERE center_id = ? AND row_label = 'MS' AND col_number BETWEEN 1 AND ?
        ORDER BY col_number ASC`,
      [slot.center_id, seatCount]
    );

    const [bookedRows] = await pool.query(
      "SELECT seat_id FROM booking_seats WHERE slot_id = ?",
      [slotId]
    );
    const booked = new Set(bookedRows.map(r => r.seat_id));

    res.json({
      seats: seats.map(s => ({
        id: String(s.id),
        label: `MS-${s.col_number}`,
        displayNo: s.col_number,
        price: slot.price,
        status: booked.has(s.id) ? "BOOKED" : "AVAILABLE"
      }))
    });
  } catch (err) {
    console.error("SEATS_LIST_FAILED:", err);
    res.status(500).json({ error: "SEATS_LIST_FAILED" });
  }
});

/**
 * GET /api/slots/resolve
 * Resolve slot by center/date/start_time (accepts center code 'c37' or numeric '37')
 * Query params: centerId, date, start, end?
 */
router.get("/resolve", async (req, res) => {
  const { centerId, date, start, end } = req.query || {};
  if (!centerId || !date || !start) {
    return res.status(400).json({ error: "centerId, date, start are required" });
  }
  if (!isISODate(date)) return res.status(400).json({ error: "Invalid date" });

  try {
    // Resolve to numeric id
    let centerIdNum = null;
    try {
      centerIdNum = await resolveCenterId(centerId);
    } catch (err) {
      if (err?.message === "INVALID_CENTER_CODE") {
        return res.status(400).json({ error: "Invalid centerId" });
      }
      throw err;
    }

    if (!centerIdNum) return res.status(404).json({ error: "Center not found" });

    // Normalize times
    const startTime = `${start}:00`.slice(0, 8);
    const params = [centerIdNum, date, startTime];
    let sql = `
      SELECT s.id
      FROM slots s
      WHERE s.center_id = ? AND s.session_date = ? AND s.start_time = ?
    `;
    if (end) {
      const endTime = `${end}:00`.slice(0, 8);
      sql += ` AND s.end_time = ?`;
      params.push(endTime);
    }
    sql += ` LIMIT 1`;

    const [rows] = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: "No matching slot" });
    res.json({ slotId: rows[0].id });
  } catch (err) {
    console.error("SLOT_RESOLVE_FAILED:", err);
    res.status(500).json({ error: "SLOT_RESOLVE_FAILED" });
  }
});

/**
 * GET /api/slots/:centerCode/:date
 * Return all slots for a center+date
 * centerCode may be 'c37' or '37'
 */
router.get("/:centerCode/:date", async (req, res) => {
  try {
    const rawCenter = req.params.centerCode;
    const date = req.params.date;
    if (!isISODate(date)) return res.status(400).json({ error: "Invalid date" });

    // Debug
    console.log("SLOTS_LIST_QUERY params:", { rawCenter, date });

    // Resolve numeric center id
    let centerId;
    try {
      centerId = await resolveCenterId(rawCenter);
    } catch (err) {
      if (err?.message === "INVALID_CENTER_CODE") {
        return res.status(400).json({ error: "Invalid center" });
      }
      throw err;
    }

    if (!centerId) {
      console.log("SLOTS_LIST_NO_CENTER:", rawCenter);
      return res.json({ slots: [] });
    }

    console.log("SLOTS_LIST_RESOLVED_ID:", rawCenter, "=>", centerId);

    const [rows] = await pool.query(
      `
      SELECT
        s.id,
        DATE_FORMAT(s.start_time, '%H:%i') AS start,
        DATE_FORMAT(s.end_time,   '%H:%i') AS end,
        s.price,
        s.status,
        '' AS subtitle
      FROM slots s
      WHERE s.center_id = ? AND s.session_date = ?
      ORDER BY s.start_time ASC
      `,
      [centerId, date]
    );

    console.log("SLOTS_LIST_RESULT count:", rows.length, rows[0] || null);
    res.json({ slots: rows });
  } catch (err) {
    console.error("SLOTS_LIST_FAILED:", err);
    res.status(500).json({ error: "SLOTS_LIST_FAILED" });
  }
});

export default router;
