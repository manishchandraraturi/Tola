// P10 — scale photo to weight.
//
// The image bytes never reach the database. The slip stores a SHA-256 of the
// capture, plus the weight the vision/OCR step read and how confident it was.
// Everything below is pure so it can be unit-tested without a browser or model.
import crypto from "crypto";

/** Below this, the UI asks the jeweller to check the display by hand. */
export const SCALE_CONFIDENCE_THRESHOLD = 0.75;

/** Jewellery job-work, not bullion: 5 kg is already an absurd reading. */
export const MAX_SCALE_WEIGHT_GRAMS = 5000;

/** Camera photos are compressed client-side; 6 MB is plenty. */
export const MAX_SCALE_IMAGE_BYTES = 6 * 1024 * 1024;

export type ScaleReading = {
  weightGrams: number;
  confidence: number;
  raw: string;
};

export type SlipPhotoInput = {
  sha256: string;
  filename: string;
  weightGrams: number;
  confidence: number;
};

export function scalePhotoHash(bytes: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/** SHA-256 of a demo payload, so demo records look like every other one. */
export function demoScaleHash(seed = "tola-demo-scale-photo"): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export function makeScaleReading(
  weightGrams: number,
  confidence: number,
  raw = ""
): ScaleReading | null {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0 || weightGrams > MAX_SCALE_WEIGHT_GRAMS) {
    return null;
  }
  const clamped = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  return {
    weightGrams: Math.round(weightGrams * 100) / 100,
    confidence: Math.round(clamped * 100) / 100,
    raw,
  };
}

export function needsHumanCheck(reading: Pick<ScaleReading, "confidence">): boolean {
  return reading.confidence < SCALE_CONFIDENCE_THRESHOLD;
}

/**
 * Read the first plausible weight in an OCR string. Handles "25.40 g",
 * "WT: 18.75g", "25,4 gram" and "0.0254 kg" (converted to grams). A bare
 * number is accepted at low confidence so the confirmation card insists on a
 * human check rather than dropping the reading.
 */
export function parseScaleReading(input: string): ScaleReading | null {
  if (typeof input !== "string") return null;
  const text = input
    .replace(/\u00a0/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  const kg = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:kgs?|kilograms?)(?![a-z])/i);
  if (kg) {
    return makeScaleReading(parseFloat(kg[1]) * 1000, 0.9, kg[0]);
  }

  const grams = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:gms?|gm|grams?|g)(?![a-z])/i);
  if (grams) {
    const weight = parseFloat(grams[1]);
    const confidence = /\.\d/.test(grams[1]) ? 0.96 : 0.9;
    return makeScaleReading(weight, confidence, grams[0]);
  }

  const bare = text.match(/(?:^|\s)([0-9]+(?:\.[0-9]+)?)(?=\s|$)/);
  if (bare) {
    return makeScaleReading(parseFloat(bare[1]), 0.55, bare[0].trim());
  }

  return null;
}

/** Parse the JSON the vision prompt asks for, tolerating code fences. */
export function parseVisionScaleJson(content: string): ScaleReading | null {
  const cleaned = String(content ?? "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const weight = Number(parsed.weightGrams ?? parsed.weight ?? parsed.grams);
    const confidence = Number(parsed.confidence ?? parsed.score ?? 0.8);
    return makeScaleReading(weight, confidence, String(parsed.raw ?? ""));
  } catch {
    return null;
  }
}

/** Keep only a safe basename; never trust a client path. */
export function sanitizeScaleFilename(name: string, fallback = "scale-photo.jpg"): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(-80);
  return safe || fallback;
}

/** Validate the photo metadata a client sends with a new slip. */
export function normaliseSlipPhoto(input: unknown): SlipPhotoInput | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const sha256 = String(raw.sha256 ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;

  const weightGrams = Number(raw.weightGrams);
  if (!Number.isFinite(weightGrams) || weightGrams <= 0 || weightGrams > MAX_SCALE_WEIGHT_GRAMS) {
    return null;
  }

  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  return {
    sha256,
    filename: sanitizeScaleFilename(String(raw.filename ?? "")),
    weightGrams: Math.round(weightGrams * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
  };
}
