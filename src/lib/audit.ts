// P13 — jeweller audit export.
// Builds one row per job plus the live ledger-chain result at export time.
// Pure: the API route and the printable page both call this with the same rows.
import { verifyLedgerChain, type LedgerVerifyEntry } from "./tola";

export interface AuditPaymentLike {
  amount?: number | null;
  status?: string | null;
  upiRef?: string | null;
  paidConfirmedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface AuditSlipInput {
  id: string;
  number: number;
  job: string;
  purity: string;
  status: string;
  weightGrams: number;
  dueDate: Date | string;
  returnedAt?: Date | string | null;
  pieceWeightGrams?: number | null;
  scrapWeightGrams?: number | null;
  wastageAgreedPct: number;
  wastageActualPct?: number | null;
  makingCharges?: number | null;
  settledAt?: Date | string | null;
  paidAt?: Date | string | null;
  jewellerApprovedAt?: Date | string | null;
  karigarApprovedAt?: Date | string | null;
  karigar: { name: string };
  payment?: AuditPaymentLike | null;
}

export interface AuditLedgerInput extends LedgerVerifyEntry {
  proof?: string | null;
}

export interface AuditRow {
  slipNumber: number;
  karigar: string;
  job: string;
  purity: string;
  status: string;
  issuedGrams: number;
  dueDate: string | null;
  returnedAt: string | null;
  pieceGrams: number | null;
  scrapGrams: number | null;
  agreedPct: number;
  actualPct: number | null;
  diffPct: number | null;
  makingCharges: number;
  paymentStatus: string;
  upiRef: string | null;
  jewellerApprovedAt: string | null;
  karigarApprovedAt: string | null;
  settledAt: string | null;
  paidAt: string | null;
  otpProofs: string[];
  ledgerSeqs: number[];
}

export interface AuditExportResult {
  generatedAt: string;
  range: { from: number; to: number } | null;
  chain: { ok: boolean; checked: number; brokenAtSeq?: number };
  rows: AuditRow[];
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Assemble the audit export and verify the whole ledger chain at this moment.
 * `entries` may arrive in any order; they are sorted by seq before checking.
 */
export function buildAuditExport(
  slips: AuditSlipInput[],
  entries: AuditLedgerInput[],
  now: Date = new Date()
): AuditExportResult {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const chain = verifyLedgerChain(sorted);
  const range = sorted.length
    ? { from: sorted[0].seq, to: sorted[sorted.length - 1].seq }
    : null;

  const bySlip = new Map<string, AuditLedgerInput[]>();
  for (const entry of sorted) {
    if (!entry.slipId) continue;
    const list = bySlip.get(entry.slipId) ?? [];
    list.push(entry);
    bySlip.set(entry.slipId, list);
  }

  const rows: AuditRow[] = slips.map((slip) => {
    const own = bySlip.get(slip.id) ?? [];
    const actual = slip.wastageActualPct ?? null;
    return {
      slipNumber: slip.number,
      karigar: slip.karigar.name,
      job: slip.job,
      purity: slip.purity,
      status: slip.status,
      issuedGrams: round2(slip.weightGrams),
      dueDate: iso(slip.dueDate),
      returnedAt: iso(slip.returnedAt ?? slip.settledAt),
      pieceGrams:
        slip.pieceWeightGrams == null ? null : round2(slip.pieceWeightGrams),
      scrapGrams:
        slip.scrapWeightGrams == null ? null : round2(slip.scrapWeightGrams),
      agreedPct: round2(slip.wastageAgreedPct),
      actualPct: actual == null ? null : round2(actual),
      diffPct: actual == null ? null : round2(actual - slip.wastageAgreedPct),
      makingCharges: Math.round(slip.payment?.amount ?? slip.makingCharges ?? 0),
      paymentStatus: slip.payment?.status ?? (slip.paidAt ? "PAID" : ""),
      upiRef: slip.payment?.upiRef ?? null,
      jewellerApprovedAt: iso(slip.jewellerApprovedAt),
      karigarApprovedAt: iso(slip.karigarApprovedAt),
      settledAt: iso(slip.settledAt),
      paidAt: iso(slip.paidAt ?? slip.payment?.paidConfirmedAt),
      otpProofs: own
        .filter((entry) => !!entry.proof)
        .map((entry) => `${entry.kind} ${entry.proof}`),
      ledgerSeqs: own.map((entry) => entry.seq),
    };
  });

  return {
    generatedAt: now.toISOString(),
    range,
    chain,
    rows,
  };
}

const HEADERS = [
  "slip_number",
  "karigar",
  "job",
  "purity",
  "status",
  "gold_issued_g",
  "due_date",
  "returned_at",
  "piece_g",
  "scrap_g",
  "wastage_agreed_pct",
  "wastage_actual_pct",
  "wastage_diff_pct",
  "making_charges_inr",
  "payment_status",
  "upi_ref",
  "jeweller_approved_at",
  "karigar_approved_at",
  "settled_at",
  "paid_at",
  "otp_proofs",
  "ledger_entry_seqs",
];

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Keep spreadsheets from evaluating a cell as a formula.
  if (/^[=+@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** CSV with a short metadata preamble, then one row per job. */
export function toAuditCsv(result: AuditExportResult): string {
  const preamble: string[][] = [
    ["# Tola audit export"],
    ["# Generated", result.generatedAt],
    ["# Ledger range", result.range ? `${result.range.from}-${result.range.to}` : "none"],
    ["# Chain verified", result.chain.ok ? "yes" : "no"],
    ["# Entries checked", String(result.chain.checked)],
    ["# Chain broken at", result.chain.brokenAtSeq == null ? "" : String(result.chain.brokenAtSeq)],
    [],
    HEADERS,
  ];

  const rows = result.rows.map((row) => [
    row.slipNumber,
    row.karigar,
    row.job,
    row.purity,
    row.status,
    row.issuedGrams,
    row.dueDate,
    row.returnedAt,
    row.pieceGrams,
    row.scrapGrams,
    row.agreedPct,
    row.actualPct,
    row.diffPct,
    row.makingCharges,
    row.paymentStatus,
    row.upiRef,
    row.jewellerApprovedAt,
    row.karigarApprovedAt,
    row.settledAt,
    row.paidAt,
    row.otpProofs.join(" | "),
    row.ledgerSeqs.join(" "),
  ]);

  return [...preamble, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")
    .concat("\r\n");
}
