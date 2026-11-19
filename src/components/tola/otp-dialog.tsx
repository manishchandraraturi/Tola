"use client";

import { useState, useEffect } from "react";
import { SketchBox, SketchButton, SectionTitle, Kicker, TapChip } from "./sketch";

export function OtpDialog({ open, purpose, targetId, title, onClose, onVerified }: { open: boolean; purpose: "issue" | "confirm" | "return" | "approve" | "resolve-dispute"; targetId?: string; title?: string; onClose: () => void; onVerified: (auth: { challengeId: string; otp: string }) => Promise<void> | void }) {
  const [otp, setOtp] = useState<string>("");
  const [show, setShow] = useState(false);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // keep only digits
    if (value.length > 6) value = value.slice(0, 6);
    setOtp(value);
  };

  useEffect(() => {
    // Set show state after first render when open changes
    // We use a ref pattern to avoid setState-in-effect warning
    if (open) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!otp || otp.length !== 6) {
      alert("Please enter a valid 6-digit OTP code.");
      return;
    }
    const challengeId = localStorage.getItem("tota_otp_challenge_id");
    if (challengeId) {
      await onVerified({ challengeId, otp });
    } else {
      alert("No OTP challenge found. Please try again.");
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <SketchBox tone="salmon" variant="c" style={{ padding: "1.5rem", maxWidth: "400px" }}>
      <SectionTitle>{title || "OTP Confirmation"}</SectionTitle>
      <p className="text-ink-soft small mb-4">
        Enter the 6-digit OTP code sent to your DEMO SMS inbox
      </p>

      <div className="mt-4">
        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={handleInput}
          pattern="[0-9]{6}"
          inputMode="numeric"
          className="w-full border-[2px] border-ink rounded paper-shadow px-3 py-2 text-3xl text-center font-sketch focus-outline"
          aria-label="6-digit OTP code"
          placeholder="123456"
        />
      </div>

      <div className="mt-6 flex gap-3">
        <SketchButton onClick={handleConfirm} disabled={otp.length !== 6}>
          Confirm OTP
        </SketchButton>
        <SketchButton onClick={() => setShow(false)} className="ml-3">Cancel</SketchButton>
      </div>

      <p className="text-ink-soft small mt-4">
        <a href="/api/notifications" className="underline text-ink-soft">
          View DEMO SMS inbox
        </a>
      </p>
    </SketchBox>
  );
}