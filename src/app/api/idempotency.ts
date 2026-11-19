import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

// P11 — replay-safe mutations. A client retry after reconnect sends the same
// Idempotency-Key; the handler runs once and the stored response is replayed.
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** A claimed key stores this status until the handler finishes. */
export const IDEMPOTENCY_PENDING_STATUS = 102;

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;

export type StoredIdempotentResponse = {
  status: number;
  body: unknown;
};

export type BeginIdempotency =
  | { state: "proceed"; key: string | null }
  | { state: "replay"; key: string; status: number; body: unknown }
  | { state: "in_progress"; key: string };

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === "P2002"
      : (error as { code?: string } | null)?.code === "P2002"
  );
}

function parseStored(raw: string): StoredIdempotentResponse | null {
  try {
    const value = JSON.parse(raw) as { status?: unknown; body?: unknown };
    if (typeof value.status !== "number") return null;
    return { status: value.status, body: value.body };
  } catch {
    return null;
  }
}

export function idempotencyKeyFrom(req: Request): string | null {
  const raw = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!raw) return null;
  return KEY_PATTERN.test(raw) ? raw : null;
}

function replayFrom(row: { key: string; response: string }): BeginIdempotency {
  const stored = parseStored(row.response);
  if (!stored || stored.status === IDEMPOTENCY_PENDING_STATUS) {
    return { state: "in_progress", key: row.key };
  }
  return { state: "replay", key: row.key, status: stored.status, body: stored.body };
}

/**
 * Claim the key before doing any work. A duplicate that arrives while the first
 * request is still running gets "in_progress" rather than a second side effect.
 */
export async function beginIdempotency(
  req: Request,
  client: PrismaClient = db
): Promise<BeginIdempotency> {
  const key = idempotencyKeyFrom(req);
  if (!key) return { state: "proceed", key: null };

  const existing = await client.idempotencyKey.findUnique({ where: { key } });
  if (existing) return replayFrom(existing);

  try {
    await client.idempotencyKey.create({
      data: {
        key,
        response: JSON.stringify({
          status: IDEMPOTENCY_PENDING_STATUS,
          body: { pending: true },
        }),
      },
    });
    return { state: "proceed", key };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await client.idempotencyKey.findUnique({ where: { key } });
    if (!raced) throw error;
    return replayFrom(raced);
  }
}

/** Store the final response for later replays. */
export async function saveIdempotencyResponse(
  key: string | null,
  status: number,
  body: unknown,
  client: PrismaClient = db
): Promise<void> {
  if (!key) return;
  await client.idempotencyKey.update({
    where: { key },
    data: { response: JSON.stringify({ status, body }) },
  });
}

/** Let a failed handler be retried with the same key. */
export async function releaseIdempotency(
  key: string | null,
  client: PrismaClient = db
): Promise<void> {
  if (!key) return;
  await client.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
}
