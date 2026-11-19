import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordUpiPayment } from "@/lib/tola";

export const dynamic = "force-dynamic";

// The jeweller has paid in their own UPI app and records the 12-digit reference.
// This does not move money — it records what the app did and moves the payment
// to PENDING_CONFIRMATION until the karigar confirms receipt.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const result = await recordUpiPayment(db, {
    paymentId: id,
    upiRef: String(body.upiRef ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ payment: result.payment });
}
