// P6 tests: payment clock countdown, UPI deep links, and the OTP-confirmed
// payment completion flow. Runs against a throwaway SQLite database.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  PAYMENT_CLOCK_HOURS,
  paymentDueAt,
  paymentClock,
  formatDuration,
  buildUpiLink,
  isValidUpiRef,
  recordUpiPayment,
  requestPaymentOtp,
  confirmPaymentWithOtp,
} from "@/lib/tola";

describe("Payment clock", () => {
  const start = new Date("2026-11-10T10:00:00.000Z");

  it("sets the due time 24h after approval", () => {
    const due = paymentDueAt(start);
    expect(due.toISOString()).toBe("2026-11-11T10:00:00.000Z");
    expect(PAYMENT_CLOCK_HOURS).toBe(24);
  });

  it("counts down before the due time", () => {
    const due = paymentDueAt(start);
    const clock = paymentClock(due, new Date("2026-11-11T08:00:00.000Z"));
    expect(clock.overdue).toBe(false);
    expect(clock.label).toBe("2h 0m left");
    expect(clock.msLeft).toBe(2 * 3600 * 1000);
  });

  it("turns overdue after the due time", () => {
    const due = paymentDueAt(start);
    const clock = paymentClock(due, new Date("2026-11-11T12:30:00.000Z"));
    expect(clock.overdue).toBe(true);
    expect(clock.label).toBe("overdue by 2h 30m");
  });

  it("handles a missing clock", () => {
    const clock = paymentClock(null);
    expect(clock.dueAt).toBeNull();
    expect(clock.label).toBe("no clock");
  });

  it("formats durations under an hour and over a day", () => {
    expect(formatDuration(5 * 60 * 1000)).toBe("5m");
    expect(formatDuration(26 * 3600 * 1000)).toBe("26h 0m");
  });
});

describe("UPI deep link", () => {
  it("builds a valid upi:// link with payee, amount, currency and note", () => {
    const link = buildUpiLink({
      payeeVpa: "meena.naik@upi",
      payeeName: "Meena Naik",
      amount: 3270,
      note: "Tola Slip 212",
    });
    expect(link.startsWith("upi://pay?")).toBe(true);
    expect(link).toContain("pa=meena.naik%40upi");
    expect(link).toContain("pn=Meena+Naik");
    expect(link).toContain("am=3270");
    expect(link).toContain("cu=INR");
    expect(link).toContain("tn=Tola+Slip+212");
  });

  it("validates a 12-digit UPI reference", () => {
    expect(isValidUpiRef("410023456789")).toBe(true);
    expect(isValidUpiRef("12345")).toBe(false);
    expect(isValidUpiRef("41002345678a")).toBe(false);
  });
});

describe("OTP-confirmed payment flow", () => {
  let dir = "";
  let client: PrismaClient;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-pay-"));
    const url = `file:${path.join(dir, "pay.db").replace(/\\/g, "/")}`;
    execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
    );
    client = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  beforeEach(async () => {
    await client.ledgerEntry.deleteMany({});
    await client.payment.deleteMany({});
    await client.slip.deleteMany({});
    await client.karigar.deleteMany({});
    await client.otpChallenge.deleteMany({});
    await client.notificationLog.deleteMany({});
  });

  afterAll(async () => {
    await client?.$disconnect();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  async function setupPayment() {
    const k = await client.karigar.create({
      data: {
        name: "Meena Naik",
        phone: "+91 97402 88391",
        speciality: "Rings",
        city: "Tumakuru",
        upiId: "meena.naik@upi",
      },
    });
    const slip = await client.slip.create({
      data: {
        number: 501,
        karigarId: k.id,
        weightGrams: 10,
        purity: "22K",
        job: "Ring set",
        dueDate: new Date(),
        wastageAgreedPct: 3,
        status: "SETTLED",
        makingCharges: 3800,
        payDueAt: paymentDueAt(new Date()),
      },
    });
    const payment = await client.payment.create({
      data: { slipId: slip.id, amount: 3800, status: "PENDING" },
    });
    return { k, slip, payment };
  }

  it("records the UPI reference and moves to PENDING_CONFIRMATION", async () => {
    const { payment } = await setupPayment();

    const bad = await recordUpiPayment(client, { paymentId: payment.id, upiRef: "123" });
    expect(bad.ok).toBe(false);

    const ok = await recordUpiPayment(client, { paymentId: payment.id, upiRef: "410023456789" });
    expect(ok.ok).toBe(true);
    const row = await client.payment.findUnique({ where: { id: payment.id } });
    expect(row!.status).toBe("PENDING_CONFIRMATION");
    expect(row!.upiRef).toBe("410023456789");
  });

  it("will not request an OTP before a UPI reference exists", async () => {
    const { payment } = await setupPayment();
    const result = await requestPaymentOtp(client, { paymentId: payment.id });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
  });

  it("marks the payment PAID only after a valid OTP", async () => {
    const { payment } = await setupPayment();
    await recordUpiPayment(client, { paymentId: payment.id, upiRef: "410023456789" });

    const requested = await requestPaymentOtp(client, { paymentId: payment.id });
    expect(requested.ok).toBe(true);
    expect(requested.demoCode).toMatch(/^\d{6}$/);

    const wrong = requested.demoCode === "000000" ? "111111" : "000000";
    const rejected = await confirmPaymentWithOtp(client, {
      paymentId: payment.id,
      challengeId: requested.challengeId!,
      code: wrong,
    });
    expect(rejected.ok).toBe(false);

    const confirmed = await confirmPaymentWithOtp(client, {
      paymentId: payment.id,
      challengeId: requested.challengeId!,
      code: requested.demoCode!,
    });
    expect(confirmed.ok).toBe(true);

    const row = await client.payment.findUnique({ where: { id: payment.id } });
    expect(row!.status).toBe("PAID");
    expect(row!.paidConfirmedAt).not.toBeNull();

    const slip = await client.slip.findUnique({ where: { id: row!.slipId } });
    expect(slip!.paidAt).not.toBeNull();

    const entry = await client.ledgerEntry.findFirst({
      where: { slipId: row!.slipId, kind: "PAID" },
    });
    expect(entry).not.toBeNull();
    expect(entry!.proof).toBe(`otp:${requested.challengeId}`);
  });

  it("does not let the same payment be confirmed twice", async () => {
    const { payment } = await setupPayment();
    await recordUpiPayment(client, { paymentId: payment.id, upiRef: "410023456789" });
    const requested = await requestPaymentOtp(client, { paymentId: payment.id });
    await confirmPaymentWithOtp(client, {
      paymentId: payment.id,
      challengeId: requested.challengeId!,
      code: requested.demoCode!,
    });

    const again = await confirmPaymentWithOtp(client, {
      paymentId: payment.id,
      challengeId: requested.challengeId!,
      code: requested.demoCode!,
    });
    expect(again.ok).toBe(false);
    expect(again.status).toBe(409);
  });
});
