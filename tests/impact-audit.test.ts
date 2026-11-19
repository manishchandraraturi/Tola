// P13 — impact metric formulas and audit export verification.
import { describe, expect, it } from "vitest";
import {
  approvalToPaid,
  disputeTrend,
  hashChain,
  onTimeDelivery,
} from "@/lib/tola";
import {
  buildAuditExport,
  toAuditCsv,
  type AuditLedgerInput,
  type AuditSlipInput,
} from "@/lib/audit";

const at = (iso: string) => new Date(iso);

function ledger(
  rows: Array<{
    kind: string;
    text: string;
    actor: string;
    slipId: string | null;
    proof?: string | null;
    createdAt: Date;
  }>
): AuditLedgerInput[] {
  let prevHash = "GENESIS";
  return rows.map((row, i) => {
    const seq = i + 1;
    const hash = hashChain(
      seq,
      prevHash,
      row.kind,
      row.actor,
      row.slipId,
      row.createdAt,
      row.text
    );
    const entry: AuditLedgerInput = {
      seq,
      hash,
      prevHash,
      kind: row.kind,
      text: row.text,
      actor: row.actor,
      slipId: row.slipId,
      createdAt: row.createdAt,
      proof: row.proof ?? null,
    };
    prevHash = hash;
    return entry;
  });
}

const slips: AuditSlipInput[] = [
  {
    id: "s1",
    number: 211,
    job: "Bangle set, pair",
    purity: "22K",
    status: "SETTLED",
    weightGrams: 12.2,
    dueDate: at("2026-11-02T00:00:00.000Z"),
    returnedAt: at("2026-11-01T10:00:00.000Z"),
    pieceWeightGrams: 11.62,
    scrapWeightGrams: 0.14,
    wastageAgreedPct: 3.5,
    wastageActualPct: 3.61,
    makingCharges: 4640,
    settledAt: at("2026-11-01T15:00:00.000Z"),
    jewellerApprovedAt: at("2026-11-01T14:00:00.000Z"),
    karigarApprovedAt: at("2026-11-01T15:00:00.000Z"),
    karigar: { name: "Suresh Patel" },
    payment: {
      amount: 4640,
      status: "PAID",
      upiRef: "410023456789",
      paidConfirmedAt: at("2026-11-02T15:00:00.000Z"),
    },
  },
  {
    id: "s2",
    number: 212,
    job: "Jhumkas (1 pair)",
    purity: "22K",
    status: "SETTLED",
    weightGrams: 8.6,
    dueDate: at("2026-11-05T00:00:00.000Z"),
    returnedAt: at("2026-11-05T11:00:00.000Z"),
    pieceWeightGrams: 8.14,
    scrapWeightGrams: 0.12,
    wastageAgreedPct: 4,
    wastageActualPct: 3.95,
    makingCharges: 3270,
    settledAt: at("2026-11-03T16:30:00.000Z"),
    jewellerApprovedAt: at("2026-11-03T16:00:00.000Z"),
    karigarApprovedAt: at("2026-11-03T16:30:00.000Z"),
    karigar: { name: "Meena Naik" },
    payment: {
      amount: 3270,
      status: "PAID",
      upiRef: "410098765432",
      paidConfirmedAt: at("2026-11-05T17:00:00.000Z"),
    },
  },
];

const entries = ledger([
  {
    kind: "ISSUE",
    text: "Slip #211 issued.",
    actor: "jeweller",
    slipId: "s1",
    createdAt: at("2026-10-20T10:00:00.000Z"),
  },
  {
    kind: "RETURN",
    text: "Slip #211 returned.",
    actor: "jeweller",
    slipId: "s1",
    createdAt: at("2026-11-01T10:00:00.000Z"),
  },
  {
    kind: "PAID",
    text: "Payment confirmed.",
    actor: "karigar:ravi",
    slipId: "s1",
    proof: "otp:ch_123",
    createdAt: at("2026-11-02T15:00:00.000Z"),
  },
]);

describe("on-time delivery", () => {
  it("counts a return before or on the due day", () => {
    const result = onTimeDelivery([
      {
        dueDate: at("2026-11-02T00:00:00.000Z"),
        returnedAt: at("2026-11-01T10:00:00.000Z"),
      },
      {
        dueDate: at("2026-11-05T00:00:00.000Z"),
        returnedAt: at("2026-11-05T18:00:00.000Z"),
      },
      {
        dueDate: at("2026-11-10T00:00:00.000Z"),
        returnedAt: at("2026-11-11T09:00:00.000Z"),
      },
    ]);

    expect(result).toEqual({ pct: 66.7, onTime: 2, returned: 3 });
  });

  it("leaves jobs without a recorded return date out of the metric", () => {
    const result = onTimeDelivery([
      {
        dueDate: at("2026-11-02T00:00:00.000Z"),
        returnedAt: at("2026-11-01T10:00:00.000Z"),
      },
      { dueDate: at("2026-11-12T00:00:00.000Z"), returnedAt: null },
    ]);

    expect(result).toEqual({ pct: 100, onTime: 1, returned: 1 });
  });

  it("falls back to the settlement date when returnAt was never stored", () => {
    const result = onTimeDelivery([
      {
        dueDate: at("2026-11-02T00:00:00.000Z"),
        settledAt: at("2026-11-02T15:00:00.000Z"),
      },
    ]);

    expect(result).toEqual({ pct: 100, onTime: 1, returned: 1 });
  });

  it("returns zero rather than dividing by zero when nothing is returned", () => {
    expect(onTimeDelivery([])).toEqual({ pct: 0, onTime: 0, returned: 0 });
  });
});

describe("approval → paid", () => {
  it("uses the latest approval and only counts confirmed payments", () => {
    const result = approvalToPaid([
      {
        status: "SETTLED",
        createdAt: at("2026-10-20T10:00:00.000Z"),
        jewellerApprovedAt: at("2026-11-01T14:00:00.000Z"),
        karigarApprovedAt: at("2026-11-01T15:00:00.000Z"),
        payment: {
          status: "PAID",
          paidConfirmedAt: at("2026-11-02T15:00:00.000Z"),
        },
      },
      {
        status: "SETTLED",
        createdAt: at("2026-10-24T10:00:00.000Z"),
        karigarApprovedAt: at("2026-11-03T16:30:00.000Z"),
        payment: {
          status: "PAID",
          paidConfirmedAt: at("2026-11-05T17:00:00.000Z"),
        },
      },
      {
        status: "SETTLED",
        createdAt: at("2026-10-24T10:00:00.000Z"),
        jewellerApprovedAt: at("2026-11-03T16:00:00.000Z"),
        payment: { status: "PENDING_CONFIRMATION" },
      },
      {
        status: "RETURNED",
        createdAt: at("2026-10-24T10:00:00.000Z"),
        payment: {
          status: "PAID",
          paidConfirmedAt: at("2026-11-05T17:00:00.000Z"),
        },
      },
    ]);

    expect(result.paid).toBe(2);
    expect(result.avgDays).toBe(1.5);
    expect(result.samples).toEqual([1, 2]);
  });
});

describe("disputes per month", () => {
  it("returns six months with quiet months at zero", () => {
    const trend = disputeTrend(
      [
        {
          slipId: "s1",
          kind: "OPENED",
          createdAt: new Date(2026, 10, 5, 10),
        },
        {
          slipId: "s1",
          kind: "RESOLVED",
          createdAt: new Date(2026, 10, 6, 10),
        },
        {
          slipId: "s2",
          kind: "OPENED",
          createdAt: new Date(2026, 8, 3, 10),
        },
      ],
      new Date(2026, 10, 18, 12)
    );

    expect(trend).toHaveLength(6);
    expect(trend[0].month).toBe("2026-06");
    expect(trend[trend.length - 1]).toEqual({
      month: "2026-11",
      opened: 1,
      closed: 1,
    });
    expect(trend.find((m) => m.month === "2026-09")).toEqual({
      month: "2026-09",
      opened: 1,
      closed: 0,
    });
    expect(trend.find((m) => m.month === "2026-07")).toEqual({
      month: "2026-07",
      opened: 0,
      closed: 0,
    });
  });
});

describe("audit export", () => {
  it("verifies the ledger chain and includes OTP proofs", () => {
    const audit = buildAuditExport(
      slips,
      entries,
      new Date("2026-11-18T12:00:00.000Z")
    );

    expect(audit.chain).toEqual({ ok: true, checked: 3 });
    expect(audit.range).toEqual({ from: 1, to: 3 });
    expect(audit.rows).toHaveLength(2);

    const first = audit.rows[0];
    expect(first.job).toBe("Bangle set, pair");
    expect(first.agreedPct).toBe(3.5);
    expect(first.actualPct).toBe(3.61);
    expect(first.diffPct).toBe(0.11);
    expect(first.otpProofs).toEqual(["PAID otp:ch_123"]);
    expect(first.ledgerSeqs).toEqual([1, 2, 3]);
  });

  it("records a broken chain at the first bad entry", () => {
    const tampered = entries.map((entry) =>
      entry.seq === 2 ? { ...entry, text: "Slip #211 returned (edited)." } : entry
    );
    const audit = buildAuditExport(
      slips,
      tampered,
      new Date("2026-11-18T12:00:00.000Z")
    );

    expect(audit.chain.ok).toBe(false);
    expect(audit.chain.brokenAtSeq).toBe(2);
  });

  it("serializes rows and the chain status to CSV", () => {
    const audit = buildAuditExport(
      slips,
      entries,
      new Date("2026-11-18T12:00:00.000Z")
    );
    const csv = toAuditCsv(audit);

    expect(csv).toContain("# Chain verified,yes");
    expect(csv).toContain("# Ledger range,1-3");
    expect(csv).toContain("# Entries checked,3");
    expect(csv).toContain("slip_number,karigar,job");
    expect(csv).toContain('"Bangle set, pair"');
    expect(csv).toContain("PAID otp:ch_123");
    expect(csv).toContain("410023456789");
  });

  it("writes a broken chain status into the CSV too", () => {
    const tampered = entries.map((entry) =>
      entry.seq === 1 ? { ...entry, text: "Edited issue entry." } : entry
    );
    const csv = toAuditCsv(
      buildAuditExport(slips, tampered, new Date("2026-11-18T12:00:00.000Z"))
    );

    expect(csv).toContain("# Chain verified,no");
    expect(csv).toContain("# Chain broken at,1");
  });

  it("handles an empty ledger without claiming a break", () => {
    const audit = buildAuditExport([], [], new Date("2026-11-18T12:00:00.000Z"));

    expect(audit.chain).toEqual({ ok: true, checked: 0 });
    expect(audit.range).toBeNull();
    expect(audit.rows).toEqual([]);
  });
});
