import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashChain } from "@/lib/tola";

export const dynamic = "force-dynamic";

// DEMO ONLY (NEXT_PUBLIC_DEMO=1). Two buttons in the Ledger tab call this:
//  - "tamper": edit the latest entry's text straight in the database and leave
//    its stored hash alone, so "Verify chain" shows exactly where it broke.
//  - "repair": recompute prevHash and hash for every entry in seq order, so the
//    chain links up again.
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO !== "1")
    return NextResponse.json({ error: "Demo mode is off." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "tamper") {
    const latest = await db.ledgerEntry.findFirst({ orderBy: { seq: "desc" } });
    if (!latest) return NextResponse.json({ error: "There are no entries yet." }, { status: 404 });

    await db.ledgerEntry.update({
      where: { id: latest.id },
      data: { text: `${latest.text} (edited in DEMO)` },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "repair") {
    await db.$transaction(async (tx) => {
      const entries = await tx.ledgerEntry.findMany({ orderBy: { seq: "asc" } });
      let prevHash = "GENESIS";
      for (const e of entries) {
        const hash = hashChain(e.seq, prevHash, e.kind, e.actor, e.slipId ?? null, e.createdAt, e.text);
        await tx.ledgerEntry.update({ where: { id: e.id }, data: { prevHash, hash } });
        prevHash = hash;
      }
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'tamper' or 'repair'." }, { status: 400 });
}
