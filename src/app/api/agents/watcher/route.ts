import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watcherAlerts } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Watcher: tracks every due date, puts wedding orders first, warns early.
export async function GET() {
  const slips = await db.slip.findMany({
    include: { karigar: true },
    orderBy: { dueDate: "asc" },
  });
  const alerts = watcherAlerts(
    slips.map((s) => ({
      number: s.number,
      job: s.job,
      isWedding: s.isWedding,
      dueDate: s.dueDate,
      status: s.status,
      karigarName: s.karigar.name,
    }))
  );
  return NextResponse.json({
    alerts,
    summary: alerts.length
      ? `${alerts.length} thing${alerts.length === 1 ? "" : "s"} need attention. Wedding orders come first.`
      : "All quiet. Nothing due this week.",
  });
}
