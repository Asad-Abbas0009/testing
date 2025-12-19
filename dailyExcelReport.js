import cron from "node-cron";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { pool } from "../db.js";
import fs from "fs";
import path from "path";

/* =========================================================
   EMAIL TRANSPORT (CREATE ONCE)
   ========================================================= */
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_GMAIL_USER,
    pass: process.env.EMAIL_GMAIL_PASS
  }
});

/* =========================================================
   TIME WINDOW
   Yesterday 6:00 AM → Today 5:59:59 AM (IST)
   ========================================================= */
function getTimeRange() {
  const now = new Date();

  const end = new Date(now);
  end.setHours(5, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  start.setHours(6, 0, 0, 0);

  return { start, end };
}

/* =========================================================
   GENERATE EXCEL
   ========================================================= */
async function generateExcel(rows, filePath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Bookings");

  sheet.columns = [
    { header: "Booking ID", key: "booking_id", width: 12 },
    { header: "Name", key: "name", width: 22 },
    { header: "Mobile Number", key: "mobile_no", width: 18 },
    { header: "Email ID", key: "email", width: 30 },
    { header: "Registration ID", key: "registration_id", width: 18 },
    { header: "Payment Status", key: "status", width: 16 },
    { header: "Payment Txn ID", key: "payment_ref", width: 28 }
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  rows.forEach(r => {
    sheet.addRow({
      booking_id: r.id,
      name: r.name,
      mobile_no: r.mobile_no,
      email: r.email,
      registration_id: r.registration_id || "",
      status:
        r.status === "CONFIRMED"
          ? "PAID"
          : r.status === "PENDING_PAYMENT"
          ? "PENDING"
          : "CANCELLED",
      payment_ref: r.payment_ref || ""
    });
  });

  // Scanner-friendly borders
  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
  });

  await workbook.xlsx.writeFile(filePath);
}

/* =========================================================
   SEND EMAIL
   ========================================================= */
async function sendEmail(filePath, reportDate) {
  await mailer.sendMail({
    from: process.env.EMAIL_FROM,
    to: "registration@aicog2026.com",
    bcc: [
      "asadabbas4338@gmail.com",
      "ankur.s@onesimulation.co.in",
      "ritik315cool@gmail.com"
    ],
    subject: `AICOG Daily Booking Report – ${reportDate}`,
    text: `Please find attached the booking report for ${reportDate}.`,
    attachments: [
      {
        filename: path.basename(filePath),
        path: filePath
      }
    ]
  });
}

/* =========================================================
   MAIN JOB
   ========================================================= */
async function generateDailyExcelReport() {
  const conn = await pool.getConnection();
  try {
    const { start, end } = getTimeRange();

    const [rows] = await conn.query(
      `
      SELECT
        id,
        name,
        mobile_no,
        email,
        registration_id,
        status,
        payment_ref
      FROM bookings
      WHERE created_at >= ?
        AND created_at <= ?
      ORDER BY id ASC
      `,
      [start, end]
    );

    if (!rows.length) {
      console.log("[DAILY-REPORT] No data found");
      return;
    }

    const reportDate = end.toISOString().slice(0, 10);
    const reportsDir = path.resolve(process.cwd(), "reports");

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filePath = path.join(
      reportsDir,
      `AICOG_Daily_Report_${reportDate}.xlsx`
    );

    await generateExcel(rows, filePath);
    await sendEmail(filePath, reportDate);

    console.log(
      `[DAILY-REPORT] Sent ${rows.length} records (${reportDate})`
    );
  } catch (err) {
    console.error("[DAILY-REPORT ERROR]", err);
  } finally {
    conn.release();
  }
}

/* =========================================================
   CRON SCHEDULE
   Every day at 6:00 AM IST
   ========================================================= */
cron.schedule("0 6 * * *", generateDailyExcelReport, {
  timezone: "Asia/Kolkata"
});

// cron.schedule("* * * * *", generateDailyExcelReport, {
//   timezone: "Asia/Kolkata"
// });


console.log("✅ Daily Excel Report Cron Scheduled (6:00 AM IST)");
