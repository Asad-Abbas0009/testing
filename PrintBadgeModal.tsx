"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Printer } from "lucide-react";
import type { VisitorRecord } from "@/lib/types";
import { buildPassQrPayload } from "@/lib/qrPayload";

type CardProps = {
  visitor: VisitorRecord;
  /** Set on the printable copy. The WhatsApp capture uses a ref instead. */
  cardId?: string;
};

/** The visitor badge drawn at check-in. Print and WhatsApp both use this. */
export const VisitorBadgeCard = forwardRef<HTMLDivElement, CardProps>(
  function VisitorBadgeCard({ visitor, cardId }, ref) {
    const now = new Date();
    const dateStr = now
      .toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
      .toUpperCase();
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const primaryQrData = JSON.stringify(buildPassQrPayload(visitor));
    const badgePhoto = visitor.storedPhotoUrl || visitor.photoUrl;
    const photoCrossOrigin =
      badgePhoto && !badgePhoto.startsWith("data:") ? ("anonymous" as const) : undefined;

    return (
      <div
        ref={ref}
        id={cardId}
        className="relative w-[360px] overflow-hidden rounded-3xl bg-gradient-to-b from-[#e8f0ff] to-white shadow-2xl print:shadow-none"
        style={{ border: "2px solid #bfd0f7" }}
      >
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-48 opacity-10"
          viewBox="0 0 200 500"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="160" cy="80" r="40" fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
          <circle cx="140" cy="80" r="60" fill="none" stroke="#1d4ed8" strokeWidth="1" />
        </svg>

        <div className="flex justify-center pt-4 pb-1">
          <div className="h-3 w-14 rounded-full bg-blue-800" />
        </div>

        <div className="flex items-center justify-center gap-2.5 px-6 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ONE SIMULATION" className="h-9 w-auto object-contain" />
          <div>
            <p className="text-[13px] font-extrabold leading-tight tracking-wide text-blue-900">
              ONE SIMULATION
            </p>
            <p className="text-[9px] font-medium text-blue-500">Transforming Healthcare Landscape</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-1.5">
          <div className="flex-1 border-t-2 border-blue-200" />
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            <span className="text-base font-black tracking-[0.18em] text-blue-900">VISITOR PASS</span>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          </div>
          <div className="flex-1 border-t-2 border-blue-200" />
        </div>

        <div className="flex justify-center py-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-36 w-36 rounded-full border-2 border-blue-300/50" />
            <div className="absolute h-32 w-32 rounded-full border-[3px] border-blue-400/60" />
            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow-lg">
              {badgePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={badgePhoto}
                  alt={visitor.name}
                  crossOrigin={photoCrossOrigin}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-100">
                  <span className="text-3xl font-bold text-blue-400">
                    {visitor.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 text-center">
          <p className="text-xl font-black uppercase tracking-wider text-blue-900">{visitor.name}</p>
          <div className="mt-2 flex justify-center">
            <span className="rounded-md bg-blue-700 px-5 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
              {visitor.purpose}
            </span>
          </div>
          {visitor.email && visitor.email !== "—" && (
            <p className="mt-2 text-[10px] font-semibold text-slate-500">{visitor.email}</p>
          )}
        </div>

        <div className="mx-8 mt-4 flex items-center gap-2">
          <div className="flex-1 border-t border-blue-200" />
          <div className="h-1.5 w-1.5 rounded-full bg-blue-300" />
          <div className="flex-1 border-t border-blue-200" />
        </div>

        <div className="pt-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Visitor ID</p>
          <p className="mt-0.5 text-xl font-black text-blue-600">{visitor.id}</p>
        </div>

        <div className="flex flex-col items-center gap-1.5 px-6 pt-3 pb-1">
          <div className="rounded-2xl border-2 border-blue-200 bg-white p-3 shadow-sm">
            <QRCodeSVG value={primaryQrData} size={110} level="H" />
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Scan at the kiosk to check in or out
          </p>
        </div>

        <div className="mt-3">
          <svg
            viewBox="0 0 360 28"
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path d="M0,28 Q90,0 180,14 Q270,28 360,4 L360,28 Z" fill="#1e40af" />
          </svg>
          <div className="grid grid-cols-3 divide-x divide-blue-600 bg-blue-800 px-3 pb-5 text-white">
            <div className="flex items-center gap-2 pr-2">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-wider text-blue-300">Valid For</p>
                <p className="text-[11px] font-black">{visitor.validFor?.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-wider text-blue-300">Date & Time</p>
                <p className="text-[10px] font-black leading-tight">{dateStr}</p>
                <p className="text-[9px] font-semibold text-blue-200">{timeStr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-2">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-wider text-blue-300">Department</p>
                <p className="text-[10px] font-black leading-tight uppercase">
                  {visitor.department || "Reception"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

type Props = {
  visitor: VisitorRecord;
  onClose: () => void;
};

export function PrintBadgeModal({ visitor, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-black/60 p-4 print:bg-transparent print:block print:p-0">
      <VisitorBadgeCard visitor={visitor} cardId="visitor-pass-print" />

      <div className="mt-5 flex gap-3 print:hidden">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
          CLOSE
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          PRINT
        </button>
      </div>
    </div>
  );
}
