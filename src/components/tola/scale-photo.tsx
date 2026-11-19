"use client";

import * as React from "react";
import { SketchButton } from "./sketch";

// Kept local so the browser bundle never pulls the server-only hashing module.
const SCALE_CONFIDENCE_THRESHOLD = 0.75;
const needsHumanCheck = (confidence: number) =>
  confidence < SCALE_CONFIDENCE_THRESHOLD;

export type ScalePhotoDraft = {
  weightGrams: number;
  confidence: number;
  sha256: string;
  filename: string;
  source: "photo";
};

type ReadingState = {
  weightGrams: number;
  confidence: number;
  raw: string;
  sha256: string;
  filename: string;
  provider: string;
  isDemo: boolean;
  note?: string;
};

type ScaleApiResponse = {
  reading?: { weightGrams?: number; confidence?: number; raw?: string };
  sha256?: string;
  filename?: string;
  provider?: string;
  isDemo?: boolean;
  note?: string;
  error?: string;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
}

/**
 * Snap the scale → read the weight → show an editable confirmation card.
 * The photo itself is not uploaded to storage; only its SHA-256 and the read
 * weight travel with the slip.
 */
export function ScalePhotoCard({ onUse }: { onUse: (draft: ScalePhotoDraft) => void }) {
  const [reading, setReading] = React.useState<ReadingState | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [editedWeight, setEditedWeight] = React.useState("");
  const [manualCheck, setManualCheck] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function analyse(payload: {
    imageBase64?: string;
    mimeType?: string;
    filename: string;
    demo?: boolean;
  }) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/scribe/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ScaleApiResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not read that photo.");
      if (
        !data.reading ||
        typeof data.reading.weightGrams !== "number" ||
        typeof data.reading.confidence !== "number" ||
        !data.sha256
      ) {
        throw new Error("The scale reading came back incomplete. Try the photo again.");
      }

      setReading({
        weightGrams: data.reading.weightGrams,
        confidence: data.reading.confidence,
        raw: String(data.reading.raw ?? ""),
        sha256: data.sha256,
        filename: String(data.filename ?? payload.filename),
        provider: String(data.provider ?? "unknown"),
        isDemo: Boolean(data.isDemo),
        note: data.note,
      });
      setEditedWeight(String(data.reading.weightGrams));
      setManualCheck(false);
      if (data.note) setNotice(data.note);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose a photo of the scale display (JPEG, PNG or WebP).");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setNotice("That photo is too large. Use one under 6 MB.");
      return;
    }

    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview(dataUrl);
      await analyse({
        imageBase64: dataUrl.split(",")[1] ?? "",
        mimeType: file.type,
        filename: file.name,
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that photo.");
    }
  }

  async function runDemoPhoto() {
    setPreview(null);
    await analyse({ demo: true, filename: "demo-scale-photo.jpg" });
  }

  function reset() {
    setReading(null);
    setPreview(null);
    setEditedWeight("");
    setManualCheck(false);
    setNotice(null);
  }

  const parsedWeight = parseFloat(editedWeight);
  const requiresCheck = reading
    ? needsHumanCheck(reading.confidence) || reading.isDemo
    : false;
  const canUse =
    Boolean(reading) &&
    Number.isFinite(parsedWeight) &&
    parsedWeight > 0 &&
    (!requiresCheck || manualCheck);

  function useWeight() {
    if (!reading || !canUse) return;
    onUse({
      weightGrams: Math.round(parsedWeight * 100) / 100,
      confidence: reading.confidence,
      sha256: reading.sha256,
      filename: reading.filename,
      source: "photo",
    });
    setNotice("Weight sent to the slip form. The photo hash travels with the slip.");
  }

  const confidencePct = reading ? Math.round(reading.confidence * 100) : 0;

  return (
    <div className="border-[2px] border-dashed border-ink-soft/60 bg-white px-3 py-3 sketch-c">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-sketch text-sm font-bold text-ink">
          Scale photo · snap the display
        </p>
        <span className="ml-auto font-hand text-xs text-ink-soft">
          {reading
            ? reading.isDemo
              ? "DEMO reading"
              : reading.provider === "vision"
                ? "Vision model"
                : "Photo reading"
            : "Vision + OCR"}
        </span>
      </div>
      <p className="mt-1 font-hand text-xs text-ink-soft">
        The slip keeps the photo&apos;s SHA-256 and the weight that was read — never the image
        itself. Check the number before it fills the slip.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label
          className="sketch-btn cursor-pointer px-4 py-2 text-sm"
          style={{
            background: "var(--blue-fill)",
            borderColor: "var(--blue-line)",
            color: "var(--blue-ink)",
          }}
        >
          Take / choose scale photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void onFile(file);
            }}
          />
        </label>
        <SketchButton
          tone="yellow"
          className="!py-1 text-sm"
          disabled={busy}
          onClick={runDemoPhoto}
        >
          Use demo scale photo
        </SketchButton>
        {reading && (
          <button
            type="button"
            onClick={reset}
            className="font-hand text-sm text-ink-soft underline hover:text-ink"
          >
            try another photo
          </button>
        )}
      </div>

      {notice && <p className="mt-2 font-hand text-sm text-ink">{notice}</p>}

      {reading && (
        <div className="tola-pop mt-3 border-[2px] border-ink bg-[var(--paper)] px-3 py-3 sketch-b">
          <p className="font-sketch font-bold text-ink">
            I read: {reading.weightGrams.toFixed(2)} g on the scale. Correct?
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-hand text-xs text-ink-soft">
            <span
              className="stamp"
              style={{
                background:
                  confidencePct >= SCALE_CONFIDENCE_THRESHOLD * 100
                    ? "var(--green-fill)"
                    : "var(--orange-fill)",
                border: "2px solid var(--ink-soft)",
                color: "var(--ink)",
              }}
            >
              CONFIDENCE {confidencePct}%
            </span>
            {reading.isDemo && (
              <span
                className="stamp"
                style={{
                  background: "var(--marker-yellow)",
                  border: "2px solid #B99420",
                  color: "var(--ink)",
                }}
              >
                DEMO
              </span>
            )}
            <span className="font-mono text-[10px]">
              sha256 {reading.sha256.slice(0, 16)}…
            </span>
          </div>

          {reading.raw && (
            <p className="mt-1 font-mono text-xs text-ink-soft">
              Display text: “{reading.raw}”
            </p>
          )}

          {preview && (
            // Local preview only — the file is not stored on the server.
            <img
              src={preview}
              alt="Scale display that was read"
              className="mt-2 max-h-40 w-auto border-[2px] border-ink-soft/50 sketch-c"
            />
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="font-sketch text-xs font-bold text-ink">
              Weight read (g)
              <input
                value={editedWeight}
                onChange={(e) => setEditedWeight(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full border-[2.5px] border-ink bg-white px-2 py-1 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
              />
            </label>
            <p className="self-end pb-1 font-hand text-xs text-ink-soft">
              {reading.filename}
            </p>
          </div>

          {requiresCheck && (
            <label className="mt-2 flex items-start gap-2 font-hand text-sm text-ink">
              <input
                type="checkbox"
                checked={manualCheck}
                onChange={(e) => setManualCheck(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--marker-red)]"
              />
              <span>
                I checked the scale display myself.
                {reading.isDemo ? " This reading is a demo, not a model result." : ""}
              </span>
            </label>
          )}

          <div className="mt-3">
            <SketchButton
              tone="yellow"
              className="!py-1 text-sm"
              disabled={!canUse}
              onClick={useWeight}
            >
              Use this weight →
            </SketchButton>
          </div>
        </div>
      )}
    </div>
  );
}
