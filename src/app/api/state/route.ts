import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedIfEmpty, watcherAlerts, MAKING_CHARGE_PER_GRAM } from "@/lib/tola";

export const dynamic = "force-dynamic";

export async function GET() {
  await seedIfEmpty();

  const karigars = await db.karigar.findMany({ orderBy: { createdAt: "asc" } });
  const slips = await db.slip.findMany({
    orderBy: { number: "desc" },
    include: { karigar: true, payment: true },
  });
  const ledger = await db.ledgerEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { slip: { select: { number: true } } },
  });

  // Live gold balance with each karigar: gold on slips not yet returned.
  const balances = new Map<string, number>();
  const openByKarigar = new Map<string, number>();
  for (const s of slips) {
    if (s.status === "ISSUED" || s.status === "WORKING") {
      balances.set(s.karigarId, (balances.get(s.karigarId) ?? 0) + s.weightGrams);
    }
    if (s.status !== "SETTLED") {
      openByKarigar.set(s.karigarId, (openByKarigar.get(s.karigarId) ?? 0) + 1);
    }
  }

  const goldOut = [...balances.values()].reduce((a, b) => a + b, 0);
  const openSlips = slips.filter((s) => s.status !== "SETTLED").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueSoon = slips.filter((s) => {
    if (s.status === "SETTLED") return false;
    const due = new Date(s.dueDate);
    due.setHours(0, 0, 0, 0);
    const days = (due.getTime() - today.getTime()) / 86400000;
    return days <= 7;
  }).length;

  const settled = slips.filter((s) => s.status === "SETTLED" && s.paidAt);
  const payDays = settled.map((s) =>
    Math.max(
      0,
      (new Date(s.paidAt as Date).getTime() - new Date(s.createdAt).getTime()) / 86400000
    )
  );
  const avgPayDays = payDays.length
    ? Math.round((payDays.reduce((a, b) => a + b, 0) / payDays.length) * 10) / 10
    : 0;
  const paidTotal = settled.reduce((a, s) => a + (s.makingCharges ?? 0), 0);

  return NextResponse.json({
    jeweller: { name: "Sri Lakshmi Jewellers", city: "Bengaluru", rate: MAKING_CHARGE_PER_GRAM },
    karigars: karigars.map((k) => ({
      ...k,
      goldBalance: Math.round((balances.get(k.id) ?? 0) * 100) / 100,
      openSlips: openByKarigar.get(k.id) ?? 0,
    })),
    slips: slips.map((s) => ({
      ...s,
      karigarName: s.karigar.name,
      karigarPhone: s.karigar.phone,
    })),
    ledger,
    stats: {
      goldOut: Math.round(goldOut * 100) / 100,
      openSlips,
      dueSoon,
      avgPayDays,
      paidTotal: Math.round(paidTotal),
      disputes: 0,
      settledCount: settled.length,
    },
    alerts: watcherAlerts(
      slips.map((s) => ({
        number: s.number,
        job: s.job,
        isWedding: s.isWedding,
        dueDate: s.dueDate,
        status: s.status,
        karigarName: s.karigar.name,
      }))
    ),
  });
}
