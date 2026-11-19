import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { approvalToPaid, onTimeDelivery } from "@/lib/tola";
import { PrintButton } from "@/components/tola/print-button";

export const dynamic = "force-dynamic";

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const grams = (n: number) => `${Math.round(n * 100) / 100} g`;
const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

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

const day = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

// Month-end statement for one karigar. Read-only and printable: all jobs on
// record, wastage agreed vs actual, scrap, charges settled and the gold still
// in hand. It is the same record the jeweller sees.
export default async function KarigarStatementPage({
  params,
}: {
  params: Promise<{ karigarId: string }>;
}) {
  const { karigarId } = await params;

  const karigar = await db.karigar.findUnique({
    where: { id: karigarId },
    include: {
      slips: { orderBy: { number: "asc" }, include: { payment: true } },
    },
  });
  if (!karigar) notFound();

  const slips = karigar.slips;
  const open = slips.filter((s) => s.status === "ISSUED" || s.status === "WORKING");
  const returned = slips.filter(
    (s) => s.pieceWeightGrams != null || s.scrapWeightGrams != null
  );
  const settled = slips.filter((s) => s.status === "SETTLED");

  const goldInHand = open.reduce((a, s) => a + s.weightGrams, 0);
  const goldIssued = slips.reduce((a, s) => a + s.weightGrams, 0);
  const returnedGold = returned.reduce(
    (a, s) => a + (s.pieceWeightGrams ?? 0) + (s.scrapWeightGrams ?? 0),
    0
  );
  const wastageGold = returned.reduce(
    (a, s) =>
      a +
      Math.max(
        0,
        s.weightGrams - (s.pieceWeightGrams ?? 0) - (s.scrapWeightGrams ?? 0)
      ),
    0
  );
  const wastageBase = returned.reduce((a, s) => a + s.weightGrams, 0);
  const chargesSettled = settled.reduce(
    (a, s) => a + (s.payment?.amount ?? s.makingCharges ?? 0),
    0
  );
  const paidReceived = slips.reduce(
    (a, s) => a + (s.payment?.status === "PAID" ? s.payment.amount : 0),
    0
  );
  const onTime = onTimeDelivery(slips);
  const pay = approvalToPaid(slips);
  const monthLabel = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="paper-bg min-h-screen px-6 py-10 font-hand text-ink print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-[2.5px] border-ink pb-3">
          <div>
            <p className="font-sketch text-3xl font-bold">Tola</p>
            <p className="text-ink-soft">Sri Lakshmi Jewellers · Bengaluru</p>
            <p className="font-sketch text-lg font-bold">
              Month-end statement · {monthLabel}
            </p>
            <p className="text-ink-soft">
              {karigar.name} · {karigar.phone} · {karigar.speciality}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PrintButton />
            <p className="text-xs text-ink-soft">Generated {dt(new Date())}</p>
          </div>
        </div>

        <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-[2px] border-ink bg-[var(--marker-yellow-soft)] px-3 py-2 sketch-c">
            <p className="text-xs text-ink-soft">Net gold in hand now</p>
            <p className="font-sketch text-2xl font-bold">{grams(goldInHand)}</p>
            <p className="text-xs text-ink-soft">
              {open.length} open slip{open.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="border-[2px] border-ink bg-white px-3 py-2 sketch-c">
            <p className="text-xs text-ink-soft">Making charges settled</p>
            <p className="font-sketch text-2xl font-bold">{rupees(chargesSettled)}</p>
            <p className="text-xs text-ink-soft">
              {settled.length} settled · {rupees(paidReceived)} received
            </p>
          </div>
          <div className="border-[2px] border-ink bg-white px-3 py-2 sketch-c">
            <p className="text-xs text-ink-soft">Wastage on returned jobs</p>
            <p className="font-sketch text-2xl font-bold">{grams(wastageGold)}</p>
            <p className="text-xs text-ink-soft">
              {wastageBase > 0 ? pct((wastageGold / wastageBase) * 100) : "—"} of{" "}
              {grams(wastageBase)} issued
            </p>
          </div>
          <div className="border-[2px] border-ink bg-white px-3 py-2 sketch-c">
            <p className="text-xs text-ink-soft">Returned on or before due date</p>
            <p className="font-sketch text-2xl font-bold">{pct(onTime.pct)}</p>
            <p className="text-xs text-ink-soft">
              {onTime.onTime} of {onTime.returned} dated returns
            </p>
          </div>
        </section>

        <p className="mt-2 text-sm text-ink-soft">
          Gold issued on record: <b>{grams(goldIssued)}</b> · returned piece and scrap:{" "}
          <b>{grams(returnedGold)}</b> · average approval → paid:{" "}
          <b>{pay.paid ? `${pay.avgDays.toFixed(1)} days` : "no paid slips yet"}</b>
          {pay.paid ? ` across ${pay.paid} paid slip${pay.paid === 1 ? "" : "s"}` : ""}.
        </p>

        <section className="mt-5">
          <p className="font-sketch text-lg font-bold">All jobs on record</p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Job</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Issued</th>
                  <th className="py-1 pr-2">Due</th>
                  <th className="py-1 pr-2">Returned</th>
                  <th className="py-1 pr-2">Piece</th>
                  <th className="py-1 pr-2">Scrap</th>
                  <th className="py-1 pr-2">Agreed</th>
                  <th className="py-1 pr-2">Actual</th>
                  <th className="py-1 pr-2">Diff</th>
                  <th className="py-1 pr-2">Charges</th>
                  <th className="py-1">Payment</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((s) => {
                  const diff =
                    s.wastageActualPct == null
                      ? null
                      : Math.round((s.wastageActualPct - s.wastageAgreedPct) * 100) / 100;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-dashed border-ink-soft/40 align-top"
                    >
                      <td className="py-1 pr-2 font-mono text-xs">{s.number}</td>
                      <td className="py-1 pr-2">{s.job}</td>
                      <td className="py-1 pr-2 font-sketch text-xs font-bold">{s.status}</td>
                      <td className="py-1 pr-2">{grams(s.weightGrams)}</td>
                      <td className="py-1 pr-2 text-xs">{day(s.dueDate)}</td>
                      <td className="py-1 pr-2 text-xs">
                        {day(s.returnedAt ?? s.settledAt)}
                      </td>
                      <td className="py-1 pr-2">
                        {s.pieceWeightGrams == null ? "—" : grams(s.pieceWeightGrams)}
                      </td>
                      <td className="py-1 pr-2">
                        {s.scrapWeightGrams == null ? "—" : grams(s.scrapWeightGrams)}
                      </td>
                      <td className="py-1 pr-2">{pct(s.wastageAgreedPct)}</td>
                      <td className="py-1 pr-2">
                        {s.wastageActualPct == null ? "—" : pct(s.wastageActualPct)}
                      </td>
                      <td className="py-1 pr-2">
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff}%`}
                      </td>
                      <td className="py-1 pr-2">
                        {rupees(s.payment?.amount ?? s.makingCharges ?? 0)}
                      </td>
                      <td className="py-1 text-xs">
                        {s.payment
                          ? `${s.payment.status}${s.payment.upiRef ? ` · ${s.payment.upiRef}` : ""}`
                          : s.paidAt
                            ? "PAID"
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
                {slips.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-2 text-ink-soft">
                      No jobs on record yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
            <p className="font-sketch text-lg font-bold">Signatures on record</p>
            <div className="mt-1 space-y-1 text-sm">
              {slips
                .filter((s) => s.jewellerApprovedAt || s.karigarApprovedAt)
                .map((s) => (
                  <p key={s.id}>
                    #{s.number} · jeweller {dt(s.jewellerApprovedAt)} · karigar{" "}
                    {dt(s.karigarApprovedAt)}
                  </p>
                ))}
              {!slips.some((s) => s.jewellerApprovedAt || s.karigarApprovedAt) && (
                <p className="text-ink-soft">No approvals recorded yet.</p>
              )}
            </div>
          </div>
          <div className="border-[2px] border-ink-soft/50 bg-white px-4 py-3 sketch-c">
            <p className="font-sketch text-lg font-bold">How to read this</p>
            <p className="mt-1 text-sm text-ink-soft">
              Agreed wastage is the percentage saved on the issue slip. Actual wastage is
              worked out on return from piece + scrap. The difference is in percentage
              points; positive means more metal was used than agreed.
            </p>
          </div>
        </section>

        <p className="mt-6 border-t-2 border-dashed border-ink-soft/40 pt-2 text-sm text-ink-soft">
          Prepared from the shared record both sides see. Tola never moves money; UPI
          receipts are confirmed by the karigar&apos;s OTP. Nothing changes without both
          taps.
        </p>
      </div>
    </main>
  );
}
