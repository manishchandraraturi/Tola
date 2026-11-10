import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Fair-wastage: compares each job with that pair's history and the usual range.
// Flags odd ones in plain words. Never accuses.
export async function GET() {
  const karigars = await db.karigar.findMany({ include: { slips: true } });

  const bands = karigars.map((k) => {
    const settled = k.slips.filter(
      (s) => s.status === "SETTLED" && s.wastageActualPct !== null
    );
    const vals = settled.map((s) => s.wastageActualPct as number);
    const pending = k.slips.filter((s) => s.status === "RETURNED");
    return {
      karigarId: k.id,
      name: k.name,
      jobs: vals.length,
      band: vals.length
        ? {
            min: Math.round(Math.min(...vals) * 100) / 100,
            max: Math.round(Math.max(...vals) * 100) / 100,
            avg:
              Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
          }
        : null,
      flags: pending
        .filter((s) => s.fairFlag)
        .map((s) => ({ slipNumber: s.number, text: s.fairFlag as string })),
    };
  });

  const totalFlags = bands.reduce((a, b) => a + b.flags.length, 0);
  return NextResponse.json({
    bands,
    summary:
      totalFlags > 0
        ? `${totalFlags} job${totalFlags === 1 ? "" : "s"} worth a plain-words look. No accusations, just numbers both sides can see.`
        : "Nothing odd in any pair's history right now.",
  });
}
