import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAuditExport, toAuditCsv } from "@/lib/audit";

export const dynamic = "force-dynamic";

// CSV export of the same audit view. The ledger chain is verified at export
// time and the result travels both in the CSV preamble and response headers.
export async function GET() {
  try {
    const slips = await db.slip.findMany({
      orderBy: { number: "asc" },
      include: { karigar: { select: { name: true } }, payment: true },
    });
    const entries = await db.ledgerEntry.findMany({
      orderBy: { seq: "asc" },
      select: {
        seq: true,
        hash: true,
        prevHash: true,
        kind: true,
        text: true,
        slipId: true,
        actor: true,
        createdAt: true,
        proof: true,
      },
    });

    const audit = buildAuditExport(slips, entries);
    const csv = toAuditCsv(audit);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tola-audit-${date}.csv"`,
        "Cache-Control": "no-store",
        "X-Ledger-Chain": audit.chain.ok ? "verified" : "broken",
        "X-Ledger-Checked": String(audit.chain.checked),
        "X-Ledger-Range": audit.range
          ? `${audit.range.from}-${audit.range.to}`
          : "none",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not build the audit export: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
