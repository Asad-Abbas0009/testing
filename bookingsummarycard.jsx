import React from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function BookingSummaryCard({
  companyName,
  workshopTitle,
  selectedTimeSlot,
  timeSlots,
  total,
  onBookClick,
  booking,
  disabled,
  miniSeatStatus,
  is40SeatMode = false
}) {
  const selectedSeatInfo = selectedTimeSlot !== null ? miniSeatStatus[selectedTimeSlot] : null;

  return (
    <div className="mt-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Booking Details */}
        <div className="space-y-2 max-w-2xl">
          <h4 className="font-semibold text-gray-900">Booking Summary</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex gap-2">
              <span className="font-medium">Company:</span>
              <span>{companyName}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-medium">Workshop:</span>
              <span>{workshopTitle}</span>
            </div>
            {selectedTimeSlot !== null && (
              is40SeatMode && selectedSeatInfo ? (
                <div className="flex gap-2">
                  <span className="font-medium">Selected Seat:</span>
                  <span className="text-blue-600 font-medium">
                    Seat {selectedSeatInfo.displayNo}
                  </span>
                </div>
              ) : timeSlots[selectedTimeSlot] ? (
                <div className="flex gap-2">
                  <span className="font-medium">Time Slot:</span>
                  <span className="text-blue-600 font-medium">
                    {timeSlots[selectedTimeSlot].displayStart} - {timeSlots[selectedTimeSlot].displayEnd}
                  </span>
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* Book Button & Price */}
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">₹{total}</div>
            <div className="text-xs text-gray-500">Total Amount</div>
          </div>
          <button
            className={cx(
              "px-8 py-3 rounded-xl text-white text-base font-semibold border transition-all duration-200",
              disabled || booking
                ? "bg-gray-400 border-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 border-transparent shadow-lg hover:shadow-xl transform hover:scale-105"
            )}
            disabled={disabled || booking}
            onClick={onBookClick}
          >
            {booking ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Processing...
              </span>
            ) : (
              selectedTimeSlot === null 
                ? (is40SeatMode ? "Select a Seat" : "Select a 15-min Slot") 
                : "Book Slot"
            )}
          </button>
          {selectedTimeSlot === null && (
            <p className="text-xs text-gray-500 text-center">
              {is40SeatMode ? "Select a seat to continue" : "Select a mini-slot to continue"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

