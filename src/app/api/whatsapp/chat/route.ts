import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { handleWhatsappChat } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// DEMO WhatsApp inbox. A signed-in karigar can only ever act as themselves;
// the jeweller's demo panel names the karigar it is viewing.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const actor = await getActor(req);
  const karigarId =
    actor?.role === "karigar" ? actor.karigarId : (body.karigarId as string | undefined);

  if (!karigarId) {
    return NextResponse.json(
      { ok: false, error: "Pick a karigar first.", command: "help", reply: "Pick a karigar first." },
      { status: 400 }
    );
  }

  const karigar = await db.karigar.findUnique({ where: { id: karigarId }, select: { id: true } });
  if (!karigar) {
    return NextResponse.json(
      { ok: false, error: "Unknown karigar.", command: "help", reply: "Unknown karigar." },
      { status: 404 }
    );
  }

  const reply = await handleWhatsappChat(db, {
    karigarId,
    text: typeof body.text === "string" ? body.text : "",
  });

  return NextResponse.json(reply, { status: reply.ok ? 200 : 400 });
}
