import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger } from "@/lib/tola";

export const dynamic = "force-dynamic";

// The karigar confirms the slip on his phone. Nothing changes without both taps.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const slip = await db.slip.findUnique({ where: { id }, include: { karigar: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  if (slip.status !== "ISSUED")
    return NextResponse.json({ error: `Slip is already ${slip.status}.` }, { status: 400 });

  const updated = await db.slip.update({
    where: { id },
    data: { status: "WORKING" },
  });

  await appendLedger(
    "TAP",
    `Both taps done: ${slip.karigar.name} confirmed slip #${slip.number} on his phone. Gold ${slip.weightGrams.toFixed(2)} g now shows in his account.`,
    slip.id
  );

  return NextResponse.json({ slip: updated });
}
