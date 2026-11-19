// P10 tests: turning a scale photo into a checked weight. These cover the
// hashing that pins a capture, the OCR/vision text parsing, the confidence
// gate, and the metadata accepted with a new slip.
import { describe, expect, it } from "vitest";
import {
  MAX_SCALE_WEIGHT_GRAMS,
  SCALE_CONFIDENCE_THRESHOLD,
  demoScaleHash,
  makeScaleReading,
  needsHumanCheck,
  normaliseSlipPhoto,
  parseScaleReading,
  parseVisionScaleJson,
  sanitizeScaleFilename,
  scalePhotoHash,
} from "@/lib/scale-photo";

describe("scale photo hash", () => {
  it("matches the known SHA-256 of 'hello'", () => {
    expect(scalePhotoHash(Buffer.from("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("is stable for the same bytes and changes for different bytes", () => {
    const a = scalePhotoHash(Buffer.from("scale-a"));
    expect(a).toBe(scalePhotoHash(Buffer.from("scale-a")));
    expect(a).not.toBe(scalePhotoHash(Buffer.from("scale-b")));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("gives demo records a valid 64-character hash", () => {
    expect(demoScaleHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(demoScaleHash()).toBe(demoScaleHash());
    expect(demoScaleHash("a")).not.toBe(demoScaleHash("b"));
  });
});

describe("parseScaleReading", () => {
  it("reads grams with a decimal", () => {
    const r = parseScaleReading("25.40 g");
    expect(r).toEqual({ weightGrams: 25.4, confidence: 0.96, raw: "25.40 g" });
  });

  it("reads a scale display with a prefix", () => {
    const r = parseScaleReading("WT: 18.75g");
    expect(r?.weightGrams).toBe(18.75);
    expect(r?.confidence).toBeGreaterThanOrEqual(SCALE_CONFIDENCE_THRESHOLD);
  });

  it("accepts a comma decimal and the word gram", () => {
    expect(parseScaleReading("25,4 gram")?.weightGrams).toBe(25.4);
    expect(parseScaleReading("8 grams")?.weightGrams).toBe(8);
  });

  it("converts kilograms to grams", () => {
    const r = parseScaleReading("0.0254 kg");
    expect(r?.weightGrams).toBe(25.4);
    expect(r?.confidence).toBeGreaterThanOrEqual(SCALE_CONFIDENCE_THRESHOLD);
  });

  it("accepts a bare number only at low confidence", () => {
    const r = parseScaleReading("25.4");
    expect(r?.weightGrams).toBe(25.4);
    expect(r?.confidence).toBeLessThan(SCALE_CONFIDENCE_THRESHOLD);
  });

  it("rejects text with no number and impossible readings", () => {
    expect(parseScaleReading("scale is on, display blank")).toBeNull();
    expect(parseScaleReading("0 g")).toBeNull();
    expect(parseScaleReading("9999 g")).toBeNull();
    expect(makeScaleReading(Number.NaN, 0.9)).toBeNull();
  });

  it("clamps confidence into 0..1 and rounds the weight", () => {
    expect(makeScaleReading(25.444, 1.4)?.confidence).toBe(1);
    expect(makeScaleReading(25.444, -1)?.confidence).toBe(0);
    expect(makeScaleReading(25.444, 0.9)?.weightGrams).toBe(25.44);
  });
});

describe("confidence gate", () => {
  it("asks for a human check below the threshold", () => {
    expect(needsHumanCheck({ confidence: 0.74 })).toBe(true);
    expect(needsHumanCheck({ confidence: SCALE_CONFIDENCE_THRESHOLD })).toBe(false);
    expect(needsHumanCheck({ confidence: 0.96 })).toBe(false);
  });
});

describe("vision JSON", () => {
  it("parses the JSON the vision prompt asks for, even in a code fence", () => {
    const r = parseVisionScaleJson(
      '```json\n{"weightGrams": 25.4, "confidence": 0.93, "raw": "25.40 g"}\n```'
    );
    expect(r?.weightGrams).toBe(25.4);
    expect(r?.confidence).toBe(0.93);
  });

  it("returns null when the model did not return JSON", () => {
    expect(parseVisionScaleJson("The display shows about 25 grams")).toBeNull();
    expect(parseVisionScaleJson("")).toBeNull();
  });
});

describe("photo metadata accepted with a slip", () => {
  const valid = {
    sha256: "a".repeat(64),
    filename: "../../scale display.JPG",
    weightGrams: 25.4,
    confidence: 0.92,
  };

  it("accepts valid metadata and sanitises the filename", () => {
    const photo = normaliseSlipPhoto(valid);
    expect(photo).not.toBeNull();
    expect(photo?.sha256).toBe("a".repeat(64));
    expect(photo?.filename).toBe("scale_display.JPG");
    expect(photo?.weightGrams).toBe(25.4);
  });

  it("rejects a bad hash, a bad weight or an out-of-range confidence", () => {
    expect(normaliseSlipPhoto({ ...valid, sha256: "nope" })).toBeNull();
    expect(normaliseSlipPhoto({ ...valid, weightGrams: 0 })).toBeNull();
    expect(normaliseSlipPhoto({ ...valid, weightGrams: MAX_SCALE_WEIGHT_GRAMS + 1 })).toBeNull();
    expect(normaliseSlipPhoto({ ...valid, confidence: 1.2 })).toBeNull();
    expect(normaliseSlipPhoto(null)).toBeNull();
  });

  it("keeps only a safe basename for the stored filename", () => {
    expect(sanitizeScaleFilename("C:\\photos\\IMG_2041.jpg")).toBe("IMG_2041.jpg");
    expect(sanitizeScaleFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeScaleFilename("")).toBe("scale-photo.jpg");
  });
});
