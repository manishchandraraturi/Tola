import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requestPaymentOtp, confirmPaymentWithOtp } from "@/lib/tola";

export const dynamic = "force-dynamic";

// The karigar confirms receipt of the UPI payment.
//  - action "request" (or no code): create a "confirm-payment" OTP challenge.
//  - action "verify" with challengeId + code: consume the OTP and mark the
//    payment PAID, setting paidConfirmedAt and appending a proof-carrying entry.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();

  if (code) {
    const result = await confirmPaymentWithOtp(db, {
      paymentId: id,
      challengeId: String(body.challengeId ?? ""),
      code,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json({ payment: result.payment, paid: true });
  }

  const result = await requestPaymentOtp(db, { paymentId: id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({
    challengeId: result.challengeId,
    expiresAt: result.expiresAt,
    demoCode: result.demoCode,
  });
}
