import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  seedIfEmpty,
  ensureBenchmarks,
  watcherAlerts,
  disputeMetrics,
  disputeTrend,
  onTimeDelivery,
  approvalToPaid,
  buildUpiLink,
  newPublicToken,
  MAKING_CHARGE_PER_GRAM,
  KARIGAR_PLAN_CAP,
  PROPOSED_PLAN_RUPEES,
} from "@/lib/tola";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Every state read is authenticated; a karigar only ever sees their own work.
  const actor = await getActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await seedIfEmpty();
  // Demo trade benchmarks are editable rows; make sure they exist.
  await ensureBenchmarks();

  const karigarsAll = await db.karigar.findMany({ orderBy: { createdAt: "asc" } });
  const slipsAll = await db.slip.findMany({
    orderBy: { number: "desc" },
    include: {
      karigar: true,
      payment: true,
      photos: { orderBy: { createdAt: "desc" } },
    },
  });
  const isKarigar = actor.role === "karigar";
  const karigars = isKarigar
    ? karigarsAll.filter((k) => k.id === actor.karigarId)
    : karigarsAll;
  const slips = isKarigar
    ? slipsAll.filter((s) => s.karigarId === actor.karigarId)
    : slipsAll;

  // Slips created before P8 have no customer link yet; backfill one so every
  // slip in the demo can be shared.
  for (const s of slips) {
    if (!s.publicToken) {
      const publicToken = newPublicToken();
      await db.slip.update({ where: { id: s.id }, data: { publicToken } });
      s.publicToken = publicToken;
    }
  }

  const ledgerAll = await db.ledgerEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: { slip: { select: { number: true } } },
  });
  const visibleSlipIds = new Set(slips.map((s) => s.id));
  // A karigar's ledger view is limited to entries attached to their own slips.
  const ledger = isKarigar
    ? ledgerAll.filter((e) => e.slipId !== null && visibleSlipIds.has(e.slipId))
    : ledgerAll;

  // Recent outbound messages (watcher reminders, OTPs) for the Message Log.
  const notifications = await db.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
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

  const settled = slips.filter((s) => s.status === "SETTLED");
  // Payment days are measured from the latest approval to the confirmed receipt
  // (or paidAt for legacy rows). "Paid on the clock" is approval → money received.
  const paidSlips = settled.filter((s) =>
    s.payment ? s.payment.status === "PAID" : !!s.paidAt
  );
  // P13 uses the same corrected clock: latest approval → confirmed receipt.
  const payMetric = approvalToPaid(slips);
  const avgPayDays = payMetric.avgDays;
  const paidTotal = paidSlips.reduce(
    (a, s) => a + (s.payment?.amount ?? s.makingCharges ?? 0),
    0
  );

  const nowMs = Date.now();
  const pendingPayments = settled.filter(
    (s) => s.payment && s.payment.status !== "PAID"
  ).length;
  const overduePayments = settled.filter(
    (s) => s.payment && s.payment.status !== "PAID" && s.payDueAt && new Date(s.payDueAt).getTime() < nowMs
  ).length;

  // Open disputes, counted from the database — settlement on these is blocked.
  const disputes = slips.filter((s) => s.disputed).length;

  // P4 dispute metrics from the structured event history: opened per month,
  // average days to resolve.
  const disputeEventsAll = await db.disputeEvent.findMany({
    select: { slipId: true, kind: true, createdAt: true },
  });
  const disputeEvents = isKarigar
    ? disputeEventsAll.filter((e) => visibleSlipIds.has(e.slipId))
    : disputeEventsAll;
  const dMetrics = disputeMetrics(disputeEvents);
  // P13 impact metrics: six month dispute trend and on-time returns.
  const trend = disputeTrend(disputeEvents);
  const delivery = onTimeDelivery(slips);

  // Fair-wastage v2: trade-wide benchmark ranges by job keyword.
  const benchmarks = await db.wastageBenchmark.findMany({ orderBy: { keyword: "asc" } });

  return NextResponse.json({
    jeweller: { name: "Sri Lakshmi Jewellers", city: "Bengaluru", rate: MAKING_CHARGE_PER_GRAM },
    plan: { cap: KARIGAR_PLAN_CAP, proposedRupees: PROPOSED_PLAN_RUPEES, label: "proposed" },
    benchmarks: benchmarks.map((b) => ({
      keyword: b.keyword,
      minPct: b.minPct,
      maxPct: b.maxPct,
      avgPct: b.avgPct,
      source: b.source,
    })),
    karigars: karigars.map((k) => ({
      ...k,
      goldBalance: Math.round((balances.get(k.id) ?? 0) * 100) / 100,
      openSlips: openByKarigar.get(k.id) ?? 0,
    })),
    slips: slips.map((s) => {
      const payeeVpa = s.karigar.upiId ?? `${s.karigar.phone.replace(/\D/g, "")}@upi`;
      const amount = s.payment?.amount ?? s.makingCharges ?? 0;
      return {
        ...s,
        karigarName: s.karigar.name,
        karigarPhone: s.karigar.phone,
        payment: s.payment
          ? {
              ...s.payment,
              upiLink: buildUpiLink({
                payeeVpa,
                payeeName: s.karigar.name,
                amount,
                note: `Tola Slip ${s.number}`,
              }),
            }
          : null,
      };
    }),
    ledger,
    notifications: isKarigar
      ? notifications.filter((n) => n.actor === actor.actorString)
      : notifications,
    stats: {
      goldOut: Math.round(goldOut * 100) / 100,
      openSlips,
      dueSoon,
      avgPayDays,
      paidTotal: Math.round(paidTotal),
      pendingPayments,
      overduePayments,
      disputes,
      disputesThisMonth: dMetrics.thisMonth,
      avgDisputeDays: dMetrics.avgDays,
      disputeHistory: dMetrics.byMonth,
      disputeTrend: trend,
      onTimeDeliveryPct: delivery.pct,
      onTimeCount: delivery.onTime,
      returnedCount: delivery.returned,
      paidSample: payMetric.paid,
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
