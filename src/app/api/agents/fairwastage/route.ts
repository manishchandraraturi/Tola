import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureBenchmarks, fairVerdict, pairBand } from "@/lib/tola";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// Fair-wastage v2: compares each job with that pair's settled history AND a
// trade-wide range. Flags light and heavy wastage in plain words. Never accuses.
export async function GET() {
  await ensureBenchmarks(db);

  const karigars = await db.karigar.findMany({ include: { slips: true } });
  const benchmarks = await db.wastageBenchmark.findMany({ orderBy: { keyword: "asc" } });

  const bands = karigars.map((k) => {
    const settled = k.slips.filter(
      (s) => s.status === "SETTLED" && s.wastageActualPct !== null
    );
    const vals = settled.map((s) => s.wastageActualPct as number);
    const returned = k.slips.filter(
      (s) => s.status === "RETURNED" && s.wastageActualPct !== null
    );

    const actualAvg = avg(vals);
    const agreedAvg = avg(returned.map((s) => s.wastageAgreedPct));

    return {
      karigarId: k.id,
      name: k.name,
      jobs: vals.length,
      band: vals.length
        ? { min: Math.min(...vals), max: Math.max(...vals), avg: actualAvg as number }
        : null,
      pairBand: vals.length ? pairBand(vals) : null,
      agreedAvg,
      actualAvg,
      flags: returned.map((s) => {
        const verdict = fairVerdict({
          job: s.job,
          agreed: s.wastageAgreedPct,
          actual: s.wastageActualPct as number,
          history: vals,
          benchmarks,
        });
        return {
          slipNumber: s.number,
          level: verdict.level,
          text: verdict.text,
          evidence: verdict.evidence,
        };
      }),
    };
  });

  const totalFlags = bands.reduce((a, b) => a + b.flags.length, 0);
  return NextResponse.json({
    trade: benchmarks.map((b) => ({
      keyword: b.keyword,
      minPct: b.minPct,
      maxPct: b.maxPct,
      avgPct: b.avgPct,
      source: b.source,
    })),
    bands,
    summary:
      totalFlags > 0
        ? `${totalFlags} job${totalFlags === 1 ? "" : "s"} worth a plain-words look. No accusations, just numbers both sides can see.`
        : "Nothing odd in any pair's history right now.",
  });
}
