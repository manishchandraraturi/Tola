import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  const { id } = await params;

  // Allow jeweller or the slip's own karigar
  const slip = await db.slip.findUnique({ where: { id }, include: { karigar: true, payment: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });

  if (actor.role === "jeweller") {
    // jeweller sees everything
  } else if (actor.role === "karigar") {
    if (slip.karigarId !== actor.karigarId) {
      return NextResponse.json({ error: "This slip belongs to another karigar." }, { status: 403 });
    }
  }

  const entries = await db.ledgerEntry.findMany({
    where: { slipId: id },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      kind: true,
      text: true,
      actor: true,
      proof: true,
      hash: true,
      prevHash: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      slip: {
        number: slip.number,
        job: slip.job,
        weightGrams: slip.weightGrams,
        purity: slip.purity,
        isWedding: slip.isWedding,
        dueDate: slip.dueDate,
        wastageAgreedPct: slip.wastageAgreedPct,
        status: slip.status,
        pieceWeightGrams: slip.pieceWeightGrams,
        scrapWeightGrams: slip.scrapWeightGrams,
        wastageActualPct: slip.wastageActualPct,
        makingCharges: slip.makingCharges,
        karigar: { name: slip.karigar.name, phone: slip.karigar.phone },
        createdAt: slip.createdAt,
        returnedAt: slip.returnedAt,
        jewellerApproved: slip.jewellerApproved,
        jewellerApprovedAt: slip.jewellerApprovedAt,
        karigarApproved: slip.karigarApproved,
        karigarApprovedAt: slip.karigarApprovedAt,
        paidAt: slip.paidAt,
        payDueAt: slip.payDueAt,
        settledAt: slip.settledAt,
        payment: slip.payment
          ? {
              amount: slip.payment.amount,
              method: slip.payment.method,
              status: slip.payment.status,
              upiRef: slip.payment.upiRef,
              paidConfirmedAt: slip.payment.paidConfirmedAt,
              createdAt: slip.payment.createdAt,
            }
          : null,
      },
      generatedAt: new Date().toISOString(),
      finalHash: entries.length ? entries[entries.length - 1].hash : "GENESIS",
      entries,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
