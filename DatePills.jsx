import React from "react";

export default function DatePills({ options = [], activeISO, onChange }) {
  // Get current month and year from active date
  const activeDate = new Date(activeISO);
  const currentMonth = activeDate.toLocaleDateString("en-US", {
    month: "long",
  });
  const currentYear = activeDate.getFullYear();

  // 🔒 Allowed date range
  const MIN_DATE_ISO = "2026-01-14";
  const MAX_DATE_ISO = "2026-01-20";

  return (
    <div className="space-y-2 md:space-y-3">
      {/* Month and Year Header */}
      <div className="text-center">
        <h3 className="text-base md:text-lg font-semibold text-gray-800">
          {currentMonth} {currentYear}
        </h3>
      </div>

      {/* Date Pills */}
      <div className="flex flex-wrap gap-1.5 md:gap-2 justify-center">
        {options.map((opt) => {
          const active = opt.iso === activeISO;

          // 🚫 Disable everything outside allowed range
          const isOutOfRange =
            opt.iso < MIN_DATE_ISO || opt.iso > MAX_DATE_ISO;

          return (
            <button
              key={opt.iso}
              disabled={isOutOfRange}
              onClick={() => !isOutOfRange && onChange?.(opt.iso)}
              title={isOutOfRange ? "Date not available" : ""}
              className={`
                relative rounded-lg px-2.5 md:px-3 py-1.5 md:py-2
                text-sm font-medium transition-all duration-200
                min-w-[50px] md:min-w-[60px]

                ${
                  active
                    ? "bg-blue-600 text-white shadow-md"
                    : isOutOfRange
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-blue-300"
                }
              `}
            >
              <div className="text-xs opacity-80">{opt.day}</div>
              <div className="text-sm md:text-base font-semibold">
                {String(opt.dateNum).padStart(2, "0")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
