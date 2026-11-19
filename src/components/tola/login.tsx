"use client";

import * as React from "react";
import { ArrowRight, Check, Lock, Store, Users } from "lucide-react";
import { SketchButton, Stamp, Kicker } from "./sketch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type KarigarOption = { id: string; name: string };

/** PIN hints are demo scaffolding, so they only render when demo mode is on. */
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

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

  const chooseRole = (next: "jeweller" | "karigar") => {
    if (submitting) return;
    setRole(next);
    setError(null);
    // Never carry one side's PIN into the other side's login.
    setPin(next === "jeweller" ? "1234" : "");
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-paper px-4 py-10 font-hand sm:px-6">
      {/* Soft gold / blue wash so the full screen reads as a product, not a dev sandbox. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--gold)]/25 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[var(--blue-fill)]/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl border-[3px] border-ink bg-white p-7 paper-shadow sketch-c sm:p-10 lg:p-12">
        <div className="text-center">
          <Stamp status="ISSUED" />
          <h1 className="mt-4 font-sketch text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Tola
          </h1>
          <Kicker className="mt-3">Dual-signed gold ledger</Kicker>
          <p className="mx-auto mt-4 max-w-lg font-hand text-base text-ink-soft sm:text-lg">
            Log in to continue. Each karigar sees only his own account.
          </p>
        </div>

        {onShowLanding && (
          <button
            type="button"
            onClick={onShowLanding}
            className="group mt-7 flex w-full items-center justify-center gap-2 border-[2.5px] border-ink bg-white px-4 py-3 font-hand text-base text-ink sketch-c transition-colors hover:bg-[var(--marker-yellow-soft)] sm:text-lg"
          >
            View Pitch Deck &amp; How it Works
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>
        )}

        <div className="mt-8 space-y-6">
          {/* Role selection */}
          <div>
            <p className="font-hand text-base font-bold text-ink">Sign in as</p>
            <div
              role="radiogroup"
              aria-label="Account type"
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              <RoleCard
                selected={role === "jeweller"}
                disabled={submitting}
                icon={<Store className="h-6 w-6" aria-hidden="true" />}
                title="Jeweller"
                subtitle="Shop owner"
                onSelect={() => chooseRole("jeweller")}
              />
              <RoleCard
                selected={role === "karigar"}
                disabled={submitting}
                icon={<Users className="h-6 w-6" aria-hidden="true" />}
                title="Karigar login"
                subtitle="Gold worker"
                onSelect={() => chooseRole("karigar")}
              />
            </div>
          </div>

          {/* Karigar account picker */}
          {role === "karigar" && (
            <div className="border-[2.5px] border-ink bg-[var(--blue-fill)]/40 p-4 sketch-c">
              <label
                htmlFor="karigar-account"
                className="font-hand text-base font-bold text-ink"
              >
                Karigar account
              </label>
              <select
                id="karigar-account"
                value={selectedKarigarId}
                onChange={(e) => setKarigarId(e.target.value)}
                disabled={submitting || karigars.length === 0}
                className="mt-2 w-full border-[2.5px] border-ink bg-white px-3 py-3 font-hand text-base text-ink sketch-c outline-none sm:text-lg"
              >
                {karigars.length === 0 && <option value="">No karigars on file</option>}
                {karigars.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
              {karigars.length > 0 && (
                <p className="mt-2 font-hand text-sm text-ink-soft">
                  Logging in as{" "}
                  <b className="text-ink">
                    {karigars.find((k) => k.id === selectedKarigarId)?.name ??
                      selectedKarigarId}
                  </b>
                </p>
              )}
            </div>
          )}

          {/* PIN */}
          <div>
            <label htmlFor="login-pin" className="font-hand text-base font-bold text-ink">
              4-digit PIN
            </label>
            <div className="relative mt-2">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
              <input
                id="login-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={4}
                className="w-full border-[2.5px] border-ink bg-white py-3.5 pl-11 pr-3 font-hand text-lg tracking-[0.4em] text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)] sm:text-xl"
                placeholder="••••"
              />
            </div>
          </div>

          <SketchButton
            tone="green"
            onClick={login}
            disabled={submitting || pin.length !== 4}
            className="w-full py-4 font-bold text-lg sm:text-xl"
          >
            {submitting ? "Logging in…" : "Log in"}
          </SketchButton>

          {!submitting && pin.length !== 4 && (
            <p className="-mt-2 text-center font-hand text-sm text-ink-soft">
              Enter your 4-digit PIN to continue.
            </p>
          )}
        </div>

        {error && (
          <div className="mt-6 border-[2px] border-[var(--marker-red)] bg-[var(--salmon-fill)] px-4 py-3 sketch-c">
            <p className="font-hand text-base text-ink">{error}</p>
          </div>
        )}

        {DEMO && (
          <div className="mt-8 border-t-2 border-dashed border-ink-soft/60 pt-4">
            <p className="font-hand text-sm text-ink-soft">DEMO PINs:</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-mono text-xs font-bold text-ink">Jeweller: 1234</span>
              <span className="font-mono text-xs font-bold text-ink">Ravi: 1111</span>
              <span className="font-mono text-xs font-bold text-ink">Suresh: 2222</span>
              <span className="font-mono text-xs font-bold text-ink">Meena: 3333</span>
            </div>
          </div>
        )}

        {!submitting && (
          <p className="mt-6 text-center font-hand text-sm text-ink-soft sm:text-base">
            By logging in, you agree to the dual-signature model: both taps confirm every change.
          </p>
        )}
      </div>
    </div>
  );
}

/** One half of the role switch: a large tap target that shows its selected state. */
function RoleCard({
  selected,
  disabled,
  icon,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 border-[2.5px] px-4 py-4 text-left transition-all sketch-c",
        selected ? "shadow-[3px_3px_0_var(--ink)]" : "bg-white hover:-translate-y-0.5 hover:bg-[var(--marker-yellow-soft)]",
        disabled && "cursor-not-allowed opacity-60"
      )}
      style={
        selected
          ? { background: "var(--gold)", borderColor: "var(--gold-deep)", color: "#6B4A08" }
          : { borderColor: "var(--ink)", color: "var(--ink)" }
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-sketch text-lg font-bold leading-tight sm:text-xl">{title}</span>
        <span className="block font-hand text-sm opacity-80">{subtitle}</span>
      </span>
      {selected && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B4A08] text-white">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
