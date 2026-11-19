import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Require authentication
  const actor = await getActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Return latest 10 NotificationLog entries scoped to this actor
  const entries = await db.notificationLog.findMany({
    where: {
      actor: actor.actorString,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ ok: true, entries });
}