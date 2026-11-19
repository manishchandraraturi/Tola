"use client";

import * as React from "react";
import { SketchButton } from "@/components/tola/sketch";

export function RefinerForm({
  token,
  slipNumber,
}: {
  token: string;
  slipNumber: number;
}) {
  const [grams, setGrams] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setDone(null);
    setBusy(true);
    try {
      const res = await fetch("/api/refiner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, recoveredG: Number(grams) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not log the recovery.");
      setDone(
        `Logged ${Math.round(data.lot.recoveredG * 100) / 100} g for slip #${slipNumber}.`
      );
      setGrams("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the recovery.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="font-sketch text-sm font-bold">Recovered gold (grams)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max="1000"
          required
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          placeholder="e.g. 0.15"
          className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-lg text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
      </label>

      <SketchButton tone="green" type="submit" disabled={busy || !grams.trim()}>
        {busy ? "Logging…" : "Log recovered gold"}
      </SketchButton>

      {done && (
        <p className="border-[2px] border-[var(--green-line)] bg-[var(--green-fill)] px-3 py-2 text-sm">
          {done}
        </p>
      )}
      {error && (
        <p className="border-[2px] border-[var(--salmon-line)] bg-[var(--salmon-fill)] px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
