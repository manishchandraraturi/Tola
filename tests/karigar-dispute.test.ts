// P4 tests: karigar management, the proposed plan cap, wastage
// counter-proposals, and multi-party dispute rules. Runs against a throwaway
// SQLite database created with `prisma db push`, exactly like the ledger tests.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  addKarigar,
  submitWastageProposal,
  respondWastageProposal,
  karigarTapBlocked,
  applyDisputeAction,
  disputeStageAllowed,
  disputeMetrics,
} from "@/lib/tola";

let dir = "";
let client: PrismaClient;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-p4-"));
  const url = `file:${path.join(dir, "p4.db").replace(/\\/g, "/")}`;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
  );
  client = new PrismaClient({ datasources: { db: { url } } });
}, 120_000);

beforeEach(async () => {
  await client.disputeEvent.deleteMany({});
  await client.ledgerEntry.deleteMany({});
  await client.payment.deleteMany({});
  await client.slip.deleteMany({});
  await client.karigar.deleteMany({});
});

afterAll(async () => {
  await client?.$disconnect();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

async function makeKarigar(name = "Ravi Kumar") {
  return client.karigar.create({
    data: { name, phone: "+91 98450 11223", speciality: "Necklace sets", city: "Bengaluru" },
  });
}

async function makeSlip(karigarId: string, status: string, number: number) {
  return client.slip.create({
    data: {
      number,
      karigarId,
      weightGrams: 10,
      purity: "22K",
      job: "Test job",
      dueDate: new Date(Date.now() + 7 * 86400000),
      wastageAgreedPct: 3,
      status,
    },
  });
}

describe("Karigar management", () => {
  it("adds a karigar and returns the new count", async () => {
    const result = await addKarigar(client, {
      name: "Lakshmi Devi",
      phone: "+91 90000 00001",
      speciality: "Jhumkas",
      city: "Tumakuru",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(1);
    expect(result.karigar.name).toBe("Lakshmi Devi");
    expect(await client.karigar.count()).toBe(1);
  });

  it("respects the proposed plan cap and reports it", async () => {
    // Use a small cap to exercise the rule quickly.
    expect((await addKarigar(client, { name: "A", phone: "1", speciality: "s", city: "c" }, 2)).ok).toBe(true);
    expect((await addKarigar(client, { name: "B", phone: "2", speciality: "s", city: "c" }, 2)).ok).toBe(true);

    const third = await addKarigar(client, { name: "C", phone: "3", speciality: "s", city: "c" }, 2);
    expect(third.ok).toBe(false);
    if (third.ok) return;
    expect(third.status).toBe(409);
    expect(third.count).toBe(2);
    expect(third.cap).toBe(2);
    expect(await client.karigar.count()).toBe(2);
  });
});

describe("Wastage counter-proposal", () => {
  it("blocks the karigar's confirm tap until the jeweller accepts", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "ISSUED", 301);

    const proposed = await submitWastageProposal(client, {
      slipId: slip.id,
      karigarId: k.id,
      pct: 4.5,
      note: "The piece needed extra filing.",
    });
    expect(proposed.ok).toBe(true);

    const afterProposal = await client.slip.findUnique({ where: { id: slip.id } });
    expect(afterProposal!.wastageProposalStatus).toBe("PENDING");
    expect(afterProposal!.wastageProposedPct).toBe(4.5);
    expect(karigarTapBlocked(afterProposal!)).toBe(true);

    // The jeweller accepts.
    const accepted = await respondWastageProposal(client, {
      slipId: slip.id,
      side: "jeweller",
      accept: true,
    });
    expect(accepted.ok).toBe(true);

    const afterAccept = await client.slip.findUnique({ where: { id: slip.id } });
    expect(afterAccept!.wastageProposalStatus).toBe("ACCEPTED");
    expect(afterAccept!.wastageAgreedPct).toBe(4.5);
    expect(karigarTapBlocked(afterAccept!)).toBe(false);
  });

  it("a declined proposal keeps the agreed percentage and unblocks the tap", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "ISSUED", 302);

    await submitWastageProposal(client, { slipId: slip.id, karigarId: k.id, pct: 6 });
    const declined = await respondWastageProposal(client, {
      slipId: slip.id,
      side: "jeweller",
      accept: false,
    });
    expect(declined.ok).toBe(true);

    const after = await client.slip.findUnique({ where: { id: slip.id } });
    expect(after!.wastageProposalStatus).toBe("DECLINED");
    expect(after!.wastageAgreedPct).toBe(3);
    expect(karigarTapBlocked(after!)).toBe(false);
  });

  it("only the jeweller can answer, and only on an ISSUED slip", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "ISSUED", 303);
    await submitWastageProposal(client, { slipId: slip.id, karigarId: k.id, pct: 4 });

    const karigarAnswer = await respondWastageProposal(client, {
      slipId: slip.id,
      side: "karigar",
      accept: true,
    });
    expect(karigarAnswer.ok).toBe(false);

    const working = await makeSlip(k.id, "WORKING", 304);
    const wrongStage = await submitWastageProposal(client, {
      slipId: working.id,
      karigarId: k.id,
      pct: 4,
    });
    expect(wrongStage.ok).toBe(false);
  });
});

describe("Multi-party dispute rules", () => {
  it("allows disputes at WORKING and RETURNED, but not at ISSUED or SETTLED", async () => {
    expect(disputeStageAllowed("WORKING")).toBe(true);
    expect(disputeStageAllowed("RETURNED")).toBe(true);
    expect(disputeStageAllowed("ISSUED")).toBe(false);
    expect(disputeStageAllowed("SETTLED")).toBe(false);

    const k = await makeKarigar();
    const issued = await makeSlip(k.id, "ISSUED", 401);
    const blocked = await applyDisputeAction(client, { slipId: issued.id, side: "karigar", action: "open" });
    expect(blocked.ok).toBe(false);
  });

  it("the opener cannot close it alone; the other side's agreement resolves it", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "WORKING", 402);

    const opened = await applyDisputeAction(client, {
      slipId: slip.id,
      side: "jeweller",
      action: "open",
      note: "Scrap weight does not match.",
    });
    expect(opened.ok).toBe(true);

    // Opener tries to resolve on its own -> refused.
    const selfResolve = await applyDisputeAction(client, {
      slipId: slip.id,
      side: "jeweller",
      action: "resolve",
    });
    expect(selfResolve.ok).toBe(false);
    if (!selfResolve.ok) expect(selfResolve.status).toBe(409);

    // Other side agrees -> closes.
    const otherResolve = await applyDisputeAction(client, {
      slipId: slip.id,
      side: "karigar",
      action: "resolve",
    });
    expect(otherResolve.ok).toBe(true);

    const after = await client.slip.findUnique({ where: { id: slip.id } });
    expect(after!.disputed).toBe(false);
    expect(after!.disputeOpenedBy).toBeNull();
  });

  it("the opener may formally withdraw at RETURNED stage", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "RETURNED", 403);

    await applyDisputeAction(client, { slipId: slip.id, side: "karigar", action: "open", note: "Please recheck." });

    const otherWithdraw = await applyDisputeAction(client, {
      slipId: slip.id,
      side: "jeweller",
      action: "withdraw",
    });
    expect(otherWithdraw.ok).toBe(false);

    const withdraw = await applyDisputeAction(client, {
      slipId: slip.id,
      side: "karigar",
      action: "withdraw",
      note: "Talked it through.",
    });
    expect(withdraw.ok).toBe(true);

    const events = await client.disputeEvent.findMany({ where: { slipId: slip.id } });
    expect(events.map((e) => e.kind)).toEqual(["OPENED", "WITHDRAWN"]);
  });

  it("records dispute history events and computes monthly counts and average days", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, "RETURNED", 404);
    await applyDisputeAction(client, { slipId: slip.id, side: "jeweller", action: "open", note: "check" });
    await applyDisputeAction(client, { slipId: slip.id, side: "karigar", action: "note", note: "my side" });
    await applyDisputeAction(client, { slipId: slip.id, side: "karigar", action: "resolve" });

    const kinds = (await client.disputeEvent.findMany({ where: { slipId: slip.id } })).map((e) => e.kind);
    expect(kinds).toEqual(["OPENED", "NOTE", "RESOLVED"]);

    // Pure metric function: two opened in Jan, one resolved after 2 days.
    const metrics = disputeMetrics(
      [
        { slipId: "a", kind: "OPENED", createdAt: new Date("2026-01-01T00:00:00Z") },
        { slipId: "a", kind: "RESOLVED", createdAt: new Date("2026-01-03T00:00:00Z") },
        { slipId: "b", kind: "OPENED", createdAt: new Date("2026-01-05T00:00:00Z") },
        { slipId: "c", kind: "OPENED", createdAt: new Date("2026-02-02T00:00:00Z") },
      ],
      new Date("2026-02-10T00:00:00Z")
    );
    expect(metrics.byMonth).toEqual([
      { month: "2026-01", opened: 2, closed: 1 },
      { month: "2026-02", opened: 1, closed: 0 },
    ]);
    expect(metrics.thisMonth).toBe(1);
    expect(metrics.avgDays).toBe(2);
    expect(metrics.resolved).toBe(1);
  });
});
