import { NextResponse } from "next/server";
import { reseed } from "@/lib/tola";

export const dynamic = "force-dynamic";

export async function POST() {
  await reseed();
  return NextResponse.json({ ok: true });
}
