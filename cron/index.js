import cron from "node-cron";
import { autoCancelPendingBookings } from "./autoCancelBookings.js";
import { generateDailyExcelReport } from "./dailyExcelReport.js";

/**
 * Auto-cancel pending bookings
 * Runs every 1 minute
 */
cron.schedule("* * * * *", async () => {
  await autoCancelPendingBookings();
});

/**
 * Daily Excel Report
 * Runs every day at 6:00 AM IST
 */
cron.schedule("0 6 * * *", async () => {
  console.log("📊 [CRON] Starting daily Excel report generation at 6:00 AM IST...");
  try {
    const result = await generateDailyExcelReport();
    console.log("✅ [CRON] Daily report completed:", result.message);
  } catch (err) {
    console.error("❌ [CRON] Daily report failed:", err.message);
    // Don't throw - let cron continue running
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log("✅ Cron jobs scheduled:");
console.log("   - Auto-cancel pending bookings: Every 1 minute");
console.log("   - Daily Excel report: Every day at 6:00 AM IST");
