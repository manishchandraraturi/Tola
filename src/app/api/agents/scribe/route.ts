import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scribeParse, matchKarigar } from "@/lib/tola";

export const dynamic = "force-dynamic";

// Scribe: speak, or snap the scale, in Kannada or Hindi.
// Here we parse a simulated transcription (typed note) into a slip draft.
// Karigar matching lives in lib/tola.ts (pure, unit-tested): full name if
// present, otherwise a first-name match, case-insensitive on word boundaries.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Say or type something first." }, { status: 400 });

  const parsed = scribeParse(text);
  const karigars = await db.karigar.findMany({ orderBy: { createdAt: "asc" } });
  const matched = matchKarigar(text, karigars);

  const missing: string[] = [];
  if (!parsed.weight) missing.push("weight (say it like '25.4 grams')");
  if (!parsed.purity) missing.push("purity (say it like '22K')");
  if (!parsed.due) missing.push("due date (say it like 'due 12 Nov')");
  if (!matched) missing.push("karigar name (say it like 'for Ravi Kumar')");

  const heard =
    `Heard: ${parsed.weight ? `${parsed.weight} g` : "weight not caught"}, ` +
    `${parsed.purity ?? "purity not caught"}, ` +
    `${parsed.job ? `job "${parsed.job}"` : "job not named"}, ` +
    `${matched ? `for ${matched.name}` : "karigar not named"}, ` +
    `${parsed.wedding ? "wedding order" : "regular order"}, ` +
    `${parsed.due ? `due ${new Date(parsed.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "due date not caught"}` +
    (parsed.wastage ? `, wastage ${parsed.wastage}%` : "") +
    ".";

  return NextResponse.json({
    parsed,
    karigarId: matched?.id ?? null,
    karigarName: matched?.name ?? null,
    heard,
    missing,
    note: missing.length
      ? `I filled what I could. Please add: ${missing.join(", ")}.`
      : "Slip filled. Check the numbers with the karigar before you tap.",
  });
}
