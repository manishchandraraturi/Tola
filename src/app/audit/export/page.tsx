import { db } from "@/lib/db";
import { buildAuditExport } from "@/lib/audit";
import { PrintButton } from "@/components/tola/print-button";

export const dynamic = "force-dynamic";

const dt = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

const grams = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} g`);
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}%`);
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// Printable audit export: per-job weights and wastage, scrap, signatures,
// OTP-backed ledger proofs, and a live chain verification at page load.
// The CSV route builds the same data from the same helper.
export default async function AuditExportPage() {
  const slips = await db.slip.findMany({
    orderBy: { number: "asc" },
    include: { karigar: { select: { name: true } }, payment: true },
  });
  const entries = await db.ledgerEntry.findMany({
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      hash: true,
      prevHash: true,
      kind: true,
      text: true,
      slipId: true,
      actor: true,
      createdAt: true,
      proof: true,
    },
  });

  const audit = buildAuditExport(slips, entries);
  const chainLabel = audit.chain.ok
    ? `Chain verified · ${audit.chain.checked} entries`
    : `Chain break at #${audit.chain.brokenAtSeq ?? "?"} · ${audit.chain.checked} checked`;
  const chainTone = audit.chain.ok
    ? { background: "var(--green-fill)", border: "2px solid var(--green-line)", color: "var(--green-ink)" }
    : { background: "var(--salmon-fill)", border: "2px solid var(--salmon-line)", color: "var(--salmon-ink)" };

  return (
    <main className="paper-bg min-h-screen px-6 py-10 font-hand text-ink print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-[2.5px] border-ink pb-3">
          <div>
            <p className="font-sketch text-3xl font-bold">Tola · Audit export</p>
            <p className="text-ink-soft">Sri Lakshmi Jewellers · Bengaluru</p>
            <p className="font-sketch text-lg font-bold">
              Every job, every signature, every ledger link
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <PrintButton />
              <a
                href="/api/audit/export"
                className="inline-flex min-h-12 items-center border-[2.5px] border-ink bg-white px-4 py-2 font-sketch text-sm font-bold text-ink sketch-c print:hidden"
              >
                Download CSV
              </a>
            </div>
            <p className="text-xs text-ink-soft">Generated {dt(audit.generatedAt)}</p>
          </div>
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-3">
          <span className="stamp" style={chainTone}>
            {chainLabel}
          </span>
          <span className="font-hand text-sm text-ink-soft">
            Ledger range:{" "}
            <b>
              {audit.range ? `#${audit.range.from}–#${audit.range.to}` : "no entries"}
            </b>
          </span>
          <span className="font-hand text-sm text-ink-soft">
            {audit.rows.length} job{audit.rows.length === 1 ? "" : "s"} on record
          </span>
        </section>

        <section className="mt-5">
          <p className="font-sketch text-lg font-bold">
            Per-job breakdown · agreed vs actual wastage and scrap
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Karigar</th>
                  <th className="py-1 pr-2">Job</th>
                  <th className="py-1 pr-2">Issued</th>
                  <th className="py-1 pr-2">Returned</th>
                  <th className="py-1 pr-2">Piece</th>
                  <th className="py-1 pr-2">Scrap</th>
                  <th className="py-1 pr-2">Agreed</th>
                  <th className="py-1 pr-2">Actual</th>
                  <th className="py-1 pr-2">Diff</th>
                  <th className="py-1 pr-2">Charges</th>
                  <th className="py-1">Payment / UPI ref</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => (
                  <tr
                    key={row.slipNumber}
                    className="border-b border-dashed border-ink-soft/40 align-top"
                  >
                    <td className="py-1 pr-2 font-mono text-xs">{row.slipNumber}</td>
                    <td className="py-1 pr-2">{row.karigar}</td>
                    <td className="py-1 pr-2">
                      {row.job}
                      <span className="ml-1 text-xs text-ink-soft">({row.purity})</span>
                    </td>
                    <td className="py-1 pr-2">{grams(row.issuedGrams)}</td>
                    <td className="py-1 pr-2 text-xs">{dt(row.returnedAt)}</td>
                    <td className="py-1 pr-2">{grams(row.pieceGrams)}</td>
                    <td className="py-1 pr-2">{grams(row.scrapGrams)}</td>
                    <td className="py-1 pr-2">{pct(row.agreedPct)}</td>
                    <td className="py-1 pr-2">{pct(row.actualPct)}</td>
                    <td className="py-1 pr-2">
                      {row.diffPct == null
                        ? "—"
                        : `${row.diffPct > 0 ? "+" : ""}${row.diffPct}%`}
                    </td>
                    <td className="py-1 pr-2">{rupees(row.makingCharges)}</td>
                    <td className="py-1 text-xs">
                      {row.paymentStatus || "—"}
                      {row.upiRef ? ` · ${row.upiRef}` : ""}
                    </td>
                  </tr>
                ))}
                {audit.rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-2 text-ink-soft">
                      No jobs on record yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5">
          <p className="font-sketch text-lg font-bold">
            Signatures, timestamps and OTP proofs
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Jeweller approved</th>
                  <th className="py-1 pr-2">Karigar approved</th>
                  <th className="py-1 pr-2">Settled</th>
                  <th className="py-1 pr-2">Paid</th>
                  <th className="py-1 pr-2">OTP-backed ledger proofs</th>
                  <th className="py-1">Ledger seq</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => (
                  <tr
                    key={row.slipNumber}
                    className="border-b border-dashed border-ink-soft/40 align-top"
                  >
                    <td className="py-1 pr-2 font-mono text-xs">{row.slipNumber}</td>
                    <td className="py-1 pr-2 text-xs">{dt(row.jewellerApprovedAt)}</td>
                    <td className="py-1 pr-2 text-xs">{dt(row.karigarApprovedAt)}</td>
                    <td className="py-1 pr-2 text-xs">{dt(row.settledAt)}</td>
                    <td className="py-1 pr-2 text-xs">{dt(row.paidAt)}</td>
                    <td className="py-1 pr-2 text-xs">
                      {row.otpProofs.length ? row.otpProofs.join(" · ") : "—"}
                    </td>
                    <td className="py-1 font-mono text-xs">
                      {row.ledgerSeqs.length ? row.ledgerSeqs.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
          <p className="font-sketch text-lg font-bold">Chain verification at export time</p>
          <p className="mt-1 text-sm">
            {audit.chain.ok
              ? `All ${audit.chain.checked} ledger entries recompute to their stored hashes, with contiguous sequence numbers and matching previous hashes.`
              : `The chain does not recompute past entry #${audit.chain.brokenAtSeq ?? "?"}. The export records the break instead of hiding it.`}
          </p>
          <p className="mt-1 font-mono text-xs text-ink-soft">
            Ledger range: {audit.range ? `${audit.range.from}-${audit.range.to}` : "none"} ·
            entries checked: {audit.chain.checked} · generated: {audit.generatedAt}
          </p>
        </section>

        <p className="mt-6 border-t-2 border-dashed border-ink-soft/40 pt-2 text-sm text-ink-soft">
          This export is read-only. It contains the same rows both sides see; no weights or
          payments are edited here. Nothing changes without both taps.
        </p>
      </div>
    </main>
  );
}
