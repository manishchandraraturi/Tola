import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Disputes: either side can flag a RETURNED slip. An open dispute blocks
// settlement — approvals and the Settler refuse to run — until either side
// marks it resolved. Every step writes a DISPUTE / RESOLVE ledger entry.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const side = String(body.side ?? "");
  const note = String(body.note ?? "").trim().slice(0, 300);
  const resolve = Boolean(body.resolve);

  if (side !== "jeweller" && side !== "karigar")
    return NextResponse.json({ error: "side must be 'jeweller' or 'karigar'." }, { status: 400 });

  const slip = await db.slip.findUnique({ where: { id }, include: { karigar: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });
  if (slip.status !== "RETURNED")
    return NextResponse.json(
      { error: `Disputes are flagged on RETURNED slips; this one is ${slip.status}.` },
      { status: 400 }
    );

  const who = side === "jeweller" ? "Jeweller" : slip.karigar.name;

  // ---- resolve an open dispute ----
  if (resolve) {
    if (!slip.disputed)
      return NextResponse.json({ error: "There is no open dispute on this slip." }, { status: 400 });
    const updated = await db.slip.update({
      where: { id },
      data: { disputed: false },
    });
    await appendLedger(
      "RESOLVE",
      `${who} marked the dispute on slip #${slip.number} as resolved${note ? ` — ${note}` : ""}. Settlement can go ahead.`,
      slip.id
    );
    return NextResponse.json({ slip: updated });
  }

  // ---- open a dispute ----
  if (!slip.disputed) {
    const updated = await db.slip.update({
      where: { id },
      data: {
        disputed: true,
        disputeNote: `${who}: ${note || "no note given"}`,
      },
    });
    await appendLedger(
      "DISPUTE",
      `${who} flagged a dispute on slip #${slip.number}${note ? ` — ${note}` : ""}. Settlement is blocked until it is resolved.`,
      slip.id
    );
    return NextResponse.json({ slip: updated });
  }

  // ---- dispute already open: this side adds their say ----
  const updated = await db.slip.update({
    where: { id },
    data: {
      disputeNote: `${slip.disputeNote ? `${slip.disputeNote}\n` : ""}${who}: ${note || "no note given"}`,
    },
  });
  await appendLedger(
    "DISPUTE",
    `${who} added his side to the dispute on slip #${slip.number}${note ? ` — ${note}` : ""}. Still blocked until resolved.`,
    slip.id
  );
  return NextResponse.json({ slip: updated });
}
