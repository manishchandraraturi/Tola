import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger } from "@/lib/tola";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

// Public endpoint used by the refiner link. A valid slip token is the only
// authorisation; it can only add a scrap recovery to that one slip.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const recoveredG = Number(body?.recoveredG);

  if (!token || token.length > 128) return bad("This refiner link is not available.", 404);
  if (!Number.isFinite(recoveredG) || recoveredG <= 0 || recoveredG > 1000) {
    return bad("Enter the recovered gold in grams (more than 0).");
  }

  const slip = await db.slip.findUnique({
    where: { publicToken: token },
    select: { id: true, number: true, publicTokenRevokedAt: true },
  });
  if (!slip || slip.publicTokenRevokedAt) {
    return bad("This refiner link is not available.", 404);
  }

  const grams = Math.round(recoveredG * 100) / 100;
  const lot = await db.scrapLot.create({
    data: { slipId: slip.id, recoveredG: grams, refinerProof: "refiner-link" },
  });

  await appendLedger({
    kind: "REFINER_RECOVERY",
    text: `Recovered ${grams} grams from scrap`,
    slipId: slip.id,
    actor: "refiner",
  });

  return NextResponse.json(
    { ok: true, lot: { id: lot.id, recoveredG: lot.recoveredG } },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
