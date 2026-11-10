import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appendLedger, makingCharges } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Issue gold: jeweller fills the slip and taps. The karigar's tap is still pending.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const karigarId = String(body.karigarId ?? "");
  const weightGrams = Number(body.weightGrams);
  const purity = String(body.purity ?? "22K");
  const job = String(body.job ?? "").trim();
  const isWedding = Boolean(body.isWedding);
  const wastageAgreedPct = Number(body.wastageAgreedPct);
  const dueDate = new Date(body.dueDate);

  if (!karigarId || !weightGrams || weightGrams <= 0 || !job || !isFinite(wastageAgreedPct) || isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Fill every field: karigar, weight, job, due date, wastage." }, { status: 400 });
  }

  const karigar = await db.karigar.findUnique({ where: { id: karigarId } });
  if (!karigar) return NextResponse.json({ error: "Karigar not found." }, { status: 404 });

  const last = await db.slip.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const number = (last?.number ?? 210) + 1;

  const slip = await db.slip.create({
    data: {
      number,
      karigarId,
      weightGrams: Math.round(weightGrams * 100) / 100,
      purity,
      job,
      isWedding,
      dueDate,
      wastageAgreedPct: Math.round(wastageAgreedPct * 100) / 100,
      status: "ISSUED",
      makingCharges: makingCharges(weightGrams),
    },
  });

  await appendLedger(
    "ISSUE",
    `Slip #${number} issued — ${slip.weightGrams.toFixed(2)} g, ${purity}, ${job}, to ${karigar.name}. Agreed wastage ${slip.wastageAgreedPct}%. Jeweller tapped.`,
    slip.id
  );

  return NextResponse.json({ slip });
}
