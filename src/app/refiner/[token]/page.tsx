import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SketchBox, Kicker } from "@/components/tola/sketch";
import { RefinerForm } from "./refiner-form";

export const dynamic = "force-dynamic";

// Public page — no login. The token is the whole authorisation: it belongs to
// one slip, and it only lets the refiner log recovered scrap against that slip.
export default async function RefinerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length > 128) notFound();

  const slip = await db.slip.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      number: true,
      job: true,
      publicTokenRevokedAt: true,
    },
  });
  if (!slip || slip.publicTokenRevokedAt) notFound();

  const lots = await db.scrapLot.findMany({
    where: { slipId: slip.id },
    orderBy: { refinedAt: "desc" },
    select: { id: true, recoveredG: true, refinedAt: true },
  });

  return (
    <main className="paper-bg min-h-screen px-5 py-10 font-hand text-ink">
      <div className="mx-auto max-w-xl">
        <header className="border-b-[2.5px] border-ink pb-3">
          <p className="font-sketch text-3xl font-bold">Tola</p>
          <p className="text-ink-soft">Refiner link · no login needed</p>
          <h1 className="mt-2 font-sketch text-xl font-bold">
            Log recovered gold for Slip #{slip.number}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{slip.job}</p>
        </header>

        <SketchBox tone="white" variant="b" className="mt-5 px-5 py-5">
          <RefinerForm token={token} slipNumber={slip.number} />
        </SketchBox>

        <SketchBox tone="paper" variant="a" className="mt-5 px-5 py-4">
          <p className="font-sketch text-lg font-bold">Already logged on this link</p>
          {lots.length === 0 ? (
            <p className="mt-1 text-ink-soft">Nothing logged yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {lots.map((lot) => (
                <li
                  key={lot.id}
                  className="flex flex-wrap items-center gap-x-3 border-[2px] border-ink-soft/40 bg-white px-3 py-1.5 sketch-c"
                >
                  <span className="font-sketch font-bold">
                    {Math.round(lot.recoveredG * 100) / 100} g
                  </span>
                  <span className="text-sm text-ink-soft">
                    {new Date(lot.refinedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SketchBox>

        <p className="mt-5 border-t-2 border-dashed border-ink-soft/40 pt-3 text-sm text-ink-soft">
          Each recovery is written into the same hash-linked ledger the jeweller and
          the karigar use. Keep this link private — it stops working when the jeweller
          revokes it.
        </p>
        <Kicker className="mt-4">Tola · scrap recovered, accounted for</Kicker>
      </div>
    </main>
  );
}
