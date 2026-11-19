import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger, makingCharges, paymentDueAt, buildUpiLink } from "@/lib/tola";

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
  if (side === "karigar" && slip.wastageProposalStatus === "PENDING")
    return NextResponse.json(
      {
        error:
          "A wastage counter-proposal is waiting for the jeweller. Approval is blocked until it is accepted or declined.",
      },
      { status: 409 }
    );

  const now = new Date();
  const data =
    side === "jeweller"
      ? { jewellerApproved: true, jewellerApprovedAt: now }
      : { karigarApproved: true, karigarApprovedAt: now };
  const bothNow =
    (side === "jeweller" ? true : slip.jewellerApproved) &&
    (side === "karigar" ? true : slip.karigarApproved);
  const dueAt = bothNow ? paymentDueAt(now) : null;

  const updated = await db.slip.update({
    where: { id },
    data: bothNow
      ? { ...data, status: "SETTLED", settledAt: now, payDueAt: dueAt }
      : data,
  });

  await appendLedger(
    {
      kind: "APPROVE",
      text: `${side === "jeweller" ? "Jeweller" : slip.karigar.name} approved slip #${slip.number}.`,
      actor: side === "jeweller" ? "jeweller" : `karigar:${slip.karigarId}`,
      slipId: slip.id,
    },
    db
  );

  let upiLink: string | null = null;
  if (bothNow) {
    const amount = updated.makingCharges ?? makingCharges(updated.weightGrams);
    const payeeVpa = slip.karigar.upiId ?? `${slip.karigar.phone.replace(/\D/g, "")}@upi`;
    upiLink = buildUpiLink({
      payeeVpa,
      payeeName: slip.karigar.name,
      amount,
      note: `Tola Slip ${slip.number}`,
    });
    // Payment starts PENDING with a 24h clock; it is only PAID after the
    // karigar confirms receipt with an OTP.
    await db.payment.upsert({
      where: { slipId: slip.id },
      update: { amount, method: "UPI", status: "PENDING", upiRef: null, paidConfirmedAt: null },
      create: { slipId: slip.id, amount, method: "UPI", status: "PENDING" },
    });
    await appendLedger(
      {
        kind: "SETTLE",
        text: `Slip #${slip.number} settled — both approved. Payment clock started: Rs ${amount.toLocaleString("en-IN")} due by ${dueAt!.toLocaleString("en-IN")}. UPI link is ready for ${slip.karigar.name}.`,
        actor: "jeweller",
        slipId: slip.id,
      },
      db
    );
  }

  return NextResponse.json({ slip: updated, settled: bothNow, payDueAt: dueAt, upiLink });
}
