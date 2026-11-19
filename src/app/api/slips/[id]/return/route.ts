import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { appendLedger, computeWastage, fairVerdict, ensureBenchmarks } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Return: piece and scrap weighed, wastage worked out, fair-wastage agent speaks.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Recording a return is the jeweller's act; a karigar can never mark their
  // own piece returned.
  if (actor.role !== "jeweller") {
    return NextResponse.json(
      { error: "Only the jeweller records a return" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await req.json();
  const piece = Number(body.pieceWeightGrams);
  const scrap = Number(body.scrapWeightGrams);

  const slip = await db.slip.findUnique({ where: { id }, include: { karigar: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  if (slip.status !== "ISSUED" && slip.status !== "WORKING")
    return NextResponse.json({ error: `Slip is already ${slip.status}.` }, { status: 400 });
  if (!isFinite(piece) || piece <= 0 || !isFinite(scrap) || scrap < 0)
    return NextResponse.json({ error: "Enter the piece weight and the scrap weight." }, { status: 400 });
  if (piece + scrap > slip.weightGrams)
    return NextResponse.json({ error: "Piece + scrap cannot weigh more than the gold issued." }, { status: 400 });

  const actual = computeWastage(slip.weightGrams, piece, scrap);

  // Fair-wastage: compare with this pair's history (settled slips of this karigar).
  const history = await db.slip.findMany({
    where: { karigarId: slip.karigarId, status: "SETTLED", wastageActualPct: { not: null } },
    select: { wastageActualPct: true },
  });
  const vals = history.map((h) => h.wastageActualPct as number);
  await ensureBenchmarks(db);
  const benchmarks = await db.wastageBenchmark.findMany();
  const verdict = fairVerdict({
    job: slip.job,
    agreed: slip.wastageAgreedPct,
    actual,
    history: vals,
    benchmarks,
  });

  const updated = await db.slip.update({
    where: { id },
    data: {
      status: "RETURNED",
      pieceWeightGrams: piece,
      scrapWeightGrams: scrap,
      wastageActualPct: actual,
      fairFlag: verdict.text,
    },
  });

  await appendLedger(
    "RETURN",
    `Slip #${slip.number} returned — piece ${piece.toFixed(2)} g + scrap ${scrap.toFixed(2)} g. Wastage worked out at ${actual}%, agreed was ${slip.wastageAgreedPct}%.`,
    slip.id
  );
  await appendLedger("FLAG", `Fair-wastage on slip #${slip.number}: ${verdict.text}`, slip.id);

  return NextResponse.json({ slip: updated, verdict });
}
