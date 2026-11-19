"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Users,
  Lock,
  CheckSquare,
  ArrowRight,
} from "lucide-react";
import {
  SketchBox,
  SketchButton,
  Stamp,
  Kicker,
} from "./sketch";
import { useToast } from "@/hooks/use-toast";

type KarigarOption = { id: string; name: string };

export default function Login({
  karigars,
  onLoggedIn,
  onShowLanding,
}: {
  karigars: KarigarOption[];
  onLoggedIn: () => void | Promise<void>;
  onShowLanding?: () => void;
}) {
  const { toast } = useToast();
  const [role, setRole] = React.useState<"jeweller" | "karigar">("jeweller");
  const [pin, setPin] = React.useState<string>("1234");
  const [karigarId, setKarigarId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedKarigarId = karigarId || karigars[0]?.id || "";

  const login = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          pin,
          ...(role === "karigar" ? { karigarId: selectedKarigarId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      toast({ title: "Logged in", description: `Welcome, ${data.actor.name}` });
      await onLoggedIn();
    } catch (e: any) {
      setError(e.message ?? "Login failed");
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Demo PIN hints
  const demoNote = process.env.NEXT_PUBLIC_DEMO === "1" ? (
    <div className="mt-3 p-2 border-t border-ink-soft/50 pb-2">
      <p className="font-hand text-sm text-ink-soft">DEMO PINs:</p>
      <div className="flex gap-2">
        <span className="font-mono text-xs font-bold text-ink">Jeweller: 1234</span>
        <span className="font-mono text-xs font-bold text-ink">Ravi: 1111</span>
        <span className="font-mono text-xs font-bold text-ink">Suresh: 2222</span>
        <span className="font-mono text-xs font-bold text-ink">Meena: 3333</span>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center font-hand bg-paper">
      <div className="max-w-md w-full space-y-6 p-8 border sketch-c bg-white">
        <div className="text-center">
          <Stamp status="ISSUED" />
          <h2 className="mt-3 font-sketch text-2xl font-bold text-ink">Tola</h2>
        </div>

        <p className="font-hand text-base text-ink-soft text-center">
          Log in to continue. Each karigar sees only his own account.
        </p>

        {demoNote}

        {/* View Pitch Deck & How it Works */}
        {onShowLanding && (
          <button
            className="w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base text-ink sketch-c rounded mb-3 hover:bg-[var(--marker-yellow-soft)] transition-colors"
            onClick={onShowLanding}
          >
            View Pitch Deck & How it Works
          </button>
        )}

        <div className="space-y-4">
          {/* Jeweller login */}
          <div>
            <label className="font-hand text-sm font-bold text-ink">Jeweller</label>
            <SketchButton
              tone="blue"
              onClick={() => {
                setRole("jeweller");
                setPin("1234");
              }}
              disabled={submitting}
              className="w-full"
            >
              Jeweller (Sri Lakshmi Jewellers)
            </SketchButton>
            <p className="font-hand text-xs text-ink-soft">PIN: 1234</p>
          </div>

          {/* Karigar login */}
          <div>
            <label className="font-hand text-sm font-bold text-ink">Karigar</label>
            <SketchButton
              tone="yellow"
              onClick={() => {
                setRole("karigar");
                setPin("");
              }}
              disabled={submitting}
              className="w-full"
            >
              Karigar login
            </SketchButton>
            <p className="font-hand text-xs text-ink-soft">
              PINs: Ravi 1111 · Suresh 2222 · Meena 3333
            </p>
            {role === "karigar" && (
              <select
                value={selectedKarigarId}
                onChange={(e) => setKarigarId(e.target.value)}
                disabled={submitting || karigars.length === 0}
                className="mt-2 w-full border-[2.5px] border-ink bg-white px-2 py-1.5 font-hand text-base text-ink sketch-c outline-none"
              >
                {karigars.length === 0 && <option value="">No karigars on file</option>}
                {karigars.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* PIN */}
          <div>
            <label className="font-hand text-sm font-bold text-ink">4-digit PIN</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus-ring-[var(--gold)]"
              placeholder="Enter 4-digit PIN"
            />
          </div>

          <SketchButton
            tone="green"
            onClick={login}
            disabled={submitting || pin.length !== 4}
            className="w-full"
          >
            {submitting ? "Logging in…" : "Log in"}
          </SketchButton>
        </div>

        {error && (
          <div className="bg-[var(--salmon-fill)] border border-[2px] border-[var(--marker-red)] rounded px-3 py-2 sketch-c">
            <p className="font-hand text-sm text-ink">{error}</p>
          </div>
        )}

        {role === "karigar" && selectedKarigarId && (
          <p className="mt-2 font-hand text-sm text-ink-soft">
            Logging in as: {karigars.find((k) => k.id === selectedKarigarId)?.name ?? selectedKarigarId}
          </p>
        )}

        {!submitting && (
          <p className="mt-3 font-hand text-sm text-ink-soft text-center">
            By logging in, you agree to the dual-signature model: both taps confirm every change.
          </p>
        )}
      </div>
    </div>
  );
}
