import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { onTimeDelivery } from "@/lib/tola";
import { SketchBox, Takeaway, Kicker } from "@/components/tola/sketch";

export const dynamic = "force-dynamic";

const day = (value: Date | string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Public page — no login. It is deliberately a proof-of-work passport, not a
// statement: it never shows a phone number, the jeweller's name, gold weights,
// making charges, payments or any rupee amount.
export default async function PassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length > 128) notFound();

  const karigar = await db.karigar.findUnique({
    where: { id: token },
    select: {
      name: true,
      speciality: true,
      city: true,
      slips: {
        where: { status: "SETTLED" },
        orderBy: { number: "desc" },
        select: {
          id: true,
          number: true,
          job: true,
          dueDate: true,
          returnedAt: true,
          settledAt: true,
          wastageActualPct: true,
          wastageAgreedPct: true,
        },
      },
    },
  });
  if (!karigar) notFound();

  const settled = karigar.slips;
  const withWastage = settled.filter((s) => s.wastageActualPct !== null);
  const avgWastage = withWastage.length
    ? round2(
        withWastage.reduce((a, s) => a + (s.wastageActualPct ?? 0), 0) /
          withWastage.length
      )
    : 0;
  const onTime = onTimeDelivery(
    settled.map((s) => ({
      dueDate: s.dueDate,
      returnedAt: s.returnedAt,
      settledAt: s.settledAt,
    }))
  );

  return (
    <main className="paper-bg min-h-screen px-5 py-10 font-hand text-ink">
      <div className="mx-auto max-w-2xl">
        <header className="border-b-[2.5px] border-ink pb-3">
          <p className="font-sketch text-3xl font-bold">Tola</p>
          <p className="text-ink-soft">Karigar Passport · proof of delivered work</p>
          <h1 className="mt-2 font-sketch text-2xl font-bold">{karigar.name}</h1>
          <p className="text-sm text-ink-soft">
            {karigar.speciality} · {karigar.city}
          </p>
        </header>

        <div className="mt-5">
          <Takeaway>
            A clean record of delivered work — trust that travels with him.
          </Takeaway>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <SketchBox tone="green" variant="a" className="px-4 py-4 text-center">
            <p className="font-sketch text-3xl font-bold">{settled.length}</p>
            <p className="text-sm">Jobs delivered</p>
          </SketchBox>
          <SketchBox tone="blue" variant="b" className="px-4 py-4 text-center">
            <p className="font-sketch text-3xl font-bold">{onTime.pct}%</p>
            <p className="text-sm">On-time</p>
          </SketchBox>
          <SketchBox tone="yellow" variant="c" className="px-4 py-4 text-center">
            <p className="font-sketch text-3xl font-bold">{avgWastage}%</p>
            <p className="text-sm">Average wastage</p>
          </SketchBox>
        </div>

        <SketchBox tone="white" variant="b" className="mt-5 px-5 py-4">
          <p className="font-sketch text-lg font-bold">Delivered jobs</p>
          {settled.length === 0 ? (
            <p className="mt-1 text-ink-soft">No delivered jobs on record yet.</p>
          ) : (
            <div className="mt-2 divide-y divide-dashed divide-ink-soft/40">
              {settled.map((slip) => (
                <div
                  key={slip.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                >
                  <span className="font-sketch font-bold">#{slip.number}</span>
                  <span className="text-sm">{slip.job}</span>
                  <span className="text-sm text-ink-soft">
                    wastage {round2(slip.wastageActualPct ?? 0)}% (agreed{" "}
                    {round2(slip.wastageAgreedPct)}%)
                  </span>
                  <span className="ml-auto text-xs text-ink-soft">
                    {day(slip.returnedAt ?? slip.settledAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SketchBox>

        <p className="mt-5 border-t-2 border-dashed border-ink-soft/40 pt-3 text-sm text-ink-soft">
          Shared with his consent. This page shows only delivered-work proof:
          counts, timing and wastage. It never shows his phone number, the
          jeweller&apos;s name, gold weights, charges or payments. Keep the link
          private — it stops working if he withdraws it.
        </p>
        <Kicker className="mt-4">Tola · his record, his proof</Kicker>
      </div>
    </main>
  );
}
