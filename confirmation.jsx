import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import QRCode from "qrcode";

export default function Confirmation(){
  const { search } = useLocation();
  const q = new URLSearchParams(search);

  const bookingId    = q.get("bookingId");
  const companyName  = q.get("companyName");
  const workshopTitle= q.get("workshopTitle");
  const venue        = q.get("venue");
  const date         = q.get("date");
  const startTime    = q.get("startTime");
  const endTime      = q.get("endTime");
  const seatNumber   = q.get("seatNumber");
  const amount       = q.get("amount");
  const userName     = q.get("userName");
  const userMobile   = q.get("userMobile");
  const userEmail    = q.get("userEmail");

  const [qrCodeData, setQrCodeData] = useState("");

  useEffect(() => { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    
    // Generate QR code data
    const generateQRCode = async () => {
      try {
        // Create a unique verification object
        const qrData = {
          bookingId: bookingId,
          Simulator: companyName,
          workshop: workshopTitle,
          Comapny : venue,
          date: date,
          startTime: startTime,
          endTime: endTime,
          seatNumber: seatNumber,
          userName: userName,
          userMobile: userMobile,
          timestamp: Date.now(),
          verificationCode: `${bookingId}-${Date.now()}` // Unique verification code
        };
        
        // Convert to JSON string for QR code
        const qrString = JSON.stringify(qrData);
        
        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(qrString, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        setQrCodeData(qrCodeDataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    
    if (bookingId) {
      generateQRCode();
    }
  }, [bookingId, companyName, workshopTitle, venue, date, startTime, endTime, seatNumber, userName, userMobile]);

  const downloadQRCode = () => {
    if (qrCodeData) {
      const link = document.createElement('a');
      link.download = `booking-qr-${bookingId}.png`;
      link.href = qrCodeData;
      link.click();
    }
  };

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            min-height: auto !important;
            page-break-inside: avoid;
            transform: scale(0.85);
            transform-origin: top left;
          }
          
          .print-hidden {
            display: none !important;
          }
          
          .print-compact {
            margin: 2px 0 !important;
            padding: 4px 0 !important;
          }
          
          .print-text-small {
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          
          .print-heading {
            font-size: 14px !important;
            margin: 6px 0 !important;
          }
          
          .print-qr {
            width: 80px !important;
            height: 80px !important;
          }
          
          @page {
            size: A4;
            margin: 0.3in;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 py-4 px-4 print-container">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-4 print-compact">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 print:w-12 print:h-12 print:mb-2">
            <svg className="w-8 h-8 text-white print:w-6 print:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 print-heading">Booking Confirmed!</h1>
          <p className="text-sm text-gray-600 print-text-small">Your seat has been reserved successfully.</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-5 mb-4 print-compact">
          <div className="border-b border-gray-200 pb-3 mb-4 print-compact">
            <h2 className="text-lg font-semibold text-gray-900 print-heading">Booking Details</h2>
            <p className="text-xs text-gray-500 mt-1 print-text-small">Booking ID: {bookingId}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-compact">
             <div className="space-y-3 print-compact">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-1 print-heading">Workshop Information</h3>
              <div className="space-y-2 print-compact">
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Simulator</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{companyName}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Workshop</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{workshopTitle}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Company</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{venue}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Date</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{date ? new Date(date).toLocaleDateString('en-IN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  }) : 'Not specified'}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Time Slot</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{startTime} - {endTime}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Seat Number</span>
                  <p className="text-sm font-medium text-blue-600 print-text-small">Seat {seatNumber}</p>
                </div>
              </div>
            </div>

              <div className="space-y-3 print-compact">
              <h3 className="text-sm font-semibold text-gray-900 border-b pb-1 print-heading">Attendee Information</h3>
              <div className="space-y-2 print-compact">
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Full Name</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{userName}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Mobile Number</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{userMobile}</p>
                </div>
                <div className="print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Email Address</span>
                  <p className="text-sm font-medium text-gray-900 print-text-small">{userEmail}</p>
                </div>
                <div className="pt-1 print-compact">
                  <span className="text-xs text-gray-500 print-text-small">Amount Paid</span>
                  <p className="font-bold text-xl text-green-600 print-heading">₹{amount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="border-t border-gray-200 pt-4 mt-4 print-compact">
            <div className="text-center print-compact">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 print-heading">Venue Verification QR Code</h3>
              <div className="flex flex-col items-center print-compact">
                {qrCodeData ? (
                  <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm print-compact">
                    <img 
                      src={qrCodeData} 
                      alt="Booking Verification QR Code" 
                      className="w-32 h-32 mx-auto print-qr"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-1"></div>
                      <p className="text-xs text-gray-500">Generating...</p>
                    </div>
                  </div>
                )}
                <div className="mt-3 max-w-sm text-center">
                  <p className="text-xs text-gray-600">
                    Show this QR code at the venue for verification.
                  </p>
                  <div className="mt-1 p-1 bg-blue-50 rounded">
                    <p className="text-xs text-blue-800 font-mono">
                      ID: {bookingId}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center print-hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            onClick={downloadQRCode}
            disabled={!qrCodeData}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download QR
          </button>
          <Link
            to="/"
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-lg hover:from-emerald-600 hover:to-blue-600 text-sm font-medium flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
