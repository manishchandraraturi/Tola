import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger, makingCharges } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Approvals: both must tap. When both have tapped, the slip settles and the
// UPI payout goes out on the clock.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const side = String(body.side ?? "");

  const slip = await db.slip.findUnique({ where: { id }, include: { karigar: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  if (slip.status !== "RETURNED")
    return NextResponse.json({ error: `Slip is ${slip.status}; approvals happen after return.` }, { status: 400 });
  if (slip.disputed)
    return NextResponse.json(
      { error: "This slip has an open dispute — approvals stay blocked until both sides resolve it." },
      { status: 409 }
    );
  if (side !== "jeweller" && side !== "karigar")
    return NextResponse.json({ error: "side must be 'jeweller' or 'karigar'." }, { status: 400 });

  const data = side === "jeweller" ? { jewellerApproved: true } : { karigarApproved: true };
  const bothNow =
    (side === "jeweller" ? true : slip.jewellerApproved) &&
    (side === "karigar" ? true : slip.karigarApproved);

  const updated = await db.slip.update({
    where: { id },
    data: bothNow
      ? { ...data, status: "SETTLED", paidAt: new Date() }
      : data,
  });

  await appendLedger(
    "APPROVE",
    `${side === "jeweller" ? "Jeweller" : slip.karigar.name} approved slip #${slip.number}.`,
    slip.id
  );

  if (bothNow) {
    const amount = updated.makingCharges ?? makingCharges(updated.weightGrams);
    await db.payment.create({
      data: { slipId: slip.id, amount, method: "UPI", status: "PAID" },
    });
    await appendLedger(
      "SETTLE",
      `Slip #${slip.number} settled — both approved. Rs ${amount.toLocaleString("en-IN")} making charges paid by UPI to ${slip.karigar.name}.`,
      slip.id
    );
  }

  return NextResponse.json({ slip: updated, settled: bothNow });
}
