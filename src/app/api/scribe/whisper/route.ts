import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Optional Whisper adapter. With OPENAI_API_KEY set and a base64 audio clip,
// this forwards the clip to OpenAI's transcription API. Without a key (or if
// the call fails) it returns a pre-seeded transcript and labels it DEMO, so the
// voice flow always works offline and never pretends a real model ran.
const LANGUAGES = ["en-IN", "hi-IN", "kn-IN"] as const;
type ScribeLanguage = (typeof LANGUAGES)[number];

const DEMO_TRANSCRIPTS: Record<ScribeLanguage, string> = {
  "en-IN": "25.4 grams 22K necklace set, wastage 3, due 12 Nov, wedding order",
  "hi-IN": "पच्चीस ग्राम २२ के नेकलेस सेट, वेस्टेज ३, शादी, ५ दिन में",
  "kn-IN": "ಇಪ್ಪತ್ತೈದು ಗ್ರಾಂ ೨೨ ಕೆ ಕಂಠಹಾರ, ವೇಸ್ಟೇಜ್ ೩, ಮದುವೆ, ೫ ದಿನಗಳಲ್ಲಿ",
};

function normaliseLanguage(value: unknown): ScribeLanguage {
  const raw = String(value ?? "");
  return (LANGUAGES as readonly string[]).includes(raw) ? (raw as ScribeLanguage) : "en-IN";
}

// ~8 MB of base64 keeps a single voice note small enough for a demo.
const MAX_AUDIO_BASE64 = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const language = normaliseLanguage(body.language);
  const typedText = String(body.text ?? "").trim();
  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";

  if (audioBase64.length > MAX_AUDIO_BASE64) {
    return NextResponse.json({ error: "That voice note is too large." }, { status: 413 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (key && audioBase64) {
    try {
      const bytes = Buffer.from(audioBase64, "base64");
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: String(body.mimeType ?? "audio/webm") }),
        "voice-note.webm"
      );
      form.append("model", "whisper-1");
      form.append("language", language.split("-")[0]);

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Transcription API returned ${res.status}`);
      const data = (await res.json()) as { text?: string };
      const text = String(data.text ?? "").trim();
      if (!text) throw new Error("Whisper returned an empty transcript");

      return NextResponse.json({
        text,
        provider: "whisper",
        isDemo: false,
        language,
      });
    } catch (e) {
      // Fall through to the demo transcript, clearly labelled.
      return NextResponse.json({
        text: typedText || DEMO_TRANSCRIPTS[language],
        provider: "demo",
        isDemo: true,
        language,
        note: `Whisper was not reachable (${e instanceof Error ? e.message : "unknown error"}). This is a DEMO transcript.`,
      });
    }
  }

  return NextResponse.json({
    text: typedText || DEMO_TRANSCRIPTS[language],
    provider: "demo",
    isDemo: true,
    language,
    note: key
      ? "DEMO transcript — no audio clip was sent."
      : "DEMO transcript — set OPENAI_API_KEY to transcribe real audio with Whisper.",
  });
}
