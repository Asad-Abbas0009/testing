"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, LogOut, Printer, User } from "lucide-react";
import { ProgressStepper } from "./ProgressStepper";
import { PrintBadgeModal, VisitorBadgeCard } from "./PrintBadgeModal";
import type { VisitorRecord } from "@/lib/types";
import { captureBadgeJpeg } from "@/lib/captureBadge";
import { SEND_OFF_TITLE, sendOffNote, welcomeNote } from "@/lib/kioskCopy";

type Props = {
  visitor: VisitorRecord;
  mode?: "checkin" | "checkout";
  apiBase: string;
  onDone: () => void;
};

export function PassGeneratedScreen({ visitor, mode = "checkin", apiBase, onDone }: Props) {
  const [showBadge, setShowBadge] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const badgeSent = useRef(false);
  const isCheckout = mode === "checkout";
  const checkoutTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // The check-in screen already draws the visitor badge. Capture that same
  // card and hand the JPEG to the backend for the WhatsApp header.
  useEffect(() => {
    if (isCheckout || !apiBase) return;
    let cancelled = false;
    let timer = 0;

    const report = (message: string) => {
      fetch(`${apiBase}/checkin/badge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitor.id, error: message }),
      }).catch(() => {});
    };

    const sendBadge = async (attempt: number) => {
      if (cancelled || badgeSent.current) return;
      const node = badgeRef.current;
      if (!node) {
        if (attempt < 5) timer = window.setTimeout(() => sendBadge(attempt + 1), 400);
        else report("visitor badge was not on the check-in screen");
        return;
      }
      try {
        const images = Array.from(node.querySelectorAll("img"));
        await Promise.all(
          images.map(
            (img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.addEventListener("load", () => resolve(), { once: true });
                    img.addEventListener("error", () => resolve(), { once: true });
                  })
          )
        );
        if (cancelled || badgeSent.current) return;
        const image = await captureBadgeJpeg(node);
        if (cancelled || badgeSent.current || !image) return;
        const response = await fetch(`${apiBase}/checkin/badge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitor_id: visitor.id, image }),
        });
        if (!response.ok) throw new Error(`badge upload HTTP ${response.status}`);
        badgeSent.current = true;
      } catch (err) {
        if (cancelled || badgeSent.current) return;
        const message = err instanceof Error ? err.message : String(err);
        if (attempt < 2) {
          timer = window.setTimeout(() => sendBadge(attempt + 1), 800);
          return;
        }
        console.error("Could not send the visitor badge on WhatsApp:", err);
        report(message);
      }
    };

    timer = window.setTimeout(() => sendBadge(0), 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase, isCheckout, visitor.id]);

  // ── Checkout pass ─────────────────────────────────────────────────────────────
  if (isCheckout) {
    return (
      <div className="kiosk-shell bg-gradient-to-b from-white to-amber-50/30">
        <ProgressStepper currentStep={3} mode="checkout" />

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-8">
          <div className="w-full rounded-3xl border border-amber-100 bg-white shadow-xl overflow-hidden">
            {/* Amber banner */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                  <LogOut className="h-7 w-7 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold tracking-wide text-white">{SEND_OFF_TITLE}</p>
                  <p className="smile-pop text-base font-semibold text-white">
                    {sendOffNote(visitor.name)}
                  </p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">Check-Out Time</p>
                <p className="text-2xl font-extrabold text-white">{checkoutTime}</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-6 p-8 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-3">
                <div className="h-40 w-40 overflow-hidden rounded-2xl border-4 border-amber-100 bg-slate-100 shadow-md">
                  {visitor.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visitor.photoUrl} alt={visitor.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                      <User className="h-16 w-16 text-slate-400" />
                    </div>
                  )}
                </div>
                <span className="rounded-xl bg-amber-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                  Signed Out
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-center gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visitor Name</p>
                  <p className="mt-0.5 text-2xl font-extrabold text-slate-800">{visitor.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <InfoBox label="Visitor ID" value={visitor.id} />
                  <InfoBox label="Phone" value={visitor.phone} />
                  <InfoBox label="Check-Out" value={checkoutTime} highlight />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onDone}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-12 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-all hover:bg-amber-600 active:scale-[0.98]"
          >
            <Check className="h-4 w-4" />
            DONE
          </button>
        </main>
      </div>
    );
  }

  // ── Check-in pass ─────────────────────────────────────────────────────────────
  return (
    <div className="kiosk-shell bg-gradient-to-b from-white to-brand-50/40">
      <ProgressStepper currentStep={3} mode="checkin" />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-8 lg:flex-row lg:items-stretch">

        {/* Photo — portrait aspect ratio so width scales with height */}
        <div className="shrink-0 lg:w-64">
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-200 shadow-elevated">
            {visitor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visitor.photoUrl} alt={visitor.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                <User className="h-16 w-16 text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {/* Right content */}
        <div className="flex flex-1 flex-col gap-5">
          {/* Heading */}
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-success-500" strokeWidth={2} />
            <div>
              <p className="text-2xl font-extrabold tracking-wide text-success-600">ACCESS GRANTED</p>
              <p className="smile-pop text-lg font-semibold text-slate-700">
                {welcomeNote(visitor.name, visitor.isReturning)}
              </p>
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5 shadow-sm">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="Visitor Name" value={visitor.name} />
              <InfoRow label="Visitor ID" value={visitor.id} />
              <InfoRow label="Purpose of Visit" value={visitor.purpose} />
              <InfoRow label="Email" value={visitor.email} />
              <InfoRow label="Valid For" value={visitor.validFor} />
              <InfoRow label="Phone No." value={visitor.phone} />
            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 px-5 py-4 text-sm text-slate-600">
            Print the badge to carry the visitor pass — its QR code checks you in and out.
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowBadge(true)} className="btn-outline flex-1">
              <Printer className="h-4 w-4" />
              PRINT BADGE
            </button>
            <button onClick={onDone} className="btn-primary flex-1">
              <Check className="h-4 w-4" />
              DONE
            </button>
          </div>
        </div>
      </main>

      {/* Same badge as Print, outside the visible page so it can be captured. */}
      <div className="pointer-events-none fixed top-0" style={{ left: "-100vw" }} aria-hidden>
        <VisitorBadgeCard ref={badgeRef} visitor={visitor} />
      </div>

      {/* Print badge modal */}
      {showBadge && (
        <PrintBadgeModal visitor={visitor} onClose={() => setShowBadge(false)} />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-amber-50 border border-amber-100" : "bg-slate-50 border border-slate-100"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${highlight ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
