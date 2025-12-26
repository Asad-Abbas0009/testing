import React from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function UserDetailsModal({
  isOpen,
  onClose,
  userDetails,
  setUserDetails,
  isNameValid,
  isMobileValid,
  isEmailValid,
  isRegistrationIdValid,
  otpSent,
  setOtpSent,
  emailVerified,
  setEmailVerified,
  otp,
  setOtp,
  otpStatus,
  setOtpStatus,
  sendingOtp,
  verifyingOtp,
  otpAttemptsLeft,
  acceptedTerms,
  setAcceptedTerms,
  canConfirmBooking,
  onConfirmBooking,
  booking,
  error,
  onSendOtp,
  onResendOtp,
  onVerifyOtp,
  canSendOtp
}) {
  // Track which fields have been touched/interacted with
  const [touchedFields, setTouchedFields] = React.useState({
    name: false,
    registrationId: false,
    mobile: false,
    email: false
  });

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset OTP state when closing (parent will handle otpAttemptsLeft)
    setOtpSent(false);
    setOtp("");
    setOtpStatus("");
    setEmailVerified(false);
    setAcceptedTerms(false);
    setTouchedFields({ name: false, registrationId: false, mobile: false, email: false });
    onClose();
  };

  const handleFieldBlur = (fieldName) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleEmailChange = (e) => {
    setUserDetails(prev => ({ ...prev, email: e.target.value }));
    // Reset OTP state if email changes
    if (otpSent) {
      setOtpSent(false);
      setEmailVerified(false);
      setOtp("");
      setOtpStatus("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Enter Your Details</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={userDetails.name}
              onChange={(e) => setUserDetails(prev => ({ ...prev, name: e.target.value }))}
              onBlur={() => handleFieldBlur('name')}
              className={cx(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors",
                touchedFields.name && !isNameValid
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300"
              )}
              placeholder="Enter your full name"
            />
            {touchedFields.name && !isNameValid && (
              <p className="mt-1 text-xs text-red-600">Enter at least 2 characters.</p>
            )}
          </div>

          {/* Registration ID Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Registration ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={userDetails.registrationId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                setUserDetails(prev => ({
                  ...prev,
                  registrationId: value
                }));
              }}
              onBlur={() => handleFieldBlur('registrationId')}
              className={cx(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors",
                touchedFields.registrationId && !isRegistrationIdValid
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300"
              )}
              placeholder="Enter your AICOG Registration ID"
            />
            {touchedFields.registrationId && !isRegistrationIdValid && (
              <p className="mt-1 text-xs text-red-600">
                Registration ID is required.
              </p>
            )}
          </div>
          {/* Mobile Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={userDetails.mobile}
              onChange={(e) => setUserDetails(prev => ({ ...prev, mobile: e.target.value }))}
              onBlur={() => handleFieldBlur('mobile')}
              className={cx(
                "w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors",
                touchedFields.mobile && !isMobileValid
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                  : "border-gray-300"
              )}
              placeholder="Enter your mobile number"
            />
            {touchedFields.mobile && !isMobileValid && (
              <p className="mt-1 text-xs text-red-600">Enter a 10-digit Indian mobile (starts 6–9).</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={userDetails.email}
                onChange={handleEmailChange}
                onBlur={() => handleFieldBlur('email')}
                className={cx(
                  "flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors",
                  touchedFields.email && !isEmailValid
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300",
                  otpSent && !emailVerified && "bg-gray-50"
                )}
                placeholder="Enter your email address"
                disabled={otpSent && !emailVerified}
              />
              {!otpSent && (
                <button
                  onClick={onSendOtp}
                  disabled={!canSendOtp}
                  className={cx(
                    "px-6 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    canSendOtp
                      ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  )}
                >
                  {sendingOtp ? "Sending..." : "Send OTP"}
                </button>
              )}
            </div>
            {touchedFields.email && !isEmailValid && (
              <p className="mt-1 text-xs text-red-600">Enter a valid email (e.g., name@example.com).</p>
            )}
            {otpStatus && !otpSent && (
              <p
                className={cx(
                  "mt-1 text-xs",
                  otpStatus.includes("✅") || otpStatus.includes("sent")
                    ? "text-green-600"
                    : "text-red-600"
                )}
              >
                {otpStatus}
              </p>
            )}
          </div>

          {/* OTP Section */}
          {otpSent && (
            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-lg tracking-widest"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={emailVerified}
                />
                <button
                  onClick={onResendOtp}
                  disabled={sendingOtp || emailVerified}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingOtp ? "Sending..." : "Resend"}
                </button>
                {!emailVerified && (
                  <button
                    onClick={onVerifyOtp}
                    disabled={verifyingOtp || !otp || otp.trim().length !== 6}
                    className={cx(
                      "px-6 py-3 rounded-lg text-sm font-medium whitespace-nowrap",
                      verifyingOtp || !otp || otp.trim().length !== 6
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    {verifyingOtp ? "Verifying..." : "Verify"}
                  </button>
                )}
              </div>
              {otpStatus && (
                <p
                  className={cx(
                    "mt-2 text-xs",
                    otpStatus.includes("✅") || otpStatus.includes("sent") || otpStatus.includes("verified")
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {otpStatus}
                </p>
              )}
              {otpAttemptsLeft !== null && (
                <p className="mt-1 text-xs text-gray-500">
                  Attempts remaining: {otpAttemptsLeft}
                </p>
              )}
              {emailVerified && (
                <p className="mt-2 text-xs text-green-600 font-medium">
                  ✓ Email verified! Please accept the terms and conditions below to proceed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Terms and Conditions Section */}
        <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900">Terms & Conditions</h4>
          </div>
          <div className="bg-white px-4 py-4 max-h-48 overflow-y-auto text-xs text-gray-700 leading-relaxed space-y-3 custom-scrollbar">
            <div>
              <p className="font-semibold text-gray-900 text-sm mb-2">Simulation Metaverse at AICOG 2026, Delhi</p>
              <ul className="space-y-1.5 ml-4">
                <li className="list-disc">First time in AICOG</li>
                <li className="list-disc">Real-life-like simulation for skills covering all subspecialities of obstetrics and gynaecology...</li>
                <li className="list-disc">More than 3000 delegates will get an opportunity to practice hand-on on simulation models</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Terms & Conditions:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-2">
                <li>Only registered delegates for AICOG can apply</li>
                <li>Online booking is available at the AICOG website</li>
                <li>One candidate can book a maximum of 3 slots, priced at INR 500/- per slot</li>
                <li>A QR code will be issued on booking</li>
                <li>The candidates must ensure that they arrive as per the allotted time slot and leave at the end of the time slot to ensure smooth functioning of the arena</li>
                <li>Candidate late by half an hour from the slot timing will be denied entry</li>
                <li>If a slot is missed, there will be no refund of booking amount</li>
                <li>Candidates must ensure that the high fidelity simulation models are handled with care and no damage is incurred</li>
              </ol>
            </div>
          </div>

          {/* Accept Terms Checkbox */}
          <div
            className={cx(
              "bg-gray-50 px-4 py-3 border-t border-gray-200",
              !emailVerified && "opacity-50"
            )}
          >
            <label
              className={cx(
                "flex items-start gap-2",
                emailVerified ? "cursor-pointer group" : "cursor-not-allowed"
              )}
            >
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                disabled={!emailVerified}
                className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-700 group-hover:text-gray-900">
                I have read and agree to the terms and conditions <span className="text-red-500">*</span>
                {!emailVerified && (
                  <span className="block mt-1 text-red-600">(Please verify your email first)</span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>

          <button
            onClick={onConfirmBooking}
            disabled={!canConfirmBooking || booking}
            className={cx(
              "flex-1 px-4 py-3 rounded-lg font-medium transition-all",
              canConfirmBooking && !booking
                ? "bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600 shadow-lg"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            )}
          >
            {booking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Processing...
              </span>
            ) : (
              "Confirm Booking"
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}
