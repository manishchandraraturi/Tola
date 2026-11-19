import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signSession, verifyPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { role, karigarId, pin } = body;

  // Validate role
  if (role !== "jeweller" && role !== "karigar") {
    return NextResponse.json({ error: "Role must be 'jeweller' or 'karigar'." }, { status: 400 });
  }

  // Validate PIN is exactly 4 digits
  const pinStr = pin ?? "";
  if (!/^\d{4}$/.test(pinStr)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
  }

  if (role === "jeweller") {
    const account = await db.jewellerAccount.findUnique({ where: { id: "default" } });
    if (!account) return NextResponse.json({ error: "Jeweller account not seeded." }, { status: 500 });

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Too many wrong PIN attempts. Try again later." },
        { status: 429 }
      );
    }

    const valid = verifyPin(pin, account.pinHash, account.pinSalt);
    if (!valid) {
      // Count the miss; five misses lock the account for five minutes.
      const updated = await db.jewellerAccount.update({
        where: { id: "default" },
        data: { failedAttempts: { increment: 1 } },
      });
      if (updated.failedAttempts >= 5) {
        await db.jewellerAccount.update({
          where: { id: "default" },
          data: { lockedUntil: new Date(Date.now() + 5 * 60 * 1000) },
        });
      }
      return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
    }

    // Success: reset lockout and failed attempts
    await db.jewellerAccount.update({
      where: { id: "default" },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const token = signSession({ role: "jeweller" });
    const res = NextResponse.json({ ok: true, actor: { role: "jeweller", actorString: "jeweller", name: "Sri Lakshmi Jewellers" } });
    res.cookies.set("tola_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return res;
  } else {
    // role === "karigar"
    if (!karigarId || typeof karigarId !== "string") {
      return NextResponse.json({ error: "Select a karigar" }, { status: 400 });
    }

    const karigar = await db.karigar.findUnique({ where: { id: karigarId } });
    if (!karigar) return NextResponse.json({ error: "Karigar not found." }, { status: 404 });

    if (!karigar.pinHash || !karigar.pinSalt) {
      return NextResponse.json({ error: "PIN not set for this karigar." }, { status: 401 });
    }

    if (karigar.lockedUntil && karigar.lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "Too many wrong PIN attempts. Try again later." },
        { status: 429 }
      );
    }

    const valid = verifyPin(pinStr, karigar.pinHash, karigar.pinSalt);
    if (!valid) {
      // Count the miss; five misses lock the account for five minutes.
      const updated = await db.karigar.update({
        where: { id: karigarId },
        data: { failedAttempts: { increment: 1 } },
      });
      if (updated.failedAttempts >= 5) {
        await db.karigar.update({
          where: { id: karigarId },
          data: { lockedUntil: new Date(Date.now() + 5 * 60 * 1000) },
        });
      }
      return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
    }

    // Success: reset lockout and failed attempts
    await db.karigar.update({
      where: { id: karigarId },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const token = signSession({ role: "karigar", karigarId: karigar.id });
    const res = NextResponse.json({ ok: true, actor: { role: "karigar", karigarId: karigar.id, actorString: `karigar:${karigar.id}`, name: karigar.name } });
    res.cookies.set("tola_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return res;
  }
}