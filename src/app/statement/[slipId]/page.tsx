import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { paymentClock } from "@/lib/tola";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// Printable per-slip statement. Public in the prototype: it is the same record
// both sides see. No money moves here — it is a paper trail for the UPI payment.
export default async function StatementPage({
  params,
}: {
  params: Promise<{ slipId: string }>;
}) {
  const { slipId } = await params;

  const slip = await db.slip.findUnique({
    where: { id: slipId },
    include: { karigar: true, payment: true },
  });
  if (!slip) notFound();

  const entries = await db.ledgerEntry.findMany({
    where: { slipId },
    orderBy: { seq: "asc" },
  });

  const clock = paymentClock(slip.payDueAt);
  const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const dt = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  return (
    <main className="paper-bg min-h-screen px-6 py-10 font-hand text-ink print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-[2.5px] border-ink pb-3">
          <div>
            <p className="font-sketch text-3xl font-bold">Tola</p>
            <p className="text-ink-soft">Sri Lakshmi Jewellers · Bengaluru</p>
            <p className="font-sketch text-lg font-bold">Statement · Slip #{slip.number}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PrintButton />
            <p className="text-xs text-ink-soft">Generated {dt(new Date())}</p>
          </div>
        </div>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
          <p><b className="font-sketch">Karigar:</b> {slip.karigar.name}</p>
          <p><b className="font-sketch">Phone:</b> {slip.karigar.phone}</p>
          <p><b className="font-sketch">Job:</b> {slip.job}</p>
          <p><b className="font-sketch">Purity:</b> {slip.purity}</p>
          <p><b className="font-sketch">Status:</b> {slip.status}</p>
          <p><b className="font-sketch">Due:</b> {dt(slip.dueDate)}</p>
        </section>

        <section className="mt-4 border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
          <p className="font-sketch text-lg font-bold">Weights &amp; wastage</p>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
            <p>Gold issued: <b>{slip.weightGrams.toFixed(2)} g</b></p>
            <p>Finished piece: <b>{(slip.pieceWeightGrams ?? 0).toFixed(2)} g</b></p>
            <p>Scrap recovered: <b>{(slip.scrapWeightGrams ?? 0).toFixed(2)} g</b></p>
            <p>
              Wastage: <b>{slip.wastageActualPct ?? "—"}%</b> (agreed {slip.wastageAgreedPct}%)
            </p>
          </div>
          {slip.fairFlag && <p className="mt-2 text-sm text-ink-soft">Fair-wastage: {slip.fairFlag}</p>}
        </section>

        <section className="mt-4 border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
          <p className="font-sketch text-lg font-bold">Payment</p>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
            <p>Making charges: <b>{rupees(slip.payment?.amount ?? slip.makingCharges ?? 0)}</b></p>
            <p>Method: <b>{slip.payment?.method ?? "UPI"}</b></p>
            <p>Status: <b>{slip.payment?.status ?? "—"}</b></p>
            <p>UPI ref: <b>{slip.payment?.upiRef ?? "—"}</b></p>
            <p>Payment clock due: <b>{dt(slip.payDueAt)}</b></p>
            <p>Clock: <b>{clock.label}</b></p>
            <p>Paid at: <b>{dt(slip.paidAt)}</b></p>
            <p>Receipt confirmed: <b>{dt(slip.payment?.paidConfirmedAt ?? null)}</b></p>
          </div>
        </section>

        <section className="mt-4">
          <p className="font-sketch text-lg font-bold">Shared ledger (hash-linked)</p>
          <table className="mt-1 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Kind</th>
                <th className="py-1 pr-2">Entry</th>
                <th className="py-1 pr-2">By</th>
                <th className="py-1">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-dashed border-ink-soft/40 align-top">
                  <td className="py-1 pr-2 font-mono text-xs">{e.seq}</td>
                  <td className="py-1 pr-2 font-sketch font-bold">{e.kind}</td>
                  <td className="py-1 pr-2">
                    {e.text}
                    {e.proof && <span className="ml-1 text-xs text-ink-soft">({e.proof})</span>}
                  </td>
                  <td className="py-1 pr-2">{e.actor}</td>
                  <td className="py-1 text-xs text-ink-soft">{dt(e.createdAt)}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-ink-soft">No entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-xs text-ink-soft">
            Final hash: {entries.length ? entries[entries.length - 1].hash : "GENESIS"}
          </p>
        </section>

        <p className="mt-6 border-t-2 border-dashed border-ink-soft/40 pt-2 text-sm text-ink-soft">
          Tola never moves money. This statement records what both sides agreed and what the UPI app
          did. Nothing changes without both taps.
        </p>
      </div>
    </main>
  );
}
