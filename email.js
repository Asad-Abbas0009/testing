import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
const EMAIL_FROM = process.env.EMAIL_FROM || `ONE Simulation <no-reply@onesimulation.co.in>`;

// parse helpers
const parseBool = (v, d = false) => {
  if (typeof v === "undefined") return d;
  return String(v).toLowerCase() === "true";
};
const parseIntOr = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const OTP_TTL_MINUTES = parseIntOr(process.env.OTP_TTL_MINUTES, 10);

// Build transporter (lazy)
let _transporter = null;
function buildTransporter() {
  if (_transporter) return _transporter;

  // Brevo (formerly Sendinblue) SMTP
  if (EMAIL_PROVIDER === "brevo") {
    if (!process.env.BREVO_SMTP_HOST || !process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_PASS) {
      throw new Error("Brevo configured but BREVO_SMTP_HOST/USER/PASS missing");
    }

    const port = Number(process.env.BREVO_SMTP_PORT || 587);
    // Port 587 uses STARTTLS (secure: false), port 465 uses SSL (secure: true)
    const secure = port === 465;

    _transporter = nodemailer.createTransport({
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
    return _transporter;
  }

  // Generic SMTP (fallback)
  if (!process.env.EMAIL_SMTP_HOST || !process.env.EMAIL_SMTP_USER || !process.env.EMAIL_SMTP_PASS) {
    throw new Error("SMTP settings missing (EMAIL_SMTP_HOST/EMAIL_SMTP_USER/EMAIL_SMTP_PASS)");
  }

  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const secure = parseBool(process.env.EMAIL_SMTP_SECURE, port === 465);
  const rejectUnauthorized = parseBool(process.env.EMAIL_SMTP_REJECT_UNAUTHORIZED, true);

  const transportOptions = {
    host: process.env.EMAIL_SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
    tls: {
      rejectUnauthorized,
    },
  };

  _transporter = nodemailer.createTransport(transportOptions);
  return _transporter;
}

/**
 * sendEmailOtp(toEmail, otp)
 * Sends an OTP email. Returns Promise resolving to nodemailer info.
 */
export async function sendEmailOtp(toEmail, otp) {
  if (!toEmail) throw new Error("Missing recipient email");
  if (!otp) throw new Error("Missing otp");

  // build transporter lazily (throws if misconfigured)
  const transporter = buildTransporter();

  const ttlMinutes = OTP_TTL_MINUTES;
  const subject = "Your ONE Simulation Verification Code";
  const plain = `Your ONE Simulation verification code is: ${otp}\n\nThis code expires in ${ttlMinutes} minutes.`;
  const html = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;">
      <h2 style="margin:0 0 8px 0">ONE Simulation — Email verification</h2>
      <p style="margin:0 0 12px 0">Your verification code is:</p>
      <div style="display:inline-block;padding:12px 16px;background:#111827;color:#fff;border-radius:6px;font-weight:700;font-size:20px;letter-spacing:2px">
        ${otp}
      </div>
      <p style="color:#6b7280;margin-top:12px;font-size:13px">This code will expire in ${ttlMinutes} minutes. If you did not request this, please ignore.</p>
    </div>
  `;

  const mailOptions = {
    from: EMAIL_FROM,
    to: toEmail,
    subject,
    text: plain,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    // attach minimal context and rethrow so caller can log & respond correctly
    const error = new Error("Failed to send email");
    error.cause = err;
    error.original = {
      provider: EMAIL_PROVIDER,
      from: EMAIL_FROM,
      to: toEmail,
      subject,
    };
    // It's helpful to log the underlying nodemailer error here in server logs:
    console.error("sendEmailOtp error:", err && (err.code || err.response) ? { code: err.code, response: err.response } : err);
    throw error;
  }
}

// Optional: verify transporter works (call at startup)
export async function verifyTransporter() {
  const transporter = buildTransporter();
  return transporter.verify();
}
