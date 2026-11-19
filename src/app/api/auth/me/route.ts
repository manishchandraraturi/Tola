import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  let actor: { role: "jeweller" | "karigar"; karigarId?: string; name: string } | null = null;

  if (raw) {
    const payload = verifySession(raw);
    if (payload && payload.role === "jeweller") {
      actor = { role: "jeweller", karigarId: undefined, name: "Sri Lakshmi Jewellers" };
    } else if (payload && payload.role === "karigar" && payload.karigarId) {
      const k = await db.karigar.findUnique({ where: { id: payload.karigarId } });
      if (k) {
        actor = { role: "karigar", karigarId: k.id, name: k.name };
      }
    }
  }

  const karigars = await db.karigar.findMany({
    select: { id: true, name: true, speciality: true, city: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ actor, karigars });
}