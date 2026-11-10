import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger, makingCharges } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Settler: builds both statements, starts the payment clock, sends the UPI link,
// waits for both approvals.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const slipId = String(body.slipId ?? "");
  const slip = await db.slip.findUnique({ where: { id: slipId }, include: { karigar: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  if (slip.status !== "RETURNED")
    return NextResponse.json({ error: "Settler works on slips that are back and weighed." }, { status: 400 });
  if (slip.disputed)
    return NextResponse.json(
      { error: `Slip #${slip.number} has an open dispute — the Settler waits until it is resolved.` },
      { status: 409 }
    );

  const amount = slip.makingCharges ?? makingCharges(slip.weightGrams);
  const wastage = slip.wastageActualPct ?? 0;
  const startedAt = new Date();

  const statement = {
    karigarName: slip.karigar.name,
    slipNumber: slip.number,
    lines: [
      `Gold issued: ${slip.weightGrams.toFixed(2)} g, ${slip.purity}`,
      `Finished piece returned: ${(slip.pieceWeightGrams ?? 0).toFixed(2)} g`,
      `Scrap recovered: ${(slip.scrapWeightGrams ?? 0).toFixed(2)} g`,
      `Wastage: ${wastage}% (agreed ${slip.wastageAgreedPct}%)`,
      `Making charges payable: Rs ${amount.toLocaleString("en-IN")}`,
      `Paid on approval of both sides, by UPI.`,
    ],
    upiLink: `upi://pay?pa=${slip.karigar.phone.replace(/\s/g, "")}@upi&am=${amount}&cu=INR&tn=Tola slip ${slip.number}`,
    clockStartedAt: startedAt.toISOString(),
    waitingFor: [
      ...(slip.jewellerApproved ? [] : ["jeweller"]),
      ...(slip.karigarApproved ? [] : ["karigar"]),
    ],
  };

  await appendLedger(
    "CLOCK",
    `Settler started the payment clock on slip #${slip.number}. Statement sent to both phones. UPI link for Rs ${amount.toLocaleString("en-IN")} is ready, waiting for both approvals.`,
    slip.id
  );

  return NextResponse.json({ statement });
}
