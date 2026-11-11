// Unit tests for the pure domain logic in src/lib/tola.ts.
// No database: @/lib/db is aliased to tests/helpers/db-stub.ts in
// vitest.config.ts. Route-level behaviour is covered by scripts/check-routes.sh.
import { describe, it, expect } from "vitest";
import {
  computeWastage,
  makingCharges,
  hashChain,
  fmtPct,
  fairVerdict,
  watcherAlerts,
  scribeParse,
  matchKarigar,
  MAKING_CHARGE_PER_GRAM,
} from "@/lib/tola";

// ---- helpers ---------------------------------------------------------------

function atMidnight(daysFromToday: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d;
}

const KARIGARS = [
  { id: "ravi", name: "Ravi Kumar" },
  { id: "suresh", name: "Suresh Patel" },
  { id: "meena", name: "Meena Naik" },
];

// ---- computeWastage ----------------------------------------------------------

describe("computeWastage", () => {
  it("works out the share that is neither piece nor scrap", () => {
    // Seed slip #211: 12.2 issued, 11.62 piece + 0.14 scrap -> 0.44 lost.
    expect(computeWastage(12.2, 11.62, 0.14)).toBeCloseTo(3.61, 2);
  });

  it("is zero when everything comes back", () => {
    expect(computeWastage(10, 9.5, 0.5)).toBe(0);
  });

  it("is 100 when nothing comes back", () => {
    expect(computeWastage(10, 0, 0)).toBe(100);
  });

  it("rounds to two decimals", () => {
    // 0.444...% -> 3.57 style rounding used by the seeded slip #215.
    expect(computeWastage(14.0, 13.35, 0.15)).toBe(3.57);
  });
});

// ---- makingCharges -----------------------------------------------------------

describe("makingCharges", () => {
  it("charges the demo rate per gram, rounded to the nearest 10", () => {
    expect(MAKING_CHARGE_PER_GRAM).toBe(380);
    expect(makingCharges(12.2)).toBe(4640); // 4636 -> 4640
    expect(makingCharges(8.6)).toBe(3270); // 3268 -> 3270, matches the seed ledger
  });

  it("handles zero", () => {
    expect(makingCharges(0)).toBe(0);
  });
});

// ---- hashChain ----------------------------------------------------------------

describe("hashChain", () => {
  const at = new Date("2026-11-10T10:00:00.000Z");

  it("is deterministic for the same inputs", () => {
    expect(hashChain("GENESIS", "ISSUE", "Slip #211 issued", at)).toBe(
      hashChain("GENESIS", "ISSUE", "Slip #211 issued", at)
    );
  });

  it("produces a 64-char sha256 hex digest", () => {
    expect(hashChain("GENESIS", "ISSUE", "x", at)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any input changes, so tampering shows", () => {
    const base = hashChain("GENESIS", "ISSUE", "Slip #211 issued", at);
    expect(hashChain("tampered-prev", "ISSUE", "Slip #211 issued", at)).not.toBe(base);
    expect(hashChain("GENESIS", "SETTLE", "Slip #211 issued", at)).not.toBe(base);
    expect(hashChain("GENESIS", "ISSUE", "Slip #999 issued", at)).not.toBe(base);
    expect(hashChain("GENESIS", "ISSUE", "Slip #211 issued", new Date(at.getTime() + 1))).not.toBe(
      base
    );
  });

  it("links entries: hashing on top of a real hash gives a new chain", () => {
    const first = hashChain("GENESIS", "ISSUE", "one", at);
    const second = hashChain(first, "TAP", "two", at);
    expect(second).toBe(hashChain(first, "TAP", "two", at));
    expect(second).not.toBe(hashChain("GENESIS", "TAP", "two", at));
  });
});

// ---- fmtPct --------------------------------------------------------------------

describe("fmtPct", () => {
  it("keeps two decimals at most", () => {
    expect(fmtPct(3.606)).toBe("3.61%");
    expect(fmtPct(4)).toBe("4%");
  });
});

// ---- fairVerdict ----------------------------------------------------------------

describe("fairVerdict", () => {
  const band = { min: 3.9, max: 4.1, avg: 4, n: 3 };

  it("calls out a match plainly", () => {
    expect(fairVerdict(4, 4.02, band)).toContain("Matches the agreed 4%");
  });

  it("asks to check the scrap when wastage is far below agreed", () => {
    const msg = fairVerdict(4, 2.5, band);
    expect(msg).toContain("below the agreed 4%");
    expect(msg).toContain("Check the scrap");
  });

  it("flags wastage above the usual band, never accusing", () => {
    const msg = fairVerdict(3, 5, { min: 3, max: 3.5, avg: 3.2, n: 2 });
    expect(msg).toContain("above his usual range of 3%–3.5%");
    expect(msg).toContain("across 2 settled jobs");
    expect(msg).toContain("not an accusation");
  });

  it("needs at least 2 settled jobs before it trusts the band", () => {
    // Same numbers but n = 1: no band claim, falls back to "a little heavy".
    const msg = fairVerdict(3, 5, { min: 3, max: 3.5, avg: 3.2, n: 1 });
    expect(msg).toContain("within his usual range");
    expect(msg).not.toContain("usual range of");
  });

  it("calls a big-but-usual overage 'a little heavy'", () => {
    const msg = fairVerdict(3, 4.6, { min: 3, max: 5, avg: 4, n: 3 });
    expect(msg).toContain("a little heavy, not unusual for him");
  });

  it("stays calm when everything sits inside the range", () => {
    expect(fairVerdict(3, 3.5, { min: 3, max: 5, avg: 4, n: 3 })).toContain("Nothing odd");
  });

  it("works without any history", () => {
    const msg = fairVerdict(3, 3.5, null);
    expect(msg).toContain("sits close to the agreed 3%");
  });
});

// ---- watcherAlerts ----------------------------------------------------------------

describe("watcherAlerts", () => {
  const base = {
    number: 214,
    job: "Necklace set",
    isWedding: false,
    karigarName: "Ravi Kumar",
  };

  it("returns an info note for a RETURNED slip waiting on approvals", () => {
    const out = watcherAlerts([
      { ...base, status: "RETURNED", isWedding: false, dueDate: atMidnight(1) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe("info");
    expect(out[0].message).toContain("waiting for both approvals");
  });

  it("warns about overdue slips", () => {
    const out = watcherAlerts([
      { ...base, status: "WORKING", isWedding: false, dueDate: atMidnight(-2) },
    ]);
    expect(out[0].level).toBe("overdue");
    expect(out[0].message).toContain("2 days past its due date");
  });

  it("puts wedding orders first when they are due soon", () => {
    const out = watcherAlerts([
      { ...base, status: "WORKING", isWedding: true, dueDate: atMidnight(2) },
    ]);
    expect(out[0].level).toBe("wedding-soon");
    expect(out[0].message).toContain("Wedding order!");
  });

  it("queues the WhatsApp reminder in plain words (honest wording)", () => {
    const out = watcherAlerts([
      { ...base, status: "WORKING", isWedding: false, dueDate: atMidnight(1) },
    ]);
    expect(out[0].level).toBe("urgent");
    expect(out[0].message).toContain("A reminder to Ravi Kumar is queued for WhatsApp");
    // The old overclaim must never come back.
    expect(out[0].message).not.toContain("goes out on WhatsApp");
  });

  it("stays silent about settled slips", () => {
    const out = watcherAlerts([
      { ...base, status: "SETTLED", isWedding: true, dueDate: atMidnight(-5) },
    ]);
    expect(out).toHaveLength(0);
  });

  it("sorts overdue first, then weddings, then urgent, then info", () => {
    const out = watcherAlerts([
      { ...base, number: 1, status: "RETURNED", isWedding: false, dueDate: atMidnight(3) },
      { ...base, number: 2, status: "WORKING", isWedding: false, dueDate: atMidnight(1) },
      { ...base, number: 3, status: "WORKING", isWedding: true, dueDate: atMidnight(2) },
      { ...base, number: 4, status: "WORKING", isWedding: false, dueDate: atMidnight(-1) },
    ]);
    expect(out.map((a) => a.slipNumber)).toEqual([4, 3, 2, 1]);
  });

  it("does not double-warn a wedding slip that is also overdue", () => {
    const out = watcherAlerts([
      { ...base, status: "WORKING", isWedding: true, dueDate: atMidnight(-3) },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe("overdue");
  });
});

// ---- scribeParse --------------------------------------------------------------------

describe("scribeParse", () => {
  it("reads the jeweller's demo sentence", () => {
    const p = scribeParse(
      "Ravi Kumar: 25.4 grams 22K necklace set, wastage 3, due 12 Nov, wedding order"
    );
    expect(p.weight).toBe(25.4);
    expect(p.purity).toBe("22K");
    expect(p.wastage).toBe(3);
    expect(p.wedding).toBe(true);
    expect(p.job).toBe("necklace set");
    expect(p.due).toBeDefined();
  });

  it("reads grams written in Hindi and Kannada", () => {
    expect(scribeParse("25 ग्राम 22K पेंडेंट").weight).toBe(25);
    expect(scribeParse("8.5 ಗ್ರಾಂ 22K jhumkas").weight).toBe(8.5);
  });

  it("parses 'in N days' as the due date", () => {
    const p = scribeParse("14 grams 18K ring set, wastage 3, in 5 days");
    expect(p.due).toBeDefined();
    const due = new Date(p.due as string);
    const want = new Date();
    want.setDate(want.getDate() + 5);
    expect(due.getMonth()).toBe(want.getMonth());
    expect(due.getDate()).toBe(want.getDate());
  });

  it("keeps the job that follows the purity, not the 'for <name>' part", () => {
    const p = scribeParse("8 grams 22K bangles for Suresh, wastage 3, in 4 days");
    expect(p.job).toBe("bangles");
  });

  it("returns undefined fields when nothing is said", () => {
    const p = scribeParse("hello");
    expect(p.weight).toBeUndefined();
    expect(p.purity).toBeUndefined();
    expect(p.due).toBeUndefined();
    expect(p.wedding).toBe(false);
  });
});

// ---- matchKarigar ---------------------------------------------------------------------

describe("matchKarigar", () => {
  it("matches a full name, case-insensitively", () => {
    expect(matchKarigar("8 grams for meena naik today", KARIGARS)?.id).toBe("meena");
    expect(matchKarigar("SURESH PATEL", KARIGARS)?.id).toBe("suresh");
  });

  it("matches a first name on word boundaries", () => {
    expect(matchKarigar("for Ravi — 25 grams 22K", KARIGARS)?.id).toBe("ravi");
    expect(matchKarigar("ravi will come tomorrow", KARIGARS)?.id).toBe("ravi");
  });

  it("does not match a name hiding inside another word", () => {
    expect(matchKarigar("making ravioli plates for the shop", KARIGARS)).toBeNull();
  });

  it("prefers the full name when two karigars share a first name", () => {
    const ks = [
      { id: "a", name: "Ravi Kumar" },
      { id: "b", name: "Ravi Sharma" },
    ];
    expect(matchKarigar("slip for Ravi Sharma", ks)?.id).toBe("b");
    expect(matchKarigar("slip for ravi kumar", ks)?.id).toBe("a");
    expect(matchKarigar("just ravi", ks)?.id).toBe("a"); // first in the list wins
  });

  it("returns null when nobody is named", () => {
    expect(matchKarigar("14 grams 18K ring set", KARIGARS)).toBeNull();
  });

  it("survives regex-special characters in a name", () => {
    const ks = [{ id: "x", name: "Anand (Gold)" }];
    expect(matchKarigar("for Anand (Gold) 5 grams", ks)?.id).toBe("x");
  });
});
