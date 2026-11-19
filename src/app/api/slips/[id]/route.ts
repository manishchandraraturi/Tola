import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Save the customer details that travel with the customer status link.
// These are optional: a slip without them still works, it just has no one to
// send the link to.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const slip = await db.slip.findUnique({ where: { id }, select: { id: true } });
  if (!slip) return NextResponse.json({ error: "Slip not found." }, { status: 404 });

  const customerName = String(body.customerName ?? "").trim().slice(0, 80) || null;
  const customerPhone = String(body.customerPhone ?? "").trim().slice(0, 24) || null;

  const updated = await db.slip.update({
    where: { id },
    data: { customerName, customerPhone },
    select: { id: true, customerName: true, customerPhone: true, publicToken: true },
  });

  return NextResponse.json({ slip: updated });
}
