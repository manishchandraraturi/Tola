// Tola — shared domain logic (server-side)
import crypto from "crypto";
import { db } from "@/lib/db";

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

export function hashChain(prevHash: string, kind: string, text: string, at: Date) {
  return crypto
    .createHash("sha256")
    .update(`${prevHash}|${kind}|${text}|${at.toISOString()}`)
    .digest("hex");
}

export async function appendLedger(
  kind: string,
  text: string,
  slipId?: string,
  at?: Date
) {
  const prev = await db.ledgerEntry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const now = at ?? new Date();
  const hash = hashChain(prev?.hash ?? "GENESIS", kind, text, now);
  return db.ledgerEntry.create({
    data: { kind, text, hash, slipId: slipId ?? null, createdAt: now },
  });
}

// ---- Fair-wastage agent ----------------------------------------------------
// Compares each job with that pair's history and the usual range.
// Flags odd ones in plain words. Never accuses.
export function fairVerdict(
  agreed: number,
  actual: number,
  band: { min: number; avg: number; max: number; n: number } | null
): string {
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
export function scribeParse(text: string) {
  const t = text.toLowerCase();
  const weight = num(t, /([0-9]+(?:\.[0-9]+)?)\s*(?:g|gram|grams|ग्राम|ಗ್ರಾಂ)/);
  const purityMatch = t.match(/\b(24|22|18)\s*(k|kt|carat|caret|ಕೆ)\b/);
  const purity = purityMatch ? `${purityMatch[1]}K` : undefined;
  const wastage = num(t, /wastage\s*(?:of|is|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*%?/);
  const wedding = /(wedding|marriage|ಮದುವೆ|शादी)/.test(t);
  const due = parseDue(t);
  let job = /(?:job|job:|piece|for|of)\s*[:]?\s*([a-z ]{3,40})/.exec(t)?.[1]?.trim();
  // e.g. "25.4 grams 22K necklace set, wastage 3" — the words after the purity
  // are the job. Prefer this when it matches: "for <name>" after the job would
  // otherwise be mistaken for the job itself.
  const jobAfterPurity = /\b(?:24|22|18)\s*k[a-z]*\.?\s+([a-z][a-z ]{2,30}?)(?:\s*,|\s+wastage|\s+due|\s+in\s|\s+for\s|$)/.exec(t)?.[1]?.trim();
  if (jobAfterPurity) {
    job = jobAfterPurity;
  } else if (job) {
    job = job.replace(/\s+(due|on|by|for|wedding|marriage|wastage).*$/, "").trim();
  }
  if (!job) job = undefined;
  return { weight, purity, wastage, wedding, due, job };
}

function num(t: string, re: RegExp): number | undefined {
  const m = t.match(re);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
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
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const m = t.match(/\b(?:due|by|on)\s*(?:the)?\s*([0-9]{1,2})\s*(?:st|nd|rd|th)?\s*(?:of\s*)?([a-z]{3})[a-z]*/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = months.findIndex((x) => m[2].startsWith(x));
    if (mo >= 0) {
      const now = new Date();
      let y = now.getFullYear();
      if (mo < now.getMonth() || (mo === now.getMonth() && d < now.getDate())) y += 1;
      return new Date(y, mo, d).toISOString();
    }
  }
  const m2 = t.match(/\bin\s*([0-9]{1,2})\s*days?\b/);
  if (m2) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(m2[1], 10));
    return d.toISOString();
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

export async function reseed() {
  await db.payment.deleteMany({});
  await db.ledgerEntry.deleteMany({});
  await db.slip.deleteMany({});
  await db.karigar.deleteMany({});

  const day = (y: number, m: number, d: number, h = 10, min = 0) =>
    new Date(y, m - 1, d, h, min, 0);

  const ravi = await db.karigar.create({
    data: { name: "Ravi Kumar", phone: "+91 98450 11223", speciality: "Necklace sets", city: "Bengaluru" },
  });
  const suresh = await db.karigar.create({
    data: { name: "Suresh Patel", phone: "+91 99001 44557", speciality: "Bangles & anklets", city: "Bengaluru" },
  });
  const meena = await db.karigar.create({
    data: { name: "Meena Naik", phone: "+91 97402 88391", speciality: "Jhumkas & rings, from home", city: "Tumakuru" },
  });

  // year 2026, current date is 10 Nov 2026
  const Y = 2026;

  const s211 = await db.slip.create({
    data: {
      number: 211, karigarId: suresh.id, weightGrams: 12.2, purity: "22K",
      job: "Bangle set (2)", dueDate: day(Y, 11, 2), wastageAgreedPct: 3.5,
      status: "SETTLED", pieceWeightGrams: 11.62, scrapWeightGrams: 0.14,
      wastageActualPct: computeWastage(12.2, 11.62, 0.14),
      jewellerApproved: true, karigarApproved: true,
      makingCharges: makingCharges(12.2), paidAt: day(Y, 11, 2, 15),
      createdAt: day(Y, 10, 20),
    },
  });
  const s212 = await db.slip.create({
    data: {
      number: 212, karigarId: meena.id, weightGrams: 8.6, purity: "22K",
      job: "Jhumkas (1 pair)", dueDate: day(Y, 11, 5), wastageAgreedPct: 4,
      status: "SETTLED", pieceWeightGrams: 8.14, scrapWeightGrams: 0.12,
      wastageActualPct: computeWastage(8.6, 8.14, 0.12),
      jewellerApproved: true, karigarApproved: true,
      makingCharges: makingCharges(8.6), paidAt: day(Y, 11, 5, 17),
      createdAt: day(Y, 10, 24),
    },
  });
  const s213 = await db.slip.create({
    data: {
      number: 213, karigarId: suresh.id, weightGrams: 18.75, purity: "22K",
      job: "Anklets (1 pair)", dueDate: day(Y, 11, 18), wastageAgreedPct: 3,
      status: "WORKING", makingCharges: makingCharges(18.75), createdAt: day(Y, 11, 3),
    },
  });
  const s214 = await db.slip.create({
    data: {
      number: 214, karigarId: ravi.id, weightGrams: 25.4, purity: "22K",
      job: "Necklace set", isWedding: true, dueDate: day(Y, 11, 12), wastageAgreedPct: 3,
      status: "ISSUED", makingCharges: makingCharges(25.4), createdAt: day(Y, 11, 10, 9),
    },
  });
  const s215 = await db.slip.create({
    data: {
      number: 215, karigarId: meena.id, weightGrams: 14.0, purity: "18K",
      job: "Ring set (2)", dueDate: day(Y, 11, 11), wastageAgreedPct: 3,
      status: "RETURNED", pieceWeightGrams: 13.35, scrapWeightGrams: 0.15,
      wastageActualPct: computeWastage(14.0, 13.35, 0.15),
      makingCharges: makingCharges(14.0),
      createdAt: day(Y, 11, 1),
    },
  });

  // Slip #215 came back before this build, so the return route never ran for it.
  // Compute its fair-wastage verdict the same way the route does: from Meena's
  // settled history, and store it so the Fair-wastage console shows it.
  const meenaHistory = await db.slip.findMany({
    where: { karigarId: meena.id, status: "SETTLED", wastageActualPct: { not: null } },
    select: { wastageActualPct: true },
  });
  const meenaVals = meenaHistory.map((h) => h.wastageActualPct as number);
  const band215 = meenaVals.length
    ? {
        min: Math.min(...meenaVals),
        max: Math.max(...meenaVals),
        avg: Math.round((meenaVals.reduce((a, b) => a + b, 0) / meenaVals.length) * 100) / 100,
        n: meenaVals.length,
      }
    : null;
  const verdict215 = fairVerdict(
    s215.wastageAgreedPct,
    s215.wastageActualPct as number,
    band215
  );
  await db.slip.update({ where: { id: s215.id }, data: { fairFlag: verdict215 } });

  await appendLedger("ISSUE", "Slip #211 issued — 12.20 g, 22K, bangle set, to Suresh Patel. Agreed wastage 3.5%.", s211.id, day(Y, 10, 20));
  await appendLedger("TAP", "Both taps done: Suresh confirmed the slip on his phone. Gold 12.20 g now shows in his account.", s211.id, day(Y, 10, 20, 10, 30));
  await appendLedger("ISSUE", "Slip #212 issued — 8.60 g, 22K, jhumkas, to Meena Naik. Agreed wastage 4%.", s212.id, day(Y, 10, 24));
  await appendLedger("TAP", "Both taps done: Meena confirmed slip #212. Gold 8.60 g now shows in her account.", s212.id, day(Y, 10, 24, 12, 10));
  await appendLedger("RETURN", "Slip #212 returned — piece 8.14 g + scrap 0.12 g. Wastage worked out at 3.95%, agreed was 4%.", s212.id, day(Y, 11, 5, 11, 0));
  await appendLedger("SETTLE", "Slip #212 settled — both approved. ₹3,270 making charges paid by UPI.", s212.id, day(Y, 11, 5, 17, 0));
  await appendLedger("ISSUE", "Slip #213 issued — 18.75 g, 22K, anklets, to Suresh Patel. Agreed wastage 3%.", s213.id, day(Y, 11, 3));
  await appendLedger("TAP", "Both taps done: Suresh confirmed slip #213. Gold 18.75 g now shows in his account.", s213.id, day(Y, 11, 3, 10, 45));
  await appendLedger("ISSUE", "Slip #214 issued — 25.40 g, 22K, necklace set, to Ravi Kumar. Wedding order, due 12 Nov. Agreed wastage 3%.", s214.id, day(Y, 11, 10, 9));
  await appendLedger("ISSUE", "Slip #215 issued — 14.00 g, 18K, ring set, to Meena Naik. Agreed wastage 3%.", s215.id, day(Y, 11, 1));
  await appendLedger("TAP", "Both taps done: Meena confirmed slip #215. Gold 14.00 g now shows in her account.", s215.id, day(Y, 11, 1, 13, 20));
  await appendLedger("RETURN", "Slip #215 returned — piece 13.35 g + scrap 0.15 g. Wastage worked out at 3.57%, agreed was 3%. Fair-wastage agent: within her usual range.", s215.id, day(Y, 11, 9, 16, 40));
  await appendLedger("FLAG", `Fair-wastage on slip #215: ${verdict215}`, s215.id, day(Y, 11, 9, 16, 41));
}
