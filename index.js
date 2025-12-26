import express from "express";
import cors from "cors";
import morgan from "morgan";
// import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import aicog from "./routes/aicog.js";
import "./cron/index.js";
// import "./cron/dailyExcelReport.js";
import slots from "./routes/slots.js";
import bookings from "./routes/bookings.js";
import sameDayWorkshops from "./routes/samedayWorkshops.js";
import otps from "./routes/otps.js";

dotenv.config();

/* ------------------- __dirname fix (ESM) ------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ------------------- Environment ------------------- */
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const ALLOW_CREDENTIALS = process.env.ALLOW_CREDENTIALS === "true";

/* ------------------- Trust Proxy ------------------- */
if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

/* ------------------- CORS Configuration ------------------- */
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / curl
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("CORS policy: Origin not allowed"));
  },
  credentials: ALLOW_CREDENTIALS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-AICOG-SECRET"
  ],
  optionsSuccessStatus: 204,
  maxAge: 600
};

app.use(cors(corsOptions));

/* ------------------- Static Files ------------------- */
app.use(
  "/uploads",
  express.static(path.join(__dirname, "public", "uploads"), {
    maxAge: "1d"
  })
);

/* ------------------- Body Parsing ------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ------------------- HTTP Logging ------------------- */
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);

/* ------------------- Disable API caching ------------------- */
app.set("etag", false);
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

/* ------------------- API Routes ------------------- */
app.use("/api/slots", slots);
app.use("/api/bookings", bookings);
app.use("/api/workshops", sameDayWorkshops);
app.use("/api/otps", otps);
app.use("/api/aicog", aicog);

/* ------------------- Health Check ------------------- */
app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* ------------------- Root Endpoint ------------------- */
app.get("/", (_req, res) => {
  res.json({
    status: "API online",
    env: process.env.NODE_ENV || "development"
  });
});

/* ------------------- Global Error Handler ------------------- */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.message?.includes("CORS policy")) {
    return res.status(403).json({
      error: "Origin not allowed by CORS policy"
    });
  }

  console.error("ERROR:", err.stack || err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error"
  });
});

/* ------------------- Start Server ------------------- */
app.listen(PORT, () => {
  console.log(
    `API running on http://0.0.0.0:${PORT} | ENV=${process.env.NODE_ENV || "dev"}`
  );
});
