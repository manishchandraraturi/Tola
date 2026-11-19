// Integration tests for the hash-linked ledger.
// They run against a throwaway SQLite database created with `prisma db push`,
// so the real reseed/appendLedger/verify code paths are exercised end to end.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { appendLedger, reseed, verifyLedgerChain } from "@/lib/tola";

let dir = "";
let client: PrismaClient;

function chain() {
  return client.ledgerEntry.findMany({ orderBy: { seq: "asc" } });
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-ledger-"));
  const url = `file:${path.join(dir, "ledger.db").replace(/\\/g, "/")}`;
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

beforeEach(async () => {
  await reseed(client);
});

describe("ledger chain integrity", () => {
  it("a clean seed verifies OK", async () => {
    const entries = await chain();
    expect(entries.length).toBeGreaterThan(1);
    const result = verifyLedgerChain(entries);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(entries.length);
  });

  it("changing any entry's text breaks the chain at that seq", async () => {
    const entries = await chain();
    const target = entries[Math.floor(entries.length / 2)];
    await client.ledgerEntry.update({
      where: { seq: target.seq },
      data: { text: `${target.text} (edited)` },
    });
    const result = verifyLedgerChain(await chain());
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(target.seq);
  });

  it("deleting a middle entry breaks the chain", async () => {
    const entries = await chain();
    const middle = entries[Math.floor(entries.length / 2)];
    await client.ledgerEntry.delete({ where: { seq: middle.seq } });
    const result = verifyLedgerChain(await chain());
    expect(result.ok).toBe(false);
    expect(result.checked).toBeLessThan(middle.seq);
  });

  it("reordering two entries breaks the chain", async () => {
    const entries = await chain();
    const a = entries[2];
    const b = entries[3];
    await client.$transaction([
      client.ledgerEntry.update({ where: { seq: a.seq }, data: { seq: -1 } }),
      client.ledgerEntry.update({ where: { seq: b.seq }, data: { seq: a.seq } }),
      client.ledgerEntry.update({ where: { seq: -1 }, data: { seq: b.seq } }),
    ]);
    const result = verifyLedgerChain(await chain());
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(a.seq);
  });

  it("changing the actor on an entry breaks the chain too", async () => {
    const entries = await chain();
    const target = entries[4];
    await client.ledgerEntry.update({
      where: { seq: target.seq },
      data: { actor: "system" },
    });
    expect(verifyLedgerChain(await chain()).brokenAtSeq).toBe(target.seq);
  });

  it("entries appended after a reseed still verify", async () => {
    const before = verifyLedgerChain(await chain());
    await appendLedger(
      { kind: "NOTE", text: "A fresh note written after the reseed.", actor: "jeweller" },
      client
    );
    const after = verifyLedgerChain(await chain());
    expect(after.ok).toBe(true);
    expect(after.checked).toBe(before.checked + 1);
  });
});
