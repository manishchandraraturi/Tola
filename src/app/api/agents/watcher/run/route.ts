import { NextResponse } from "next/server";
import { runWatcher } from "@/lib/notify";
import { getActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Run the Watcher now: message only what has not already gone out today.
// The unique AlertLog key (slip + level + day) keeps re-runs quiet.
export async function POST(req: Request) {
  const actor = await getActor(req);
  if (actor && actor.role !== "jeweller") {
    return NextResponse.json({ error: "Only the jeweller can run the Watcher." }, { status: 403 });
  }

  const origin = new URL(req.url).origin;
  const result = await runWatcher(undefined, undefined, undefined, origin);
  return NextResponse.json({
    ok: true,
    summary:
      result.generated === 0
        ? "All quiet — nothing needs a reminder today."
        : `${result.sent} reminder${result.sent === 1 ? "" : "s"} sent, ${result.skipped} already logged today.`,
    ...result,
  });
}
