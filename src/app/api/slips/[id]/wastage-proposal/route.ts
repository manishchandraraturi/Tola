import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { submitWastageProposal, respondWastageProposal } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Wastage counter-proposal (P4).
//  - propose: the karigar proposes a different wastage % on an ISSUED slip.
//  - accept / decline: the jeweller answers. Accept sets the agreed %.
// While a proposal is PENDING the karigar's confirm/approve taps are blocked.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const actor = await getActor(req);

  const action =
    String(body.action ?? "") ||
    (body.accept === true ? "accept" : body.accept === false ? "decline" : "propose");

  if (action === "propose") {
    const slip = await db.slip.findUnique({
      where: { id },
      select: { karigarId: true },
    });
    if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });

    // A signed-in karigar may only propose for himself; in demo mode the
    // caller passes the karigar id (defaults to the slip's karigar).
    const karigarId =
      actor?.role === "karigar" && actor.karigarId
        ? actor.karigarId
        : String(body.karigarId ?? slip.karigarId);

    const result = await submitWastageProposal(db, {
      slipId: id,
      karigarId,
      pct: Number(body.pct ?? body.wastageProposedPct),
      note: String(body.note ?? ""),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json({ slip: result.slip });
  }

  if (action === "accept" || action === "decline") {
    const side = String(body.side ?? "jeweller") as "jeweller" | "karigar";
    const result = await respondWastageProposal(db, {
      slipId: id,
      side,
      accept: action === "accept",
      note: String(body.note ?? ""),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json({ slip: result.slip });
  }

  return NextResponse.json(
    { error: "action must be 'propose', 'accept' or 'decline'." },
    { status: 400 }
  );
}
