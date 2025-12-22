import React from "react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function TimeSlotGrid({
  timeSlots,
  miniSeatStatus,
  selectedTimeSlot,
  onSlotSelect,
  is40SeatMode = false
}) {
  // 40-seat mode: show all seats as individual buttons
  if (is40SeatMode) {
    const seats = Object.keys(miniSeatStatus).map(idx => ({
      index: Number(idx),
      ...miniSeatStatus[idx]
    })).sort((a, b) => a.displayNo - b.displayNo);

    return (
      <div className="rounded-xl border p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Select Your Seat (40 Seats Available)
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {seats.map((seat) => {
            const isBooked = seat.status !== "AVAILABLE";
            const isSelected = selectedTimeSlot === seat.index;

            return (
              <button
                key={seat.id}
                onClick={() => {
                  if (isBooked) return;
                  onSlotSelect(seat.index, Number(seat.id));
                }}
                disabled={isBooked}
                className={cx(
                  "p-3 rounded-lg border-2 transition-all duration-200 text-center",
                  isSelected
                    ? "border-blue-500 bg-blue-500 text-white shadow-lg transform scale-105"
                    : isBooked
                      ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                )}
                title={isBooked ? `Seat ${seat.displayNo} is already booked` : `Select Seat ${seat.displayNo}`}
              >
                <div className="text-sm font-semibold">Seat</div>
                <div className="text-lg font-bold">{seat.displayNo}</div>
                <div
                  className={cx(
                    "text-xs mt-1 px-2 py-0.5 rounded-full inline-block",
                    isSelected
                      ? "bg-white/20 text-white"
                      : isBooked
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                  )}
                >
                  {isBooked ? "BOOKED" : "AVAILABLE"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Original 4 mini-slot mode
  return (
    <div className="rounded-xl border p-6 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        Select 15-Minute Time Slot
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {timeSlots.map((slot, i) => {
          const info = miniSeatStatus[i];
          const isBooked = info && info.status !== "AVAILABLE";
          const isSelected = selectedTimeSlot === i;

          return (
            <button
              key={slot.id}
              onClick={() => {
                if (!info || info.status !== "AVAILABLE") return;
                onSlotSelect(i, Number(info.id));
              }}
              disabled={isBooked}
              className={cx(
                "p-4 rounded-lg border-2 transition-all duration-200 text-left",
                isSelected
                  ? "border-blue-500 bg-blue-500 text-white shadow-lg transform scale-105"
                  : isBooked
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
              )}
              title={isBooked ? "This 15-minute slot is already booked" : `${slot.displayStart} - ${slot.displayEnd}`}
            >
              <div className="text-sm font-semibold">{slot.displayStart}</div>
              <div className="text-xs opacity-75 mt-1">to {slot.displayEnd}</div>
              <div
                className={cx(
                  "text-xs mt-2 px-2 py-1 rounded-full inline-block",
                  isSelected
                    ? "bg-white/20 text-white"
                    : isBooked
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600"
                )}
              >
                {isBooked ? "BOOKED" : "AVAILABLE"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

