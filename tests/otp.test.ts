// OTP challenge unit tests for Tola dual-signed tap confirmation.
// Runs against a throwaway SQLite database created with `prisma db push`,
// so createOtpChallenge / consumeOtpChallenge are exercised end to end.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createOtpChallenge, consumeOtpChallenge } from "@/lib/otp";

let dir = "";
let client: PrismaClient;

// createOtpChallenge never returns the plaintext code (only its scrypt hash is
// stored). For the demo it writes the code into NotificationLog, so tests read
// it back from there — exactly the way the DEMO SMS bar shows it.
async function latestCode(actor: string): Promise<string> {
  const log = await client.notificationLog.findFirst({
    where: { actor },
    orderBy: { createdAt: "desc" },
  });
  const match = log?.text.match(/(\d{6})/);
  if (!match) throw new Error(`No OTP code found for actor ${actor}`);
  return match[1];
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-otp-"));
  const url = `file:${path.join(dir, "otp.db").replace(/\\/g, "/")}`;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
  );
  client = new PrismaClient({ datasources: { db: { url } } });
}, 120_000);

afterAll(async () => {
  await client?.$disconnect();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe("OTP challenges", () => {
  it("1. creates a hashed code and consumes it once with the right code, returning proof otp:<id>", async () => {
    const actor = "jeweller:t1";
    const created = await createOtpChallenge(
      { actor, purpose: "confirm", targetId: "slip-1" },
      client
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // codeHash must not be the 6-digit plaintext
    const challenge = await client.otpChallenge.findUnique({
      where: { id: created.challengeId },
    });
    expect(challenge).not.toBeNull();
    expect(challenge!.codeHash).not.toMatch(/^\d{6}$/);

    const code = await latestCode(actor);
    expect(code).toMatch(/^\d{6}$/);

    const result = await consumeOtpChallenge(
      { challengeId: created.challengeId, code, actor, purpose: "confirm", targetId: "slip-1" },
      client
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proof).toBe(`otp:${created.challengeId}`);
  });

  it("2. fails when an already-consumed challengeId is reused", async () => {
    const actor = "jeweller:t2";
    const created = await createOtpChallenge(
      { actor, purpose: "confirm", targetId: "slip-2" },
      client
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const code = await latestCode(actor);
    const first = await consumeOtpChallenge(
      { challengeId: created.challengeId, code, actor, purpose: "confirm", targetId: "slip-2" },
      client
    );
    expect(first.ok).toBe(true);

    const second = await consumeOtpChallenge(
      { challengeId: created.challengeId, code, actor, purpose: "confirm", targetId: "slip-2" },
      client
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already consumed/i);
  });

  it("3. wrong code fails and increments attempts; after 3 failures the correct code still fails", async () => {
    const actor = "jeweller:t3";
    const created = await createOtpChallenge(
      { actor, purpose: "confirm", targetId: "slip-3" },
      client
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const correct = await latestCode(actor);
    const wrong = correct === "000000" ? "111111" : "000000";

    for (let i = 1; i <= 3; i++) {
      const r = await consumeOtpChallenge(
        { challengeId: created.challengeId, code: wrong, actor, purpose: "confirm", targetId: "slip-3" },
        client
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/wrong otp code/i);
      const row = await client.otpChallenge.findUnique({ where: { id: created.challengeId } });
      expect(row!.attempts).toBe(i);
    }

    const locked = await consumeOtpChallenge(
      { challengeId: created.challengeId, code: correct, actor, purpose: "confirm", targetId: "slip-3" },
      client
    );
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/locked out/i);
  });

  it("4. fails when the challenge has expired", async () => {
    const actor = "jeweller:t4";
    const created = await createOtpChallenge(
      { actor, purpose: "confirm", targetId: "slip-4" },
      client
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await client.otpChallenge.update({
      where: { id: created.challengeId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const code = await latestCode(actor);
    const result = await consumeOtpChallenge(
      { challengeId: created.challengeId, code, actor, purpose: "confirm", targetId: "slip-4" },
      client
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired/i);
  });

  it("5. fails when consumed by a different actor", async () => {
    const actor = "jeweller:t5";
    const created = await createOtpChallenge(
      { actor, purpose: "confirm", targetId: "slip-5" },
      client
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const code = await latestCode(actor);
    const result = await consumeOtpChallenge(
      { challengeId: created.challengeId, code, actor: "karigar:other", purpose: "confirm", targetId: "slip-5" },
      client
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/does not match this actor/i);
  });
});
