import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { verifyLedgerChain } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Recompute the whole hash chain from seq 1 and report the first break.
export async function GET() {
  try {
    const actor = await getActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await db.ledgerEntry.findMany({
      orderBy: { seq: "asc" },
      select: {
        seq: true,
        hash: true,
        prevHash: true,
        kind: true,
        text: true,
        slipId: true,
        actor: true,
        createdAt: true,
      },
    });

    const result = verifyLedgerChain(entries);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, checked: 0, reason: (e as Error).message },
      { status: 500 }
    );
  }
}
