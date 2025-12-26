import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { pool } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   EMAIL TRANSPORT (CREATE ONCE) - Using Brevo
   ========================================================= */
function buildMailer() {
  const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
  
  // Brevo (formerly Sendinblue) SMTP
  if (EMAIL_PROVIDER === "brevo") {
    if (!process.env.BREVO_SMTP_HOST || !process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASS) {
      throw new Error("Brevo configured but BREVO_SMTP_HOST/USER/PASS missing");
    }

    const port = Number(process.env.BREVO_SMTP_PORT || 587);
    // Port 587 uses STARTTLS (secure: false), port 465 uses SSL (secure: true)
    const secure = port === 465;

    return nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }

  // Generic SMTP (fallback)
  if (!process.env.EMAIL_SMTP_HOST || !process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASS) {
    throw new Error("SMTP settings missing (EMAIL_SMTP_HOST/EMAIL_SMTP_USER/EMAIL_SMTP_PASS)");
  }

  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });
}

// Lazy initialization of mailer
let mailer = null;
function getMailer() {
  if (!mailer) {
    mailer = buildMailer();
  }
  return mailer;
}

/* =========================================================
   DATE RANGE: Configurable start date → NOW (IST)
   ========================================================= */
function getTimeRangeFromStartTillNow(startDateISO = "2025-12-19") {
  // Parse start date in IST timezone
  const start = new Date(`${startDateISO}T00:00:00+05:30`);
  
  // Get current time in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
  
  return { start, end: istNow };
}

/* =========================================================
   FORMAT DATE TO IST (for timestamps only)
   ========================================================= */
function formatIST(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(date));
}

/* =========================================================
   CLEANUP OLD FILES (keep last 30 days)
   ========================================================= */
function cleanupOldReports(reportsDir) {
  try {
    const files = fs.readdirSync(reportsDir);
    const now = Date.now();
    const thirtyDaysAgo = 30 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (!file.endsWith('.xlsx')) return;
      
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted old report: ${file}`);
      }
    });
  } catch (err) {
    console.warn("⚠️  Failed to cleanup old reports:", err.message);
  }
}

/* =========================================================
   GENERATE EXCEL FILE
   ========================================================= */
async function generateExcel(rows, filePath) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Invalid or empty rows data");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Confirmed Bookings");

  sheet.columns = [
    { header: "Booking ID", key: "booking_id", width: 12 },
    { header: "Registration ID", key: "registration_id", width: 18 },
    { header: "Name", key: "name", width: 22 },
    { header: "Mobile Number", key: "mobile_no", width: 18 },
    { header: "Email ID", key: "email", width: 30 },
    { header: "Workshop", key: "company_name", width: 24 },
    { header: "Simulator", key: "workshop_title", width: 30 },
    { header: "Company Name", key: "venue", width: 24 },
    { header: "Session Date", key: "session_date", width: 14 },
    { header: "Start Time", key: "start_time", width: 12 },
    { header: "End Time", key: "end_time", width: 12 },
    { header: "Seat No", key: "seat_number", width: 12 },
    { header: "Payment Status", key: "status", width: 16 },
    { header: "Payment Txn ID", key: "payment_ref", width: 30 },
    { header: "Amount Paid", key: "amount_paid", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Booking Date & Time (IST)", key: "created_at", width: 26 }
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" }
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Add rows with proper null handling
  rows.forEach(r => {
    sheet.addRow({
      booking_id: r.booking_id || "",
      registration_id: r.registration_id || "",
      name: r.name || "",
      mobile_no: r.mobile_no || "",
      email: r.email || "",
      company_name: r.company_name || "",
      workshop_title: r.workshop_title || "",
      venue: r.venue || "",
      session_date: r.session_date || "",
      start_time: r.start_time || "",
      end_time: r.end_time || "",
      seat_number: r.seat_number || "",
      status: r.status === 'CONFIRMED' ? 'PAID' : (r.status || ""),
      payment_ref: r.payment_ref || "",
      amount_paid: r.amount_paid || 0,
      currency: r.currency || "INR",
      created_at: formatIST(r.created_at)
    });
  });

  // Add borders to all cells
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

  // Write file with error handling
  try {
    await workbook.xlsx.writeFile(filePath);
  } catch (err) {
    throw new Error(`Failed to write Excel file: ${err.message}`);
  }
}

/* =========================================================
   SEND EMAIL
   ========================================================= */
async function sendEmail(filePath, reportDate, rowCount) {
  const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
  
  // Check for Brevo credentials
  const hasBrevo = EMAIL_PROVIDER === "brevo" && 
                   process.env.BREVO_SMTP_HOST && 
                   process.env.BREVO_SMTP_USER && 
                   process.env.BREVO_SMTP_PASS;
  
  // Check for generic SMTP credentials
  const hasSMTP = process.env.EMAIL_SMTP_HOST && 
                  process.env.EMAIL_SMTP_USER && 
                  process.env.EMAIL_SMTP_PASS;

  if (!hasBrevo && !hasSMTP) {
    console.warn("⚠️  Email credentials not configured, skipping email send");
    console.warn("   Required: BREVO_SMTP_HOST/USER/PASS or EMAIL_SMTP_HOST/USER/PASS");
    return;
  }

  try {
    const transporter = getMailer();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "services@onesimulation.co.in",
      to: "registration@aicog2026.com",
      bcc: [
        "ritik315cool@gmail.com",
        "asadabbas4338@gmail.com",
        // "ankur.s@onesimulation.co.in",
        // "ritik.k@onesimulation.co.in"
      ],
      subject: `AICOG Confirmed Bookings Report – ${reportDate} (${rowCount} bookings)`,
      text: `Please find attached the confirmed bookings report from 19 Dec 2025 to ${reportDate}.\n\nTotal bookings: ${rowCount}`,
      attachments: [
        {
          filename: path.basename(filePath),
          path: filePath
        }
      ]
    });
    console.log("✅ Email sent successfully");
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    // Don't throw - email failure shouldn't break the report generation
  }
}

/* =========================================================
   MAIN REPORT FUNCTION
   ========================================================= */
export async function generateDailyExcelReport() {
  const conn = await pool.getConnection();

  try {
    const { start, end } = getTimeRangeFromStartTillNow(
      process.env.REPORT_START_DATE || "2025-12-19"
    );

    console.log(`📊 Generating report from ${start.toISOString()} to ${end.toISOString()}`);

    const [rows] = await conn.query(
      `
      SELECT
        b.id AS booking_id,
        b.registration_id,
        b.name,
        b.email,
        b.mobile_no,
        b.amount_paid,
        b.currency,
        b.payment_ref,
        b.created_at,
        b.company_name,
        b.workshop_title,
        b.venue,
        b.status,
        DATE_FORMAT(s.session_date, '%d-%m-%Y') AS session_date,
        TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(s.end_time, '%H:%i') AS end_time,
        CONCAT(st.row_label, '-', st.col_number) AS seat_number
      FROM booking_seats bs
      JOIN bookings b ON b.id = bs.booking_id
      JOIN slots s ON s.id = bs.slot_id
      JOIN seats st ON st.id = bs.seat_id
      WHERE b.created_at >= ?
        AND b.created_at <= ?
        AND b.status = 'CONFIRMED'
      ORDER BY b.created_at ASC
      `,
      [start, end]
    );

    if (!rows || rows.length === 0) {
      console.log("⚠️  No CONFIRMED bookings found in the specified date range");
      return { success: true, count: 0, message: "No bookings to report" };
    }

    const reportsDir = path.resolve(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Cleanup old reports
    cleanupOldReports(reportsDir);

    const today = new Date().toISOString().slice(0, 10);
    const filePath = path.join(
      reportsDir,
      `AICOG_Confirmed_Bookings_19Dec_to_${today}.xlsx`
    );

    await generateExcel(rows, filePath);

    // Send email with report
    await sendEmail(filePath, today, rows.length);

    console.log(`✅ Excel generated successfully: ${filePath} (${rows.length} rows)`);
    
    return { 
      success: true, 
      count: rows.length, 
      filePath,
      message: `Report generated with ${rows.length} bookings`
    };
  } catch (err) {
    console.error("❌ Daily Report Error:", err);
    throw err; // Re-throw so caller can handle it
  } finally {
    conn.release();
  }
}

/* =========================================================
   MANUAL RUN (for testing)
   Run with: node backend/cron/dailyExcelReport.js
   ========================================================= */
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith("dailyExcelReport.js") ||
                     process.argv[1]?.includes("dailyExcelReport.js");

if (isMainModule) {
  console.log("🚀 Starting manual report generation...\n");
  generateDailyExcelReport()
    .then(result => {
      console.log("\n✅ Report generation completed successfully!");
      console.log("📊 Result:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("\n❌ Report generation failed!");
      console.error("Error details:", err);
      process.exit(1);
    });
}
