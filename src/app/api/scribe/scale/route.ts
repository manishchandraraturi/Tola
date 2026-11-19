import { NextRequest, NextResponse } from "next/server";
import {
  MAX_SCALE_IMAGE_BYTES,
  demoScaleHash,
  parseVisionScaleJson,
  sanitizeScaleFilename,
  scalePhotoHash,
  type ScaleReading,
} from "@/lib/scale-photo";

export const dynamic = "force-dynamic";

// Scale photo → weight. With OPENAI_API_KEY set, the capture is sent to a vision
// model. Otherwise (or if the model is unavailable) a DEMO reading comes back,
// clearly labelled — no model is ever pretended to have run.
const DEMO_WEIGHTS = [25.4, 18.75, 12.4, 8.6, 14.0];
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function demoReading(sha256: string, filename: string, note: string) {
  const index = parseInt(sha256.slice(0, 2), 16) % DEMO_WEIGHTS.length;
  const weightGrams = DEMO_WEIGHTS[index];
  return NextResponse.json({
    reading: {
      weightGrams,
      confidence: 0.86,
      raw: `${weightGrams.toFixed(2)} g`,
    },
    sha256,
    filename,
    provider: "demo",
    isDemo: true,
    note,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawFilename = String(body.filename ?? "");
  const filename = sanitizeScaleFilename(rawFilename);
  const wantsDemo = Boolean(body.demo);
  const trimmedBase64 = String(body.imageBase64 ?? "").replace(
    /^data:[^;]+;base64,/,
    ""
  );
  const hasImage = !wantsDemo && trimmedBase64.length > 0;

  // A demo photo carries no bytes, but still gets a real-looking hash.
  if (!hasImage) {
    const sha256 = demoScaleHash(rawFilename || "demo-scale-photo");
    return demoReading(
      sha256,
      filename,
      process.env.OPENAI_API_KEY
        ? "DEMO reading — no photo was sent. Upload a scale photo to use the vision model."
        : "DEMO reading — set OPENAI_API_KEY to read a real scale photo with a vision model."
    );
  }

  if (trimmedBase64.length > Math.ceil((MAX_SCALE_IMAGE_BYTES * 4) / 3) + 128) {
    return NextResponse.json(
      { error: "That photo is too large. Use a photo under 6 MB." },
      { status: 413 }
    );
  }

  const bytes = Buffer.from(trimmedBase64, "base64");
  if (!bytes.length) {
    return NextResponse.json({ error: "The photo was empty." }, { status: 400 });
  }
  if (bytes.length > MAX_SCALE_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Use a photo under 6 MB." },
      { status: 413 }
    );
  }

  const mimeType = String(body.mimeType ?? "image/jpeg").toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG or WebP photo of the scale display." },
      { status: 415 }
    );
  }

  const sha256 = scalePhotoHash(bytes);
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return demoReading(
      sha256,
      filename,
      "DEMO reading — set OPENAI_API_KEY to read a real scale photo with a vision model."
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Read the weight shown on this jewellery scale. Reply with ONLY JSON: {"weightGrams": number, "confidence": number between 0 and 1, "raw": "the text you saw"}. Use grams. If the display is unreadable, return {"weightGrams": 0, "confidence": 0, "raw": ""}.',
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${trimmedBase64}` },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) throw new Error(`Vision API returned ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reading: ScaleReading | null = parseVisionScaleJson(
      String(data.choices?.[0]?.message?.content ?? "")
    );
    if (!reading) throw new Error("The model did not return a readable weight");

    return NextResponse.json({
      reading,
      sha256,
      filename,
      provider: "vision",
      isDemo: false,
    });
  } catch (e) {
    return demoReading(
      sha256,
      filename,
      `DEMO reading — the vision model was not reachable (${e instanceof Error ? e.message : "unknown error"}). Check the display yourself.`
    );
  }
}
