"use client";

import * as React from "react";
import { SketchButton } from "./sketch";

export type VoiceLanguage = "en-IN" | "hi-IN" | "kn-IN";

export type VoiceDraft = {
  karigarId?: string;
  weightGrams?: number;
  purity?: string;
  job?: string;
  isWedding?: boolean;
  dueDate?: string;
  wastageAgreedPct?: number;
  source?: "voice" | "typed" | "photo";
};

const LANGUAGES: Array<{ id: VoiceLanguage; label: string }> = [
  { id: "en-IN", label: "English" },
  { id: "hi-IN", label: "हिन्दी · Hindi" },
  { id: "kn-IN", label: "ಕನ್ನಡ · Kannada" },
];

const SAMPLES: Record<VoiceLanguage, string> = {
  "en-IN": "25.4 grams 22K necklace set, wastage 3, due 12 Nov, wedding order",
  "hi-IN": "पच्चीस ग्राम २२ के नेकलेस सेट, वेस्टेज ३, शादी, ५ दिन में",
  "kn-IN": "ಇಪ್ಪತ್ತೈದು ಗ್ರಾಂ ೨೨ ಕೆ ಕಂಠಹಾರ, ವೇಸ್ಟೇಜ್ ೩, ಮದುವೆ, ೫ ದಿನಗಳಲ್ಲಿ",
};

type Provider = "browser" | "whisper" | "demo" | "typed";

type ScribeApiResponse = {
  parsed?: {
    weight?: number;
    purity?: string;
    wastage?: number;
    wedding?: boolean;
    due?: string;
    job?: string;
  };
  karigarId?: string | null;
  missing?: string[];
  note?: string;
  error?: string;
};

type VoiceForm = {
  weight: string;
  purity: string;
  job: string;
  due: string;
  wastage: string;
  wedding: boolean;
  karigarId: string;
};

// Minimal Web Speech API shape — it is still vendor-prefixed in most browsers.
type SpeechResultEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const inputCls =
  "mt-1 w-full border-[2.5px] border-ink bg-white px-2 py-1 font-hand text-base text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]";

/**
 * Voice input for English, Hindi and Kannada. The browser's speech engine
 * produces a transcript; the server Scribe parses it; the card below shows an
 * editable confirmation before anything reaches the slip. When the browser has
 * no speech API, typing and the DEMO voice note still work.
 */
export function VoiceScribeCard({
  karigars = [],
  onUse,
}: {
  karigars?: Array<{ id: string; name: string }>;
  onUse: (draft: VoiceDraft) => void;
}) {
  const [language, setLanguage] = React.useState<VoiceLanguage>("en-IN");
  const [text, setText] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [form, setForm] = React.useState<VoiceForm | null>(null);
  const [missing, setMissing] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const recognition = React.useRef<SpeechRecognitionLike | null>(null);

  function update<K extends keyof VoiceForm>(key: K, value: VoiceForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function parseTranscript(raw: string, via: Provider) {
    const said = raw.trim();
    if (!said) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/agents/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: said }),
      });
      const data = (await res.json()) as ScribeApiResponse;
      if (!res.ok) throw new Error(data.error ?? "Scribe could not read that.");

      setTranscript(said);
      setProvider(via);
      setMissing(Array.isArray(data.missing) ? data.missing : []);
      setNote(String(data.note ?? ""));
      setForm({
        weight: data.parsed?.weight != null ? String(data.parsed.weight) : "",
        purity: data.parsed?.purity ?? "22K",
        job: data.parsed?.job ?? "",
        due: data.parsed?.due ? String(data.parsed.due).slice(0, 10) : "",
        wastage: data.parsed?.wastage != null ? String(data.parsed.wastage) : "3",
        wedding: Boolean(data.parsed?.wedding),
        karigarId: data.karigarId ?? "",
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not read that sentence.");
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as SpeechWindow;
    const Ctor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Ctor) {
      setNotice(
        "This browser has no built-in speech recognition. Type the sentence below, or use the DEMO voice note — the demo is labelled clearly."
      );
      return;
    }

    setNotice(null);
    const rec = new Ctor();
    rec.lang = language;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript ?? "";
      if (!said) return;
      setText(said);
      void parseTranscript(said, "browser");
    };
    rec.onerror = () => {
      setNotice(
        "The microphone did not catch that. Type the sentence, or use the DEMO voice note — nothing is lost."
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognition.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setNotice("The microphone could not start. Type the sentence instead.");
    }
  }

  async function runDemoVoiceNote() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/scribe/whisper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const data = (await res.json()) as {
        text?: string;
        isDemo?: boolean;
        error?: string;
        note?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load the voice note.");
      const said = String(data.text ?? "");
      setText(said);
      setProvider(data.isDemo ? "demo" : "whisper");
      if (data.note) setNotice(data.note);
      await parseTranscript(said, data.isDemo ? "demo" : "whisper");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not load the voice note.");
    } finally {
      setBusy(false);
    }
  }

  function useTheseDetails() {
    if (!form) return;
    const weight = parseFloat(form.weight);
    const wastage = parseFloat(form.wastage);
    onUse({
      karigarId: form.karigarId || undefined,
      weightGrams: Number.isFinite(weight) ? weight : undefined,
      purity: form.purity || undefined,
      job: form.job.trim() || undefined,
      isWedding: form.wedding,
      dueDate: form.due ? new Date(`${form.due}T09:00:00`).toISOString() : undefined,
      wastageAgreedPct: Number.isFinite(wastage) ? wastage : undefined,
      source: provider === "typed" ? "typed" : "voice",
    });
    setNotice("Sent to the issue form. Check every field, then tap to issue.");
  }

  const providerLabel =
    provider === "browser"
      ? "Browser speech"
      : provider === "whisper"
        ? "Whisper"
        : provider === "demo"
          ? "DEMO voice note"
          : provider === "typed"
            ? "Typed"
            : "Voice or typing";

  return (
    <div className="border-[2px] border-dashed border-ink-soft/60 bg-white px-3 py-3 sketch-c">
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-sketch text-xs font-bold uppercase tracking-wide text-ink-soft">
          Voice language
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as VoiceLanguage)}
            className="ml-2 border-[2px] border-ink bg-white px-2 py-1 font-hand text-sm normal-case text-ink sketch-c outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-hand text-xs text-ink-soft">{providerLabel}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SketchButton
          tone={listening ? "salmon" : "blue"}
          className="!py-1 text-sm"
          onClick={toggleListening}
          aria-pressed={listening}
        >
          {listening ? "Listening… tap to stop" : "Speak the slip"}
        </SketchButton>
        <SketchButton
          tone="yellow"
          className="!py-1 text-sm"
          disabled={busy}
          onClick={runDemoVoiceNote}
        >
          Demo voice note
        </SketchButton>
      </div>

      <label className="mt-2 block font-sketch text-xs font-bold uppercase tracking-wide text-ink-soft">
        Or type what was said
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={SAMPLES[language]}
          className="mt-1 w-full border-[2.5px] border-ink bg-white px-3 py-2 font-hand text-base normal-case text-ink sketch-c outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SketchButton
          tone="green"
          className="!py-1 text-sm"
          disabled={busy || !text.trim()}
          onClick={() => parseTranscript(text, "typed")}
        >
          {busy ? "Reading…" : "Read what I typed"}
        </SketchButton>
        <span className="font-hand text-xs text-ink-soft">
          Typing always works, even without a microphone.
        </span>
      </div>

      {notice && <p className="mt-2 font-hand text-sm text-ink">{notice}</p>}

      {form && (
        <div className="tola-pop mt-3 border-[2px] border-ink bg-[var(--paper)] px-3 py-3 sketch-b">
          <p className="font-sketch font-bold text-ink">
            I heard: “{transcript}”. Correct?
          </p>
          <p className="mt-1 font-hand text-xs text-ink-soft">{note}</p>
          {missing.length > 0 && (
            <p className="mt-1 font-hand text-xs text-ink-soft">
              Please check: {missing.join(", ")}.
            </p>
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="font-sketch text-xs font-bold text-ink">
              Weight (g)
              <input
                value={form.weight}
                onChange={(e) => update("weight", e.target.value)}
                inputMode="decimal"
                placeholder="25.4"
                className={inputCls}
              />
            </label>
            <label className="font-sketch text-xs font-bold text-ink">
              Purity
              <select
                value={form.purity}
                onChange={(e) => update("purity", e.target.value)}
                className={inputCls}
              >
                {["22K", "18K", "24K"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-sketch text-xs font-bold text-ink">
              Job
              <input
                value={form.job}
                onChange={(e) => update("job", e.target.value)}
                placeholder="Necklace set"
                className={inputCls}
              />
            </label>
            <label className="font-sketch text-xs font-bold text-ink">
              Due date
              <input
                type="date"
                value={form.due}
                onChange={(e) => update("due", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="font-sketch text-xs font-bold text-ink">
              Agreed wastage (%)
              <input
                value={form.wastage}
                onChange={(e) => update("wastage", e.target.value)}
                inputMode="decimal"
                placeholder="3"
                className={inputCls}
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={form.wedding}
                onChange={(e) => update("wedding", e.target.checked)}
                className="h-5 w-5 accent-[var(--marker-red)]"
              />
              <span className="font-sketch text-xs font-bold text-ink">
                Wedding order — dates first
              </span>
            </label>
          </div>

          {karigars.length > 0 && (
            <label className="mt-2 block font-sketch text-xs font-bold text-ink">
              This slip is for
              <select
                value={form.karigarId}
                onChange={(e) => update("karigarId", e.target.value)}
                className={inputCls}
              >
                <option value="">— pick who this is for —</option>
                {karigars.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SketchButton tone="yellow" className="!py-1 text-sm" onClick={useTheseDetails}>
              Use these details →
            </SketchButton>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setTranscript("");
                setMissing([]);
                setNote("");
                setProvider(null);
              }}
              className="font-hand text-sm text-ink-soft underline hover:text-ink"
            >
              start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
