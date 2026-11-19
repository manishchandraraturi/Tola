import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerStatusDto } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Public, login-free status endpoint. It is intentionally a read-only view of
// one whitelisted DTO — no relation includes, no ledger text.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, now: number = Date.now()): boolean {
  if (buckets.size > 5000) buckets.clear();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS;
}

function gone() {
  return NextResponse.json(
    { error: "This status link is not available." },
    {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";

  if (rateLimited(`${ip}:${token}`)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // A malformed or unknown token gets the same answer as a revoked one.
  if (!token || token.length > 128) return gone();

  const slip = await db.slip.findUnique({ where: { publicToken: token } });
  if (!slip) return gone();

  // Only kind + timestamp: the ledger's own text never leaves the server here.
  const events = await db.ledgerEntry.findMany({
    where: { slipId: slip.id },
    orderBy: { seq: "asc" },
    select: { kind: true, createdAt: true },
    take: 200,
  });

  const dto = customerStatusDto(slip, events);
  if (!dto) return gone();

  return NextResponse.json(dto, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
