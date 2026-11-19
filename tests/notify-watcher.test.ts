// P7 tests: notifier fallback, Watcher de-duplication/ranking, and the
// karigar-scoped WhatsApp chat commands. Throwaway SQLite DB per run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { WatcherAlert } from "@/lib/tola";
import {
  DemoNotifier,
  WhatsAppNotifier,
  rankWatcherAlerts,
  runWatcher,
} from "@/lib/notify";
import { handleWhatsappChat, parseChatCommand } from "@/lib/whatsapp";

let dir = "";
let client: PrismaClient;
let nextNumber = 700;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-notify-"));
  const url = `file:${path.join(dir, "notify.db").replace(/\\/g, "/")}`;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
  );
  client = new PrismaClient({ datasources: { db: { url } } });
}, 120_000);

beforeEach(async () => {
  await client.alertLog.deleteMany({});
  await client.otpChallenge.deleteMany({});
  await client.notificationLog.deleteMany({});
  await client.payment.deleteMany({});
  await client.ledgerEntry.deleteMany({});
  await client.slip.deleteMany({});
  await client.karigar.deleteMany({});
});

afterAll(async () => {
  await client?.$disconnect();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

async function makeKarigar(name = "Ravi Kumar", phone = "+91 98450 11223") {
  return client.karigar.create({
    data: { name, phone, speciality: "Necklace sets", city: "Bengaluru" },
  });
}

type SlipOverrides = {
  status?: string;
  weightGrams?: number;
  isWedding?: boolean;
  job?: string;
  dueDate?: Date;
};

async function makeSlip(karigarId: string, overrides: SlipOverrides = {}) {
  nextNumber += 1;
  return client.slip.create({
    data: {
      number: nextNumber,
      karigarId,
      weightGrams: 10,
      purity: "22K",
      job: "Necklace set",
      dueDate: new Date(Date.now() + 2 * 86400000),
      wastageAgreedPct: 3,
      ...overrides,
    },
  });
}

// ---- Notifier ---------------------------------------------------------------

describe("Notifier", () => {
  it("DemoNotifier writes to NotificationLog and marks it demo", async () => {
    const notifier = new DemoNotifier(client);
    const result = await notifier.send({
      recipient: "+91 98450 11223",
      actor: "karigar:abc",
      text: "Slip #211 is due tomorrow.",
      channel: "WHATSAPP",
    });
    expect(result.ok).toBe(true);
    expect(result.demo).toBe(true);
    const row = await client.notificationLog.findFirst({});
    expect(row!.channel).toBe("DEMO_SMS");
    expect(row!.isDemo).toBe(true);
    expect(row!.text).toContain("due tomorrow");
  });

  it("WhatsAppNotifier falls back to the demo log when unconfigured", async () => {
    const notifier = new WhatsAppNotifier({
      client,
      token: "",
      phoneId: "",
      fallback: new DemoNotifier(client),
    });
    const result = await notifier.send({
      recipient: "+91 98450 11223",
      actor: "karigar:abc",
      text: "Reminder",
      channel: "WHATSAPP",
    });
    expect(result.ok).toBe(true);
    expect(result.channel).toBe("DEMO_SMS");
    expect(result.demo).toBe(true);
    expect(await client.notificationLog.count()).toBe(1);
  });

  it("WhatsAppNotifier calls the Cloud API when configured", async () => {
    let called: { url: string; body: { to: string } } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      called = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ messages: [{ id: "wamid.TEST" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const notifier = new WhatsAppNotifier({
      client,
      token: "test-token",
      phoneId: "123456",
      fetchImpl: fakeFetch,
    });
    const result = await notifier.send({
      recipient: "+91 98450 11223",
      actor: "karigar:abc",
      text: "Slip #211 is due tomorrow.",
      channel: "WHATSAPP",
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("WHATSAPP");
    expect(result.demo).toBe(false);
    expect(called!.url).toContain("/123456/messages");
    expect(called!.body.to).toBe("919845011223");

    const row = await client.notificationLog.findFirst({});
    expect(row!.channel).toBe("WHATSAPP");
    expect(row!.isDemo).toBe(false);
  });

  it("WhatsAppNotifier falls back when the Cloud API fails", async () => {
    const failingFetch = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const notifier = new WhatsAppNotifier({
      client,
      token: "test-token",
      phoneId: "123456",
      fallback: new DemoNotifier(client),
      fetchImpl: failingFetch,
    });
    const result = await notifier.send({
      recipient: "+91 98450 11223",
      actor: "karigar:abc",
      text: "Reminder",
    });
    expect(result.ok).toBe(true);
    expect(result.channel).toBe("DEMO_SMS");
    expect(result.error).toContain("500");
    expect(await client.notificationLog.count()).toBe(1);
  });
});

// ---- Watcher ----------------------------------------------------------------

function alert(level: WatcherAlert["level"], slipNumber: number): WatcherAlert {
  return {
    slipNumber,
    job: "Job",
    karigarName: "Ravi Kumar",
    dueDate: new Date().toISOString(),
    daysLeft: 1,
    level,
    message: `#${slipNumber}`,
  };
}

describe("Watcher", () => {
  it("ranks wedding orders first, then overdue, urgent and info", () => {
    const out = rankWatcherAlerts([
      alert("info", 1),
      alert("urgent", 2),
      alert("overdue", 3),
      alert("wedding-soon", 4),
    ]);
    expect(out.map((a) => a.level)).toEqual(["wedding-soon", "overdue", "urgent", "info"]);
  });

  it("sends once per slip, level and day — a re-run is skipped", async () => {
    const k = await makeKarigar();
    await makeSlip(k.id, { isWedding: true });
    const notifier = new DemoNotifier(client);
    const now = new Date();

    const first = await runWatcher(client, notifier, now);
    expect(first.generated).toBe(1);
    expect(first.sent).toBe(1);
    expect(first.skipped).toBe(0);

    const second = await runWatcher(client, notifier, now);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);

    expect(await client.alertLog.count()).toBe(1);
    expect(await client.notificationLog.count()).toBe(1);
  });

  it("sends again the next day", async () => {
    const k = await makeKarigar();
    await makeSlip(k.id, { isWedding: true });
    const notifier = new DemoNotifier(client);
    const now = new Date();

    await runWatcher(client, notifier, now);
    const tomorrow = await runWatcher(client, notifier, new Date(now.getTime() + 86400000));

    expect(tomorrow.sent).toBe(1);
    expect(await client.alertLog.count()).toBe(2);
    expect(await client.notificationLog.count()).toBe(2);
  });
});

// ---- WhatsApp chat ----------------------------------------------------------

describe("WhatsApp chat", () => {
  it("parses commands in plain language", () => {
    expect(parseChatCommand("balance").kind).toBe("balance");
    expect(parseChatCommand("Status #211")).toEqual({ kind: "status", slipNumber: 211 });
    expect(parseChatCommand("OK 212")).toEqual({ kind: "ok", slipNumber: 212 });
    expect(parseChatCommand("hello there")).toEqual({ kind: "help", reason: "unknown" });
    expect(parseChatCommand("   ")).toEqual({ kind: "help", reason: "empty" });
  });

  it("answers balance from this karigar's own gold only", async () => {
    const k1 = await makeKarigar();
    const k2 = await makeKarigar("Suresh Patel", "+91 99001 44557");
    await makeSlip(k1.id, { status: "WORKING", weightGrams: 10 });
    await makeSlip(k1.id, { status: "ISSUED", weightGrams: 5 });
    await makeSlip(k1.id, { status: "RETURNED", weightGrams: 2 });
    await makeSlip(k2.id, { status: "WORKING", weightGrams: 8 });

    const reply = await handleWhatsappChat(client, { karigarId: k1.id, text: "balance" });
    expect(reply.ok).toBe(true);
    expect(reply.reply).toContain("15.00 g");
    expect(reply.reply).not.toContain("23.00 g");
  });

  it("returns status and due date for an owned slip", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, { status: "WORKING" });

    const reply = await handleWhatsappChat(client, {
      karigarId: k.id,
      text: `status ${slip.number}`,
    });
    expect(reply.ok).toBe(true);
    expect(reply.reply).toContain(`Slip #${slip.number}`);
    expect(reply.reply).toContain("GOLD WITH KARIGAR");
    expect(reply.reply).toContain("Due");
  });

  it("does not reveal another karigar's slip", async () => {
    const k1 = await makeKarigar();
    const k2 = await makeKarigar("Suresh Patel", "+91 99001 44557");
    const other = await makeSlip(k2.id, { job: "Someone else's bangle", status: "WORKING" });

    const reply = await handleWhatsappChat(client, {
      karigarId: k1.id,
      text: `status ${other.number}`,
    });
    expect(reply.reply).toContain("don't see that slip on your account");
    expect(reply.reply).not.toContain("Someone else's bangle");
  });

  it("'ok <slip>' starts the OTP but never marks the payment paid", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, { status: "SETTLED" });
    const payment = await client.payment.create({
      data: { slipId: slip.id, amount: 3800, status: "PENDING", upiRef: "410023456789" },
    });

    const reply = await handleWhatsappChat(client, {
      karigarId: k.id,
      text: `ok ${slip.number}`,
    });

    expect(reply.ok).toBe(true);
    expect(reply.command).toBe("ok");
    expect(reply.challengeId).toBeTruthy();
    expect(reply.demoCode).toMatch(/^\d{6}$/);
    expect(reply.reply).toContain("OTP sent");

    const after = await client.payment.findUnique({ where: { id: payment.id } });
    expect(after!.status).toBe("PENDING");
    expect(after!.paidConfirmedAt).toBeNull();
    expect(await client.otpChallenge.count()).toBe(1);
  });

  it("'ok <slip>' explains when the slip is not at settlement yet", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, { status: "RETURNED" });

    const reply = await handleWhatsappChat(client, {
      karigarId: k.id,
      text: `ok ${slip.number}`,
    });
    expect(reply.ok).toBe(true);
    expect(reply.challengeId).toBeUndefined();
    expect(reply.reply).toContain("isn't at settlement yet");
  });

  it("'ok <slip>' waits for the jeweller's UPI reference", async () => {
    const k = await makeKarigar();
    const slip = await makeSlip(k.id, { status: "SETTLED" });
    await client.payment.create({
      data: { slipId: slip.id, amount: 3800, status: "PENDING" },
    });

    const reply = await handleWhatsappChat(client, {
      karigarId: k.id,
      text: `ok ${slip.number}`,
    });
    expect(reply.ok).toBe(true);
    expect(reply.challengeId).toBeUndefined();
    expect(reply.reply).toContain("hasn't recorded the UPI reference");
  });
});
