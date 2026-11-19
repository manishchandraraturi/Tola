import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { addKarigar, KARIGAR_PLAN_CAP, PROPOSED_PLAN_RUPEES } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Karigar management (P4). The plan cap and price are the *proposed* numbers
// from Slide 11 and are labelled as proposed wherever they appear.
export async function GET() {
  const count = await db.karigar.count();
  return NextResponse.json({
    count,
    cap: KARIGAR_PLAN_CAP,
    proposedPlan: PROPOSED_PLAN_RUPEES,
  });
}

export async function POST(req: NextRequest) {
  const actor = await getActor(req);
  // Jeweller-only. With no session (demo mode) we allow the action so the
  // prototype stays usable; a signed-in karigar is always refused.
  if (actor && actor.role !== "jeweller") {
    return NextResponse.json({ error: "Only the jeweller can add a karigar." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await addKarigar(db, {
    name: String(body.name ?? ""),
    phone: String(body.phone ?? ""),
    speciality: String(body.speciality ?? ""),
    city: String(body.city ?? ""),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, count: result.count, cap: result.cap },
      { status: result.status }
    );
  }
  return NextResponse.json({ karigar: result.karigar, count: result.count, cap: result.cap });
}
