// P8 tests: the public customer status link. The DTO is the security boundary,
// so these tests attack it directly: nothing but the whitelisted fields may
// come out, revoked links die at once, and settled links expire after 30 days.
import { describe, expect, it } from "vitest";
import {
  PUBLIC_STATUS_TTL_DAYS,
  customerStatusDto,
  customerStatusLine,
  newPublicToken,
  publicStatusVisible,
} from "@/lib/tola";

const DAY = 86400000;
const now = new Date("2026-11-17T10:00:00.000Z");

function slip(overrides: Record<string, unknown> = {}) {
  return {
    number: 214,
    job: "Necklace set",
    isWedding: true,
    dueDate: new Date("2026-11-20T09:00:00.000Z"),
    status: "WORKING",
    createdAt: new Date("2026-11-10T09:00:00.000Z"),
    settledAt: null,
    publicTokenRevokedAt: null,
    // Everything below is private and must never survive the DTO.
    weightGrams: 25.4,
    purity: "22K",
    wastageAgreedPct: 3,
    wastageActualPct: 3.9,
    makingCharges: 9650,
    customerName: "Priya & Arjun",
    customerPhone: "+91 90080 66845",
    karigarName: "Ravi Kumar",
    karigarPhone: "+91 98450 11223",
    publicToken: "a".repeat(32),
    ...overrides,
  };
}

describe("public status token", () => {
  it("generates a distinct 128-bit hex token for every slip", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newPublicToken()));
    expect(tokens.size).toBe(500);
    for (const token of tokens) {
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    }
  });
});

describe("customer status DTO whitelist", () => {
  it("returns exactly the public fields and nothing else", () => {
    const dto = customerStatusDto(slip(), [], now);
    expect(dto).not.toBeNull();
    expect(Object.keys(dto!).sort()).toEqual([
      "createdAt",
      "dueDate",
      "events",
      "isWedding",
      "job",
      "number",
      "progressStep",
      "status",
    ]);
  });

  it("never leaks weights, purity, karigar identity, money or tokens", () => {
    const dto = customerStatusDto(slip(), [], now)!;
    const json = JSON.stringify(dto);

    for (const secret of [
      "25.4",
      "22K",
      "Ravi Kumar",
      "98450 11223",
      "Priya & Arjun",
      "90080 66845",
      "9650",
      "wastageAgreedPct",
      "wastageActualPct",
      "makingCharges",
      "karigar",
      "customerName",
      "customerPhone",
      "publicToken",
    ]) {
      expect(json).not.toContain(secret);
      expect(secret in dto).toBe(false);
    }
  });

  it("maps status to the four public progress steps", () => {
    expect(customerStatusDto(slip({ status: "ISSUED" }), [], now)!.progressStep).toBe(1);
    expect(customerStatusDto(slip({ status: "WORKING" }), [], now)!.progressStep).toBe(2);
    expect(customerStatusDto(slip({ status: "RETURNED" }), [], now)!.progressStep).toBe(3);
    expect(
      customerStatusDto(
        slip({ status: "SETTLED", settledAt: new Date(now.getTime() - DAY) }),
        [],
        now
      )!.progressStep
    ).toBe(4);
  });

  it("shows only generic labels for the last three public events", () => {
    const events = [
      { kind: "ISSUE", createdAt: new Date("2026-11-10T09:00:00.000Z") },
      { kind: "TAP", createdAt: new Date("2026-11-10T13:00:00.000Z") },
      { kind: "RETURN", createdAt: new Date("2026-11-14T16:00:00.000Z") },
      // Unknown kinds are dropped, even if their text holds private data.
      { kind: "SECRET", createdAt: new Date("2026-11-15T10:00:00.000Z") },
      { kind: "PAID", createdAt: new Date("2026-11-16T10:00:00.000Z") },
    ];
    const dto = customerStatusDto(slip(), events, now)!;

    expect(dto.events).toHaveLength(3);
    expect(dto.events.map((e) => e.label)).toEqual([
      "Gold handed over — both taps done",
      "Piece came back for weighing",
      "Payment completed",
    ]);
    const json = JSON.stringify(dto);
    expect(json).not.toContain("SECRET");
    expect(json).not.toContain("PRIVATE-NOTE");
  });

  it("keeps customer-facing language free of accusations", () => {
    for (const status of ["ISSUED", "WORKING", "RETURNED", "SETTLED"] as const) {
      const line = customerStatusLine(status).toLowerCase();
      expect(line).not.toMatch(/late|delay|fault|blame|penalt/);
    }
  });
});

describe("customer status expiry and revocation", () => {
  it("returns null as soon as the token is revoked", () => {
    expect(
      publicStatusVisible(slip({ publicTokenRevokedAt: new Date(now.getTime() - 1000) }), now)
    ).toBe(false);
    expect(
      customerStatusDto(slip({ publicTokenRevokedAt: new Date(now.getTime() - 1000) }), [], now)
    ).toBeNull();
  });

  it("keeps a link live for 30 days after settlement, then expires it", () => {
    const settledAt = new Date(now.getTime() - 29 * DAY);
    expect(customerStatusDto(slip({ status: "SETTLED", settledAt }), [], now)).not.toBeNull();

    const expiredAt = new Date(now.getTime() - (PUBLIC_STATUS_TTL_DAYS + 1) * DAY);
    expect(
      customerStatusDto(slip({ status: "SETTLED", settledAt: expiredAt }), [], now)
    ).toBeNull();
    expect(PUBLIC_STATUS_TTL_DAYS).toBe(30);
  });

  it("does not expire an unsettled link, however old the order is", () => {
    const dto = customerStatusDto(
      slip({ status: "WORKING", createdAt: new Date(now.getTime() - 400 * DAY) }),
      [],
      now
    );
    expect(dto).not.toBeNull();
  });

  it("treats a settled slip with no settlement time as still visible", () => {
    expect(publicStatusVisible(slip({ status: "SETTLED", settledAt: null }), now)).toBe(true);
  });
});
