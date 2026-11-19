// Tola — shared domain logic (server-side)
import crypto from "crypto";
import { db } from "@/lib/db";
import { createOtpChallenge, consumeOtpChallenge } from "@/lib/otp";

export type SlipStatus = "ISSUED" | "WORKING" | "RETURNED" | "SETTLED";

export const MAKING_CHARGE_PER_GRAM = 380; // demo rate for making charges, Rs

export function computeWastage(issued: number, piece: number, scrap: number) {
  // Wastage = what is neither in the finished piece nor recoverable scrap.
  const lost = issued - piece - scrap;
  return Math.round((lost / issued) * 10000) / 100; // percent, 2 decimals
}

export function makingCharges(weightGrams: number) {
  return Math.round((weightGrams * MAKING_CHARGE_PER_GRAM) / 10) * 10;
}

// Hash a ledger link. Supports two call shapes that exist in this codebase:
//   hashChain(prevHash, kind, text, at)                              (4-arg, unit tests)
//   hashChain(seq, prevHash, kind, actor, slipId, createdAt, text)   (7-arg, chain verify)
export function hashChain(
  a: number | string,
  b: string,
  c: string,
  d: string | null | Date,
  e?: string | null | Date,
  f?: Date | string,
  g?: string
) {
  let payload: string;
  if (typeof a === "number") {
    const seq = a;
    const prevHash = b;
    const kind = c;
    const actor = (d as string) ?? "";
    const slipId = (e as string | null) ?? "";
    const createdAt = (f as Date) ?? new Date();
    const text = (g as string) ?? "";
    payload = `${seq}|${prevHash}|${kind}|${actor}|${slipId}|${createdAt.toISOString()}|${text}`;
  } else {
    const prevHash = a;
    const kind = b;
    const text = c;
    const at = d as Date;
    payload = `${prevHash}|${kind}|${text}|${at.toISOString()}`;
  }
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export interface AppendLedgerInput {
  kind: string;
  text: string;
  actor?: string;
  slipId?: string;
  at?: Date;
  proof?: string;
}

// Append a hash-linked ledger entry. Two call shapes are supported:
//   appendLedger(kind, text, slipId?, at?, client?)   (routes / reseed)
//   appendLedger({ kind, text, actor }, client)        (ledger tests)
export async function appendLedger(
  inputOrKind: string | AppendLedgerInput,
  textOrClient?: string | typeof db,
  slipIdArg?: string,
  atArg?: Date,
  clientArg?: typeof db
) {
  let kind: string;
  let text: string;
  let slipId: string | undefined;
  let at: Date | undefined;
  let actor: string | undefined;
  let proof: string | undefined;
  let client: typeof db | undefined;

  if (typeof inputOrKind === "object" && inputOrKind !== null) {
    kind = inputOrKind.kind;
    text = inputOrKind.text;
    actor = inputOrKind.actor;
    slipId = inputOrKind.slipId;
    at = inputOrKind.at;
    proof = inputOrKind.proof;
    client = textOrClient as typeof db | undefined;
  } else {
    kind = inputOrKind;
    text = textOrClient as string;
    slipId = slipIdArg;
    at = atArg;
    client = clientArg;
  }

  const dbClient = client || db;
  const lastEntry = await dbClient.ledgerEntry.findFirst({
    orderBy: { seq: "desc" },
    select: { seq: true, hash: true },
  });
  const seq = (lastEntry?.seq ?? 0) + 1;
  const prevHash = lastEntry?.hash ?? "GENESIS";
  const now = at ?? new Date();
  const actorValue = actor ?? "jeweller";
  const hash = hashChain(seq, prevHash, kind, actorValue, slipId ?? null, now, text);
  return dbClient.ledgerEntry.create({
    data: {
      kind,
      text,
      hash,
      seq,
      prevHash,
      actor: actorValue,
      proof: proof ?? null,
      slipId: slipId ?? null,
      createdAt: now,
    },
  });
}

// ---- Fair-wastage agent (v2) ----------------------------------------------
// Compares each job with that pair's settled history AND a trade-wide range.
// Every number in the text is drawn from the evidence. Tone is plain and
// never accusing.
export type FairLevel = "ok" | "light" | "heavy" | "odd" | "no-history";

export interface TradeBenchmark {
  keyword: string;
  minPct: number;
  maxPct: number;
  avgPct: number;
  source: string;
}

export interface PairBand {
  min: number;
  max: number;
  avg: number;
  median: number;
  q1: number;
  q3: number;
  n: number;
}

export interface FairVerdictResult {
  level: FairLevel;
  evidence: string;
  text: string;
  benchmark: TradeBenchmark | null;
  pair: PairBand | null;
  used: "pair" | "benchmark" | "none";
}

// Demo assumptions, editable in the database (WastageBenchmark table). They are
// clearly labelled as such wherever they are shown.
export const DEFAULT_WASTAGE_BENCHMARKS: Array<{
  keyword: string;
  minPct: number;
  maxPct: number;
  avgPct: number;
}> = [
  { keyword: "necklace", minPct: 2.2, maxPct: 4.6, avgPct: 3.4 },
  { keyword: "bangle", minPct: 2.8, maxPct: 4.8, avgPct: 3.7 },
  { keyword: "ring", minPct: 2.0, maxPct: 4.0, avgPct: 3.0 },
  { keyword: "anklet", minPct: 2.6, maxPct: 4.4, avgPct: 3.5 },
  { keyword: "jhumka", minPct: 3.0, maxPct: 5.2, avgPct: 4.0 },
];

export const BENCHMARK_SOURCE = "Trade benchmark (demo assumption, editable)";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function jobKeyword(
  job: string,
  benchmarks: Array<{ keyword: string }> = DEFAULT_WASTAGE_BENCHMARKS
): string | null {
  const hay = (job ?? "").toLowerCase();
  for (const b of benchmarks) {
    if (hay.includes(b.keyword.toLowerCase())) return b.keyword;
  }
  return null;
}

export function lookupBenchmark(
  job: string,
  benchmarks: Array<{
    keyword: string;
    minPct: number;
    maxPct: number;
    avgPct: number;
    source?: string;
  }>
): TradeBenchmark | null {
  const hay = (job ?? "").toLowerCase();
  for (const b of benchmarks) {
    if (hay.includes(b.keyword.toLowerCase())) {
      return {
        keyword: b.keyword,
        minPct: b.minPct,
        maxPct: b.maxPct,
        avgPct: b.avgPct,
        source: b.source ?? BENCHMARK_SOURCE,
      };
    }
  }
  return null;
}

// Median + quartiles for a pair's settled jobs. Falls back to min/max for
// small samples, though callers should use the trade benchmark below n = 4.
export function pairBand(values: number[]): PairBand {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  const q = (p: number) => {
    if (n === 1) return sorted[0];
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const avg = sorted.reduce((a, b) => a + b, 0) / n;
  return {
    min: round2(sorted[0]),
    max: round2(sorted[n - 1]),
    avg: round2(avg),
    median: round2(q(0.5)),
    q1: round2(q(0.25)),
    q3: round2(q(0.75)),
    n,
  };
}

export interface FairVerdictInput {
  job?: string;
  agreed: number;
  actual: number;
  history?: number[];
  benchmarks?: Array<{
    keyword: string;
    minPct: number;
    maxPct: number;
    avgPct: number;
    source?: string;
  }>;
}

function fairVerdictReport(input: FairVerdictInput): FairVerdictResult {
  const agreed = round2(input.agreed);
  const actual = round2(input.actual);
  const history = (input.history ?? []).filter((v) => Number.isFinite(v));
  const benchmark = input.benchmarks ? lookupBenchmark(input.job ?? "", input.benchmarks) : null;
  const pair = history.length ? pairBand(history) : null;
  const hasPair = history.length >= 4;
  const diff = round2(actual - agreed);

  // ---- no reference at all ----
  if (!hasPair && !benchmark) {
    const note =
      " There is not enough settled history yet and no trade benchmark for this job.";
    const relation =
      Math.abs(diff) <= 0.05
        ? `Wastage ${fmtPct(actual)} matches the agreed ${fmtPct(agreed)}.`
        : diff < 0
          ? `Wastage ${fmtPct(actual)} is ${fmtPct(agreed - actual)} below the agreed ${fmtPct(agreed)} — more metal came back than expected.`
          : `Wastage ${fmtPct(actual)} is ${fmtPct(actual - agreed)} above the agreed ${fmtPct(agreed)}.`;
    return {
      level: "no-history",
      evidence: `Actual ${fmtPct(actual)} vs agreed ${fmtPct(agreed)}.${note}`,
      text: `${relation}${note}`,
      benchmark: null,
      pair: null,
      used: "none",
    };
  }

  const used: "pair" | "benchmark" = hasPair ? "pair" : "benchmark";
  let lo: number;
  let hi: number;
  let label: string;
  if (hasPair && pair) {
    lo = pair.q1;
    hi = pair.q3;
    label = `his usual range of ${fmtPct(lo)}–${fmtPct(hi)} across ${pair.n} settled jobs`;
  } else if (benchmark) {
    lo = benchmark.minPct;
    hi = benchmark.maxPct;
    label = `the trade benchmark of ${fmtPct(lo)}–${fmtPct(hi)} for ${benchmark.keyword} jobs (${benchmark.source})`;
  } else {
    lo = agreed;
    hi = agreed;
    label = `the agreed ${fmtPct(agreed)}`;
  }
  const notEnough = hasPair ? "" : " Not enough history yet, so this uses the trade benchmark.";

  // ---- light: more metal came back than expected ----
  if (actual < agreed - 1.0) {
    return {
      level: "light",
      evidence: `Actual ${fmtPct(actual)} is ${fmtPct(agreed - actual)} below the agreed ${fmtPct(agreed)}. Compared with ${label}.${notEnough}`,
      text: `Wastage ${fmtPct(actual)} is below the agreed ${fmtPct(agreed)} — more metal came back than expected. Compared with ${label}.${notEnough}`,
      benchmark,
      pair,
      used,
    };
  }

  // ---- above agreed: odd when outside the usual range, else heavy ----
  if (actual > agreed + 1.0) {
    if (actual > hi + 0.5) {
      return {
        level: "odd",
        evidence: `Actual ${fmtPct(actual)} is ${fmtPct(actual - agreed)} above the agreed ${fmtPct(agreed)} and above ${label}.`,
        text: `Wastage ${fmtPct(actual)} is above the agreed ${fmtPct(agreed)} and above ${label}. Worth a word before approving — not an accusation.${notEnough}`,
        benchmark,
        pair,
        used,
      };
    }
    return {
      level: "heavy",
      evidence: `Actual ${fmtPct(actual)} is ${fmtPct(actual - agreed)} above the agreed ${fmtPct(agreed)} but inside ${label}.`,
      text: `Wastage ${fmtPct(actual)} is ${fmtPct(actual - agreed)} above the agreed ${fmtPct(agreed)}, but inside ${label}. A little heavy, not unusual.${notEnough}`,
      benchmark,
      pair,
      used,
    };
  }

  // ---- ok ----
  return {
    level: "ok",
    evidence: `Actual ${fmtPct(actual)} is within 1 pt of the agreed ${fmtPct(agreed)} and compared with ${label}.${notEnough}`,
    text: `Wastage ${fmtPct(actual)} sits close to the agreed ${fmtPct(agreed)} and compared with ${label}. Nothing odd.${notEnough}`,
    benchmark,
    pair,
    used,
  };
}

type LegacyBand = { min: number; max: number; avg: number; n: number } | null;

/**
 * The original, plain-words verdict used by the earlier UI surface. It is kept
 * as an overload so both the old slip flows and the newer evidence-based
 * report can call the same function.
 */
export function fairVerdict(input: FairVerdictInput): FairVerdictResult;
export function fairVerdict(agreed: number, actual: number, band: LegacyBand): string;
export function fairVerdict(
  inputOrAgreed: FairVerdictInput | number,
  actualArg?: number,
  bandArg?: LegacyBand
): FairVerdictResult | string {
  if (typeof inputOrAgreed !== "number") return fairVerdictReport(inputOrAgreed);

  const agreed = inputOrAgreed;
  const actual = actualArg ?? 0;
  const band = bandArg ?? null;
  if (actual <= agreed + 0.05 && actual >= agreed - 0.05)
    return `Matches the agreed ${fmtPct(agreed)}. Nothing odd here.`;
  if (actual < agreed - 1.0)
    return `Wastage ${fmtPct(actual)} is below the agreed ${fmtPct(agreed)} — he returned more than expected. Check the scrap was weighed with him.`;
  const overBand = band && actual > band.max + 0.5 && band.n >= 2;
  if (overBand) {
    return `Wastage ${fmtPct(actual)} is above the agreed ${fmtPct(agreed)} and above his usual range of ${fmtPct(band.min)}–${fmtPct(band.max)} across ${band.n} settled jobs. Worth a word before approving — not an accusation.`;
  }
  if (actual > agreed + 1.0) {
    return `Wastage ${fmtPct(actual)} is ${fmtPct(actual - agreed)} above the agreed ${fmtPct(agreed)}, but within his usual range. In plain words: a little heavy, not unusual for him.`;
  }
  return `Wastage ${fmtPct(actual)} sits close to the agreed ${fmtPct(agreed)} and inside his usual range. Nothing odd.`;
}

// Seed/refresh the demo benchmark rows without overwriting edited values.
export async function ensureBenchmarks(client: typeof db = db): Promise<void> {
  for (const b of DEFAULT_WASTAGE_BENCHMARKS) {
    await client.wastageBenchmark.upsert({
      where: { keyword: b.keyword },
      update: {},
      create: { ...b, source: BENCHMARK_SOURCE },
    });
  }
}

export function fmtPct(n: number) {
  return `${Math.round(n * 100) / 100}%`;
}

// ---- Watcher agent ---------------------------------------------------------
export type WatcherAlert = {
  slipNumber: number;
  job: string;
  karigarName: string;
  dueDate: string;
  daysLeft: number;
  level: "wedding-soon" | "urgent" | "overdue" | "info";
  message: string;
};

export function watcherAlerts(
  slips: Array<{
    number: number;
    job: string;
    isWedding: boolean;
    dueDate: Date;
    status: string;
    karigarName: string;
  }>
): WatcherAlert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: WatcherAlert[] = [];
  for (const s of slips) {
    if (s.status === "SETTLED") continue;
    const due = new Date(s.dueDate);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000);
    const base = {
      slipNumber: s.number,
      job: s.job,
      karigarName: s.karigarName,
      dueDate: due.toISOString(),
      daysLeft,
    };
    if (s.status === "RETURNED") {
      out.push({
        ...base,
        level: "info",
        message: `Slip #${s.number} (${s.job}) is back and waiting for both approvals before ${s.karigarName} gets paid.`,
      });
      continue;
    }
    if (daysLeft < 0) {
      out.push({
        ...base,
        level: "overdue",
        message: `Slip #${s.number} (${s.job}) is ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} past its due date. ${s.karigarName} should hear about it early, not at month end.`,
      });
    } else if (s.isWedding && daysLeft <= 3) {
      out.push({
        ...base,
        level: "wedding-soon",
        message: `Wedding order! Slip #${s.number} (${s.job}) is due in ${daysLeft === 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}. Wedding dates come first — nudge now, keep the customer posted.`,
      });
    } else if (daysLeft <= 2) {
      out.push({
        ...base,
        level: "urgent",
        message: `Slip #${s.number} (${s.job}) is due ${daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}. A reminder to ${s.karigarName} is queued for WhatsApp.`,
      });
    }
  }
  const rank = { overdue: 0, "wedding-soon": 1, urgent: 2, info: 3 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level] || a.daysLeft - b.daysLeft);
}

// ---- Scribe agent ----------------------------------------------------------
// "Speak, or snap the scale, in Kannada or Hindi. Reads the weight and fills the slip."
// Here: parses a typed/simulated-transcribed note into a slip draft.
// Devanagari (०–९) and Kannada (೦–೯) digits, plus the number words most likely
// to be spoken into a scale-side phone. Normalising early lets every regex
// below work on plain ASCII digits.
const SCRIBE_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  "೦": "0", "೧": "1", "೨": "2", "೩": "3", "೪": "4",
  "೫": "5", "೬": "6", "೭": "7", "೮": "8", "೯": "9",
};

const SCRIBE_NUMBER_WORDS: Record<string, number> = {
  // Hindi
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5,
  "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
  "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14, "पंद्रह": 15,
  "पन्द्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18,
  "उन्नीस": 19, "बीस": 20, "इक्कीस": 21, "बाईस": 22, "तेईस": 23,
  "चौबीस": 24, "पच्चीस": 25, "पचीस": 25, "छब्बीस": 26,
  "सत्ताईस": 27, "अट्ठाईस": 28, "उनतीस": 29, "तीस": 30,
  // Kannada
  "ಒಂದು": 1, "ಎರಡು": 2, "ಮೂರು": 3, "ನಾಲ್ಕು": 4, "ಐದು": 5,
  "ಆರು": 6, "ಏಳು": 7, "ಎಂಟು": 8, "ಒಂಬತ್ತು": 9, "ಹತ್ತು": 10,
  "ಹನ್ನೊಂದು": 11, "ಹನ್ನೆರಡು": 12, "ಹದಿಮೂರು": 13, "ಹದಿನಾಲ್ಕು": 14,
  "ಹದಿನೈದು": 15, "ಹದಿನಾರು": 16, "ಹದಿನೇಳು": 17, "ಹದಿನೆಂಟು": 18,
  "ಹತ್ತೊಂಬತ್ತು": 19, "ಇಪ್ಪತ್ತು": 20, "ಇಪ್ಪತ್ತೊಂದು": 21,
  "ಇಪ್ಪತ್ತೆರಡು": 22, "ಇಪ್ಪತ್ತಮೂರು": 23, "ಇಪ್ಪತ್ತನಾಲ್ಕು": 24,
  "ಇಪ್ಪತ್ತೈದು": 25, "ಇಪ್ಪತ್ತಾರು": 26, "ಇಪ್ಪತ್ತೇಳು": 27,
  "ಇಪ್ಪತ್ತೆಂಟು": 28, "ಇಪ್ಪತ್ತೊಂಬತ್ತು": 29, "ಮೂವತ್ತು": 30,
};

/** Turn multilingual digits and number words into ASCII digits. */
export function normaliseScribeNumbers(text: string): string {
  const digits = text.replace(/[०-९೦-೯]/g, (d) => SCRIBE_DIGITS[d] ?? d);
  return digits
    .split(/(\s+)/)
    .map((token) => {
      const key = token.replace(/^[.,!?;:।]+|[.,!?;:।]+$/g, "").toLowerCase();
      const value = SCRIBE_NUMBER_WORDS[key];
      if (value === undefined || !key) return token;
      return token.replace(key, String(value));
    })
    .join("");
}

// Weight units across English, Hindi and Kannada. `ಕೆ` is listed because it is
// how a Kannada speaker often clips "grams"; the purity match is removed from
// the text first so "22 ಕೆ" is read as purity, not as 22 grams.
const SCRIBE_WEIGHT_UNITS = "grams?|gram|g|ग्राम्स|ग्राम|ग्रा|ಗ್ರಾಂ|ಗ್ರಾಮ್|ಗ್ರಾಮ|ಕೆ";

export function scribeParse(text: string) {
  const t = normaliseScribeNumbers(text).toLowerCase();
  const purityMatch = t.match(
    /(24|22|18)\s*(?:k|kt|karat|carat|के|कैरेट|ಕೆ|ಕ್ಯಾರೆಟ್)(?![a-z0-9])/
  );
  const purity = purityMatch ? `${purityMatch[1]}K` : undefined;
  // Purity is stripped before looking for a weight so "22 ಕೆ" never becomes 22 g.
  const withoutPurity = purityMatch ? t.replace(purityMatch[0], " ") : t;
  const weight = num(
    withoutPurity,
    new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*(?:${SCRIBE_WEIGHT_UNITS})(?![a-z0-9])`)
  );
  const wastage = num(
    t,
    /(?:wastage|वेस्टेज|ವೇಸ್ಟೇಜ್)\s*(?:of|is|:)?\s*([0-9]+(?:[.,][0-9]+)?)\s*%?/
  );
  const wedding = /(wedding|marriage|शादी|विवाह|ಮದುವೆ|ವಿವಾಹ)/.test(t);
  const due = parseDue(t);
  let job = /(?:job|job:|piece|for|of)\s*[:]?\s*([a-z ]{3,40})/.exec(t)?.[1]?.trim();
  // e.g. "25.4 grams 22K necklace set, wastage 3" — the words after the purity
  // are the job. Prefer this when it matches: "for <name>" after the job would
  // otherwise be mistaken for the job itself.
  const jobAfterPurity = /\b(?:24|22|18)\s*k[a-z]*\.?\s+([a-z][a-z ]{2,30}?)(?:\s*,|\s+wastage|\s+due|\s+in\s|\s+for\s|$)/.exec(t)?.[1]?.trim();
  if (jobAfterPurity) {
    job = jobAfterPurity;
  } else if (job) {
    job = job
      .replace(/\s+(due|on|by|for|wedding|marriage|wastage|शादी|विवाह|ಮದುವೆ|ವೇಸ್ಟೇಜ್).*$/, "")
      .trim();
  }
  if (!job) job = undefined;
  return { weight, purity, wastage, wedding, due, job };
}

function num(t: string, re: RegExp): number | undefined {
  const m = t.match(re);
  if (!m) return undefined;
  const v = parseFloat(m[1].replace(",", "."));
  return isFinite(v) ? v : undefined;
}

// Scribe helper: match a karigar name mentioned in the note. Full name wins,
// then a first-name match. Case-insensitive, on word boundaries, so "ravi"
// does not match inside another word. Returns null when nobody is named —
// the UI then falls back to a hand pick from a dropdown.
export function matchKarigar(
  text: string,
  karigars: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const k of karigars) {
    const full = k.name.toLowerCase();
    if (full && lower.includes(full)) return k;
  }
  for (const k of karigars) {
    const first = k.name.toLowerCase().split(/\s+/)[0];
    if (!first) continue;
    if (new RegExp(`\\b${escapeRegExp(first)}\\b`, "i").test(text)) return k;
  }
  return null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDue(t: string): string | undefined {
  const now = new Date();

  // "in 5 days", "5 days", "५ दिन", "५ दिनों में", "೫ ದಿನಗಳಲ್ಲಿ"
  const days = t.match(
    /([0-9]{1,3})\s*(?:days?|दिनों|दिन|ದಿನಗಳಲ್ಲಿ|ದಿನಗಳು|ದಿನ)/
  );
  if (days) {
    const d = new Date(now);
    d.setDate(d.getDate() + parseInt(days[1], 10));
    return d.toISOString();
  }

  // "12 Nov", "12 November", "१२ नवंबर", "೧೨ ನವೆಂಬರ್"
  const months: Array<[string, number]> = [
    ["january", 0], ["jan", 0], ["जनवरी", 0], ["ಜನವರಿ", 0],
    ["february", 1], ["feb", 1], ["फरवरी", 1], ["ಫೆಬ್ರವರಿ", 1],
    ["march", 2], ["mar", 2], ["मार्च", 2], ["ಮಾರ್ಚ್", 2],
    ["april", 3], ["apr", 3], ["अप्रैल", 3], ["ಏಪ್ರಿಲ್", 3],
    ["may", 4], ["मई", 4], ["ಮೇ", 4],
    ["june", 5], ["jun", 5], ["जून", 5], ["ಜೂನ್", 5],
    ["july", 6], ["jul", 6], ["जुलाई", 6], ["ಜುಲೈ", 6],
    ["august", 7], ["aug", 7], ["अगस्त", 7], ["ಆಗಸ್ಟ್", 7],
    ["september", 8], ["sep", 8], ["सितंबर", 8], ["ಸೆಪ್ಟೆಂಬರ್", 8],
    ["october", 9], ["oct", 9], ["अक्टूबर", 9], ["ಅಕ್ಟೋಬರ್", 9],
    ["november", 10], ["nov", 10], ["नवंबर", 10], ["ನವೆಂಬರ್", 10],
    ["december", 11], ["dec", 11], ["दिसंबर", 11], ["ಡಿಸೆಂಬರ್", 11],
  ];
  months.sort((a, b) => b[0].length - a[0].length);

  const monthPattern = months.map(([key]) => escapeRegExp(key)).join("|");
  const m = t.match(
    new RegExp(`([0-9]{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthPattern})`, "iu")
  );
  if (m) {
    const d = parseInt(m[1], 10);
    const key = m[2].toLowerCase();
    const found = months.find(
      ([name]) => key.startsWith(name.toLowerCase()) || name.toLowerCase().startsWith(key)
    );
    if (found) {
      const mo = found[1];
      let y = now.getFullYear();
      if (mo < now.getMonth() || (mo === now.getMonth() && d < now.getDate())) y += 1;
      return new Date(y, mo, d).toISOString();
    }
  }
  return undefined;
}

// ---- Seed ------------------------------------------------------------------
// Prototype seed: one jeweller, three karigars, five slips across all statuses.
export async function seedIfEmpty() {
  const count = await db.karigar.count();
  if (count > 0) return false;
  await reseed();
  return true;
}

export async function reseed(client?: typeof db) {
  const dbClient = client || db;
  await dbClient.payment.deleteMany({});
  await dbClient.ledgerEntry.deleteMany({});
  await dbClient.disputeEvent.deleteMany({});
  await dbClient.slip.deleteMany({});
  await dbClient.karigar.deleteMany({});
  await dbClient.jewellerAccount.deleteMany({});
  await dbClient.otpChallenge.deleteMany({});
  await dbClient.notificationLog.deleteMany({});
  await dbClient.alertLog.deleteMany({});
  await dbClient.idempotencyKey.deleteMany({});
  await ensureBenchmarks(dbClient);

  // P2: demo PINs so the login cards match a seeded database. PINs are stored
  // only as scrypt hashes, exactly like hashPin() in lib/auth.ts.
  const pin = (plain: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    return {
      pinHash: crypto.scryptSync(plain, salt, 32).toString("hex"),
      pinSalt: salt,
    };
  };
  await dbClient.jewellerAccount.create({
    data: { id: "default", ...pin("1234") },
  });

  const day = (y: number, m: number, d: number, h = 10, min = 0) =>
    new Date(y, m - 1, d, h, min, 0);

  const ravi = await dbClient.karigar.create({
    data: { name: "Ravi Kumar", phone: "+91 98450 11223", speciality: "Necklace sets", city: "Bengaluru", upiId: "ravi.kumar@upi", ...pin("1111") },
  });
  const suresh = await dbClient.karigar.create({
    data: { name: "Suresh Patel", phone: "+91 99001 44557", speciality: "Bangles & anklets", city: "Bengaluru", upiId: "suresh.patel@upi", ...pin("2222") },
  });
  const meena = await dbClient.karigar.create({
    data: { name: "Meena Naik", phone: "+91 97402 88391", speciality: "Jhumkas & rings, from home", city: "Tumakuru", upiId: "meena.naik@upi", ...pin("3333") },
  });

  // year 2026, current date is 10 Nov 2026
  const Y = 2026;

  const s211 = await dbClient.slip.create({
    data: {
      number: 211, karigarId: suresh.id, weightGrams: 12.2, purity: "22K",
      job: "Bangle set (2)", dueDate: day(Y, 11, 2), wastageAgreedPct: 3.5,
      status: "SETTLED", pieceWeightGrams: 11.62, scrapWeightGrams: 0.14,
      wastageActualPct: computeWastage(12.2, 11.62, 0.14),
      jewellerApproved: true, karigarApproved: true,
      jewellerApprovedAt: day(Y, 11, 1, 14), karigarApprovedAt: day(Y, 11, 1, 15),
      settledAt: day(Y, 11, 1, 15), payDueAt: day(Y, 11, 2, 15),
      makingCharges: makingCharges(12.2), paidAt: day(Y, 11, 2, 15),
      customerName: "Ananya Rao", customerPhone: "+91 90080 22114",
      publicToken: newPublicToken(),
      createdAt: day(Y, 10, 20),
    },
  });
  const s212 = await dbClient.slip.create({
    data: {
      number: 212, karigarId: meena.id, weightGrams: 8.6, purity: "22K",
      job: "Jhumkas (1 pair)", dueDate: day(Y, 11, 5), wastageAgreedPct: 4,
      status: "SETTLED", pieceWeightGrams: 8.14, scrapWeightGrams: 0.12,
      wastageActualPct: computeWastage(8.6, 8.14, 0.12),
      jewellerApproved: true, karigarApproved: true,
      jewellerApprovedAt: day(Y, 11, 3, 16), karigarApprovedAt: day(Y, 11, 3, 16, 30),
      settledAt: day(Y, 11, 3, 16, 30), payDueAt: day(Y, 11, 4, 16, 30),
      makingCharges: makingCharges(8.6), paidAt: day(Y, 11, 5, 17),
      customerName: "Kavya Shetty", customerPhone: "+91 90080 44207",
      publicToken: newPublicToken(),
      createdAt: day(Y, 10, 24),
    },
  });
  const s213 = await dbClient.slip.create({
    data: {
      number: 213, karigarId: suresh.id, weightGrams: 18.75, purity: "22K",
      job: "Anklets (1 pair)", dueDate: day(Y, 11, 18), wastageAgreedPct: 3,
      status: "WORKING", makingCharges: makingCharges(18.75),
      customerName: "Deepa Menon", customerPhone: "+91 90080 55732",
      publicToken: newPublicToken(),
      createdAt: day(Y, 11, 3),
    },
  });
  const s214 = await dbClient.slip.create({
    data: {
      number: 214, karigarId: ravi.id, weightGrams: 25.4, purity: "22K",
      job: "Necklace set", isWedding: true, dueDate: day(Y, 11, 12), wastageAgreedPct: 3,
      status: "ISSUED", makingCharges: makingCharges(25.4),
      customerName: "Priya & Arjun", customerPhone: "+91 90080 66845",
      publicToken: newPublicToken(),
      createdAt: day(Y, 11, 10, 9),
    },
  });
  const s215 = await dbClient.slip.create({
    data: {
      number: 215, karigarId: meena.id, weightGrams: 14.0, purity: "18K",
      job: "Ring set (2)", dueDate: day(Y, 11, 11), wastageAgreedPct: 3,
      status: "RETURNED", pieceWeightGrams: 13.35, scrapWeightGrams: 0.15,
      wastageActualPct: computeWastage(14.0, 13.35, 0.15),
      makingCharges: makingCharges(14.0),
      customerName: "Lakshmi Iyer", customerPhone: "+91 90080 77903",
      publicToken: newPublicToken(),
      createdAt: day(Y, 11, 1),
    },
  });

  // Already-paid demo payments: both had a UPI reference and OTP-confirmed receipt.
  await dbClient.payment.create({
    data: {
      slipId: s211.id, amount: makingCharges(12.2), method: "UPI", status: "PAID",
      upiRef: "410023456789", paidConfirmedAt: day(Y, 11, 2, 15), createdAt: day(Y, 11, 1, 15, 5),
    },
  });
  await dbClient.payment.create({
    data: {
      slipId: s212.id, amount: makingCharges(8.6), method: "UPI", status: "PAID",
      upiRef: "410098765432", paidConfirmedAt: day(Y, 11, 5, 17), createdAt: day(Y, 11, 3, 16, 35),
    },
  });

  // Slip #215 came back before this build, so the return route never ran for it.
  // Compute its fair-wastage verdict the same way the route does: from Meena's
  // settled history, and store it so the Fair-wastage console shows it.
  const meenaHistory = await dbClient.slip.findMany({
    where: { karigarId: meena.id, status: "SETTLED", wastageActualPct: { not: null } },
    select: { wastageActualPct: true },
  });
  const meenaVals = meenaHistory.map((h) => h.wastageActualPct as number);
  const benchmarks215 = await dbClient.wastageBenchmark.findMany();
  const verdict215 = fairVerdict({
    job: s215.job,
    agreed: s215.wastageAgreedPct,
    actual: s215.wastageActualPct as number,
    history: meenaVals,
    benchmarks: benchmarks215,
  });
  await dbClient.slip.update({ where: { id: s215.id }, data: { fairFlag: verdict215.text } });

  await appendLedger("ISSUE", "Slip #211 issued — 12.20 g, 22K, bangle set, to Suresh Patel. Agreed wastage 3.5%.", s211.id, day(Y, 10, 20), dbClient);
  await appendLedger("TAP", "Both taps done: Suresh confirmed the slip on his phone. Gold 12.20 g now shows in his account.", s211.id, day(Y, 10, 20, 10, 30), dbClient);
  await appendLedger("ISSUE", "Slip #212 issued — 8.60 g, 22K, jhumkas, to Meena Naik. Agreed wastage 4%.", s212.id, day(Y, 10, 24), dbClient);
  await appendLedger("TAP", "Both taps done: Meena confirmed slip #212. Gold 8.60 g now shows in her account.", s212.id, day(Y, 10, 24, 12, 10), dbClient);
  await appendLedger("RETURN", "Slip #212 returned — piece 8.14 g + scrap 0.12 g. Wastage worked out at 3.95%, agreed was 4%.", s212.id, day(Y, 11, 5, 11, 0), dbClient);
  await appendLedger("SETTLE", "Slip #212 settled — both approved. ₹3,270 making charges paid by UPI.", s212.id, day(Y, 11, 5, 17, 0), dbClient);
  await appendLedger("ISSUE", "Slip #213 issued — 18.75 g, 22K, anklets, to Suresh Patel. Agreed wastage 3%.", s213.id, day(Y, 11, 3), dbClient);
  await appendLedger("TAP", "Both taps done: Suresh confirmed slip #213. Gold 18.75 g now shows in his account.", s213.id, day(Y, 11, 3, 10, 45), dbClient);
  await appendLedger("ISSUE", "Slip #214 issued — 25.40 g, 22K, necklace set, to Ravi Kumar. Wedding order, due 12 Nov. Agreed wastage 3%.", s214.id, day(Y, 11, 10, 9), dbClient);
  await appendLedger("ISSUE", "Slip #215 issued — 14.00 g, 18K, ring set, to Meena Naik. Agreed wastage 3%.", s215.id, day(Y, 11, 1), dbClient);
  await appendLedger("TAP", "Both taps done: Meena confirmed slip #215. Gold 14.00 g now shows in her account.", s215.id, day(Y, 11, 1, 13, 20), dbClient);
  await appendLedger("RETURN", "Slip #215 returned — piece 13.35 g + scrap 0.15 g. Wastage worked out at 3.57%, agreed was 3%. Fair-wastage agent: within her usual range.", s215.id, day(Y, 11, 9, 16, 40), dbClient);
  await appendLedger("FLAG", `Fair-wastage on slip #215: ${verdict215}`, s215.id, day(Y, 11, 9, 16, 41), dbClient);
}

// Verify ledger chain integrity
// Entries must arrive sorted by seq ascending. Checks three things per entry:
//  1. seq is contiguous starting at 1 (a gap means an entry was deleted);
//  2. prevHash matches the previously verified hash ("GENESIS" for seq 1);
//  3. hash recomputes from seq, prevHash, kind, actor, slipId, createdAt and text.
export interface LedgerVerifyEntry {
  seq: number;
  hash: string;
  prevHash?: string | null;
  kind: string;
  text: string;
  slipId?: string | null;
  actor: string;
  createdAt: Date;
}

export function verifyLedgerChain(entries: LedgerVerifyEntry[]): {
  ok: boolean;
  checked: number;
  brokenAtSeq?: number;
} {
  let checked = 0;
  let prevHash = "GENESIS";

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    if (e.seq !== i + 1) {
      return { ok: false, checked, brokenAtSeq: e.seq };
    }

    if (e.prevHash != null && e.prevHash !== prevHash) {
      return { ok: false, checked, brokenAtSeq: e.seq };
    }

    const expected = hashChain(
      e.seq,
      prevHash,
      e.kind,
      e.actor,
      e.slipId ?? null,
      e.createdAt,
      e.text
    );
    if (e.hash !== expected) {
      return { ok: false, checked, brokenAtSeq: e.seq };
    }

    prevHash = e.hash;
    checked++;
  }

  return { ok: true, checked };
}

// ---- P4: Karigar management -------------------------------------------------
// The plan cap and price are a *proposal* from the deck (Slide 11), shown
// clearly as proposed — not a hard commercial limit.
export const KARIGAR_PLAN_CAP = 10;
export const PROPOSED_PLAN_RUPEES = 499;

export interface AddKarigarInput {
  name: string;
  phone: string;
  speciality: string;
  city: string;
}

export type AddKarigarResult =
  | { ok: true; karigar: { id: string; name: string }; count: number; cap: number }
  | { ok: false; error: string; status: number; count: number; cap: number };

// Add a karigar, respecting the proposed plan cap. Returns the new count
// either way so the UI can show "Karigar N of 10".
export async function addKarigar(
  client: typeof db,
  input: AddKarigarInput,
  cap: number = KARIGAR_PLAN_CAP
): Promise<AddKarigarResult> {
  const name = (input.name ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const speciality = (input.speciality ?? "").trim();
  const city = (input.city ?? "").trim();

  const count = await client.karigar.count();
  if (!name || !phone || !speciality || !city) {
    return {
      ok: false,
      error: "Fill every field: name, phone, speciality and city.",
      status: 400,
      count,
      cap,
    };
  }
  if (count >= cap) {
    return {
      ok: false,
      error: `The proposed plan covers ${cap} karigars. This is a prototype cap, not a hard limit.`,
      status: 409,
      count,
      cap,
    };
  }

  const karigar = await client.karigar.create({
    data: { name, phone, speciality, city },
  });
  return {
    ok: true,
    karigar: { id: karigar.id, name: karigar.name },
    count: count + 1,
    cap,
  };
}

// ---- P4: Wastage counter-proposal ------------------------------------------
// A karigar may propose a different wastage % on an ISSUED slip. While the
// proposal is PENDING the karigar's confirm/approve taps stay blocked; the
// jeweller accepts (which sets the agreed %) or declines.
export function karigarTapBlocked(slip: {
  wastageProposalStatus?: string | null;
}): boolean {
  return slip.wastageProposalStatus === "PENDING";
}

export interface WastageProposalResult {
  ok: boolean;
  error?: string;
  status?: number;
  slip?: { id: string; wastageProposedPct: number | null; wastageProposalStatus: string | null };
}

export async function submitWastageProposal(
  client: typeof db,
  args: { slipId: string; karigarId: string; pct: number; note?: string }
): Promise<WastageProposalResult> {
  const slip = await client.slip.findUnique({
    where: { id: args.slipId },
    include: { karigar: true },
  });
  if (!slip) return { ok: false, error: "Slip not found.", status: 404 };
  if (slip.status !== "ISSUED")
    return {
      ok: false,
      error: `A wastage proposal is made while the slip is ISSUED; this one is ${slip.status}.`,
      status: 400,
    };
  if (slip.karigarId !== args.karigarId)
    return { ok: false, error: "This slip belongs to another karigar.", status: 403 };
  if (!isFinite(args.pct) || args.pct < 0 || args.pct > 100)
    return { ok: false, error: "Enter a wastage between 0 and 100.", status: 400 };

  const pct = Math.round(args.pct * 100) / 100;
  const note = (args.note ?? "").trim().slice(0, 300);
  const updated = await client.slip.update({
    where: { id: slip.id },
    data: {
      wastageProposedPct: pct,
      wastageProposalStatus: "PENDING",
      wastageProposalNote: note || null,
      wastageProposedAt: new Date(),
    },
  });
  await appendLedger(
    {
      kind: "PROPOSE",
      text: `${slip.karigar.name} proposed a wastage of ${pct}% on slip #${slip.number}${note ? ` — ${note}` : ""}. Waiting for the jeweller to accept or decline.`,
      actor: `karigar:${slip.karigarId}`,
      slipId: slip.id,
    },
    client
  );
  return {
    ok: true,
    slip: {
      id: updated.id,
      wastageProposedPct: updated.wastageProposedPct,
      wastageProposalStatus: updated.wastageProposalStatus,
    },
  };
}

export async function respondWastageProposal(
  client: typeof db,
  args: { slipId: string; side: "jeweller" | "karigar"; accept: boolean; note?: string }
): Promise<WastageProposalResult> {
  const slip = await client.slip.findUnique({
    where: { id: args.slipId },
    include: { karigar: true },
  });
  if (!slip) return { ok: false, error: "Slip not found.", status: 404 };
  if (args.side !== "jeweller")
    return { ok: false, error: "Only the jeweller can accept or decline a wastage proposal.", status: 403 };
  if (slip.wastageProposalStatus !== "PENDING" || slip.wastageProposedPct == null)
    return { ok: false, error: "There is no wastage proposal waiting on this slip.", status: 400 };

  const note = (args.note ?? "").trim().slice(0, 300);
  const updated = await client.slip.update({
    where: { id: slip.id },
    data: args.accept
      ? { wastageProposalStatus: "ACCEPTED", wastageAgreedPct: slip.wastageProposedPct }
      : { wastageProposalStatus: "DECLINED" },
  });
  await appendLedger(
    {
      kind: args.accept ? "ACCEPT" : "DECLINE",
      text: args.accept
        ? `Jeweller accepted ${slip.karigar.name}'s wastage proposal on slip #${slip.number}${note ? ` — ${note}` : ""}. Agreed wastage is now ${updated.wastageAgreedPct}%.`
        : `Jeweller declined ${slip.karigar.name}'s wastage proposal on slip #${slip.number}${note ? ` — ${note}` : ""}. The agreed ${slip.wastageAgreedPct}% stands.`,
      actor: "jeweller",
      slipId: slip.id,
    },
    client
  );
  return {
    ok: true,
    slip: {
      id: updated.id,
      wastageProposedPct: updated.wastageProposedPct,
      wastageProposalStatus: updated.wastageProposalStatus,
    },
  };
}

// ---- P4: Stronger disputes --------------------------------------------------
// Disputes can be raised with the karigar (WORKING) or after it comes back
// (RETURNED). The side that opened it may only withdraw; the other side may
// agree to resolve. Neither side can close it alone.
export type DisputeSide = "jeweller" | "karigar";
export type DisputeAction = "open" | "note" | "resolve" | "withdraw";

export function disputeStageAllowed(status: string): boolean {
  return status === "WORKING" || status === "RETURNED";
}

export interface DisputeActionResult {
  ok: boolean;
  error?: string;
  status?: number;
  slip?: { id: string; disputed: boolean; disputeOpenedBy: string | null };
}

export async function applyDisputeAction(
  client: typeof db,
  args: { slipId: string; side: DisputeSide; action: DisputeAction; note?: string }
): Promise<DisputeActionResult> {
  const slip = await client.slip.findUnique({
    where: { id: args.slipId },
    include: { karigar: true },
  });
  if (!slip) return { ok: false, error: "Slip not found.", status: 404 };
  if (!disputeStageAllowed(slip.status))
    return {
      ok: false,
      error: `Disputes are raised while the slip is with the karigar or returned; this one is ${slip.status}.`,
      status: 400,
    };

  const who = args.side === "jeweller" ? "Jeweller" : slip.karigar.name;
  const actorStr = args.side === "jeweller" ? "jeweller" : `karigar:${slip.karigarId}`;
  const note = (args.note ?? "").trim().slice(0, 300);

  // ---- no dispute yet: only "open" is valid ----
  if (!slip.disputed) {
    if (args.action !== "open")
      return { ok: false, error: "There is no open dispute on this slip.", status: 400 };
    const updated = await client.slip.update({
      where: { id: slip.id },
      data: {
        disputed: true,
        disputeOpenedBy: args.side,
        disputeNote: `${who}: ${note || "no note given"}`,
      },
    });
    await client.disputeEvent.create({
      data: { slipId: slip.id, kind: "OPENED", side: args.side, note: note || null },
    });
    await appendLedger(
      {
        kind: "DISPUTE",
        text: `${who} flagged a dispute on slip #${slip.number}${note ? ` — ${note}` : ""}. Settlement is blocked until both sides agree or it is withdrawn.`,
        actor: actorStr,
        slipId: slip.id,
      },
      client
    );
    return { ok: true, slip: { id: updated.id, disputed: updated.disputed, disputeOpenedBy: updated.disputeOpenedBy } };
  }

  // ---- dispute already open ----
  if (args.action === "open")
    return { ok: false, error: "This slip already has an open dispute — add your side instead.", status: 409 };

  if (args.action === "withdraw") {
    if (slip.disputeOpenedBy !== args.side)
      return { ok: false, error: "Only the side that opened the dispute can withdraw it.", status: 403 };
    const updated = await client.slip.update({
      where: { id: slip.id },
      data: { disputed: false, disputeOpenedBy: null },
    });
    await client.disputeEvent.create({
      data: { slipId: slip.id, kind: "WITHDRAWN", side: args.side, note: note || null },
    });
    await appendLedger(
      {
        kind: "RESOLVE",
        text: `${who} withdrew the dispute on slip #${slip.number}${note ? ` — ${note}` : ""}. Settlement can go ahead.`,
        actor: actorStr,
        slipId: slip.id,
      },
      client
    );
    return { ok: true, slip: { id: updated.id, disputed: updated.disputed, disputeOpenedBy: updated.disputeOpenedBy } };
  }

  if (args.action === "resolve") {
    if (slip.disputeOpenedBy === args.side)
      return {
        ok: false,
        error: "The side that opened the dispute cannot also close it. The other side must agree, or the opener may withdraw.",
        status: 409,
      };
    const updated = await client.slip.update({
      where: { id: slip.id },
      data: { disputed: false, disputeOpenedBy: null },
    });
    await client.disputeEvent.create({
      data: { slipId: slip.id, kind: "RESOLVED", side: args.side, note: note || null },
    });
    await appendLedger(
      {
        kind: "RESOLVE",
        text: `${who} agreed the dispute on slip #${slip.number} is settled${note ? ` — ${note}` : ""}. Settlement can go ahead.`,
        actor: actorStr,
        slipId: slip.id,
      },
      client
    );
    return { ok: true, slip: { id: updated.id, disputed: updated.disputed, disputeOpenedBy: updated.disputeOpenedBy } };
  }

  // ---- action === "note" ----
  const updated = await client.slip.update({
    where: { id: slip.id },
    data: {
      disputeNote: `${slip.disputeNote ? `${slip.disputeNote}\n` : ""}${who}: ${note || "no note given"}`,
    },
  });
  await client.disputeEvent.create({
    data: { slipId: slip.id, kind: "NOTE", side: args.side, note: note || null },
  });
  await appendLedger(
    {
      kind: "DISPUTE",
      text: `${who} added his side to the dispute on slip #${slip.number}${note ? ` — ${note}` : ""}. Still blocked until resolved.`,
      actor: actorStr,
      slipId: slip.id,
    },
    client
  );
  return { ok: true, slip: { id: updated.id, disputed: updated.disputed, disputeOpenedBy: updated.disputeOpenedBy } };
}

// ---- Dispute metrics --------------------------------------------------------
export interface DisputeEventLike {
  slipId: string;
  kind: string;
  createdAt: Date | string;
}

export function disputeMetrics(
  events: DisputeEventLike[],
  now: Date = new Date()
): {
  byMonth: Array<{ month: string; opened: number; closed: number }>;
  thisMonth: number;
  avgDays: number;
  resolved: number;
} {
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const byMonthMap = new Map<string, { opened: number; closed: number }>();
  const bySlip = new Map<string, DisputeEventLike[]>();

  for (const e of events) {
    const created = new Date(e.createdAt);
    const key = monthKey(created);
    const row = byMonthMap.get(key) ?? { opened: 0, closed: 0 };
    if (e.kind === "OPENED") row.opened++;
    if (e.kind === "RESOLVED" || e.kind === "WITHDRAWN") row.closed++;
    byMonthMap.set(key, row);

    const arr = bySlip.get(e.slipId) ?? [];
    arr.push(e);
    bySlip.set(e.slipId, arr);
  }

  const byMonth = [...byMonthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, opened: v.opened, closed: v.closed }));

  const durations: number[] = [];
  for (const arr of bySlip.values()) {
    const sorted = [...arr].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let openedAt: number | null = null;
    for (const e of sorted) {
      if (e.kind === "OPENED") {
        openedAt = new Date(e.createdAt).getTime();
      } else if ((e.kind === "RESOLVED" || e.kind === "WITHDRAWN") && openedAt !== null) {
        durations.push(Math.max(0, (new Date(e.createdAt).getTime() - openedAt) / 86400000));
        openedAt = null;
      }
    }
  }

  const avgDays = durations.length
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    : 0;

  return {
    byMonth,
    thisMonth: byMonthMap.get(monthKey(now))?.opened ?? 0,
    avgDays,
    resolved: durations.length,
  };
}

// ---- P6: Payment clock & UPI -------------------------------------------------
export const PAYMENT_CLOCK_HOURS = 24;

export function paymentDueAt(from: Date = new Date(), hours: number = PAYMENT_CLOCK_HOURS): Date {
  return new Date(from.getTime() + hours * 3600 * 1000);
}

// Builds a UPI deep link. Tola never moves money — the link opens the payer's
// UPI app; the reference is recorded by hand and confirmed by the karigar.
export function buildUpiLink(input: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const params = new URLSearchParams();
  params.set("pa", input.payeeVpa);
  params.set("pn", input.payeeName);
  params.set("am", String(Math.round(input.amount * 100) / 100));
  params.set("cu", "INR");
  params.set("tn", input.note ?? "Tola payment");
  return `upi://pay?${params.toString()}`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export interface PaymentClock {
  dueAt: string | null;
  msLeft: number;
  overdue: boolean;
  label: string;
}

export function paymentClock(
  payDueAt: Date | string | null | undefined,
  now: Date = new Date()
): PaymentClock {
  if (!payDueAt) {
    return { dueAt: null, msLeft: 0, overdue: false, label: "no clock" };
  }
  const due = new Date(payDueAt);
  const msLeft = due.getTime() - now.getTime();
  const overdue = msLeft < 0;
  return {
    dueAt: due.toISOString(),
    msLeft,
    overdue,
    label: overdue ? `overdue by ${formatDuration(msLeft)}` : `${formatDuration(msLeft)} left`,
  };
}

// Latest approval timestamp on a slip, used as the start of the payment clock.
export function approvalAt(slip: {
  jewellerApprovedAt?: Date | null;
  karigarApprovedAt?: Date | null;
  settledAt?: Date | null;
  createdAt?: Date | null;
}): Date | null {
  const candidates = [slip.jewellerApprovedAt, slip.karigarApprovedAt, slip.settledAt, slip.createdAt]
    .filter((d): d is Date => !!d)
    .map((d) => new Date(d).getTime());
  if (!candidates.length) return null;
  return new Date(Math.max(...candidates));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round(((to.getTime() - from.getTime()) / 86400000) * 10) / 10);
}

// ---- P6: Payment recording & OTP confirmation --------------------------------
export function isValidUpiRef(ref: string): boolean {
  return /^\d{12}$/.test(ref);
}

export interface PaymentActionResult {
  ok: boolean;
  error?: string;
  status?: number;
  payment?: {
    id: string;
    status: string;
    upiRef: string | null;
    paidConfirmedAt: Date | null;
  };
  challengeId?: string;
  expiresAt?: string;
  demoCode?: string;
}

export async function recordUpiPayment(
  client: typeof db,
  args: { paymentId: string; upiRef: string }
): Promise<PaymentActionResult> {
  const payment = await client.payment.findUnique({
    where: { id: args.paymentId },
    include: { slip: { include: { karigar: true } } },
  });
  if (!payment) return { ok: false, error: "Payment not found.", status: 404 };
  if (payment.status === "PAID")
    return { ok: false, error: "This payment is already confirmed as received.", status: 409 };

  const upiRef = (args.upiRef ?? "").trim();
  if (!isValidUpiRef(upiRef))
    return { ok: false, error: "Enter the 12-digit UPI reference from your payment app.", status: 400 };

  const updated = await client.payment.update({
    where: { id: payment.id },
    data: { upiRef, status: "PENDING_CONFIRMATION" },
  });
  await appendLedger(
    {
      kind: "PAY",
      text: `Jeweller recorded UPI ref ${upiRef} for slip #${payment.slip.number} (Rs ${payment.amount.toLocaleString("en-IN")}). Waiting for ${payment.slip.karigar.name} to confirm receipt.`,
      actor: "jeweller",
      slipId: payment.slipId,
    },
    client
  );
  return {
    ok: true,
    payment: {
      id: updated.id,
      status: updated.status,
      upiRef: updated.upiRef,
      paidConfirmedAt: updated.paidConfirmedAt,
    },
  };
}

export async function requestPaymentOtp(
  client: typeof db,
  args: { paymentId: string }
): Promise<PaymentActionResult> {
  const payment = await client.payment.findUnique({
    where: { id: args.paymentId },
    include: { slip: { include: { karigar: true } } },
  });
  if (!payment) return { ok: false, error: "Payment not found.", status: 404 };
  if (payment.status === "PAID")
    return { ok: false, error: "This payment is already confirmed as received.", status: 409 };
  if (!payment.upiRef)
    return { ok: false, error: "The jeweller has not recorded the UPI reference yet.", status: 409 };

  const actor = `karigar:${payment.slip.karigarId}`;
  const created = await createOtpChallenge(
    { actor, purpose: "confirm-payment", targetId: payment.id },
    client
  );
  if (!created.ok) return { ok: false, error: created.error, status: created.status ?? 400 };

  // Demo only: surface the code from the DEMO SMS inbox so the prototype works
  // on one screen. It is never stored in plaintext.
  const log = await client.notificationLog.findFirst({
    where: { actor },
    orderBy: { createdAt: "desc" },
  });
  const demoCode = log?.text.match(/(\d{6})/)?.[1];

  return { ok: true, challengeId: created.challengeId, expiresAt: created.expiresAt, demoCode };
}

// ---- P8: Customer status link ----------------------------------------------
// A customer gets one opaque link. The page behind it is deliberately narrow:
// progress, due date and plain-language status only. Weights, purity, wastage,
// karigar identity, making charges, payments and ledger hashes never leave the
// server through this DTO.
export const PUBLIC_STATUS_TTL_DAYS = 30;

export type CustomerStatusStep = 1 | 2 | 3 | 4;

export interface CustomerStatusEvent {
  label: string;
  at: string;
}

export interface CustomerStatusDTO {
  number: number;
  job: string;
  isWedding: boolean;
  dueDate: string;
  status: SlipStatus;
  createdAt: string;
  progressStep: CustomerStatusStep;
  events: CustomerStatusEvent[];
}

/** 32 hex characters (128 bits) — unguessable enough to be the only credential. */
export function newPublicToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

const STEP_BY_STATUS: Record<SlipStatus, CustomerStatusStep> = {
  ISSUED: 1,
  WORKING: 2,
  RETURNED: 3,
  SETTLED: 4,
};

// Ledger entries are only used for their timestamp. Their text carries weights,
// names and money, so it is replaced with a generic public label — and an
// unknown kind is dropped entirely rather than passed through.
const PUBLIC_EVENT_LABEL: Record<string, string> = {
  ISSUE: "Order opened at the jeweller",
  TAP: "Gold handed over — both taps done",
  RETURN: "Piece came back for weighing",
  APPROVE: "Approval recorded",
  CLOCK: "Settlement step started",
  SETTLE: "Settled — both sides approved",
  PAID: "Payment completed",
  PROPOSE: "A wastage note was added",
  ACCEPT: "Agreement reached",
  DECLINE: "Agreement updated",
  DISPUTE: "A question was raised",
  RESOLVE: "Question closed",
};

export interface PublicStatusSlip {
  number: number;
  job: string;
  isWedding: boolean;
  dueDate: Date | string;
  status: string;
  createdAt: Date | string;
  settledAt?: Date | string | null;
  publicTokenRevokedAt?: Date | string | null;
}

/** Revoked links die immediately; settled links live for 30 days. */
export function publicStatusVisible(
  slip: PublicStatusSlip,
  now: Date = new Date()
): boolean {
  if (slip.publicTokenRevokedAt) return false;
  if (slip.status !== "SETTLED" || !slip.settledAt) return true;
  const expiresAt =
    new Date(slip.settledAt).getTime() + PUBLIC_STATUS_TTL_DAYS * 86400000;
  return now.getTime() <= expiresAt;
}

/**
 * The only shape the customer page may see. Returns null for a revoked or
 * expired link so callers can answer 404 without saying why.
 */
export function customerStatusDto(
  slip: PublicStatusSlip,
  events: Array<{ kind: string; createdAt: Date | string }> = [],
  now: Date = new Date()
): CustomerStatusDTO | null {
  if (!publicStatusVisible(slip, now)) return null;

  const publicEvents = events
    .filter((e) => PUBLIC_EVENT_LABEL[e.kind])
    .map((e) => ({
      label: PUBLIC_EVENT_LABEL[e.kind],
      at: new Date(e.createdAt).toISOString(),
    }))
    .slice(-3);

  const status = slip.status as SlipStatus;
  return {
    number: slip.number,
    job: slip.job,
    isWedding: slip.isWedding,
    dueDate: new Date(slip.dueDate).toISOString(),
    status,
    createdAt: new Date(slip.createdAt).toISOString(),
    progressStep: STEP_BY_STATUS[status] ?? 1,
    events: publicEvents,
  };
}

/** Plain-language status for the customer page. */
export function customerStatusLine(status: SlipStatus): string {
  switch (status) {
    case "ISSUED":
      return "The jeweller has opened the order. The gold is being weighed and prepared for the karigar.";
    case "WORKING":
      return "The gold is with the karigar and the piece is being made.";
    case "RETURNED":
      return "The piece is back at the jeweller. It is being checked and both sides are approving it.";
    case "SETTLED":
    default:
      return "Your order is settled. Both sides approved it and the payment is being completed.";
  }
}

export async function confirmPaymentWithOtp(
  client: typeof db,
  args: { paymentId: string; challengeId: string; code: string }
): Promise<PaymentActionResult> {
  const payment = await client.payment.findUnique({
    where: { id: args.paymentId },
    include: { slip: { include: { karigar: true } } },
  });
  if (!payment) return { ok: false, error: "Payment not found.", status: 404 };
  if (payment.status === "PAID")
    return { ok: false, error: "This payment is already confirmed as received.", status: 409 };
  if (!payment.upiRef)
    return { ok: false, error: "The jeweller has not recorded the UPI reference yet.", status: 409 };

  const actor = `karigar:${payment.slip.karigarId}`;
  const consumed = await consumeOtpChallenge(
    {
      challengeId: args.challengeId,
      code: args.code,
      actor,
      purpose: "confirm-payment",
      targetId: payment.id,
    },
    client
  );
  if (!consumed.ok) return { ok: false, error: consumed.error, status: 400 };

  const now = new Date();
  const updated = await client.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", paidConfirmedAt: now },
  });
  await client.slip.update({ where: { id: payment.slipId }, data: { paidAt: now } });
  await appendLedger(
    {
      kind: "PAID",
      text: `${payment.slip.karigar.name} confirmed receipt of Rs ${payment.amount.toLocaleString("en-IN")} by UPI (ref ${payment.upiRef}). Payment marked paid.`,
      actor,
      slipId: payment.slipId,
      proof: consumed.proof,
    },
    client
  );
  return {
    ok: true,
    payment: {
      id: updated.id,
      status: updated.status,
      upiRef: updated.upiRef,
      paidConfirmedAt: updated.paidConfirmedAt,
    },
  };
}

// ---- P13: Impact metrics ----------------------------------------------------
// The three numbers promised on the slide: disputes per month, days taken to
// pay a karigar, and orders returned by the due date. All are derived from the
// same rows both sides see — nothing is typed in by hand.

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export interface DeliverySlipLike {
  dueDate: Date | string;
  returnedAt?: Date | string | null;
  settledAt?: Date | string | null;
}

/**
 * Share of returned jobs whose return is on or before the due date. A return
 * on the due day itself counts as on time. Jobs without a recorded return
 * timestamp are left out of both the numerator and the denominator, so the
 * result never invents a delivery date.
 */
export function onTimeDelivery(slips: DeliverySlipLike[]): {
  pct: number;
  onTime: number;
  returned: number;
} {
  let onTime = 0;
  let returned = 0;

  for (const slip of slips) {
    const due = asDate(slip.dueDate);
    const at = asDate(slip.returnedAt) ?? asDate(slip.settledAt);
    if (!due || !at) continue;
    returned++;
    const endOfDueDay = new Date(due);
    endOfDueDay.setHours(23, 59, 59, 999);
    if (at.getTime() <= endOfDueDay.getTime()) onTime++;
  }

  const pct = returned ? Math.round((onTime / returned) * 1000) / 10 : 0;
  return { pct, onTime, returned };
}

export interface PaidSlipLike {
  status: string;
  createdAt: Date | string;
  jewellerApprovedAt?: Date | string | null;
  karigarApprovedAt?: Date | string | null;
  settledAt?: Date | string | null;
  paidAt?: Date | string | null;
  payment?: {
    status?: string | null;
    paidConfirmedAt?: Date | string | null;
    createdAt?: Date | string | null;
  } | null;
}

/**
 * Approval → paid with the P6 correction: the clock starts at the latest
 * approval or settlement, not when the slip was first written. Only settled
 * slips whose money was confirmed as received are counted.
 */
export function approvalToPaid(slips: PaidSlipLike[]): {
  avgDays: number;
  paid: number;
  samples: number[];
} {
  const samples: number[] = [];

  for (const slip of slips) {
    if (slip.status !== "SETTLED") continue;
    const paid =
      slip.payment?.status === "PAID"
        ? (asDate(slip.payment.paidConfirmedAt) ??
          asDate(slip.payment.createdAt) ??
          asDate(slip.paidAt))
        : asDate(slip.paidAt);
    if (!paid) continue;

    const start =
      approvalAt({
        jewellerApprovedAt: asDate(slip.jewellerApprovedAt),
        karigarApprovedAt: asDate(slip.karigarApprovedAt),
        settledAt: asDate(slip.settledAt),
        createdAt: asDate(slip.createdAt),
      }) ?? asDate(slip.createdAt);
    if (!start) continue;

    samples.push(daysBetween(start, paid));
  }

  const avgDays = samples.length
    ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
    : 0;
  return { avgDays, paid: samples.length, samples };
}

/** Six month buckets ending with the current month, including quiet months. */
export function disputeTrend(
  events: DisputeEventLike[],
  now: Date = new Date(),
  months = 6
): Array<{ month: string; opened: number; closed: number }> {
  const { byMonth } = disputeMetrics(events, now);
  const map = new Map(byMonth.map((row) => [row.month, row]));
  const out: Array<{ month: string; opened: number; closed: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = map.get(key);
    out.push({ month: key, opened: row?.opened ?? 0, closed: row?.closed ?? 0 });
  }

  return out;
}
