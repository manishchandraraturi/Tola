// P2: Identity & Privacy — real route + database tests.
// A throwaway SQLite database is pushed with `prisma db push` and swapped in
// for @/lib/db, so the actual route handlers run end to end.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const tmp = process.env.TEMP ?? process.env.TMP ?? "/tmp";
  const file = `${tmp}/tola-auth-privacy-${process.pid}-${Date.now()}.db`.replace(/\\/g, "/");
  return { url: `file:${file}` };
});

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: hoisted.url } } });
  return { db };
});

import { db } from "@/lib/db";
import { reseed } from "@/lib/tola";
import { getActor, hashPin, signSession, verifySession } from "@/lib/auth";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as stateRoute } from "@/app/api/state/route";
import { POST as returnRoute } from "@/app/api/slips/[id]/return/route";

const dbFile = hoisted.url.replace(/^file:/, "");
let raviId = "";
let sureshId = "";
let raviSlipId = "";
let sureshSlipId = "";

function get(url: string, cookie?: string) {
  return new NextRequest(url, { headers: cookie ? { cookie } : {} });
}

function post(url: string, body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function cookieFor(token: string) {
  return `tola_session=${token}`;
}

interface StateBody {
  karigars: Array<{ id: string }>;
  slips: Array<{ id: string; karigarId: string; status: string; weightGrams: number }>;
  ledger: Array<{ slipId: string | null }>;
  stats: { goldOut: number };
}

beforeAll(async () => {
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: hoisted.url }, stdio: "pipe" }
  );

  // The normal seed story: Ravi, Suresh, Meena, their slips and the ledger.
  await reseed(db);

  // reseed() seeds the demo jeweller account; reset it to a known PIN.
  const jewellerPin = hashPin("1234");
  await db.jewellerAccount.upsert({
    where: { id: "default" },
    update: { pinHash: jewellerPin.pinHash, pinSalt: jewellerPin.pinSalt, failedAttempts: 0, lockedUntil: null },
    create: { id: "default", pinHash: jewellerPin.pinHash, pinSalt: jewellerPin.pinSalt },
  });

  const ravi = await db.karigar.findFirstOrThrow({ where: { name: "Ravi Kumar" } });
  const suresh = await db.karigar.findFirstOrThrow({ where: { name: "Suresh Patel" } });
  raviId = ravi.id;
  sureshId = suresh.id;

  const raviPin = hashPin("1111");
  await db.karigar.update({
    where: { id: ravi.id },
    data: { pinHash: raviPin.pinHash, pinSalt: raviPin.pinSalt },
  });

  const raviSlip = await db.slip.create({
    data: {
      number: 901,
      karigarId: ravi.id,
      weightGrams: 10,
      purity: "22K",
      job: "Test job (Ravi)",
      dueDate: new Date(Date.now() + 7 * 86400000),
      wastageAgreedPct: 3,
      status: "WORKING",
    },
  });
  const sureshSlip = await db.slip.create({
    data: {
      number: 902,
      karigarId: suresh.id,
      weightGrams: 12,
      purity: "22K",
      job: "Test job (Suresh)",
      dueDate: new Date(Date.now() + 7 * 86400000),
      wastageAgreedPct: 3,
      status: "WORKING",
    },
  });
  raviSlipId = raviSlip.id;
  sureshSlipId = sureshSlip.id;

  // One ledger entry each, so the privacy assertion has foreign rows to exclude.
  const max = (await db.ledgerEntry.aggregate({ _max: { seq: true } }))._max.seq ?? 0;
  await db.ledgerEntry.create({
    data: {
      seq: max + 1,
      kind: "NOTE",
      text: "Ravi only",
      hash: "h-ravi",
      prevHash: "h-prev",
      actor: "jeweller",
      slipId: raviSlip.id,
    },
  });
  await db.ledgerEntry.create({
    data: {
      seq: max + 2,
      kind: "NOTE",
      text: "Suresh only",
      hash: "h-suresh",
      prevHash: "h-ravi",
      actor: "jeweller",
      slipId: sureshSlip.id,
    },
  });
}, 120_000);

afterAll(async () => {
  await db.$disconnect();
  if (fs.existsSync(dbFile)) fs.rmSync(dbFile, { force: true });
});

describe("P2 session signing", () => {
  it("signSession round-trips and verifySession rejects a tampered token", () => {
    const token = signSession({ role: "karigar", karigarId: "abc" });
    expect(token.split(".")).toHaveLength(2);
    expect(verifySession(token)).toEqual({ role: "karigar", karigarId: "abc" });
    expect(verifySession(`${token}x`)).toBeNull();
    expect(verifySession("not-a-token")).toBeNull();
  });
});

describe("P2 login & lockout", () => {
  it("logs the jeweller in and getActor reads the session cookie", async () => {
    const res = await loginRoute(
      post("http://localhost/api/auth/login", { role: "jeweller", pin: "1234" })
    );
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie") ?? "";
    const token = setCookie.match(/tola_session=([^;]+)/)?.[1] ?? "";
    expect(token).not.toBe("");

    const actor = await getActor(get("http://localhost/api/state", cookieFor(token)));
    expect(actor?.role).toBe("jeweller");
    expect(actor?.actorString).toBe("jeweller");
  });

  it("locks out after 5 wrong PINs and the 6th correct attempt gets 429", async () => {
    await db.jewellerAccount.update({
      where: { id: "default" },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    for (let i = 0; i < 5; i++) {
      const res = await loginRoute(
        post("http://localhost/api/auth/login", { role: "jeweller", pin: "9999" })
      );
      expect(res.status).toBe(401);
    }

    const locked = await loginRoute(
      post("http://localhost/api/auth/login", { role: "jeweller", pin: "1234" })
    );
    expect(locked.status).toBe(429);
    const body = (await locked.json()) as { error?: string };
    expect(body.error).toMatch(/too many wrong pin/i);

    const account = await db.jewellerAccount.findUniqueOrThrow({ where: { id: "default" } });
    expect(account.failedAttempts).toBe(5);
    expect(account.lockedUntil).not.toBeNull();
  });
});

describe("P2 state privacy", () => {
  it("returns 401 when the request carries no session cookie", async () => {
    const res = await stateRoute(get("http://localhost/api/state"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns only the karigar's own profile, slips, ledger and stats", async () => {
    const token = signSession({ role: "karigar", karigarId: raviId });
    const res = await stateRoute(get("http://localhost/api/state", cookieFor(token)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as StateBody;

    // Own profile only.
    expect(body.karigars).toHaveLength(1);
    expect(body.karigars[0].id).toBe(raviId);

    // Own slips only.
    expect(body.slips.length).toBeGreaterThan(0);
    expect(body.slips.every((s) => s.karigarId === raviId)).toBe(true);
    expect(body.slips.some((s) => s.karigarId === sureshId)).toBe(false);

    // Ledger entries only for those slips.
    const ownSlipIds = new Set(body.slips.map((s) => s.id));
    expect(body.ledger.length).toBeGreaterThan(0);
    expect(body.ledger.every((e) => e.slipId !== null && ownSlipIds.has(e.slipId))).toBe(true);
    expect(body.ledger.some((e) => e.slipId === sureshSlipId)).toBe(false);

    // Stats are recomputed over the scoped slips, not the whole workshop.
    const expectedGold =
      Math.round(
        body.slips
          .filter((s) => s.status === "ISSUED" || s.status === "WORKING")
          .reduce((sum, s) => sum + s.weightGrams, 0) * 100
      ) / 100;
    expect(body.stats.goldOut).toBe(expectedGold);
  });

  it("refuses a return recorded by a karigar with 403", async () => {
    const token = signSession({ role: "karigar", karigarId: raviId });
    const res = await returnRoute(
      post(
        `http://localhost/api/slips/${raviSlipId}/return`,
        { pieceWeightGrams: 9, scrapWeightGrams: 0.1 },
        cookieFor(token)
      ),
      { params: Promise.resolve({ id: raviSlipId }) }
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/only the jeweller/i);

    // Nothing was mutated.
    const slip = await db.slip.findUniqueOrThrow({ where: { id: raviSlipId } });
    expect(slip.status).toBe("WORKING");
  });
});
